import {
  connectDB,
  reconnectDB,
  User,
  Config,
  Campaign,
  MongoConnection,
  AdminCredential,
  createToken,
  verifyToken,
  comparePassword,
  ensureAdminCredentials,
  verifyAdminLogin,
  getAdminCredentialsInfo,
  updateAdminUsername,
  updateAdminPassword,
  updateAdminApiKey,
  generateRandomPassword,
  generateRandomApiKey,
  refreshConfigFile,
  jsonResponse,
} from '@/lib/core';

// Helper: extract token from request cookies
function getTokenFromReq(req) {
  const cookieHeader = req.headers.get('cookie') || '';
  const tokenMatch = cookieHeader.match(/token=([^;]+)/);
  return tokenMatch ? tokenMatch[1] : null;
}

// Helper: verify admin token (for admin-only actions)
async function verifyAdmin(req) {
  const token = getTokenFromReq(req);
  if (!token) return { error: 'Unauthorized', code: 401 };
  const decoded = await verifyToken(token);
  if (!decoded) return { error: 'Invalid Token', code: 403 };
  if (decoded.role !== 'admin') return { error: 'Forbidden: Admin only', code: 403 };
  return { decoded };
}

// Helper: verify any valid token (user or admin)
async function verifyAny(req) {
  const token = getTokenFromReq(req);
  if (!token) return { error: 'Unauthorized', code: 401 };
  const decoded = await verifyToken(token);
  if (!decoded) return { error: 'Invalid Token', code: 403 };
  return { decoded };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { action } = body;

    // ================================================================
    // ADMIN PANEL ACTIONS (Netlify only — 3-layer security login)
    // ================================================================

    // ===== ACTION: adminLogin (3-layer: username + password + apiKey) =====
    if (action === 'adminLogin') {
      await connectDB();
      const { username, password, apiKey } = body;

      if (!username || !password || !apiKey) {
        return jsonResponse({ error: 'Username, password, and API key are all required' }, 400);
      }

      // Ensure default admin credentials exist (creates on first call)
      const newCreds = await ensureAdminCredentials();
      // If just created, we need the plain credentials to verify
      // But the admin must type them — so if just created, show error with hint
      if (newCreds) {
        // Return the generated credentials so admin can use them first time
        return jsonResponse({
          success: false,
          firstSetup: true,
          message: 'Admin credentials generated for first time. Please save these and login again:',
          credentials: newCreds,
        }, 200);
      }

      const result = await verifyAdminLogin(username, password, apiKey);
      if (!result.success) {
        return jsonResponse({ error: result.error }, 401);
      }

      const token = await createToken({
        userId: 'admin',
        role: 'admin',
        email: 'admin@system',
        username: result.admin.username,
      });

      const res = jsonResponse({ success: true, role: 'admin', username: result.admin.username }, 200);
      res.headers.set(
        'Set-Cookie',
        `token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`
      );
      return res;
    }

    // ===== ACTION: getAdminCredentials (view current admin creds — masked) =====
    if (action === 'getAdminCredentials') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);

      await connectDB();
      const info = await getAdminCredentialsInfo();
      if (!info) {
        return jsonResponse({ error: 'No admin credentials found' }, 404);
      }
      return jsonResponse({ credentials: info }, 200);
    }

    // ===== ACTION: updateAdminUsername =====
    if (action === 'updateAdminUsername') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);

      const { newUsername } = body;
      if (!newUsername || newUsername.trim().length < 3) {
        return jsonResponse({ error: 'Username must be at least 3 characters' }, 400);
      }

      await connectDB();
      const result = await updateAdminUsername(newUsername.trim());
      if (!result.success) {
        return jsonResponse({ error: result.error }, 409);
      }
      return jsonResponse({ success: true, message: 'Username updated successfully!' }, 200);
    }

    // ===== ACTION: updateAdminPassword =====
    if (action === 'updateAdminPassword') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);

      const { newPassword } = body;
      if (!newPassword || newPassword.length < 8) {
        return jsonResponse({ error: 'Password must be at least 8 characters' }, 400);
      }

      await connectDB();
      const result = await updateAdminPassword(newPassword);
      if (!result.success) {
        return jsonResponse({ error: result.error }, 500);
      }
      return jsonResponse({ success: true, message: 'Password updated successfully!' }, 200);
    }

    // ===== ACTION: updateAdminApiKey (generate new random API key) =====
    if (action === 'updateAdminApiKey') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);

      await connectDB();
      const result = await updateAdminApiKey();
      if (!result.success) {
        return jsonResponse({ error: result.error }, 500);
      }
      return jsonResponse({ success: true, message: 'API key regenerated!', apiKey: result.apiKey }, 200);
    }

    // ===== ACTION: saveConfig (admin saves Gemini/SMS/MongoDB keys) =====
    if (action === 'saveConfig') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);

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
      return jsonResponse({ success: true, message: 'Configuration Saved Successfully!' }, 200);
    }

    // ===== ACTION: getUsers (admin views all users) =====
    if (action === 'getUsers') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);

      await connectDB();
      const users = await User.find({}).select('-password').sort({ createdAt: -1 });
      return jsonResponse({ users }, 200);
    }

    // ===== ACTION: createUser (admin creates a new user) =====
    if (action === 'createUser') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);

      const { email, password, sendingLimit } = body;
      if (!email || !password) {
        return jsonResponse({ error: 'Email and password required' }, 400);
      }
      if (password.length < 6) {
        return jsonResponse({ error: 'Password must be at least 6 characters' }, 400);
      }

      await connectDB();
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        return jsonResponse({ error: 'User already exists' }, 409);
      }

      const newUser = new User({
        email: email.toLowerCase(),
        password,
        role: 'user',
        sendingLimit: sendingLimit || 100,
      });
      await newUser.save();
      return jsonResponse({ success: true, message: 'User created successfully!' }, 200);
    }

    // ===== ACTION: updateUserLimit (admin changes user SMS limit) =====
    if (action === 'updateUserLimit') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);

      const { email: targetEmail, limit } = body;
      if (!targetEmail || limit === undefined) {
        return jsonResponse({ error: 'Email and limit required' }, 400);
      }

      await connectDB();
      await User.findOneAndUpdate(
        { email: targetEmail.toLowerCase() },
        { sendingLimit: Number(limit) }
      );
      return jsonResponse({ success: true, message: 'User limit updated' }, 200);
    }

    // ===== ACTION: suspendUser =====
    if (action === 'suspendUser') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);

      const { email: targetEmail } = body;
      if (!targetEmail) return jsonResponse({ error: 'Email required' }, 400);

      await connectDB();
      await User.findOneAndUpdate(
        { email: targetEmail.toLowerCase() },
        { status: 'suspended' }
      );
      return jsonResponse({ success: true, message: 'User suspended' }, 200);
    }

    // ===== ACTION: activateUser =====
    if (action === 'activateUser') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);

      const { email: targetEmail } = body;
      if (!targetEmail) return jsonResponse({ error: 'Email required' }, 400);

      await connectDB();
      await User.findOneAndUpdate(
        { email: targetEmail.toLowerCase() },
        { status: 'active' }
      );
      return jsonResponse({ success: true, message: 'User activated' }, 200);
    }

    // ===== ACTION: deleteUser =====
    if (action === 'deleteUser') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);

      const { email: targetEmail } = body;
      if (!targetEmail) return jsonResponse({ error: 'Email required' }, 400);

      await connectDB();
      await User.findOneAndDelete({ email: targetEmail.toLowerCase() });
      return jsonResponse({ success: true, message: 'User deleted' }, 200);
    }

    // ===== ACTION: getCampaigns (admin views all campaigns) =====
    if (action === 'getCampaigns') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);

      await connectDB();
      const campaigns = await Campaign.find({})
        .sort({ createdAt: -1 })
        .limit(100);
      return jsonResponse({ campaigns }, 200);
    }

    // ===== ACTION: getConfigStatus =====
    if (action === 'getConfigStatus') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);

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

    // ===== ACTION: getMongoConnections =====
    if (action === 'getMongoConnections') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);

      await connectDB();
      const connections = await MongoConnection.find({})
        .sort({ isActive: -1, createdAt: 1 })
        .select('-uri')
        .lean();
      const masked = connections.map((c) => ({
        _id: c._id,
        label: c.label,
        isActive: c.isActive,
        createdAt: c.createdAt,
        uriMasked: c.uri ? c.uri.replace(/:[^:@]+@/, ':****@') : '',
      }));
      return jsonResponse({ connections: masked }, 200);
    }

    // ===== ACTION: addMongoConnection =====
    if (action === 'addMongoConnection') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);

      const { label, uri } = body;
      if (!label || !uri) return jsonResponse({ error: 'label and uri required' }, 400);

      await connectDB();
      const existing = await MongoConnection.findOne({ uri });
      if (existing) return jsonResponse({ error: 'This URI already exists' }, 409);

      const count = await MongoConnection.countDocuments();
      const makeActive = count === 0;

      await MongoConnection.create({
        label: label.trim(),
        uri: uri.trim(),
        isActive: makeActive,
      });

      return jsonResponse({
        success: true,
        message: makeActive
          ? 'MongoDB connection added and set as active!'
          : 'MongoDB connection added!',
      }, 200);
    }

    // ===== ACTION: deleteMongoConnection =====
    if (action === 'deleteMongoConnection') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);

      const { connectionId } = body;
      if (!connectionId) return jsonResponse({ error: 'connectionId required' }, 400);

      await connectDB();
      const conn = await MongoConnection.findById(connectionId);
      if (!conn) return jsonResponse({ error: 'Connection not found' }, 404);

      const wasActive = conn.isActive;
      await MongoConnection.findByIdAndDelete(connectionId);

      if (wasActive) {
        const remaining = await MongoConnection.findOne({}).sort({ createdAt: 1 });
        if (remaining) {
          remaining.isActive = true;
          await remaining.save();
          await reconnectDB(remaining.uri);
        }
      }

      return jsonResponse({ success: true, message: 'Connection deleted' }, 200);
    }

    // ===== ACTION: setActiveMongo =====
    if (action === 'setActiveMongo') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);

      const { connectionId } = body;
      if (!connectionId) return jsonResponse({ error: 'connectionId required' }, 400);

      await connectDB();
      const conn = await MongoConnection.findById(connectionId);
      if (!conn) return jsonResponse({ error: 'Connection not found' }, 404);

      await MongoConnection.updateMany({}, { isActive: false });
      conn.isActive = true;
      await conn.save();

      try {
        await reconnectDB(conn.uri);
      } catch (err) {
        return jsonResponse({ error: 'Failed to connect to new database: ' + err.message }, 500);
      }

      return jsonResponse({ success: true, message: 'Active database switched successfully!' }, 200);
    }

    // ================================================================
    // USER PANEL ACTIONS (Vercel only — username + password login)
    // ================================================================

    // ===== ACTION: registerUser (user self-registration) =====
    if (action === 'registerUser') {
      await connectDB();
      const { email, password } = body;

      if (!email || !password) {
        return jsonResponse({ error: 'Email and password required' }, 400);
      }
      if (password.length < 6) {
        return jsonResponse({ error: 'Password must be at least 6 characters' }, 400);
      }

      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        return jsonResponse({ error: 'Email already registered. Please login.' }, 409);
      }

      const newUser = new User({
        email: email.toLowerCase(),
        password,
        role: 'user',
        sendingLimit: 100,
      });
      await newUser.save();

      // Auto-login after registration
      const token = await createToken({
        userId: newUser._id.toString(),
        role: 'user',
        email: newUser.email,
      });

      const res = jsonResponse({
        success: true,
        role: 'user',
        limit: newUser.sendingLimit,
        sent: newUser.sentCount,
        email: newUser.email,
      }, 200);
      res.headers.set(
        'Set-Cookie',
        `token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`
      );
      return res;
    }

    // ===== ACTION: login (user login — username/email + password) =====
    if (action === 'login') {
      await connectDB();
      const { email, password } = body;

      if (!email || !password) {
        return jsonResponse({ error: 'Email and password required' }, 400);
      }

      // NOTE: No auto-admin creation anymore. Users are 'user' role only.
      // Admin access is separate (adminLogin action with 3-layer security).
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

      const res = jsonResponse({
        success: true,
        role: user.role,
        limit: user.sendingLimit,
        sent: user.sentCount,
        email: user.email,
      }, 200);
      res.headers.set(
        'Set-Cookie',
        `token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`
      );
      return res;
    }

    // ===== ACTION: getUserCampaigns (user views own campaigns + quota) =====
    if (action === 'getUserCampaigns') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);

      await connectDB();
      const user = await User.findOne({ email: auth.decoded.email });
      if (!user) return jsonResponse({ error: 'User not found' }, 404);

      const campaigns = await Campaign.find({ userEmail: auth.decoded.email })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      return jsonResponse({
        campaigns,
        limit: user.sendingLimit,
        sent: user.sentCount,
        status: user.status,
        email: user.email,
        role: user.role,
      }, 200);
    }

    // ===== ACTION: sendCampaign =====
    if (action === 'sendCampaign') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);

      const { email, message, numbers } = body;

      if (!email || !message || !numbers) {
        return jsonResponse({ error: 'email, message, numbers required' }, 400);
      }

      if (auth.decoded.email !== email.toLowerCase()) {
        return jsonResponse({ error: 'Email mismatch' }, 403);
      }

      await connectDB();
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) return jsonResponse({ error: 'User not found' }, 404);

      if (user.status !== 'active') {
        return jsonResponse({ error: 'Account Suspended' }, 403);
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
        return jsonResponse({ error: 'AI Spam Filter not configured by Admin' }, 500);
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
      return jsonResponse({ success: true, message: 'Campaign Sent Successfully!' }, 200);
    }

    // ===== ACTION: checkSession (verify if token is still valid) =====
    if (action === 'checkSession') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);

      await connectDB();
      if (auth.decoded.role === 'admin') {
        return jsonResponse({
          valid: true,
          role: 'admin',
          username: auth.decoded.username,
        }, 200);
      }

      const user = await User.findOne({ email: auth.decoded.email });
      if (!user) return jsonResponse({ error: 'User not found' }, 404);

      return jsonResponse({
        valid: true,
        role: user.role,
        limit: user.sendingLimit,
        sent: user.sentCount,
        status: user.status,
        email: user.email,
      }, 200);
    }

    return jsonResponse({ error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('API Error:', error);
    return jsonResponse({ error: 'Internal Server Error' }, 500);
  }
}
