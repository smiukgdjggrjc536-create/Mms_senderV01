import mongoose from 'mongoose';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  checkRateLimit,
  recordRateHit,
  sleep,
  batchArray,
  executeRealSend,
  sendWithRetry,
  scoreSpamHeuristic,
  geminiSpamReview,
  aiRankSenderApis,
  enforceCountryRules,
} from './sendingEngine.js';

// ============================================================================
// MongoDB Connection (global caching pattern)
// ============================================================================

const ENV_MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/sms_campaign_db';

const cached = { conn: null, promise: null };

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose
      .connect(ENV_MONGODB_URI, opts)
      .then(async (mongooseInstance) => {
        try {
          const MongoConnectionModel =
            mongoose.models.MongoConnection ||
            mongoose.model(
              'MongoConnection',
              new mongoose.Schema({
                label: { type: String, required: true },
                uri: { type: String, required: true },
                isActive: { type: Boolean, default: false },
                createdAt: { type: Date, default: Date.now },
              })
            );

          const active = await MongoConnectionModel.findOne({ isActive: true });
          if (active && active.uri && active.uri !== ENV_MONGODB_URI) {
            await mongoose.disconnect();
            return mongoose.connect(active.uri, opts);
          }
        } catch (err) {
          // continue with ENV URI
        }
        return mongooseInstance;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}

async function reconnectDB(newUri) {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  } catch (e) {
    // ignore
  }
  cached.conn = null;
  cached.promise = mongoose
    .connect(newUri, { bufferCommands: false })
    .then((instance) => instance);
  cached.conn = await cached.promise;
  return cached.conn;
}

// ============================================================================
// JWT Helpers (using jose library)
// ============================================================================

function getJWTSecret() {
  const secret =
    process.env.JWT_SECRET ||
    'default_dev_secret_change_this_in_production_minimum_32_chars_long_2024';
  return new TextEncoder().encode(secret);
}

async function createToken(payload) {
  const secret = getJWTSecret();
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(secret);
  return token;
}

