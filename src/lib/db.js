import mongoose from 'mongoose';

const MONGODB_URI = process.env.MASTER_DB_URL;

if (!MONGODB_URI) {
  throw new Error('Please define the MASTER_DB_URL environment variable inside .env');
}

let cached = global.mongoose || { conn: null, promise: null };

export async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false }).then((m) => m);
  }
  cached.conn = await cached.promise;
  global.mongoose = cached;
  return cached.conn;
}
