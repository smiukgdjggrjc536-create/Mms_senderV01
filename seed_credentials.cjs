// ============================================================================
// seed_credentials.cjs — Seed admin + test-user credentials (PRESERVE-FIRST)
// ----------------------------------------------------------------------------
// SECURITY (V7 P1.1):
//   1. MONGODB_URI is read from the environment — NEVER hardcoded.
//   2. PITFALL P3 compliance: existing admin/testuser docs are NEVER overwritten
//      or reset. A credential is seeded ONLY when its document is absent.
//      This mirrors ensureAdminCredentials() in src/lib/core.js:688.
//   3. Admin username after the @ is 665 (six-six-five, NOT zero).
// CommonJS standalone script (`.cjs`); require() is correct here.
// ============================================================================
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('[seed_credentials] MONGODB_URI env var is required. Set it before running.');
  console.error('   Example: MONGODB_URI="mongodb+srv://..." node seed_credentials.cjs');
  process.exit(1);
}
const DB_NAME = process.env.MONGODB_DB || 'test';

const adminCredentialSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, default: null },
    passwordHash: { type: String, required: true },
    apiKey: { type: String, required: true },
    role: { type: String, enum: ['superadmin', 'subadmin'], default: 'superadmin' },
    permissions: { type: [String], default: ['all'] },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    userId: { type: String, unique: true, sparse: true, uppercase: false, trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    sendingLimit: { type: Number, default: 100 },
    sentCount: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    expiryDate: { type: Date, default: null },
    lastActiveAt: { type: Date, default: Date.now },
    lastSendAt: { type: Date, default: null },
    ipAddress: { type: String, default: null },
    inboxRate: { type: Number, default: 0 },
    spamRate: { type: Number, default: 0 },
    invalidHits: { type: Number, default: 0 },
  },
  { timestamps: true }
);

async function main() {
  try {
    await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
    console.log('✅ Connected to MongoDB (db: ' + DB_NAME + ')\n');

    const AdminCredential = mongoose.models.AdminCredential || mongoose.model('AdminCredential', adminCredentialSchema);
    const User = mongoose.models.User || mongoose.model('User', userSchema);

    // ---- Report current state (read-only) ----
    const adminCount = await AdminCredential.countDocuments();
    console.log('=== AdminCredential Collection ===');
    console.log('Document count:', adminCount);

    const userCount = await User.countDocuments();
    console.log('\n=== User Collection ===');
    console.log('Document count:', userCount);

    // ---- Seed admin ONLY if absent (PITFALL P3: never overwrite) ----
    const ADMIN_USERNAME = 'Admin@665_Sam1';
    const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD || 'ArThac751Hgafn116';
    const ADMIN_EMAIL = 'admin@test.com';

    console.log('\n=== Seeding Admin Credentials (preserve-first) ===');
    const existingAdmin = await AdminCredential.findOne({ username: ADMIN_USERNAME });
    if (existingAdmin) {
      console.log('⚠️  Admin doc already exists for "' + ADMIN_USERNAME + '" — LEFT UNTOUCHED (P3).');
      console.log('   To reset, use the admin panel rotate-credentials flow, not this script.');
    } else {
      const ADMIN_APIKEY = 'sk_' + crypto.randomBytes(20).toString('hex');
      const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
      await AdminCredential.create({
        username: ADMIN_USERNAME,
        email: ADMIN_EMAIL,
        passwordHash: adminHash,
        apiKey: ADMIN_APIKEY,
        role: 'superadmin',
        permissions: ['all'],
      });
      console.log('✅ Admin credential seeded (doc was absent):');
      console.log('   Username:', ADMIN_USERNAME, '(the digits after @ are 6-6-5, NOT zero)');
      console.log('   Email:', ADMIN_EMAIL);
      console.log('   API Key:', ADMIN_APIKEY);
    }

    // ---- Seed test user ONLY if absent (PITFALL P3: never overwrite) ----
    const USER_LOGINID = 'TESTUSER01';
    const USER_PASSWORD = process.env.TESTUSER_SEED_PASSWORD || 'TestPass2026!';
    const USER_EMAIL = 'testuser01@mms.test';

    console.log('\n=== Seeding Test User Account (preserve-first) ===');
    const existingUser = await User.findOne({ userId: USER_LOGINID });
    if (existingUser) {
      console.log('⚠️  Test user "' + USER_LOGINID + '" already exists — LEFT UNTOUCHED (P3).');
    } else {
      const userHash = await bcrypt.hash(USER_PASSWORD, 12);
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 365); // 1 year expiry
      await User.create({
        userId: USER_LOGINID,
        email: USER_EMAIL,
        password: userHash,
        role: 'user',
        sendingLimit: 5000,
        sentCount: 0,
        status: 'active',
        expiryDate: expiry,
      });
      console.log('✅ Test user seeded (doc was absent):');
      console.log('   Login ID:', USER_LOGINID);
      console.log('   Email:', USER_EMAIL);
      console.log('   Expiry:', expiry.toISOString());
      console.log('   Sending limit:', 5000);
    }

    // ---- Verify ----
    console.log('\n=== Verification ===');
    const verifyAdmin = await AdminCredential.findOne({ username: ADMIN_USERNAME });
    if (verifyAdmin) {
      const pwdOk = await bcrypt.compare(ADMIN_PASSWORD, verifyAdmin.passwordHash);
      console.log('Admin login test:', pwdOk ? '✅ PASS' : '⚠️  password differs from seed (existing doc preserved)');
    } else {
      console.log('Admin doc not found.');
    }

    const verifyUser = await User.findOne({ userId: USER_LOGINID });
    if (verifyUser) {
      const userPwdOk = await bcrypt.compare(USER_PASSWORD, verifyUser.password);
      console.log('User login test:', userPwdOk ? '✅ PASS' : '⚠️  password differs from seed (existing doc preserved)');
    } else {
      console.log('Test user doc not found.');
    }

    await mongoose.disconnect();
    console.log('\n✅ Done. DB disconnected.');
  } catch (err) {
    console.error('❌ [seed_credentials] error:', err.message);
    try { await mongoose.disconnect(); } catch (_) {}
    process.exit(1);
  }
}

main();