async function verifyToken(token) {
  try {
    const secret = getJWTSecret();
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (err) {
    return null;
  }
}

// ============================================================================
// Password Handling (using bcryptjs)
// ============================================================================

async function hashPassword(password) {
  return await bcrypt.hash(password, 12);
}

async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

// ============================================================================
// Random Generators (for admin credentials)
// ============================================================================

function generateRandomUsername() {
  const prefix = 'admin';
  const random = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${random}`;
}

function generateRandomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  const bytes = crypto.randomBytes(16);
  for (let i = 0; i < 16; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

function generateRandomApiKey() {
  return 'sk_' + crypto.randomBytes(20).toString('hex');
}

function generateVerificationCode() {
  // 6-digit code
  return String(crypto.randomInt(100000, 999999));
}

// ============================================================================
// Mongoose Schemas
// ============================================================================

// --- User Schema (for USER PANEL on Vercel) ---
const userSchema = new mongoose.Schema({
  // New enterprise login ID: 4 letters + 2 digits (e.g. "SAMU01"), no @ symbol
  userId: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
  // Legacy email field — kept for backward compatibility with existing accounts (no longer required)
  email: { type: String, unique: true, sparse: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  sendingLimit: { type: Number, default: 100 },
  sentCount: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  // Enterprise fields
  expiryDate: { type: Date, default: null }, // account expiry/meyad
  lastActiveAt: { type: Date, default: Date.now },
  lastSendAt: { type: Date, default: null },
  ipAddress: { type: String, default: null },
  inboxRate: { type: Number, default: 0 }, // percentage
  spamRate: { type: Number, default: 0 },
  invalidHits: { type: Number, default: 0 },
  totalInbox: { type: Number, default: 0 },
  totalSpam: { type: Number, default: 0 },
  totalDelivered: { type: Number, default: 0 },
  totalUndelivered: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  // Only hash if it's a plain text password (not already hashed)
  if (!this.password.startsWith('$2a$') && !this.password.startsWith('$2b$')) {
    this.password = await hashPassword(this.password);
  }
});

// --- AdminCredential Schema (3-layer security + email for verification) ---
const adminCredentialSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, default: null }, // for mail verification
  passwordHash: { type: String, required: true },
  apiKey: { type: String, required: true },
  role: { type: String, enum: ['superadmin', 'subadmin'], default: 'superadmin' },
  permissions: { type: [String], default: ['all'] }, // access control for subadmin
  updatedAt: { type: Date, default: Date.now },
});

// --- Config Schema (key-value config store) ---
const configSchema = new mongoose.Schema({
  keyName: { type: String, required: true, unique: true },
  keyValue: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now },
});

// --- Campaign Schema ---
const campaignSchema = new mongoose.Schema({
  userEmail: { type: String, required: true, lowercase: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  message: { type: String },
  numbers: { type: [String] },
  validNumbers: { type: [String], default: [] },
  invalidNumbers: { type: [String], default: [] },
  status: { type: String, enum: ['pending', 'running', 'sent', 'partial', 'blocked', 'blocked_spam', 'failed', 'queued'], default: 'pending' },
  aiVerdict: { type: String },
  aiSuggestion: { type: String },
  spamScore: { type: Number, default: 0 },
  spamLevel: { type: String, default: null },
  country: { type: String, default: null },
  countryCode: { type: String, default: null },
  batchSize: { type: Number, default: 5 },
  delayMs: { type: Number, default: 1200 },
  totalSent: { type: Number, default: 0 },
  totalDelivered: { type: Number, default: 0 },
  totalUndelivered: { type: Number, default: 0 },
  totalInvalid: { type: Number, default: 0 },
  totalInbox: { type: Number, default: 0 },
  totalSpam: { type: Number, default: 0 },
  senderApiId: { type: mongoose.Schema.Types.ObjectId, ref: 'SenderApi', default: null },
  senderApiName: { type: String, default: null },
  geminiApiId: { type: mongoose.Schema.Types.ObjectId, ref: 'GeminiApi', default: null },
  templateUsed: { type: String, default: null },
  sendType: { type: String, enum: ['manual', 'preset', 'ai_suggested', 'auto_new'], default: 'manual' },
  createdAt: { type: Date, default: Date.now },
});

// --- MongoConnection Schema (multi-database support) ---
const mongoConnectionSchema = new mongoose.Schema({
  label: { type: String, required: true },
  uri: { type: String, required: true },
  isActive: { type: Boolean, default: false },
  storageUsed: { type: Number, default: 0 }, // in MB
  storageLimit: { type: Number, default: 512 }, // free tier default
  createdAt: { type: Date, default: Date.now },
});

// --- SenderApi Schema (multiple sender APIs, up to 10) ---
const senderApiSchema = new mongoose.Schema({
  name: { type: String, required: true },
  provider: { type: String, default: 'custom' }, // twilio, vonage, custom, etc.
  apiKey: { type: String, required: true },
  apiSecret: { type: String, default: '' },
  endpoint: { type: String, default: '' },
  senderId: { type: String, default: '' },
  limit: { type: Number, default: 1000 }, // total limit
  used: { type: Number, default: 0 }, // how many sent
  remaining: { type: Number, default: 1000 },
  status: { type: String, enum: ['active', 'blocked', 'warning', 'exhausted'], default: 'active' },
  inboxRate: { type: Number, default: 0 }, // percentage inbox
  spamRate: { type: Number, default: 0 }, // percentage spam
  totalSent: { type: Number, default: 0 },
  totalInbox: { type: Number, default: 0 },
  totalSpam: { type: Number, default: 0 },
  priority: { type: Number, default: 0 }, // higher = preferred
  autoRoute: { type: Boolean, default: true }, // auto routing enabled
  lastUsedAt: { type: Date, default: null },
  lastError: { type: String, default: null },
  healthScore: { type: Number, default: 100 }, // 0-100
  createdAt: { type: Date, default: Date.now },
});

// --- GeminiApi Schema (multiple Gemini APIs, up to 10) ---
const geminiApiSchema = new mongoose.Schema({
  name: { type: String, required: true },
  apiKey: { type: String, required: true },
  model: { type: String, default: 'gemini-2.5-flash' },
  endpoint: { type: String, default: 'https://generativelanguage.googleapis.com/v1beta/models' },
  limit: { type: Number, default: 1500 }, // requests per day free tier
  used: { type: Number, default: 0 },
  remaining: { type: Number, default: 1500 },
  status: { type: String, enum: ['active', 'blocked', 'warning', 'exhausted'], default: 'active' },
  priority: { type: Number, default: 0 },
  autoRoute: { type: Boolean, default: true },
  lastUsedAt: { type: Date, default: null },
  lastError: { type: String, default: null },
  healthScore: { type: Number, default: 100 },
  createdAt: { type: Date, default: Date.now },
});

// --- MessageTemplate Schema (presets by type) ---
const messageTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['payment', 'marketing', 'promo', 'order', 'crypto', 'custom'], default: 'custom' },
  content: { type: String, required: true },
  variables: { type: [String], default: [] }, // e.g. {name}, {amount}
  isPreset: { type: Boolean, default: true },
  createdBy: { type: String, default: 'admin' }, // admin or user email
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

// --- ContentAsset Schema (logos, photos for sending/module) ---
const contentAssetSchema = new mongoose.Schema({
  type: { type: String, enum: ['logo', 'photo', 'media'], default: 'photo' },
  name: { type: String, required: true },
  data: { type: String, default: '' }, // base64 or URL
  url: { type: String, default: '' },
  purpose: { type: String, default: 'sending' }, // sending, module_logo, etc.
  mimeType: { type: String, default: 'image/png' },
  size: { type: Number, default: 0 }, // bytes
  createdBy: { type: String, default: 'admin' },
  createdAt: { type: Date, default: Date.now },
});

// --- ActivityLog Schema (track all actions) ---
const activityLogSchema = new mongoose.Schema({
  actorId: { type: String, default: null },
  actorType: { type: String, enum: ['admin', 'subadmin', 'user'], default: 'user' },
  actorEmail: { type: String, default: '' },
  action: { type: String, required: true },
  details: { type: String, default: '' },
  ipAddress: { type: String, default: null },
  timestamp: { type: Date, default: Date.now },
});

// --- Blacklist Schema (blocked numbers) ---
const blacklistSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  reason: { type: String, default: 'spam' },
  addedBy: { type: String, default: 'admin' },
  createdAt: { type: Date, default: Date.now },
});

// --- DeliveryReport Schema (per-send details) ---
const deliveryReportSchema = new mongoose.Schema({
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', default: null },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  userEmail: { type: String, default: '' },
  number: { type: String, required: true },
  status: { type: String, enum: ['sent', 'delivered', 'undelivered', 'invalid', 'spam', 'pending', 'queued', 'failed'], default: 'pending' },
  country: { type: String, default: null },
  countryCode: { type: String, default: null },
  senderApiId: { type: String, default: null },
  senderApiName: { type: String, default: null },
  provider: { type: String, default: null },
  providerMsgId: { type: String, default: null },
  errorCode: { type: String, default: null },
  attempts: { type: Number, default: 0 },
  batchIndex: { type: Number, default: 0 },
  errorMessage: { type: String, default: null },
  sentAt: { type: Date, default: Date.now },
  deliveredAt: { type: Date, default: null },
});

deliveryReportSchema.index({ campaignId: 1, status: 1 });
deliveryReportSchema.index({ userEmail: 1, sentAt: -1 });
deliveryReportSchema.index({ providerMsgId: 1 }, { sparse: true });

// --- AppSettings Schema (platform configuration) ---
const appSettingsSchema = new mongoose.Schema({
  platformName: { type: String, default: 'MMS Sender' },
  logoUrl: { type: String, default: '' },
  description: { type: String, default: 'Professional MMS Sending Platform' },
  whatsapp: { type: String, default: '' },
  email: { type: String, default: '' },
  language: { type: String, enum: ['bn', 'en', 'syl'], default: 'en' },
  refreshEnabled: { type: Boolean, default: true },
  alertEmail: { type: String, default: '' },
  alertWhatsapp: { type: String, default: '' },
  alertWhatsappApiKey: { type: String, default: '' },
  alertEmailApiKey: { type: String, default: '' },
  alertEmailFrom: { type: String, default: 'alerts@mms-sender.local' },
  alertOnCrash: { type: Boolean, default: true },
  alertOnApiDown: { type: Boolean, default: true },
  alertOnError: { type: Boolean, default: true },
  spamProtection: { type: Boolean, default: true },
  countryRules: { type: String, default: '' }, // JSON string of country rules
  rateLimitPerMinute: { type: Number, default: 10 },
  rateLimitPerHour: { type: Number, default: 100 },
  defaultUserLimit: { type: Number, default: 100 },
  defaultUserExpiryDays: { type: Number, default: 30 },
  updatedAt: { type: Date, default: Date.now },
});

// --- VerificationCode Schema (for mail verification) ---
const verificationCodeSchema = new mongoose.Schema({
  email: { type: String, required: true },
  code: { type: String, required: true },
  purpose: { type: String, default: 'password_change' }, // password_change, admin_change, etc.
  used: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});

// --- ScheduledSend Schema (schedule sends) ---
const scheduledSendSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  userEmail: { type: String, required: true },
  message: { type: String, required: true },
  numbers: { type: [String], required: true },
  scheduledAt: { type: Date, required: true },
  status: { type: String, enum: ['scheduled', 'sent', 'cancelled'], default: 'scheduled' },
  templateUsed: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

// --- AutoReplyConfig Schema (per-user SMS auto-reply with language selection) ---
// When an SMS is received, the system first sends a language-selection prompt.
// The sender replies with 1/2/3 (Bangla/English/Sylheti), then gets the configured reply.
const autoReplyConfigSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  userEmail: { type: String, default: '' },
  enabled: { type: Boolean, default: false },
  // The initial prompt sent when any SMS is received (asks the sender to choose a language)
  languagePrompt: {
    bn: { type: String, default: 'আমাদের সাথে যোগাযোগের জন্য ধন্যবাদ। ভাষা নির্বাচন করুন:\n1 - বাংলা\n2 - English\n3 - সিলেটি\n(Reply with 1, 2 or 3)' },
    en: { type: String, default: 'Thanks for contacting us. Choose your language:\n1 - Bangla\n2 - English\n3 - Sylheti\n(Reply with 1, 2 or 3)' },
  },
  // The actual auto-reply message for each language (sent after the sender picks a language)
  replyMessage: {
    bn: { type: String, default: 'আসসালামু আলাইকুম। আমরা আপনার বার্তা পেয়েছি। আমাদের প্রতিনিধি শীঘ্রই আপনার সাথে যোগাযোগ করবে। ধন্যবাদ।' },
    en: { type: String, default: 'Hello! We have received your message. Our representative will contact you shortly. Thank you.' },
    syl: { type: String, default: 'আসসালামু আলাইকুম। আমরা আপনার খবর পাইছি। আমাগো প্রতিনিধি অইগো তোমার লগে যোগাযোগ করমু। ধন্যবাদ।' },
  },
  updatedAt: { type: Date, default: Date.now },
});

// --- SmsInbound Schema (log of received SMS + language selection state) ---
const smsInboundSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  userEmail: { type: String, default: '' },
  fromNumber: { type: String, required: true },
  incomingMessage: { type: String, default: '' },
  // State machine: 'awaiting_language' = sent prompt, waiting for 1/2/3; 'replied' = sent final reply
  state: { type: String, enum: ['awaiting_language', 'replied', 'direct'], default: 'awaiting_language' },
  selectedLanguage: { type: String, enum: ['bn', 'en', 'syl', null], default: null },
  replySent: { type: String, default: '' },
  receivedAt: { type: Date, default: Date.now },
});
smsInboundSchema.index({ userId: 1, fromNumber: 1, receivedAt: -1 });

// ============================================================================
// Export models (with caching to prevent recompilation)
// ============================================================================

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Config = mongoose.models.Config || mongoose.model('Config', configSchema);
const Campaign = mongoose.models.Campaign || mongoose.model('Campaign', campaignSchema);
const MongoConnection = mongoose.models.MongoConnection || mongoose.model('MongoConnection', mongoConnectionSchema);
const AdminCredential = mongoose.models.AdminCredential || mongoose.model('AdminCredential', adminCredentialSchema);
const SenderApi = mongoose.models.SenderApi || mongoose.model('SenderApi', senderApiSchema);
const GeminiApi = mongoose.models.GeminiApi || mongoose.model('GeminiApi', geminiApiSchema);
const MessageTemplate = mongoose.models.MessageTemplate || mongoose.model('MessageTemplate', messageTemplateSchema);
const ContentAsset = mongoose.models.ContentAsset || mongoose.model('ContentAsset', contentAssetSchema);
const ActivityLog = mongoose.models.ActivityLog || mongoose.model('ActivityLog', activityLogSchema);
const Blacklist = mongoose.models.Blacklist || mongoose.model('Blacklist', blacklistSchema);
const DeliveryReport = mongoose.models.DeliveryReport || mongoose.model('DeliveryReport', deliveryReportSchema);
const AppSettings = mongoose.models.AppSettings || mongoose.model('AppSettings', appSettingsSchema);
const VerificationCode = mongoose.models.VerificationCode || mongoose.model('VerificationCode', verificationCodeSchema);
const ScheduledSend = mongoose.models.ScheduledSend || mongoose.model('ScheduledSend', scheduledSendSchema);
const AutoReplyConfig = mongoose.models.AutoReplyConfig || mongoose.model('AutoReplyConfig', autoReplyConfigSchema);
const SmsInbound = mongoose.models.SmsInbound || mongoose.model('SmsInbound', smsInboundSchema);

// ============================================================================
// Admin Credential Management
// ============================================================================

async function ensureAdminCredentials() {
  const existing = await AdminCredential.countDocuments();
  if (existing > 0) {
    return null;
  }

  const username = generateRandomUsername();
  const password = generateRandomPassword();
  const apiKey = generateRandomApiKey();
  const passwordHash = await hashPassword(password);

  await AdminCredential.create({
    username,
    passwordHash,
    apiKey,
  });

  return { username, password, apiKey };
}

async function verifyAdminLogin(username, password, apiKey) {
  const admin = await AdminCredential.findOne({ username });
  if (!admin) {
    return { success: false, error: 'Invalid credentials' };
  }

  const passwordMatch = await comparePassword(password, admin.passwordHash);
  if (!passwordMatch) {
    return { success: false, error: 'Invalid credentials' };
  }

  if (admin.apiKey !== apiKey) {
    return { success: false, error: 'Invalid API key' };
  }

  return { success: true, admin };
}

async function getAdminCredentialsInfo() {
  const admin = await AdminCredential.findOne({ role: 'superadmin' }) || await AdminCredential.findOne({});
  if (!admin) {
    return null;
  }
  return {
    username: admin.username,
    email: admin.email,
    apiKeyMasked: admin.apiKey.substring(0, 6) + '••••••••••••••••••••',
    passwordSet: true,
    role: admin.role,
    permissions: admin.permissions,
    updatedAt: admin.updatedAt,
  };
}

async function updateAdminUsername(newUsername) {
  const admin = await AdminCredential.findOne({ role: 'superadmin' }) || await AdminCredential.findOne({});
  if (!admin) {
    return { success: false, error: 'Admin not found' };
  }
  const existing = await AdminCredential.findOne({
    username: newUsername,
    _id: { $ne: admin._id },
  });
  if (existing) {
    return { success: false, error: 'Username already taken' };
  }
  admin.username = newUsername;
  admin.updatedAt = new Date();
  await admin.save();
  return { success: true };
}

async function updateAdminPassword(newPassword) {
  const admin = await AdminCredential.findOne({ role: 'superadmin' }) || await AdminCredential.findOne({});
  if (!admin) {
    return { success: false, error: 'Admin not found' };
  }
  admin.passwordHash = await hashPassword(newPassword);
  admin.updatedAt = new Date();
  await admin.save();
  return { success: true };
}

async function updateAdminApiKey() {
  const admin = await AdminCredential.findOne({ role: 'superadmin' }) || await AdminCredential.findOne({});
  if (!admin) {
    return { success: false, error: 'Admin not found' };
  }
  const newKey = generateRandomApiKey();
  admin.apiKey = newKey;
  admin.updatedAt = new Date();
  await admin.save();
  return { success: true, apiKey: newKey };
}

async function updateAdminEmail(email) {
  const admin = await AdminCredential.findOne({ role: 'superadmin' }) || await AdminCredential.findOne({});
  if (!admin) {
    return { success: false, error: 'Admin not found' };
  }
  admin.email = email;
  admin.updatedAt = new Date();
  await admin.save();
  return { success: true };
}

// Sub-admin management
async function createSubAdmin(username, password, apiKey, permissions) {
  const existing = await AdminCredential.findOne({ username });
  if (existing) {
    return { success: false, error: 'Username already exists' };
  }
  const passwordHash = await hashPassword(password);
  const sub = await AdminCredential.create({
    username,
    passwordHash,
    apiKey,
    role: 'subadmin',
    permissions: permissions || ['dashboard', 'users'],
  });
  return { success: true, id: sub._id };
}

async function getSubAdmins() {
  return await AdminCredential.find({ role: 'subadmin' }).select('-passwordHash -apiKey');
}

async function updateSubAdminPermissions(id, permissions) {
  const sub = await AdminCredential.findById(id);
  if (!sub || sub.role !== 'subadmin') {
    return { success: false, error: 'Sub-admin not found' };
  }
  sub.permissions = permissions;
  sub.updatedAt = new Date();
  await sub.save();
  return { success: true };
}

async function deleteSubAdmin(id) {
  const sub = await AdminCredential.findById(id);
  if (!sub || sub.role !== 'subadmin') {
    return { success: false, error: 'Sub-admin not found' };
  }
  await AdminCredential.findByIdAndDelete(id);
  return { success: true };
}

// ============================================================================
// Verification Code Management (for email verification)
// ============================================================================

async function createVerificationCode(email, purpose) {
  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  await VerificationCode.create({ email, code, purpose, expiresAt });
  return code;
}

async function verifyCode(email, code, purpose) {
  const record = await VerificationCode.findOne({
    email,
    code,
    purpose,
    used: false,
    expiresAt: { $gt: new Date() },
  });
  if (!record) {
    return { success: false, error: 'Invalid or expired code' };
  }
  record.used = true;
  await record.save();
  return { success: true };
}

// ============================================================================
// Sender API Management (auto-routing)
// ============================================================================

// Get the best sender API based on inbox rate, health, remaining quota, and priority
async function getBestSenderApi() {
  const apis = await SenderApi.find({ status: 'active', autoRoute: true }).sort({
    healthScore: -1,
    inboxRate: -1,
    priority: -1,
    remaining: -1,
  });
  if (apis.length === 0) {
    // Try without autoRoute filter
    const anyActive = await SenderApi.find({ status: 'active' }).sort({
      healthScore: -1,
      inboxRate: -1,
      priority: -1,
      remaining: -1,
    });
    return anyActive[0] || null;
  }
  return apis[0];
}

// Get best Gemini API
async function getBestGeminiApi() {
  const apis = await GeminiApi.find({ status: 'active', autoRoute: true }).sort({
    healthScore: -1,
    priority: -1,
    remaining: -1,
  });
  if (apis.length === 0) {
    const anyActive = await GeminiApi.find({ status: 'active' }).sort({
      healthScore: -1,
      priority: -1,
      remaining: -1,
    });
    return anyActive[0] || null;
  }
  return apis[0];
}

// Update sender API usage after sending
async function updateSenderApiUsage(apiId, sentCount, inboxCount, spamCount) {
  const api = await SenderApi.findById(apiId);
  if (!api) return;
  api.used += sentCount;
  api.remaining = Math.max(0, api.limit - api.used);
  api.totalSent += sentCount;
  api.totalInbox += inboxCount;
  api.totalSpam += spamCount;
  api.lastUsedAt = new Date();
  // Calculate rates
  if (api.totalSent > 0) {
    api.inboxRate = Math.round((api.totalInbox / api.totalSent) * 100);
    api.spamRate = Math.round((api.totalSpam / api.totalSent) * 100);
  }
  // Health score based on inbox rate and remaining
  api.healthScore = Math.round(
    (api.inboxRate * 0.6) + ((api.remaining / api.limit) * 100 * 0.4)
  );
  // Status checks
  if (api.remaining <= 0) {
    api.status = 'exhausted';
  } else if (api.remaining < api.limit * 0.1) {
    api.status = 'warning';
  }
  await api.save();
}

// Update Gemini API usage
async function updateGeminiApiUsage(apiId, requestCount) {
  const api = await GeminiApi.findById(apiId);
  if (!api) return;
  api.used += requestCount;
  api.remaining = Math.max(0, api.limit - api.used);
  api.lastUsedAt = new Date();
  if (api.remaining <= 0) {
    api.status = 'exhausted';
  } else if (api.remaining < api.limit * 0.1) {
    api.status = 'warning';
  }
  await api.save();
}

// ============================================================================
// SHARED GEMINI CALL HELPER
// ----------------------------------------------------------------------------
// A single robust entry point for ALL Gemini API calls across the app.
// Handles:
//   • API-key format validation (must start with "AIza")
//   • Automatic model fallback on 404 (tries a list of known-good models)
//   • Clear, structured error objects with human-readable hints
//   • Auto-updates the DB record to the working model
//   • Records lastError on the GeminiApi document for admin diagnostics
// Usage:
//   const result = await callGemini(geminiApi, promptText, { temperature, maxOutputTokens });
//   if (result.ok) { result.text } else { result.error, result.status, result.hint }
// ============================================================================
const GEMINI_FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest'];

async function callGemini(geminiApi, promptText, opts = {}) {
  if (!geminiApi) {
    return { ok: false, status: 0, error: 'No Gemini API configured', hint: 'Admin must add a Gemini API key in API Management.' };
  }
  // Validate key format — real Gemini keys start with "AIza"
  if (!geminiApi.apiKey || !geminiApi.apiKey.startsWith('AIza')) {
    const msg = `Gemini API key format looks invalid (should start with "AIzaSy..."). Current key starts with "${(geminiApi.apiKey || '').substring(0, 8)}..."`;
    await GeminiApi.findByIdAndUpdate(geminiApi._id, { lastError: msg }).catch(() => {});
    return {
      ok: false, status: 400, error: msg,
      hint: 'Get a FREE valid key from https://aistudio.google.com/apikey — then update it in Admin Panel → API Management → Gemini.',
    };
  }
  const temperature = opts.temperature ?? 0.7;
  const maxOutputTokens = opts.maxOutputTokens ?? 1024;
  const endpoint = geminiApi.endpoint || 'https://generativelanguage.googleapis.com/v1beta/models';

  // Build the candidate model list: the configured model first, then fallbacks (deduped)
  const modelList = [];
  if (geminiApi.model) modelList.push(geminiApi.model);
  for (const m of GEMINI_FALLBACK_MODELS) {
    if (!modelList.includes(m)) modelList.push(m);
  }

  let lastStatus = 0;
  let lastErrBody = '';
  for (const model of modelList) {
    const url = `${endpoint}/${model}:generateContent?key=${geminiApi.apiKey}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { temperature, maxOutputTokens },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text) {
          // If we fell back to a different model, persist it so future calls are fast
          if (model !== geminiApi.model) {
            await GeminiApi.findByIdAndUpdate(geminiApi._id, { model, lastError: null }).catch(() => {});
          } else {
            await GeminiApi.findByIdAndUpdate(geminiApi._id, { lastError: null }).catch(() => {});
          }
          return { ok: true, text, model };
        }
        lastStatus = res.status;
        lastErrBody = 'Empty response from model';
        continue;
      }
      lastStatus = res.status;
      lastErrBody = await res.text().catch(() => '');
      // 404 = model not found → try next model in the list
      if (res.status === 404) continue;
      // For 400/403/429 the issue is the key or quota, not the model — stop trying other models
      if (res.status === 400 || res.status === 403 || res.status === 429) break;
      // Other errors — try next model as a last resort
      continue;
    } catch (e) {
      lastStatus = 0;
      lastErrBody = e.message;
      continue;
    }
  }

  // All models failed — build a helpful error
  let hint = '';
  if (lastStatus === 403) hint = 'API key is invalid or the Generative Language API is not enabled for this key. Get a new key from https://aistudio.google.com/apikey';
  else if (lastStatus === 400) hint = 'Bad request — usually means the API key format is wrong. It must start with "AIzaSy...". Get one from https://aistudio.google.com/apikey';
  else if (lastStatus === 429) hint = 'Rate limit / quota exceeded. Wait a moment or add another Gemini API key.';
  else if (lastStatus === 404) hint = `Tried models [${modelList.join(', ')}] but all returned 404. The API key may be invalid. Get a free key from https://aistudio.google.com/apikey`;
  else hint = 'Network or unknown error. Check the endpoint URL and try again. Get a valid key from https://aistudio.google.com/apikey';

  const errorMsg = `Gemini request failed (HTTP ${lastStatus || 'network'}). ${lastErrBody.slice(0, 200)}`;
  await GeminiApi.findByIdAndUpdate(geminiApi._id, { lastError: errorMsg.slice(0, 300) }).catch(() => {});
  return { ok: false, status: lastStatus, error: errorMsg, hint, model: geminiApi.model };
}

