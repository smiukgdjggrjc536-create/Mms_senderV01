// Comprehensive DB seed script: check current state, seed admin + user credentials
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const MONGO_URI = 'mongodb+srv://mmsadmin:Mmssendrjag2866Sami@mmsdb.xlplomx.mongodb.net/?appName=MmsDB';
const DB_NAME = 'test';

const adminCredentialSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, default: null },
  passwordHash: { type: String, required: true },
  apiKey: { type: String, required: true },
  role: { type: String, enum: ['superadmin', 'subadmin'], default: 'superadmin' },
  permissions: { type: [String], default: ['all'] },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

const userSchema = new mongoose.Schema({
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
}, { timestamps: true });

async function main() {
  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
  console.log('✅ Connected to MongoDB\n');

  const AdminCredential = mongoose.models.AdminCredential || mongoose.model('AdminCredential', adminCredentialSchema);
  const User = mongoose.models.User || mongoose.model('User', userSchema);

  // 1. Check current AdminCredential collection
  const adminCount = await AdminCredential.countDocuments();
  console.log('=== AdminCredential Collection ===');
  console.log('Document count:', adminCount);
  const admins = await AdminCredential.find({}).lean();
  admins.forEach(a => {
    console.log(JSON.stringify({
      _id: a._id,
      username: a.username,
      email: a.email,
      hasPasswordHash: !!a.passwordHash && a.passwordHash !== 'NO' && a.passwordHash.length > 5,
      hasApiKey: !!a.apiKey && a.apiKey !== 'NO' && a.apiKey.length > 5,
      role: a.role,
      permissions: a.permissions,
    }, null, 2));
  });

  // 2. Check current User collection
  const userCount = await User.countDocuments();
  console.log('\n=== User Collection ===');
  console.log('Document count:', userCount);
  const users = await User.find({}).lean();
  users.forEach(u => {
    console.log(JSON.stringify({
      _id: u._id,
      userId: u.userId,
      email: u.email,
      hasPassword: !!u.password && u.password !== 'NO' && u.password.length > 5,
      role: u.role,
      status: u.status,
      sendingLimit: u.sendingLimit,
      expiryDate: u.expiryDate,
    }, null, 2));
  });

  // 3. Seed / Fix Admin credentials
  console.log('\n=== Seeding Admin Credentials ===');
  const ADMIN_USERNAME = 'Admin@665_Sam1';
  const ADMIN_PASSWORD = 'ArThac751Hgafn116';
  const ADMIN_EMAIL = 'admin@test.com';
  const ADMIN_APIKEY = 'sk_' + crypto.randomBytes(20).toString('hex');
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  // Remove all existing admin docs and create fresh
  await AdminCredential.deleteMany({});
  await AdminCredential.create({
    username: ADMIN_USERNAME,
    email: ADMIN_EMAIL,
    passwordHash: adminHash,
    apiKey: ADMIN_APIKEY,
    role: 'superadmin',
    permissions: ['all'],
  });
  console.log('✅ Admin credential seeded:');
  console.log('   Username:', ADMIN_USERNAME);
  console.log('   Password:', ADMIN_PASSWORD);
  console.log('   Email:', ADMIN_EMAIL);
  console.log('   API Key:', ADMIN_APIKEY);

  // 4. Seed / Fix test user account
  console.log('\n=== Seeding Test User Account ===');
  const USER_LOGINID = 'TESTUSER01';
  const USER_PASSWORD = 'TestPass2026!';
  const USER_EMAIL = 'testuser01@mms.test';
  const userHash = await bcrypt.hash(USER_PASSWORD, 12);

  // Remove existing test user and create fresh
  await User.deleteMany({ userId: USER_LOGINID });
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 365); // 1 year expiry
  const newUser = await User.create({
    userId: USER_LOGINID,
    email: USER_EMAIL,
    password: userHash,
    role: 'user',
    sendingLimit: 5000,
    sentCount: 0,
    status: 'active',
    expiryDate: expiry,
  });
  console.log('✅ Test user seeded:');
  console.log('   Login ID:', USER_LOGINID);
  console.log('   Password:', USER_PASSWORD);
  console.log('   Email:', USER_EMAIL);
  console.log('   Expiry:', expiry.toISOString());
  console.log('   Sending limit:', 5000);

  // 5. Verify
  console.log('\n=== Verification ===');
  const verifyAdmin = await AdminCredential.findOne({ username: ADMIN_USERNAME });
  const pwdOk = verifyAdmin ? await bcrypt.compare(ADMIN_PASSWORD, verifyAdmin.passwordHash) : false;
  console.log('Admin login test:', pwdOk ? '✅ PASS' : '❌ FAIL');
  console.log('Admin apiKey match:', verifyAdmin && verifyAdmin.apiKey === ADMIN_APIKEY ? '✅ PASS' : '❌ FAIL');

  const verifyUser = await User.findOne({ userId: USER_LOGINID });
  const userPwdOk = verifyUser ? await bcrypt.compare(USER_PASSWORD, verifyUser.password) : false;
  console.log('User login test:', userPwdOk ? '✅ PASS' : '❌ FAIL');

  await mongoose.disconnect();
  console.log('\n✅ Done. DB disconnected.');
}

main().catch(err => { console.error('❌ Error:', err); process.exit(1); });
