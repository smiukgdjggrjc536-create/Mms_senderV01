import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Config, User } from '@/lib/models';

export async function POST(req) {
  await connectDB();
  const { keyName, keyValue } = await req.json();
  
  await Config.findOneAndUpdate(
    { keyName },
    { keyValue },
    { upsert: true, new: true }
  );
  return NextResponse.json({ success: true, message: 'Config updated perfectly' });
}

export async function GET() {
  await connectDB();
  const configs = await Config.find({});
  const usersCount = await User.countDocuments();
  return NextResponse.json({ configs, usersCount });
}