// ============================================================================
// REAL BULK SEND ENGINE
// ----------------------------------------------------------------------------
// This is the enterprise-grade bulk sending core. It:
//   1. Scores the message for spam (heuristic + optional Gemini AI, 50/50).
//   2. Blocks high-spam messages when spamProtection is on (spam-free guard).
//   3. Uses AI to rank available sender APIs by inbox quality (with fallback).
//   4. Sends in configurable batches with throttling between batches.
//   5. Applies per-minute / per-hour rate limits per sender API.
//   6. Retries transient failures with exponential backoff (terminal errors skip).
//   7. Auto-routes to the next-best API if the current one exhausts or fails hard.
//   8. Writes a DeliveryReport per number with provider, providerMsgId, errorCode.
//   9. Updates sender API usage + health score after the campaign.
//  10. Updates the campaign document live so the UI can poll progress.
// ============================================================================

async function bulkSendEngine(opts) {
  const {
    user,
    message,
    numbers,
    invalidNumbers = [],
    countryInfo,
    geminiApi,
    campaign,
    appSettings,
    options = {},
  } = opts;

  const batchSize = options.batchSize || 5;
  const delayMs = options.delayMs || 1200;
  const mediaUrl = options.mediaUrl || null;
  const perMinute = options.perMinute || (appSettings && appSettings.rateLimitPerMinute) || 0;
  const perHour = options.perHour || (appSettings && appSettings.rateLimitPerHour) || 0;
  const maxRetries = options.maxRetries != null ? options.maxRetries : 2;

  // ── 1. Spam scoring (heuristic + optional Gemini AI) ──────────────────────
  const heuristic = scoreSpamHeuristic(message);
  const spamReasons = [...(heuristic.reasons || [])];

  let aiReview = null;
  if (geminiApi) {
    aiReview = await geminiSpamReview(message, geminiApi);
    if (aiReview && aiReview.spam_score != null) {
      await updateGeminiApiUsage(geminiApi._id, 1);
      if (aiReview.suggestion) spamReasons.push('AI: ' + aiReview.suggestion);
    }
  }

  let spamScore = heuristic.score;
  if (aiReview && aiReview.spam_score != null) {
    spamScore = Math.round(heuristic.score * 0.5 + aiReview.spam_score * 0.5);
  }
  const spamLevel = spamScore >= 60 ? 'high' : spamScore >= 30 ? 'moderate' : 'clean';

  // ── SPAM-FREE GUARD: block high-spam content when protection is on ────────
  if (appSettings && appSettings.spamProtection && spamLevel === 'high') {
    campaign.status = 'blocked_spam';
    campaign.aiVerdict = 'spam_blocked';
    campaign.aiSuggestion = spamReasons.join('; ');
    campaign.spamScore = spamScore;
    campaign.spamLevel = spamLevel;
    await campaign.save();
    return {
      blocked: true,
      spamScore,
      spamLevel,
      spamReasons,
      aiReview,
      totalSent: 0,
      totalDelivered: 0,
      totalUndelivered: 0,
      totalInvalid: invalidNumbers.length,
      invalidNumbers,
      deliveryReports: [],
    };
  }

  // ── 2. AI routing — rank sender APIs by inbox quality ─────────────────────
  let allApis = await SenderApi.find({ status: 'active' }).sort({ healthScore: -1 }).lean();
  if (allApis.length === 0) {
    campaign.status = 'failed';
    campaign.aiVerdict = 'no_sender_api';
    campaign.aiSuggestion = 'No active sender API configured. Add one in Admin → API Management.';
    campaign.spamScore = spamScore;
    await campaign.save();
    return {
      blocked: false,
      error: 'no_sender_api',
      spamScore,
      spamLevel,
      spamReasons,
      aiReview,
      totalSent: 0,
      totalDelivered: 0,
      totalUndelivered: 0,
      totalInvalid: invalidNumbers.length,
      invalidNumbers,
      deliveryReports: [],
    };
  }

  // Try AI ranking; fall back to deterministic sort on failure
  let rankedApis = allApis;
  if (geminiApi) {
    try {
      const aiRanked = await aiRankSenderApis(allApis, message, geminiApi);
      if (aiRanked && Array.isArray(aiRanked) && aiRanked.length > 0) {
        rankedApis = aiRanked;
      }
    } catch (_e) {
      // keep deterministic fallback
    }
  }

  // Build a mutable lookup so we can fetch fresh docs during auto-routing
  const apiMap = new Map();
  for (const a of rankedApis) apiMap.set(String(a._id), a);

  // ── 3. Prepare campaign state ─────────────────────────────────────────────
  campaign.status = 'running';
  campaign.spamScore = spamScore;
  campaign.spamLevel = spamLevel;
  campaign.batchSize = batchSize;
  campaign.delayMs = delayMs;
  campaign.totalInvalid = invalidNumbers.length;
  await campaign.save();

  const deliveryReports = [];
  let totalSent = 0;
  let totalDelivered = 0;
  let totalUndelivered = 0;
  const apisUsed = new Set();
  let currentApiIndex = 0;
  let senderApiUsed = rankedApis[0] ? rankedApis[0].name : null;

  // Helper to get a fresh API doc by id (so we always read latest remaining/health)
  async function getApiDoc(id) {
    return await SenderApi.findById(id);
  }

  // Advance to the next-best API when the current one is exhausted / blocked
  function advanceApi() {
    currentApiIndex++;
    if (currentApiIndex < rankedApis.length) {
      senderApiUsed = rankedApis[currentApiIndex].name;
      return true;
    }
    return false;
  }

  // ── 4. Send in batches with throttling + retry + rate limiting ────────────
  let batchIndex = 0;
  for (const batch of batchArray(numbers, batchSize)) {
    // Pick the current sender API (fresh doc)
    let apiDoc = null;
    let apiId = null;
    while (currentApiIndex < rankedApis.length) {
      apiId = String(rankedApis[currentApiIndex]._id);
      apiDoc = await getApiDoc(apiId);
      if (!apiDoc) {
        if (!advanceApi()) break;
        continue;
      }
      if (apiDoc.status !== 'active' || apiDoc.remaining <= 0) {
        if (!advanceApi()) break;
        continue;
      }
      break;
    }

    // No more APIs available — mark remaining numbers as undelivered
    if (!apiDoc) {
      for (const num of batch) {
        deliveryReports.push({
          campaignId: campaign._id,
          userId: user._id,
          userEmail: user.email,
          number: num,
          status: 'failed',
          errorMessage: 'No available sender API',
          batchIndex,
        });
        totalUndelivered++;
      }
      batchIndex++;
      continue;
    }

    apisUsed.add(apiDoc.name);
    senderApiUsed = apiDoc.name;

    // Enforce rate limits (wait if needed)
    const rate = checkRateLimit(apiId, perMinute, perHour);
    if (!rate.allowed) {
      await sleep(rate.waitMs);
    }

    // Send each number in the batch
    for (const number of batch) {
      // Country rule enforcement
      if (appSettings && appSettings.countryRules) {
        const cRes = enforceCountryRules(number, appSettings.countryRules);
        if (cRes.blocked) {
          deliveryReports.push({
            campaignId: campaign._id,
            userId: user._id,
            userEmail: user.email,
            number,
            status: 'invalid',
            errorMessage: cRes.reason || 'Blocked by country rule',
            batchIndex,
          });
          totalUndelivered++;
          continue;
        }
      }

      recordRateHit(apiId);

      const result = await sendWithRetry(apiDoc, number, message, mediaUrl, maxRetries);
      totalSent++;

      const dr = {
        campaignId: campaign._id,
        userId: user._id,
        userEmail: user.email,
        number,
        status: result.success ? 'sent' : 'failed',
        senderApiId: String(apiDoc._id),
        senderApiName: apiDoc.name,
        provider: apiDoc.provider,
        providerMsgId: result.providerMsgId || null,
        errorCode: result.errorCode || null,
        attempts: result.attempts || (result.success ? 1 : maxRetries + 1),
        batchIndex,
        errorMessage: result.errorMessage || null,
        sentAt: new Date(),
      };

      if (result.success) {
        totalDelivered++;
      } else {
        totalUndelivered++;
        // If this is a hard/terminal failure, consider auto-routing
        if (result.terminal && apiDoc.remaining <= 0) {
          advanceApi();
        }
      }

      deliveryReports.push(dr);

      // Update sender API usage incrementally (every send)
      await updateSenderApiUsage(apiDoc._id, 1, result.success ? 1 : 0, 0);

      // Refresh apiDoc so we have the latest remaining/status for the next send
      apiDoc = await getApiDoc(apiId);
      if (!apiDoc || apiDoc.status !== 'active' || apiDoc.remaining <= 0) {
        if (!advanceApi()) break;
      }
    }

    // Live campaign progress update after each batch
    campaign.totalSent = totalSent;
    campaign.totalDelivered = totalDelivered;
    campaign.totalUndelivered = totalUndelivered;
    campaign.senderApiName = senderApiUsed;
    await campaign.save();

    batchIndex++;
    // Throttle between batches
    if (delayMs > 0) await sleep(delayMs);
  }

  // ── 5. Finalize campaign ──────────────────────────────────────────────────
  campaign.totalSent = totalSent;
  campaign.totalDelivered = totalDelivered;
  campaign.totalUndelivered = totalUndelivered;
  campaign.status =
    totalSent === 0
      ? 'failed'
      : totalDelivered === totalSent
        ? 'sent'
        : 'partial';
  campaign.senderApiName = senderApiUsed;
  await campaign.save();

  // Bulk-write delivery reports
  if (deliveryReports.length > 0) {
    try {
      await DeliveryReport.insertMany(deliveryReports);
    } catch (_e) {
      // Best-effort; individual failures are non-fatal
    }
  }

  // Log activity
  try {
    await logActivity({
      actorId: String(user._id),
      actorType: 'user',
      actorEmail: user.email,
      action: 'bulk_send_complete',
      details: `Sent ${totalSent} (delivered ${totalDelivered}, undelivered ${totalUndelivered}) via ${[...apisUsed].join(', ')}`,
    });
  } catch (_e) {
    // non-fatal
  }

  return {
    blocked: false,
    spamScore,
    spamLevel,
    spamReasons,
    aiReview,
    totalSent,
    totalDelivered,
    totalUndelivered,
    totalInvalid: invalidNumbers.length,
    invalidNumbers,
    deliveryReports,
    senderApiUsed,
    apisUsed: [...apisUsed],
  };
}

