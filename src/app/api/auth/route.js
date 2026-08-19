import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/lib/models';
import jwt from 'jsonwebtoken';

export async function POST(req) {
  await connectDB();
  const { email, password } = await req.json();

  // Auto Create Admin on first run if DB is empty
  const userCount = await User.countDocuments();
  if (userCount === 0) {
    await User.create({ email, password, role: 'admin' });
  }

  const user = await User.findOne({ email, password });
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  if (user.status !== 'active') {
    return NextResponse.json({ error: 'Account suspended' }, { status: 403 });
  }

  const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET || 'super-secret-key-enterprise', { expiresIn: '1d' });
  
  const response = NextResponse.json({ success: true, role: user.role });
  response.cookies.set({
    name: 'token',
    value: token,
    httpOnly: true,
    path: '/',
  });
  return response;
}
