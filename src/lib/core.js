import mongoose from 'mongoose';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

// ============================================================================
// MongoDB Connection (global caching pattern)
// ============================================================================

const ENV_MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/sms_campaign_db';

const cached = { conn: null, promise: null, uri: null };

async function getActiveMongoURI() {
  try {
    // If already connected, return cached URI
    if (cached.uri) return cached.uri;

    // Try to read active connection from database
    // We need a temporary connection using ENV URI to read the config
    if (mongoose.connection.readyState === 0) {
      // Not connected — connect with ENV URI temporarily
      const opts = { bufferCommands: false };
      await mongoose.connect(ENV_MONGODB_URI, opts);
    }

    const MongoConnection =
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

    const active = await MongoConnection.findOne({ isActive: true });
    if (active && active.uri) {
      cached.uri = active.uri;
      return active.uri;
    }

    // No active connection in DB — use ENV URI
    cached.uri = ENV_MONGODB_URI;
    return ENV_MONGODB_URI;
  } catch (err) {
    // If anything fails, fall back to ENV URI
    return ENV_MONGODB_URI;
  }
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  const uri = await getActiveMongoURI();

  if (!cached.promise || cached.uri !== uri) {
    cached.promise = null;
    cached.uri = uri;
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose
      .connect(uri, opts)
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

// Force reconnect with a new URI (used when switching active MongoDB)
async function reconnectDB(newUri) {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  } catch (e) {
    // ignore disconnect errors
  }
  cached.conn = null;
  cached.promise = null;
  cached.uri = newUri;
  return connectDB();
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

// --- MongoConnection Schema (multi-database support) ---
const mongoConnectionSchema = new mongoose.Schema({
  label: { type: String, required: true },
  uri: { type: String, required: true },
  isActive: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

// Export models (check if already exists to avoid OverwriteModelError)
const User = mongoose.models.User || mongoose.model('User', userSchema);
const Config = mongoose.models.Config || mongoose.model('Config', configSchema);
const Campaign =
  mongoose.models.Campaign || mongoose.model('Campaign', campaignSchema);
const MongoConnection =
  mongoose.models.MongoConnection ||
  mongoose.model('MongoConnection', mongoConnectionSchema);

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
  getActiveMongoURI,
  getJWTSecret,
  createToken,
  verifyToken,
  hashPassword,
  comparePassword,
  User,
  Config,
  Campaign,
  MongoConnection,
  refreshConfigFile,
  jsonResponse,
};