// ============================================================================
// Number Validation
// ============================================================================

function validatePhoneNumber(number) {
  // Remove all non-digit characters except +
  const cleaned = number.replace(/[^\d+]/g, '');
  // Basic validation: must have at least 7 digits
  const digitsOnly = cleaned.replace(/\+/g, '');
  if (digitsOnly.length < 7 || digitsOnly.length > 15) {
    return { valid: false, reason: 'Invalid number length' };
  }
  // Check for obviously invalid patterns
  if (/^0{4,}/.test(digitsOnly)) {
    return { valid: false, reason: 'Invalid number format' };
  }
  return { valid: true, cleaned };
}

function getCountryCode(number) {
  const cleaned = number.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    const code = cleaned.substring(1, 4);
    return { countryCode: '+' + code, country: countryCodeToCountry(code) };
  }
  // Common country codes mapping
  return { countryCode: '+1', country: 'Unknown' };
}

function countryCodeToCountry(code) {
  const map = {
    '1': 'USA/Canada',
    '44': 'UK',
    '880': 'Bangladesh',
    '91': 'India',
    '93': 'Afghanistan',
    '94': 'Sri Lanka',
    '977': 'Nepal',
    '960': 'Maldives',
    '92': 'Pakistan',
    '60': 'Malaysia',
    '65': 'Singapore',
    '66': 'Thailand',
    '62': 'Indonesia',
    '63': 'Philippines',
    '84': 'Vietnam',
    '86': 'China',
    '81': 'Japan',
    '82': 'South Korea',
    '971': 'UAE',
    '966': 'Saudi Arabia',
    '20': 'Egypt',
    '234': 'Nigeria',
    '27': 'South Africa',
    '49': 'Germany',
    '33': 'France',
    '34': 'Spain',
    '39': 'Italy',
    '31': 'Netherlands',
    '7': 'Russia',
    '55': 'Brazil',
    '52': 'Mexico',
    '54': 'Argentina',
    '61': 'Australia',
    '64': 'New Zealand',
  };
  return map[code] || 'Unknown';
}

