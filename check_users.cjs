const mongoose = require('mongoose');
const MONGO_URI = 'mongodb+srv://mmsadmin:Mmssendrjag2866Sami@mmsdb.xlplomx.mongodb.net/?appName=MmsDB';
const userSchema = new mongoose.Schema({ userId: String, email: String, password: String, role: String, status: String, sendingLimit: Number }, { timestamps: true });
async function main() {
  await mongoose.connect(MONGO_URI, { dbName: 'test' });
  const User = mongoose.models.User || mongoose.model('User', userSchema);
  const users = await User.find({}).lean();
  console.log('Total users:', users.length);
  users.forEach(u => console.log(JSON.stringify({ userId: u.userId, email: u.email, hasPwd: u.password && u.password.length > 5, role: u.role, status: u.status, limit: u.sendingLimit })));
  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
