import mongoose from 'mongoose';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

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
  // 16 chars: mix of letters, numbers, symbols — readable
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  const bytes = crypto.randomBytes(16);
  for (let i = 0; i < 16; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

function generateRandomApiKey() {
  // API key: sk_ prefix + 40 hex chars
  return 'sk_' + crypto.randomBytes(20).toString('hex');
}

// ============================================================================
// Mongoose Schemas
// ============================================================================

// --- User Schema (for USER PANEL on Vercel) ---
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  sendingLimit: { type: Number, default: 100 },
  sentCount: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
});

userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  this.password = await hashPassword(this.password);
});

// --- AdminCredential Schema (for ADMIN PANEL on Netlify — 3-layer security) ---
const adminCredentialSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  apiKey: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now },
});

// --- Config Schema ---
const configSchema = new mongoose.Schema({
  keyName: { type: String, required: true, unique: true },
  keyValue: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now },
});

// --- Campaign Schema ---
const campaignSchema = new mongoose.Schema({
  userEmail: { type: String, required: true, lowercase: true },
  message: { type: String },
  numbers: { type: [String] },
  status: { type: String, enum: ['pending', 'sent', 'blocked'], default: 'pending' },
  aiVerdict: { type: String },
  createdAt: { type: Date, default: Date.now },
});

// --- MongoConnection Schema (multi-database support) ---
const mongoConnectionSchema = new mongoose.Schema({
  label: { type: String, required: true },
  uri: { type: String, required: true },
  isActive: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

// Export models
const User = mongoose.models.User || mongoose.model('User', userSchema);
const Config = mongoose.models.Config || mongoose.model('Config', configSchema);
const Campaign =
  mongoose.models.Campaign || mongoose.model('Campaign', campaignSchema);
const MongoConnection =
  mongoose.models.MongoConnection ||
  mongoose.model('MongoConnection', mongoConnectionSchema);
const AdminCredential =
  mongoose.models.AdminCredential ||
  mongoose.model('AdminCredential', adminCredentialSchema);

// ============================================================================
// Admin Credential Management
// ============================================================================

// Initialize default admin credentials if none exist (called on first admin login attempt)
async function ensureAdminCredentials() {
  const existing = await AdminCredential.countDocuments();
  if (existing > 0) {
    return null; // already has credentials
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

  // Return the PLAIN credentials ONCE (only on creation) so they can be shown to admin
  return { username, password, apiKey };
}

// Verify admin login (3-layer: username + password + apiKey)
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

// Get admin credentials info (masked — for display in admin panel)
async function getAdminCredentialsInfo() {
  const admin = await AdminCredential.findOne({});
  if (!admin) {
    return null;
  }
  return {
    username: admin.username,
    apiKeyMasked: admin.apiKey.substring(0, 6) + '••••••••••••••••••••',
    passwordSet: true,
    updatedAt: admin.updatedAt,
  };
}

// Update admin username
async function updateAdminUsername(newUsername) {
  const admin = await AdminCredential.findOne({});
  if (!admin) {
    return { success: false, error: 'Admin not found' };
  }
  // Check uniqueness
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

// Update admin password
async function updateAdminPassword(newPassword) {
  const admin = await AdminCredential.findOne({});
  if (!admin) {
    return { success: false, error: 'Admin not found' };
  }
  admin.passwordHash = await hashPassword(newPassword);
  admin.updatedAt = new Date();
  await admin.save();
  return { success: true };
}

// Update admin API key (generate new random one)
async function updateAdminApiKey() {
  const admin = await AdminCredential.findOne({});
  if (!admin) {
    return { success: false, error: 'Admin not found' };
  }
  const newKey = generateRandomApiKey();
  admin.apiKey = newKey;
  admin.updatedAt = new Date();
  await admin.save();
  return { success: true, apiKey: newKey };
}

// ============================================================================
// Config File Generator
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
      content = `export const GEMINI_CONFIG = {\n  apiKey: '${keyValue}',\n  model: 'gemini-1.5-flash',\n  endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',\n};\n`;
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
    console.error(`Failed to write config file ${fileName}:`, err);
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
  connectDB,
  reconnectDB,
  getJWTSecret,
  createToken,
  verifyToken,
  hashPassword,
  comparePassword,
  generateRandomUsername,
  generateRandomPassword,
  generateRandomApiKey,
  ensureAdminCredentials,
  verifyAdminLogin,
  getAdminCredentialsInfo,
  updateAdminUsername,
  updateAdminPassword,
  updateAdminApiKey,
  User,
  Config,
  Campaign,
  MongoConnection,
  AdminCredential,
  refreshConfigFile,
  jsonResponse,
};