// ============================================================================
// Dashboard Stats
// ============================================================================

async function getDashboardStats() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const totalUsers = await User.countDocuments({ role: 'user' });
  // Online = active in last 5 minutes
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const onlineUsers = await User.countDocuments({ role: 'user', lastActiveAt: { $gte: fiveMinAgo }, status: 'active' });
  const offlineUsers = totalUsers - onlineUsers;
  const suspendedUsers = await User.countDocuments({ role: 'user', status: 'suspended' });

  // Sending stats
  const todaySent = await Campaign.aggregate([
    { $match: { createdAt: { $gte: todayStart } } },
    { $group: { _id: null, total: { $sum: '$totalSent' } } },
  ]);
  const weekSent = await Campaign.aggregate([
    { $match: { createdAt: { $gte: weekStart } } },
    { $group: { _id: null, total: { $sum: '$totalSent' } } },
  ]);
  const monthSent = await Campaign.aggregate([
    { $match: { createdAt: { $gte: monthStart } } },
    { $group: { _id: null, total: { $sum: '$totalSent' } } },
  ]);
  const yearSent = await Campaign.aggregate([
    { $match: { createdAt: { $gte: yearStart } } },
    { $group: { _id: null, total: { $sum: '$totalSent' } } },
  ]);

  const runningCampaigns = await Campaign.countDocuments({ status: 'running' });

  // Inbox/spam rates
  const allCampaigns = await Campaign.aggregate([
    { $group: {
      _id: null,
      totalSent: { $sum: '$totalSent' },
      totalInbox: { $sum: '$totalInbox' },
      totalSpam: { $sum: '$totalSpam' },
      totalDelivered: { $sum: '$totalDelivered' },
      totalUndelivered: { $sum: '$totalUndelivered' },
      totalInvalid: { $sum: '$totalInvalid' },
    }},
  ]);
  const totals = allCampaigns[0] || {};
  const totalAllSent = totals.totalSent || 0;
  const inboxRate = totalAllSent > 0 ? Math.round((totals.totalInbox / totalAllSent) * 100) : 0;
  const spamRate = totalAllSent > 0 ? Math.round((totals.totalSpam / totalAllSent) * 100) : 0;

  // API health
  const senderApis = await SenderApi.find().lean();
  const geminiApis = await GeminiApi.find().lean();

  const senderApiHealth = senderApis.map(a => ({
    id: a._id,
    name: a.name,
    status: a.status,
    used: a.used,
    limit: a.limit,
    remaining: a.remaining,
    usagePercent: a.limit > 0 ? Math.round((a.used / a.limit) * 100) : 0,
    inboxRate: a.inboxRate,
    spamRate: a.spamRate,
    healthScore: a.healthScore,
    autoRoute: a.autoRoute,
    lastUsedAt: a.lastUsedAt,
    lastError: a.lastError,
  }));

  const geminiApiHealth = geminiApis.map(a => ({
    id: a._id,
    name: a.name,
    status: a.status,
    used: a.used,
    limit: a.limit,
    remaining: a.remaining,
    usagePercent: a.limit > 0 ? Math.round((a.used / a.limit) * 100) : 0,
    healthScore: a.healthScore,
    autoRoute: a.autoRoute,
    lastUsedAt: a.lastUsedAt,
  }));

  // Panel health (aggregate of all API health scores)
  const allHealthScores = [...senderApis.map(a => a.healthScore), ...geminiApis.map(a => a.healthScore)];
  const panelHealth = allHealthScores.length > 0
    ? Math.round(allHealthScores.reduce((s, v) => s + v, 0) / allHealthScores.length)
    : 100;

  const blockedApis = [
    ...senderApis.filter(a => a.status === 'blocked').map(a => ({ name: a.name, type: 'sender' })),
    ...geminiApis.filter(a => a.status === 'blocked').map(a => ({ name: a.name, type: 'gemini' })),
  ];
  const warningApis = [
    ...senderApis.filter(a => a.status === 'warning').map(a => ({ name: a.name, type: 'sender' })),
    ...geminiApis.filter(a => a.status === 'warning').map(a => ({ name: a.name, type: 'gemini' })),
  ];
  const goodApis = [
    ...senderApis.filter(a => a.status === 'active' && a.healthScore > 70).map(a => ({ name: a.name, type: 'sender', inboxRate: a.inboxRate })),
    ...geminiApis.filter(a => a.status === 'active' && a.healthScore > 70).map(a => ({ name: a.name, type: 'gemini' })),
  ];

  // Best sender API for inbox
  const bestSenderForInbox = senderApis.length > 0
    ? senderApis.reduce((best, a) => (a.inboxRate > (best?.inboxRate || 0) ? a : best), null)
    : null;

  // Database usage
  const mongoConnections = await MongoConnection.find().lean();
  const dbUsage = mongoConnections.map(m => ({
    id: m._id,
    label: m.label,
    storageUsed: m.storageUsed,
    storageLimit: m.storageLimit,
    usagePercent: m.storageLimit > 0 ? Math.round((m.storageUsed / m.storageLimit) * 100) : 0,
    isActive: m.isActive,
  }));

  // Users with details (IP, last active, last send, expiry)
  const usersWithDetails = await User.find({ role: 'user' })
    .select('email status sendingLimit sentCount lastActiveAt lastSendAt ipAddress expiryDate inboxRate spamRate invalidHits')
    .lean();

  return {
    users: {
      total: totalUsers,
      online: onlineUsers,
      offline: offlineUsers,
      suspended: suspendedUsers,
      withDetails: usersWithDetails.map(u => ({
        ...u,
        isOnline: u.lastActiveAt && new Date(now.getTime() - 5 * 60 * 1000) < u.lastActiveAt,
        expiryDaysLeft: u.expiryDate ? Math.ceil((u.expiryDate - now) / (24 * 60 * 60 * 1000)) : null,
        lastActiveAgo: u.lastActiveAt ? timeAgo(u.lastActiveAt, now) : 'Never',
        lastSendAgo: u.lastSendAt ? timeAgo(u.lastSendAt, now) : 'Never',
      })),
    },
    sending: {
      today: todaySent[0]?.total || 0,
      week: weekSent[0]?.total || 0,
      month: monthSent[0]?.total || 0,
      year: yearSent[0]?.total || 0,
      running: runningCampaigns,
      // Computed trend: today vs avg daily this week
      avgDailyThisWeek: weekSent[0]?.total ? Math.round((weekSent[0]?.total || 0) / 7) : 0,
    },
    inboxSpam: {
      inboxRate,
      spamRate,
      totalSent: totalAllSent,
      totalInbox: totals.totalInbox || 0,
      totalSpam: totals.totalSpam || 0,
      totalDelivered: totals.totalDelivered || 0,
      totalUndelivered: totals.totalUndelivered || 0,
      totalInvalid: totals.totalInvalid || 0,
      deliveryRate: totalAllSent > 0 ? Math.round(((totals.totalDelivered || 0) / totalAllSent) * 100) : 0,
      undeliveredRate: totalAllSent > 0 ? Math.round(((totals.totalUndelivered || 0) / totalAllSent) * 100) : 0,
    },
    apiHealth: {
      senderApis: senderApiHealth,
      geminiApis: geminiApiHealth,
      panelHealth,
      blocked: blockedApis,
      warning: warningApis,
      good: goodApis,
      bestSenderForInbox: bestSenderForInbox ? { name: bestSenderForInbox.name, inboxRate: bestSenderForInbox.inboxRate } : null,
      totalApiCount: senderApis.length + geminiApis.length,
      avgUsagePercent: (senderApis.length + geminiApis.length) > 0
        ? Math.round([...senderApis, ...geminiApis].reduce((s, a) => s + (a.limit > 0 ? (a.used / a.limit) * 100 : 0), 0) / (senderApis.length + geminiApis.length))
        : 0,
    },
    database: dbUsage,
    // ── Computed System Intelligence ──
    intelligence: {
      // Daily trend: today vs average daily (this week)
      dailyTrendPct: (weekSent[0]?.total || 0) > 0
        ? Math.round((((todaySent[0]?.total || 0) - ((weekSent[0]?.total || 0) / 7)) / ((weekSent[0]?.total || 0) / 7)) * 100)
        : 0,
      // Active user rate
      activeUserPct: totalUsers > 0 ? Math.round((onlineUsers / totalUsers) * 100) : 0,
      // Delivery efficiency score (weighted: delivery 50% + inbox 30% + (100-spam) 20%)
      deliveryEfficiency: totalAllSent > 0
        ? Math.round(((totals.totalDelivered || 0) / totalAllSent) * 50 + (inboxRate * 0.3) + ((100 - spamRate) * 0.2))
        : 100,
      // Capacity warning: any API > 80% usage
      capacityWarnings: [...senderApis, ...geminiApis].filter(a => a.limit > 0 && (a.used / a.limit) > 0.8).map(a => ({ name: a.name, pct: Math.round((a.used / a.limit) * 100) })),
      // Expiring users (within 7 days)
      expiringUsers: usersWithDetails.filter(u => u.expiryDate && Math.ceil((u.expiryDate - now) / (24 * 60 * 60 * 1000)) <= 7 && Math.ceil((u.expiryDate - now) / (24 * 60 * 60 * 1000)) >= 0).length,
      // High spam risk users (spamRate > 10%)
      highRiskUsers: usersWithDetails.filter(u => (u.spamRate || 0) > 10).length,
      // Estimated monthly capacity remaining (sum of remaining across all sender APIs)
      estRemainingCapacity: senderApis.reduce((s, a) => s + (a.remaining || 0), 0),
      // System grade
      systemGrade: (() => {
        const score = panelHealth * 0.4 + (totalAllSent > 0 ? (100 - spamRate) * 0.3 : 70) + (totalUsers > 0 ? (onlineUsers / totalUsers) * 100 * 0.3 : 50);
        if (score >= 85) return { grade: 'A', color: '#34d399', label: 'Excellent' };
        if (score >= 70) return { grade: 'B', color: '#60a5fa', label: 'Good' };
        if (score >= 55) return { grade: 'C', color: '#fbbf24', label: 'Fair' };
        if (score >= 40) return { grade: 'D', color: '#fb923c', label: 'Poor' };
        return { grade: 'F', color: '#fb7185', label: 'Critical' };
      })(),
    },
  };
}

