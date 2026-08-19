import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Config, User, Campaign } from '@/lib/models';
import jwt from 'jsonwebtoken';

export async function POST(req) {
  await connectDB();
  try {
    const token = req.cookies.get('token')?.value;
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super-secret-key-enterprise');
    const user = await User.findById(decoded.userId);

    const { message, numbers } = await req.json();
    const numbersArray = numbers.split(',').map(n => n.trim());

    if (user.sentCount + numbersArray.length > user.sendingLimit) {
      return NextResponse.json({ error: 'Sending limit exceeded!' }, { status: 403 });
    }

    // Fetch Gemini API Key dynamically from DB
    const geminiConfig = await Config.findOne({ keyName: 'GEMINI_API_KEY' });
    if (!geminiConfig) return NextResponse.json({ error: 'AI Agent not configured by Admin' }, { status: 500 });

    // AI Check
    const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiConfig.keyValue}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Check if this SMS is spam or fraud. Reply only with PASS or SPAM. SMS: "${message}"` }] }]
      })
    });
    
    const aiData = await aiResponse.json();
    const verdict = aiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'SPAM';

    if (verdict.includes('SPAM')) {
      await Campaign.create({ userEmail: user.email, message, numbers: numbersArray, status: 'blocked', aiVerdict: 'SPAM' });
      return NextResponse.json({ error: 'AI blocked this message due to spam policy.' }, { status: 406 });
    }

    // If PASS, log campaign & update limit (Here you will integrate SMS Gateway later)
    await Campaign.create({ userEmail: user.email, message, numbers: numbersArray, status: 'sent', aiVerdict: 'PASS' });
    user.sentCount += numbersArray.length;
    await user.save();

    return NextResponse.json({ success: true, message: 'Message approved by AI & Sent!' });

  } catch (error) {
    return NextResponse.json({ error: 'System Error' }, { status: 500 });
  }
      }
