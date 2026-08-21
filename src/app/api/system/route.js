import {
  connectDB,
  reconnectDB,
  User,
  Config,
  Campaign,
  MongoConnection,
  createToken,
  verifyToken,
  comparePassword,
  refreshConfigFile,
  jsonResponse,
} from '@/lib/core';

export async function POST(req) {
  try {
    const body = await req.json();
    const { action } = body;

    // ===== ACTION 1: login =====
    if (action === 'login') {
      await connectDB();
      const { email, password } = body;

      if (!email || !password) {
        return jsonResponse({ error: 'Email and password required' }, 400);
      }

      const userCount = await User.countDocuments();
      if (userCount === 0) {
        const firstUser = new User({
          email: email.toLowerCase(),
          password,
          role: 'admin',
        });
        await firstUser.save();
      }

      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return jsonResponse({ error: 'Invalid Credentials' }, 401);
      }

      const isMatch = await comparePassword(password, user.password);
      if (!isMatch) {
        return jsonResponse({ error: 'Invalid Credentials' }, 401);
      }

      if (user.status !== 'active') {
        return jsonResponse({ error: 'Account Suspended' }, 403);
      }

      const token = await createToken({
        userId: user._id.toString(),
        role: user.role,
        email: user.email,
      });

      const res = jsonResponse(
        {
          success: true,
          role: user.role,
          limit: user.sendingLimit,
          sent: user.sentCount,
          email: user.email,
        },
        200
      );
      res.headers.set(
        'Set-Cookie',
        `token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`
      );
      return res;
    }

    // ===== ACTION 2: saveConfig =====
    if (action === 'saveConfig') {
      const cookieHeader = req.headers.get('cookie') || '';
      const tokenMatch = cookieHeader.match(/token=([^;]+)/);
      const token = tokenMatch ? tokenMatch[1] : null;

      if (!token) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }

      const decoded = await verifyToken(token);
      if (!decoded) {
        return jsonResponse({ error: 'Invalid Token' }, 403);
      }

      if (decoded.role !== 'admin') {
        return jsonResponse({ error: 'Forbidden: Admin only' }, 403);
      }

      const { keyName, keyValue } = body;

      if (!keyName || keyValue === undefined) {
        return jsonResponse({ error: 'keyName and keyValue required' }, 400);
      }

      await connectDB();
      await Config.findOneAndUpdate(
        { keyName },
        { keyValue, updatedAt: new Date() },
        { upsert: true }
      );
      refreshConfigFile(keyName, keyValue);
      return jsonResponse(
        { success: true, message: 'Configuration Saved Successfully!' },
        200
      );
    }

    // ===== ACTION 3: sendCampaign =====
    if (action === 'sendCampaign') {
      const cookieHeader = req.headers.get('cookie') || '';
      const tokenMatch = cookieHeader.match(/token=([^;]+)/);
      const token = tokenMatch ? tokenMatch[1] : null;

      if (!token) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }

      const decoded = await verifyToken(token);
      if (!decoded) {
        return jsonResponse({ error: 'Invalid Token' }, 403);
      }

      const { email, message, numbers } = body;

      if (!email || !message || !numbers) {
        return jsonResponse({ error: 'email, message, numbers required' }, 400);
      }

      if (decoded.email !== email.toLowerCase()) {
        return jsonResponse({ error: 'Email mismatch' }, 403);
      }

      await connectDB();
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return jsonResponse({ error: 'User not found' }, 404);
      }

      const numberArray = numbers
        .split(',')
        .map((n) => n.trim())
        .filter((n) => n.length > 0);

      if (numberArray.length === 0) {
        return jsonResponse({ error: 'No valid numbers provided' }, 400);
      }

      if (user.sentCount + numberArray.length > user.sendingLimit) {
        return jsonResponse({ error: 'Limit Exceeded! Contact Admin.' }, 403);
      }

      const geminiConfig = await Config.findOne({ keyName: 'GEMINI_API_KEY' });
      if (!geminiConfig || !geminiConfig.keyValue) {
        return jsonResponse(
          { error: 'AI Spam Filter not configured by Admin' },
          500
        );
      }

      const aiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiConfig.keyValue}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Is this SMS spam? Reply ONLY with PASS or SPAM: "${message}"`,
                  },
                ],
              },
            ],
          }),
        }
      );
      const aiData = await aiRes.json();
      const verdict =
        aiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'SPAM';

      if (verdict.toUpperCase().includes('SPAM')) {
        await Campaign.create({
          userEmail: email.toLowerCase(),
          message,
          numbers: numberArray,
          status: 'blocked',
          aiVerdict: 'SPAM',
        });
        return jsonResponse({ error: 'Blocked by AI Spam Filter' }, 406);
      }

      await Campaign.create({
        userEmail: email.toLowerCase(),
        message,
        numbers: numberArray,
        status: 'sent',
        aiVerdict: 'PASS',
      });
      user.sentCount += numberArray.length;
      await user.save();
      return jsonResponse(
        { success: true, message: 'Campaign Sent Successfully!' },
        200
      );
    }

    // ===== ACTION 4: getUsers =====
    if (action === 'getUsers') {
      const cookieHeader = req.headers.get('cookie') || '';
      const tokenMatch = cookieHeader.match(/token=([^;]+)/);
      const token = tokenMatch ? tokenMatch[1] : null;
      if (!token) return jsonResponse({ error: 'Unauthorized' }, 401);
      const decoded = await verifyToken(token);
      if (!decoded) return jsonResponse({ error: 'Invalid Token' }, 403);
      if (decoded.role !== 'admin')
        return jsonResponse({ error: 'Forbidden: Admin only' }, 403);

      await connectDB();
      const users = await User.find({}).select('-password').sort({ createdAt: -1 });
      return jsonResponse({ users }, 200);
    }

    // ===== ACTION 5: suspendUser =====
    if (action === 'suspendUser') {
      const cookieHeader = req.headers.get('cookie') || '';
      const tokenMatch = cookieHeader.match(/token=([^;]+)/);
      const token = tokenMatch ? tokenMatch[1] : null;
      if (!token) return jsonResponse({ error: 'Unauthorized' }, 401);
      const decoded = await verifyToken(token);
      if (!decoded) return jsonResponse({ error: 'Invalid Token' }, 403);
      if (decoded.role !== 'admin')
        return jsonResponse({ error: 'Forbidden: Admin only' }, 403);

      const { email: targetEmail } = body;
      if (!targetEmail)
        return jsonResponse({ error: 'Email required' }, 400);
      if (decoded.email === targetEmail.toLowerCase())
        return jsonResponse({ error: 'Cannot suspend yourself' }, 400);

      await connectDB();
      await User.findOneAndUpdate(
        { email: targetEmail.toLowerCase() },
        { status: 'suspended' }
      );
      return jsonResponse({ success: true, message: 'User suspended' }, 200);
    }

    // ===== ACTION 6: activateUser =====
    if (action === 'activateUser') {
      const cookieHeader = req.headers.get('cookie') || '';
      const tokenMatch = cookieHeader.match(/token=([^;]+)/);
      const token = tokenMatch ? tokenMatch[1] : null;
      if (!token) return jsonResponse({ error: 'Unauthorized' }, 401);
      const decoded = await verifyToken(token);
      if (!decoded) return jsonResponse({ error: 'Invalid Token' }, 403);
      if (decoded.role !== 'admin')
        return jsonResponse({ error: 'Forbidden: Admin only' }, 403);

      const { email: targetEmail } = body;
      if (!targetEmail)
        return jsonResponse({ error: 'Email required' }, 400);

      await connectDB();
      await User.findOneAndUpdate(
        { email: targetEmail.toLowerCase() },
        { status: 'active' }
      );
      return jsonResponse({ success: true, message: 'User activated' }, 200);
    }

    // ===== ACTION 7: getCampaigns =====
    if (action === 'getCampaigns') {
      const cookieHeader = req.headers.get('cookie') || '';
      const tokenMatch = cookieHeader.match(/token=([^;]+)/);
      const token = tokenMatch ? tokenMatch[1] : null;
      if (!token) return jsonResponse({ error: 'Unauthorized' }, 401);
      const decoded = await verifyToken(token);
      if (!decoded) return jsonResponse({ error: 'Invalid Token' }, 403);
      if (decoded.role !== 'admin')
        return jsonResponse({ error: 'Forbidden: Admin only' }, 403);

      await connectDB();
      const campaigns = await Campaign.find({})
        .sort({ createdAt: -1 })
        .limit(100);
      return jsonResponse({ campaigns }, 200);
    }

    // ===== ACTION 8: getConfigStatus =====
    if (action === 'getConfigStatus') {
      const cookieHeader = req.headers.get('cookie') || '';
      const tokenMatch = cookieHeader.match(/token=([^;]+)/);
      const token = tokenMatch ? tokenMatch[1] : null;
      if (!token) return jsonResponse({ error: 'Unauthorized' }, 401);
      const decoded = await verifyToken(token);
      if (!decoded) return jsonResponse({ error: 'Invalid Token' }, 403);
      if (decoded.role !== 'admin')
        return jsonResponse({ error: 'Forbidden: Admin only' }, 403);

      await connectDB();
      const configs = await Config.find({});
      const status = {
        MONGODB_URI: false,
        GEMINI_API_KEY: false,
        SMS_API_KEY: false,
      };
      configs.forEach((c) => {
        if (c.keyName && c.keyValue) status[c.keyName] = true;
      });
      return jsonResponse({ status }, 200);
    }

    // ===== ACTION 9: getUserCampaigns =====
    if (action === 'getUserCampaigns') {
      const cookieHeader = req.headers.get('cookie') || '';
      const tokenMatch = cookieHeader.match(/token=([^;]+)/);
      const token = tokenMatch ? tokenMatch[1] : null;
      if (!token) return jsonResponse({ error: 'Unauthorized' }, 401);
      const decoded = await verifyToken(token);
      if (!decoded) return jsonResponse({ error: 'Invalid Token' }, 403);

      await connectDB();
      const user = await User.findOne({ email: decoded.email });
      if (!user) return jsonResponse({ error: 'User not found' }, 404);

      const campaigns = await Campaign.find({ userEmail: decoded.email })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      return jsonResponse(
        {
          campaigns,
          limit: user.sendingLimit,
          sent: user.sentCount,
          status: user.status,
          email: user.email,
          role: user.role,
        },
        200
      );
    }

    // ===== ACTION 10: getMongoConnections =====
    if (action === 'getMongoConnections') {
      const cookieHeader = req.headers.get('cookie') || '';
      const tokenMatch = cookieHeader.match(/token=([^;]+)/);
      const token = tokenMatch ? tokenMatch[1] : null;
      if (!token) return jsonResponse({ error: 'Unauthorized' }, 401);
      const decoded = await verifyToken(token);
      if (!decoded) return jsonResponse({ error: 'Invalid Token' }, 403);
      if (decoded.role !== 'admin')
        return jsonResponse({ error: 'Forbidden: Admin only' }, 403);

      await connectDB();
      const connections = await MongoConnection.find({})
        .sort({ isActive: -1, createdAt: 1 })
        .select('-uri')
        .lean();
      // Return all fields except full URI (show only masked version for security)
      const masked = connections.map((c) => ({
        _id: c._id,
        label: c.label,
        isActive: c.isActive,
        createdAt: c.createdAt,
        uriMasked: c.uri ? c.uri.replace(/:[^:@]+@/, ':****@') : '',
      }));
      return jsonResponse({ connections: masked }, 200);
    }

    // ===== ACTION 11: addMongoConnection =====
    if (action === 'addMongoConnection') {
      const cookieHeader = req.headers.get('cookie') || '';
      const tokenMatch = cookieHeader.match(/token=([^;]+)/);
      const token = tokenMatch ? tokenMatch[1] : null;
      if (!token) return jsonResponse({ error: 'Unauthorized' }, 401);
      const decoded = await verifyToken(token);
      if (!decoded) return jsonResponse({ error: 'Invalid Token' }, 403);
      if (decoded.role !== 'admin')
        return jsonResponse({ error: 'Forbidden: Admin only' }, 403);

      const { label, uri } = body;
      if (!label || !uri)
        return jsonResponse({ error: 'label and uri required' }, 400);

      await connectDB();

      // Check for duplicate
      const existing = await MongoConnection.findOne({ uri });
      if (existing)
        return jsonResponse({ error: 'This URI already exists' }, 409);

      // Count existing connections
      const count = await MongoConnection.countDocuments();
      const makeActive = count === 0;

      await MongoConnection.create({
        label: label.trim(),
        uri: uri.trim(),
        isActive: makeActive,
      });

      return jsonResponse(
        {
          success: true,
          message: makeActive
            ? 'MongoDB connection added and set as active!'
            : 'MongoDB connection added!',
        },
        200
      );
    }

    // ===== ACTION 12: deleteMongoConnection =====
    if (action === 'deleteMongoConnection') {
      const cookieHeader = req.headers.get('cookie') || '';
      const tokenMatch = cookieHeader.match(/token=([^;]+)/);
      const token = tokenMatch ? tokenMatch[1] : null;
      if (!token) return jsonResponse({ error: 'Unauthorized' }, 401);
      const decoded = await verifyToken(token);
      if (!decoded) return jsonResponse({ error: 'Invalid Token' }, 403);
      if (decoded.role !== 'admin')
        return jsonResponse({ error: 'Forbidden: Admin only' }, 403);

      const { connectionId } = body;
      if (!connectionId)
        return jsonResponse({ error: 'connectionId required' }, 400);

      await connectDB();
      const conn = await MongoConnection.findById(connectionId);
      if (!conn)
        return jsonResponse({ error: 'Connection not found' }, 404);

      const wasActive = conn.isActive;
      await MongoConnection.findByIdAndDelete(connectionId);

      // If we deleted the active connection, activate the first remaining one
      if (wasActive) {
        const remaining = await MongoConnection.findOne({}).sort({
          createdAt: 1,
        });
        if (remaining) {
          remaining.isActive = true;
          await remaining.save();
          await reconnectDB(remaining.uri);
        }
      }

      return jsonResponse(
        { success: true, message: 'Connection deleted' },
        200
      );
    }

    // ===== ACTION 13: setActiveMongo =====
    if (action === 'setActiveMongo') {
      const cookieHeader = req.headers.get('cookie') || '';
      const tokenMatch = cookieHeader.match(/token=([^;]+)/);
      const token = tokenMatch ? tokenMatch[1] : null;
      if (!token) return jsonResponse({ error: 'Unauthorized' }, 401);
      const decoded = await verifyToken(token);
      if (!decoded) return jsonResponse({ error: 'Invalid Token' }, 403);
      if (decoded.role !== 'admin')
        return jsonResponse({ error: 'Forbidden: Admin only' }, 403);

      const { connectionId } = body;
      if (!connectionId)
        return jsonResponse({ error: 'connectionId required' }, 400);

      await connectDB();
      const conn = await MongoConnection.findById(connectionId);
      if (!conn)
        return jsonResponse({ error: 'Connection not found' }, 404);

      // Deactivate all, activate the selected one
      await MongoConnection.updateMany({}, { isActive: false });
      conn.isActive = true;
      await conn.save();

      // Reconnect to the new URI
      try {
        await reconnectDB(conn.uri);
      } catch (err) {
        return jsonResponse(
          { error: 'Failed to connect to new database: ' + err.message },
          500
        );
      }

      return jsonResponse(
        { success: true, message: 'Active database switched successfully!' },
        200
      );
    }

    return jsonResponse({ error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('API Error:', error);
    return jsonResponse({ error: 'Internal Server Error' }, 500);
  }
}
