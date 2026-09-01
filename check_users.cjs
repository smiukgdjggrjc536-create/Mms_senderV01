// ============================================================================
// check_users.cjs — Inspect User collection (read-only diagnostics)
// ----------------------------------------------------------------------------
// SECURITY (V7 P1.1): the MongoDB URI is NO LONGER hardcoded. It is read from
// the MONGODB_URI environment variable. If absent the script exits with a
// clear error instead of falling back to a hardcoded secret.
// This is a CommonJS standalone script (`.cjs`), so require() is correct here.
// ============================================================================
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('[check_users] MONGODB_URI env var is required. Set it before running.');
  console.error('   Example: MONGODB_URI="mongodb+srv://..." node check_users.cjs');
  process.exit(1);
}

const userSchema = new mongoose.Schema(
  { userId: String, email: String, password: String, role: String, status: String, sendingLimit: Number },
  { timestamps: true }
);

async function main() {
  try {
    await mongoose.connect(MONGO_URI, { dbName: 'test' });
    const User = mongoose.models.User || mongoose.model('User', userSchema);
    const users = await User.find({}).lean();
    console.log('Total users:', users.length);
    users.forEach((u) =>
      console.log(
        JSON.stringify({
          userId: u.userId,
          email: u.email,
          hasPwd: u.password && u.password.length > 5,
          role: u.role,
          status: u.status,
          limit: u.sendingLimit,
        })
      )
    );
    await mongoose.disconnect();
  } catch (err) {
    console.error('[check_users] error:', err.message);
    try { await mongoose.disconnect(); } catch (_) {}
    process.exit(1);
  }
}

main();
