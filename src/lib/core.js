import mongoose from 'mongoose';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

// ============================================================================
// MongoDB Connection (global caching pattern)
// ============================================================================

const MONGODB_URI =
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
      .connect(MONGODB_URI, opts)
      .then((mongooseInstance) => {
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

// ============================================================================
// JWT Helpers (using jose library)
// ============================================================================

function getJWTSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set in environment variables');
  }
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
// Mongoose Schemas
// ============================================================================

// --- User Schema ---
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  sendingLimit: { type: Number, default: 100 },
  sentCount: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
});

// PRE-SAVE HOOK: auto-hash password when modified
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  try {
    this.password = await hashPassword(this.password);
    return next();
  } catch (err) {
    return next(err);
  }
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

// Export models (check if already exists to avoid OverwriteModelError)
const User = mongoose.models.User || mongoose.model('User', userSchema);
const Config = mongoose.models.Config || mongoose.model('Config', configSchema);
const Campaign =
  mongoose.models.Campaign || mongoose.model('Campaign', campaignSchema);

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
  getJWTSecret,
  createToken,
  verifyToken,
  hashPassword,
  comparePassword,
  User,
  Config,
  Campaign,
  refreshConfigFile,
  jsonResponse,
};
