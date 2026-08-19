import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  sendingLimit: { type: Number, default: 100 },
  sentCount: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'paused'], default: 'active' }
}, { timestamps: true });

const configSchema = new mongoose.Schema({
  keyName: { type: String, required: true, unique: true },
  keyValue: { type: String, required: true }
}, { timestamps: true });

const campaignSchema = new mongoose.Schema({
  userEmail: String,
  message: String,
  numbers: [String],
  status: { type: String, default: 'pending' },
  aiVerdict: String,
}, { timestamps: true });

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export const Config = mongoose.models.Config || mongoose.model('Config', configSchema);
export const Campaign = mongoose.models.Campaign || mongoose.model('Campaign', campaignSchema);
  
