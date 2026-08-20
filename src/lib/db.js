import mongoose from 'mongoose'; 
 
const MONGODB_URI = process.env.MASTER_DB_URL; 
 
let cached = global.mongoose || { conn: null, promise: null }; 
 
export async function connectDB() { 
  if (!MONGODB_URI) { 
    throw new Error('MASTER_DB_URL env var missing. Set it in Vercel project settings then redeploy.'); 
  } 
  if (cached.conn) return cached.conn; 
  if (!cached.promise) { 
    cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false }).then((m) => m); 
  } 
  cached.conn = await cached.promise; 
  global.mongoose = cached; 
  return cached.conn; 
} 
