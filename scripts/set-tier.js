// One-off script: set packageTier for a user (default TESTUSER01 → enterprise tier 3)
import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI || 'mongodb+srv://mmsadmin:Mmssendrjag2866Sami@mmsdb.xlplomx.mongodb.net/?appName=MmsDB';
const dbName = process.env.MONGODB_DB || 'test';
const targetLoginId = process.argv[2] || 'TESTUSER01';
const targetTier = parseInt(process.argv[3] || '3', 10);

const userSchema = new mongoose.Schema({
  userId: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
  email: { type: String, unique: true, sparse: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  packageTier: { type: Number, default: 0, min: 0, max: 3 },
  sendingLimit: { type: Number, default: 100 },
  sentCount: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
});

async function main() {
  await mongoose.connect(uri, { dbName });
  const User = mongoose.models.User || mongoose.model('User', userSchema);
  // find by userId (case-insensitive) or email
  let user = await User.findOne({ userId: { $regex: new RegExp('^' + targetLoginId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') } });
  if (!user && targetLoginId.includes('@')) user = await User.findOne({ email: targetLoginId.toLowerCase() });
  if (!user) {
    console.error('User not found:', targetLoginId);
    // list all users for debugging
    const all = await User.find({}).select('userId email packageTier role').lean();
    console.log('Available users:', JSON.stringify(all, null, 2));
    process.exit(1);
  }
  const before = user.packageTier;
  user.packageTier = targetTier;
  await user.save();
  console.log(`OK: ${user.userId || user.email} packageTier ${before} → ${user.packageTier}`);
  await mongoose.disconnect();
}

main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