function timeAgo(date, now) {
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ============================================================================
// Activity Log Helper
// ============================================================================

async function logActivity(actorId, actorType, actorEmail, action, details, ipAddress) {
  try {
    await ActivityLog.create({
      actorId,
      actorType,
      actorEmail,
      action,
      details,
      ipAddress,
    });
  } catch (e) {
    // logging should not break main flow
  }
}

// ============================================================================
// App Settings Helper
// ============================================================================

async function getAppSettings() {
  let settings = await AppSettings.findOne();
  if (!settings) {
    settings = await AppSettings.create({});
  }
  return settings;
}

async function updateAppSettings(updates) {
  let settings = await AppSettings.findOne();
  if (!settings) {
    settings = new AppSettings({});
  }
  Object.assign(settings, updates);
  settings.updatedAt = new Date();
  await settings.save();
  return settings;
}

// ============================================================================
// Alert Helper (WhatsApp / Email)
// ============================================================================

// Normalize phone number to international format (default +880 for Bangladesh)
function normalizePhone(raw) {
  if (!raw) return '';
  let p = String(raw).replace(/[^\d]/g, ''); // digits only
  if (!p) return '';
  // Bangladesh: strip leading 0 then prefix 880 → e.g. 01712345678 → 8801712345678
  if (p.startsWith('880')) return p;
  if (p.startsWith('0')) return '880' + p.slice(1);
  if (p.length === 10) return '880' + p; // assume local 10-digit BD number without leading 0
  // Already international without +
  return p;
}

async function sendAlert(type, message) {
  try {
    const settings = await getAppSettings();
    // Log the alert
    await logActivity(null, 'admin', 'system', 'alert', `${type}: ${message}`, null);

    const results = { whatsapp: null, email: null };

    // WhatsApp alert via CallMeBot — phone + apikey are SEPARATE values
    if (settings.alertWhatsapp && settings.alertWhatsappApiKey) {
      try {
        const phone = normalizePhone(settings.alertWhatsapp);
        const waUrl = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(settings.alertWhatsappApiKey)}`;
        const waRes = await fetch(waUrl, { method: 'GET' }).catch((e) => ({ error: e.message }));
        if (waRes && waRes.ok) {
          results.whatsapp = { success: true };
        } else {
          const errText = waRes && waRes.text ? await waRes.text().catch(() => 'unknown') : (waRes && waRes.error) || 'no response';
          results.whatsapp = { success: false, error: typeof errText === 'string' ? errText.slice(0, 200) : 'fetch failed' };
          await logActivity(null, 'admin', 'system', 'whatsapp_alert_failed', String(errText).slice(0, 300), null);
        }
      } catch (e) {
        results.whatsapp = { success: false, error: e.message };
      }
    } else if (settings.alertWhatsapp && !settings.alertWhatsappApiKey) {
      results.whatsapp = { success: false, error: 'Missing WhatsApp API key — get it from CallMeBot (see Alerts tab setup guide)' };
      await logActivity(null, 'admin', 'system', 'whatsapp_alert_failed', 'Missing CallMeBot API key', null);
    }

    // Email alert via Resend API (https://resend.com — free 3000 emails/month, no card)
    if (settings.alertEmail && settings.alertEmailApiKey) {
      try {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${settings.alertEmailApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: settings.alertEmailFrom || 'alerts@mms-sender.local',
            to: [settings.alertEmail],
            subject: `[MMS Sender Alert] ${type}`,
            text: message,
          }),
        }).catch((e) => ({ error: e.message }));
        if (emailRes && emailRes.ok) {
          results.email = { success: true };
        } else {
          const errText = emailRes && emailRes.text ? await emailRes.text().catch(() => 'unknown') : (emailRes && emailRes.error) || 'no response';
          results.email = { success: false, error: typeof errText === 'string' ? errText.slice(0, 200) : 'fetch failed' };
          await logActivity(null, 'admin', 'system', 'email_alert_failed', String(errText).slice(0, 300), null);
        }
      } catch (e) {
        results.email = { success: false, error: e.message };
      }
    } else if (settings.alertEmail && !settings.alertEmailApiKey) {
      // No API key → log only (backward compatible)
      await logActivity(null, 'admin', 'system', 'email_alert', `To: ${settings.alertEmail} — ${message}`, null);
      results.email = { success: false, error: 'Missing Resend API key — email logged only. Add a Resend API key in Alerts tab to enable real email delivery.' };
    }

    return { success: true, results };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ============================================================================
// Config File Generator (for user self-management)
// ============================================================================

const configKeyMap = {
  GEMINI_API_KEY: 'config-gemini.js',
  MONGODB_URI: 'config-database.js',
  SMS_API_KEY: 'config-sending.js',
};

function refreshConfigFile(keyName, keyValue) {
  const fileName = configKeyMap[keyName];
  if (!fileName) {
    return false;
  }

  const targetPath = path.join(process.cwd(), fileName);
  let content = '';

  switch (keyName) {
    case 'GEMINI_API_KEY':
      content = `export const GEMINI_CONFIG = {\n  apiKey: '${keyValue}',\n  model: 'gemini-2.5-flash',\n  endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',\n};\n`;
      break;
    case 'MONGODB_URI':
      content = `export const DB_CONFIG = {\n  uri: '${keyValue}',\n  options: {\n    bufferCommands: false,\n  },\n};\n`;
      break;
    case 'SMS_API_KEY':
      content = `export const SMS_CONFIG = {\n  apiKey: '${keyValue}',\n  provider: 'twilio',\n  endpoint: 'https://api.twilio.com/2010-04-01/Accounts/',\n};\n`;
      break;
    default:
      return false;
  }

  try {
    fs.writeFileSync(targetPath, content, 'utf8');
    return true;
  } catch (err) {
    return false;
  }
}

// ============================================================================
// Response Helper
// ============================================================================

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// Exports
// ============================================================================

export {
  // DB
  connectDB,
  reconnectDB,
  // JWT
  getJWTSecret,
  createToken,
  verifyToken,
  // Password
  hashPassword,
  comparePassword,
  // Random generators
  generateRandomUsername,
  generateRandomPassword,
  generateRandomApiKey,
  generateVerificationCode,
  // Admin credentials
  ensureAdminCredentials,
  verifyAdminLogin,
  getAdminCredentialsInfo,
  updateAdminUsername,
  updateAdminPassword,
  updateAdminApiKey,
  updateAdminEmail,
  // Sub-admin
  createSubAdmin,
  getSubAdmins,
  updateSubAdminPermissions,
  deleteSubAdmin,
  // Verification codes
  createVerificationCode,
  verifyCode,
  // API routing
  getBestSenderApi,
  getBestGeminiApi,
  callGemini,
  updateSenderApiUsage,
  updateGeminiApiUsage,
  // Bulk send engine (real provider integrations)
  bulkSendEngine,
  executeRealSend,
  sendWithRetry,
  scoreSpamHeuristic,
  geminiSpamReview,
  enforceCountryRules,
  // Number validation
  validatePhoneNumber,
  getCountryCode,
  // Dashboard
  getDashboardStats,
  // Activity log
  logActivity,
  // App settings
  getAppSettings,
  updateAppSettings,
  // Alerts
  sendAlert,
  // Config files
  refreshConfigFile,
  // Response helper
  jsonResponse,
  // Models
  User,
  Config,
  Campaign,
  MongoConnection,
  AdminCredential,
  SenderApi,
  GeminiApi,
  MessageTemplate,
  ContentAsset,
  ActivityLog,
  Blacklist,
  DeliveryReport,
  AppSettings,
  VerificationCode,
  ScheduledSend,
  AutoReplyConfig,
  SmsInbound,
};
