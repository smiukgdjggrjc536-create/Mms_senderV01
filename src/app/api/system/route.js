import {
  connectDB,
  reconnectDB,
  User,
  Config,
  Campaign,
  MongoConnection,
  AdminCredential,
  SenderApi,
  GeminiApi,
  MessageTemplate,
  ContentAsset,
  ActivityLog,
  Blacklist,
  DeliveryReport,
  AppSettings,
  VerificationCode,
  ScheduledSend,
  AutoReplyConfig,
  SmsInbound,
  createToken,
  verifyToken,
  comparePassword,
  hashPassword,
  ensureAdminCredentials,
  verifyAdminLogin,
  getAdminCredentialsInfo,
  updateAdminUsername,
  updateAdminPassword,
  updateAdminApiKey,
  updateAdminEmail,
  createSubAdmin,
  getSubAdmins,
  updateSubAdminPermissions,
  deleteSubAdmin,
  createVerificationCode,
  verifyCode,
  getBestSenderApi,
  getBestGeminiApi,
  updateSenderApiUsage,
  updateGeminiApiUsage,
  validatePhoneNumber,
  getCountryCode,
  getDashboardStats,
  logActivity,
  getAppSettings,
  updateAppSettings,
  sendAlert,
  generateRandomApiKey,
  refreshConfigFile,
  jsonResponse,
  bulkSendEngine,
  executeRealSend,
  sendWithRetry,
  scoreSpamHeuristic,
  geminiSpamReview,
  enforceCountryRules,
} from '@/lib/core';

// Helper: extract token from request cookies
function getTokenFromReq(req) {
  const cookieHeader = req.headers.get('cookie') || '';
  const tokenMatch = cookieHeader.match(/token=([^;]+)/);
  return tokenMatch ? tokenMatch[1] : null;
}

// Helper: get client IP
function getClientIP(req) {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return null;
}

// Helper: verify admin token (for admin-only actions)
async function verifyAdmin(req) {
  const token = getTokenFromReq(req);
  if (!token) return { error: 'Unauthorized', code: 401 };
  const decoded = await verifyToken(token);
  if (!decoded) return { error: 'Invalid Token', code: 403 };
  if (decoded.role !== 'admin' && decoded.role !== 'superadmin') return { error: 'Forbidden: Admin only', code: 403 };
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

// Helper: check sub-admin permissions
function hasPermission(decoded, perm) {
  if (decoded.role === 'superadmin') return true;
  if (decoded.role === 'admin') return true;
  if (decoded.permissions && decoded.permissions.includes('all')) return true;
  if (decoded.permissions && decoded.permissions.includes(perm)) return true;
  return false;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { action } = body;
    const clientIP = getClientIP(req);

    // ================================================================
    // ADMIN PANEL ACTIONS (Netlify only — 3-layer security login)
    // ================================================================

    // ===== ACTION: adminLogin (3-layer: username + password + apiKey) =====
    if (action === 'adminLogin') {
      await connectDB();
      const { username, password, apiKey } = body;

      if (!username || !password || !apiKey) {
        return jsonResponse({ error: 'All three fields required (username, password, API key)' }, 400);
      }

      // First time — auto-generate credentials
      const firstCreds = await ensureAdminCredentials();
      if (firstCreds) {
        return jsonResponse({
          success: false,
          firstSetup: true,
          message: 'Admin credentials generated for first time. Please save these and login again:',
          credentials: firstCreds,
        });
      }

      const result = await verifyAdminLogin(username, password, apiKey);
      if (result.success) {
        const adminObj = result.admin.toObject ? result.admin.toObject() : result.admin;
        const permArr = Array.isArray(adminObj.permissions) ? [...adminObj.permissions] : [];
        const token = await createToken({
          userId: adminObj._id.toString(),
          role: adminObj.role === 'subadmin' ? 'subadmin' : 'admin',
          username: adminObj.username,
          permissions: permArr,
        });
        await logActivity(adminObj._id.toString(), 'admin', adminObj.username, 'login', 'Admin logged in', clientIP);
        const res = jsonResponse({
          success: true,
          role: adminObj.role === 'subadmin' ? 'subadmin' : 'admin',
          username: adminObj.username,
          permissions: permArr,
        });
        res.headers.set('Set-Cookie', `token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`);
        return res;
      } else {
        return jsonResponse({ error: result.error }, 401);
      }
    }

    // ===== ACTION: getDashboardStats (real-time dashboard) =====
    if (action === 'getDashboardStats') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const stats = await getDashboardStats();
      return jsonResponse({ success: true, stats });
    }

    // ===== ACTION: getAdminCredentials =====
    if (action === 'getAdminCredentials') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const info = await getAdminCredentialsInfo();
      return jsonResponse({ success: true, credentials: info });
    }

    // ===== ACTION: updateAdminUsername =====
    if (action === 'updateAdminUsername') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { newUsername, verificationCode } = body;
      if (!newUsername) return jsonResponse({ error: 'New username required' }, 400);
      // Mail verification required
      const admin = await AdminCredential.findOne({ role: 'superadmin' }) || await AdminCredential.findOne({});
      if (admin && admin.email) {
        if (!verificationCode) {
          const code = await createVerificationCode(admin.email, 'admin_change');
          return jsonResponse({ success: false, needVerification: true, message: 'Verification code sent to admin email' });
        }
        const vResult = await verifyCode(admin.email, verificationCode, 'admin_change');
        if (!vResult.success) return jsonResponse({ error: vResult.error }, 400);
      }
      const result = await updateAdminUsername(newUsername);
      await logActivity(auth.decoded.userId, 'admin', auth.decoded.username, 'update_username', `Changed to ${newUsername}`, clientIP);
      return jsonResponse(result, result.success ? 200 : 400);
    }

    // ===== ACTION: updateAdminPassword =====
    if (action === 'updateAdminPassword') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { newPassword, verificationCode } = body;
      if (!newPassword || newPassword.length < 8) return jsonResponse({ error: 'Password must be at least 8 characters' }, 400);
      const admin = await AdminCredential.findOne({ role: 'superadmin' }) || await AdminCredential.findOne({});
      if (admin && admin.email) {
        if (!verificationCode) {
          const code = await createVerificationCode(admin.email, 'admin_change');
          return jsonResponse({ success: false, needVerification: true, message: 'Verification code sent to admin email' });
        }
        const vResult = await verifyCode(admin.email, verificationCode, 'admin_change');
        if (!vResult.success) return jsonResponse({ error: vResult.error }, 400);
      }
      const result = await updateAdminPassword(newPassword);
      await logActivity(auth.decoded.userId, 'admin', auth.decoded.username, 'update_password', 'Password changed', clientIP);
      return jsonResponse(result, result.success ? 200 : 400);
    }

    // ===== ACTION: updateAdminApiKey =====
    if (action === 'updateAdminApiKey') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { verificationCode } = body;
      const admin = await AdminCredential.findOne({ role: 'superadmin' }) || await AdminCredential.findOne({});
      if (admin && admin.email) {
        if (!verificationCode) {
          const code = await createVerificationCode(admin.email, 'admin_change');
          return jsonResponse({ success: false, needVerification: true, message: 'Verification code sent to admin email' });
        }
        const vResult = await verifyCode(admin.email, verificationCode, 'admin_change');
        if (!vResult.success) return jsonResponse({ error: vResult.error }, 400);
      }
      const result = await updateAdminApiKey();
      await logActivity(auth.decoded.userId, 'admin', auth.decoded.username, 'update_apikey', 'API key regenerated', clientIP);
      return jsonResponse(result, result.success ? 200 : 400);
    }

    // ===== ACTION: updateAdminEmail =====
    if (action === 'updateAdminEmail') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { email } = body;
      if (!email) return jsonResponse({ error: 'Email required' }, 400);
      const result = await updateAdminEmail(email);
      return jsonResponse(result, result.success ? 200 : 400);
    }

    // ===== ACTION: sendVerificationCode (admin mail verification) =====
    if (action === 'sendVerificationCode') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { email, purpose } = body;
      const targetEmail = email || (await getAdminCredentialsInfo())?.email;
      if (!targetEmail) return jsonResponse({ error: 'No email set. Set admin email first.' }, 400);
      const code = await createVerificationCode(targetEmail, purpose || 'admin_change');
      // In production, send via SMTP. For now, return code for demo/testing
      return jsonResponse({ success: true, message: 'Verification code sent', code: code });
    }

    // ===== ACTION: verifyCodeAction =====
    if (action === 'verifyCodeAction') {
      await connectDB();
      const { email, code, purpose } = body;
      const result = await verifyCode(email, code, purpose || 'admin_change');
      return jsonResponse(result, result.success ? 200 : 400);
    }

    // ===== ACTION: saveConfig (save API keys to DB) =====
    if (action === 'saveConfig') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { keyName, keyValue } = body;
      if (!keyName || !keyValue) return jsonResponse({ error: 'keyName and keyValue required' }, 400);
      await Config.findOneAndUpdate(
        { keyName },
        { keyName, keyValue, updatedAt: new Date() },
        { upsert: true }
      );
      refreshConfigFile(keyName, keyValue);
      await logActivity(auth.decoded.userId, 'admin', auth.decoded.username, 'save_config', `${keyName} updated`, clientIP);
      return jsonResponse({ success: true });
    }

    // ===== ACTION: getConfigStatus =====
    if (action === 'getConfigStatus') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const configs = await Config.find().lean();
      const configMap = {};
      configs.forEach(c => {
        configMap[c.keyName] = c.keyValue.substring(0, 4) + '••••••••';
      });
      return jsonResponse({ success: true, configs: configMap });
    }

    // ================================================================
    // SENDER API MANAGEMENT (up to 10 APIs)
    // ================================================================

    // ===== ACTION: getSenderApis =====
    if (action === 'getSenderApis') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const apis = await SenderApi.find().sort({ priority: -1, createdAt: 1 }).lean();
      return jsonResponse({ success: true, apis: apis.map(a => ({ ...a, apiKey: a.apiKey.substring(0, 6) + '••••••', apiSecret: a.apiSecret ? '••••' : '' })) });
    }

    // ===== ACTION: addSenderApi =====
    if (action === 'addSenderApi') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const count = await SenderApi.countDocuments();
      if (count >= 10) return jsonResponse({ error: 'Maximum 10 sender APIs allowed' }, 400);
      const { name, provider, apiKey, apiSecret, endpoint, senderId, limit, priority, autoRoute } = body;
      if (!name || !apiKey) return jsonResponse({ error: 'Name and API key required' }, 400);
      const api = await SenderApi.create({
        name, provider: provider || 'custom', apiKey, apiSecret: apiSecret || '',
        endpoint: endpoint || '', senderId: senderId || '',
        limit: limit || 1000, remaining: limit || 1000,
        priority: priority || 0, autoRoute: autoRoute !== false,
      });
      await logActivity(auth.decoded.userId, 'admin', auth.decoded.username, 'add_sender_api', `Added: ${name}`, clientIP);
      return jsonResponse({ success: true, id: api._id });
    }

    // ===== ACTION: updateSenderApi =====
    if (action === 'updateSenderApi') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { id, ...updates } = body;
      if (!id) return jsonResponse({ error: 'ID required' }, 400);
      // Don't allow updating used/remaining directly (those are tracked automatically)
      delete updates.used;
      delete updates.remaining;
      delete updates.totalSent;
      delete updates.totalInbox;
      delete updates.totalSpam;
      delete updates.healthScore;
      if (updates.limit) updates.remaining = Math.max(0, updates.limit - (await SenderApi.findById(id)).used);
      await SenderApi.findByIdAndUpdate(id, updates);
      await logActivity(auth.decoded.userId, 'admin', auth.decoded.username, 'update_sender_api', `Updated: ${id}`, clientIP);
      return jsonResponse({ success: true });
    }

    // ===== ACTION: deleteSenderApi =====
    if (action === 'deleteSenderApi') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { id } = body;
      await SenderApi.findByIdAndDelete(id);
      await logActivity(auth.decoded.userId, 'admin', auth.decoded.username, 'delete_sender_api', `Deleted: ${id}`, clientIP);
      return jsonResponse({ success: true });
    }

    // ===== ACTION: setAutoRoute (toggle auto routing) =====
    if (action === 'setAutoRoute') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { id, type, autoRoute } = body;
      if (type === 'sender') {
        await SenderApi.findByIdAndUpdate(id, { autoRoute });
      } else {
        await GeminiApi.findByIdAndUpdate(id, { autoRoute });
      }
      return jsonResponse({ success: true });
    }

    // ================================================================
    // GEMINI API MANAGEMENT (up to 10 APIs)
    // ================================================================

    if (action === 'getGeminiApis') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const apis = await GeminiApi.find().sort({ priority: -1, createdAt: 1 }).lean();
      return jsonResponse({ success: true, apis: apis.map(a => ({ ...a, apiKey: a.apiKey.substring(0, 6) + '••••••' })) });
    }

    if (action === 'addGeminiApi') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const count = await GeminiApi.countDocuments();
      if (count >= 10) return jsonResponse({ error: 'Maximum 10 Gemini APIs allowed' }, 400);
      const { name, apiKey, model, endpoint, limit, priority, autoRoute } = body;
      if (!name || !apiKey) return jsonResponse({ error: 'Name and API key required' }, 400);
      const api = await GeminiApi.create({
        name, apiKey, model: model || 'gemini-1.5-flash',
        endpoint: endpoint || 'https://generativelanguage.googleapis.com/v1beta/models',
        limit: limit || 1500, remaining: limit || 1500,
        priority: priority || 0, autoRoute: autoRoute !== false,
      });
      await logActivity(auth.decoded.userId, 'admin', auth.decoded.username, 'add_gemini_api', `Added: ${name}`, clientIP);
      return jsonResponse({ success: true, id: api._id });
    }

    if (action === 'updateGeminiApi') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { id, ...updates } = body;
      if (!id) return jsonResponse({ error: 'ID required' }, 400);
      delete updates.used;
      delete updates.remaining;
      delete updates.healthScore;
      if (updates.limit) updates.remaining = Math.max(0, updates.limit - (await GeminiApi.findById(id)).used);
      await GeminiApi.findByIdAndUpdate(id, updates);
      return jsonResponse({ success: true });
    }

    if (action === 'deleteGeminiApi') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { id } = body;
      await GeminiApi.findByIdAndDelete(id);
      return jsonResponse({ success: true });
    }

    // ================================================================
    // MESSAGE TEMPLATE MANAGEMENT
    // ================================================================

    if (action === 'getTemplates') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const templates = await MessageTemplate.find({ isActive: true }).sort({ type: 1, name: 1 }).lean();
      return jsonResponse({ success: true, templates });
    }

    if (action === 'addTemplate') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { name, type, content, variables } = body;
      if (!name || !content) return jsonResponse({ error: 'Name and content required' }, 400);
      const tpl = await MessageTemplate.create({ name, type: type || 'custom', content, variables: variables || [] });
      await logActivity(auth.decoded.userId, 'admin', auth.decoded.username, 'add_template', `Added: ${name}`, clientIP);
      return jsonResponse({ success: true, id: tpl._id });
    }

    if (action === 'updateTemplate') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { id, ...updates } = body;
      await MessageTemplate.findByIdAndUpdate(id, updates);
      return jsonResponse({ success: true });
    }

    if (action === 'deleteTemplate') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { id } = body;
      await MessageTemplate.findByIdAndDelete(id);
      return jsonResponse({ success: true });
    }

    // ================================================================
    // CONTENT ASSET MANAGEMENT (logos, photos)
    // ================================================================

    if (action === 'getContent') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const assets = await ContentAsset.find().sort({ createdAt: -1 }).lean();
      return jsonResponse({ success: true, assets });
    }

    if (action === 'addContent') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { type, name, data, url, purpose, mimeType, size } = body;
      if (!name) return jsonResponse({ error: 'Name required' }, 400);
      const asset = await ContentAsset.create({
        type: type || 'photo', name, data: data || '', url: url || '',
        purpose: purpose || 'sending', mimeType: mimeType || 'image/png', size: size || 0,
      });
      await logActivity(auth.decoded.userId, 'admin', auth.decoded.username, 'add_content', `Added: ${name}`, clientIP);
      return jsonResponse({ success: true, id: asset._id });
    }

    if (action === 'deleteContent') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { id } = body;
      await ContentAsset.findByIdAndDelete(id);
      return jsonResponse({ success: true });
    }

    // ================================================================
    // SUB-ADMIN MANAGEMENT
    // ================================================================

    if (action === 'getSubAdmins') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const subs = await getSubAdmins();
      return jsonResponse({ success: true, subAdmins: subs });
    }

    if (action === 'createSubAdmin') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { username, password, permissions } = body;
      if (!username || !password) return jsonResponse({ error: 'Username and password required' }, 400);
      const apiKey = generateRandomApiKey();
      const result = await createSubAdmin(username, password, apiKey, permissions);
      if (result.success) {
        await logActivity(auth.decoded.userId, 'admin', auth.decoded.username, 'create_subadmin', `Created: ${username}`, clientIP);
        return jsonResponse({ success: true, id: result.id, apiKey });
      }
      return jsonResponse({ error: result.error }, 400);
    }

    if (action === 'updateSubAdminPermissions') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { id, permissions } = body;
      const result = await updateSubAdminPermissions(id, permissions);
      return jsonResponse(result, result.success ? 200 : 400);
    }

    if (action === 'deleteSubAdmin') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { id } = body;
      const result = await deleteSubAdmin(id);
      await logActivity(auth.decoded.userId, 'admin', auth.decoded.username, 'delete_subadmin', `Deleted: ${id}`, clientIP);
      return jsonResponse(result, result.success ? 200 : 400);
    }

    // ================================================================
    // USER MANAGEMENT (enhanced)
    // ================================================================

    if (action === 'getUsers') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const users = await User.find({ role: 'user' }).select('-password').lean();
      const now = new Date();
      return jsonResponse({
        success: true,
        users: users.map(u => ({
          ...u,
          isOnline: u.lastActiveAt && new Date(now.getTime() - 5 * 60 * 1000) < u.lastActiveAt,
          expiryDaysLeft: u.expiryDate ? Math.ceil((u.expiryDate - now) / (24 * 60 * 60 * 1000)) : null,
          lastActiveAgo: u.lastActiveAt ? timeAgoStr(u.lastActiveAt, now) : 'Never',
          lastSendAgo: u.lastSendAt ? timeAgoStr(u.lastSendAt, now) : 'Never',
        })),
      });
    }

    if (action === 'createUser') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { email, password, sendingLimit, expiryDays } = body;
      if (!email || !password) return jsonResponse({ error: 'Email and password required' }, 400);
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) return jsonResponse({ error: 'Email already exists' }, 409);
      const settings = await getAppSettings();
      const expiryDate = expiryDays ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000) : new Date(Date.now() + settings.defaultUserExpiryDays * 24 * 60 * 60 * 1000);
      const newUser = new User({
        email: email.toLowerCase(),
        password,
        role: 'user',
        sendingLimit: sendingLimit || settings.defaultUserLimit,
        expiryDate,
      });
      await newUser.save();
      await logActivity(auth.decoded.userId, 'admin', auth.decoded.username, 'create_user', `Created: ${email}`, clientIP);
      return jsonResponse({ success: true, id: newUser._id, expiryDate });
    }

    if (action === 'updateUserLimit') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { userId, limit } = body;
      await User.findByIdAndUpdate(userId, { sendingLimit: limit });
      await logActivity(auth.decoded.userId, 'admin', auth.decoded.username, 'update_limit', `User: ${userId}, limit: ${limit}`, clientIP);
      return jsonResponse({ success: true });
    }

    if (action === 'updateUserExpiry') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { userId, expiryDays } = body;
      const expiryDate = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
      await User.findByIdAndUpdate(userId, { expiryDate });
      await logActivity(auth.decoded.userId, 'admin', auth.decoded.username, 'update_expiry', `User: ${userId}, days: ${expiryDays}`, clientIP);
      return jsonResponse({ success: true });
    }

    if (action === 'suspendUser') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { userId } = body;
      await User.findByIdAndUpdate(userId, { status: 'suspended' });
      await logActivity(auth.decoded.userId, 'admin', auth.decoded.username, 'suspend_user', `User: ${userId}`, clientIP);
      return jsonResponse({ success: true });
    }

    if (action === 'activateUser') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { userId } = body;
      await User.findByIdAndUpdate(userId, { status: 'active' });
      await logActivity(auth.decoded.userId, 'admin', auth.decoded.username, 'activate_user', `User: ${userId}`, clientIP);
      return jsonResponse({ success: true });
    }

    if (action === 'deleteUser') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { userId } = body;
      await User.findByIdAndDelete(userId);
      await logActivity(auth.decoded.userId, 'admin', auth.decoded.username, 'delete_user', `User: ${userId}`, clientIP);
      return jsonResponse({ success: true });
    }

    // ================================================================
    // CAMPAIGN MANAGEMENT
    // ================================================================

    if (action === 'getCampaigns') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const campaigns = await Campaign.find().sort({ createdAt: -1 }).limit(200).lean();
      return jsonResponse({ success: true, campaigns });
    }

    // ================================================================
    // MONGODB CONNECTION MANAGEMENT
    // ================================================================

    if (action === 'getMongoConnections') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const connections = await MongoConnection.find().lean();
      return jsonResponse({ success: true, connections });
    }

    if (action === 'addMongoConnection') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { label, uri, storageLimit } = body;
      if (!label || !uri) return jsonResponse({ error: 'Label and URI required' }, 400);
      const conn = await MongoConnection.create({ label, uri, storageLimit: storageLimit || 512 });
      return jsonResponse({ success: true, id: conn._id });
    }

    if (action === 'deleteMongoConnection') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { id } = body;
      await MongoConnection.findByIdAndDelete(id);
      return jsonResponse({ success: true });
    }

    if (action === 'setActiveMongo') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { id } = body;
      await MongoConnection.updateMany({}, { isActive: false });
      await MongoConnection.findByIdAndUpdate(id, { isActive: true });
      return jsonResponse({ success: true });
    }

    // ================================================================
    // ACTIVITY LOGS
    // ================================================================

    if (action === 'getActivityLogs') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { limit } = body;
      const logs = await ActivityLog.find().sort({ timestamp: -1 }).limit(limit || 100).lean();
      return jsonResponse({ success: true, logs });
    }

    // ================================================================
    // BLACKLIST MANAGEMENT
    // ================================================================

    if (action === 'getBlacklist') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const list = await Blacklist.find().sort({ createdAt: -1 }).limit(500).lean();
      return jsonResponse({ success: true, blacklist: list });
    }

    if (action === 'addBlacklist') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { number, reason } = body;
      if (!number) return jsonResponse({ error: 'Number required' }, 400);
      const existing = await Blacklist.findOne({ number });
      if (existing) return jsonResponse({ error: 'Already blacklisted' }, 400);
      await Blacklist.create({ number, reason: reason || 'spam', addedBy: auth.decoded.username || 'admin' });
      return jsonResponse({ success: true });
    }

    if (action === 'removeBlacklist') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { id } = body;
      await Blacklist.findByIdAndDelete(id);
      return jsonResponse({ success: true });
    }

    // ================================================================
    // APP SETTINGS
    // ================================================================

    if (action === 'getAppSettings') {
      // Public — returns platform name, description, contact info (safe for login page)
      await connectDB();
      const settings = await getAppSettings();
      // Only expose public fields (no sensitive alert config etc.)
      const publicSettings = {
        platformName: settings.platformName,
        logoUrl: settings.logoUrl,
        description: settings.description,
        whatsapp: settings.whatsapp,
        email: settings.email,
        phone: settings.phone,
        language: settings.language,
      };
      return jsonResponse({ success: true, settings: publicSettings });
    }

    if (action === 'updateAppSettings') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { settings: updates } = body;
      const updated = await updateAppSettings(updates);
      await logActivity(auth.decoded.userId, 'admin', auth.decoded.username, 'update_settings', 'App settings updated', clientIP);
      return jsonResponse({ success: true, settings: updated });
    }

    // ================================================================
    // ALERT CONFIGURATION
    // ================================================================

    if (action === 'setAlertConfig') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { alertWhatsapp, alertWhatsappApiKey, alertEmail, alertEmailApiKey, alertEmailFrom, alertOnCrash, alertOnApiDown, alertOnError } = body;
      const updated = await updateAppSettings({
        alertWhatsapp: alertWhatsapp || '',
        alertWhatsappApiKey: alertWhatsappApiKey || '',
        alertEmail: alertEmail || '',
        alertEmailApiKey: alertEmailApiKey || '',
        alertEmailFrom: alertEmailFrom || 'alerts@mms-sender.local',
        alertOnCrash: alertOnCrash !== false,
        alertOnApiDown: alertOnApiDown !== false,
        alertOnError: alertOnError !== false,
      });
      return jsonResponse({ success: true, settings: updated });
    }

    if (action === 'testAlert') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const result = await sendAlert('test', 'Test alert from MMS Sender Admin Panel — if you see this, alerts are working!');
      return jsonResponse(result);
    }

    // ================================================================
    // PRIMARY REFRESH (reset page, fix bugs, no data loss)
    // ================================================================

    if (action === 'refreshSystem') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      // Clear cached connections, reset transient states, but keep all data
      await logActivity(auth.decoded.userId, 'admin', auth.decoded.username, 'refresh_system', 'Primary refresh triggered', clientIP);
      // Mark all running campaigns as sent (they were likely interrupted)
      await Campaign.updateMany({ status: 'running' }, { status: 'sent' });
      return jsonResponse({ success: true, message: 'System refreshed. No data lost.' });
    }

    // ================================================================
    // USER PANEL ACTIONS (Vercel only)
    // ================================================================

    // ===== ACTION: registerUser (admin-created account, role='user') =====
    // Self-registration is DISABLED on the user panel (login only).
    // This action remains for admin-created accounts and validates the 4-letter+2-digit ID format.
    if (action === 'registerUser') {
      await connectDB();
      const { email, password, userId } = body;
      if (!password) return jsonResponse({ error: 'Password required' }, 400);
      if (password.length < 6) return jsonResponse({ error: 'Password must be at least 6 characters' }, 400);
      // Determine the login identifier: prefer userId (new format), fall back to email (legacy)
      let loginId = null;
      if (userId) {
        const cleanId = String(userId).trim().toUpperCase();
        if (!/^[A-Z]{4}[0-9]{2}$/.test(cleanId)) {
          return jsonResponse({ error: 'User ID must be exactly 4 letters followed by 2 digits (e.g. SAMU01). No @ symbol.' }, 400);
        }
        const exists = await User.findOne({ userId: cleanId });
        if (exists) return jsonResponse({ error: 'This User ID is already taken.' }, 409);
        loginId = cleanId;
      } else if (email) {
        const exists = await User.findOne({ email: email.toLowerCase() });
        if (exists) return jsonResponse({ error: 'Email already registered. Please login.' }, 409);
        loginId = email.toLowerCase();
      } else {
        return jsonResponse({ error: 'User ID (4 letters + 2 digits) required' }, 400);
      }
      const settings = await getAppSettings();
      const newUserDoc = {
        password,
        role: 'user',
        sendingLimit: settings.defaultUserLimit,
        expiryDate: new Date(Date.now() + settings.defaultUserExpiryDays * 24 * 60 * 60 * 1000),
        ipAddress: clientIP,
      };
      if (userId) newUserDoc.userId = loginId; else newUserDoc.email = loginId;
      const newUser = new User(newUserDoc);
      await newUser.save();
      const displayId = newUser.userId || newUser.email;
      await logActivity(newUser._id.toString(), 'user', displayId, 'register', 'New user registered: ' + displayId, clientIP);
      const token = await createToken({ userId: newUser._id.toString(), role: 'user', loginId: displayId });
      const res = jsonResponse({ success: true, role: 'user', limit: newUser.sendingLimit, sent: newUser.sentCount, loginId: displayId, email: newUser.email || '' });
      res.headers.set('Set-Cookie', `token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`);
      return res;
    }

    // ===== ACTION: login (user login — 4-letter+2-digit ID or legacy email + password) =====
    if (action === 'login') {
      await connectDB();
      const { email, password, loginId } = body;
      // Accept loginId (new) or email (legacy field name from old client)
      const rawId = (loginId || email || '').trim();
      if (!rawId || !password) return jsonResponse({ error: 'User ID and password required' }, 400);
      // Try userId lookup first (4 letters + 2 digits), then fall back to email lookup
      let user = null;
      const upperId = rawId.toUpperCase();
      if (/^[A-Z]{4}[0-9]{2}$/.test(upperId)) {
        user = await User.findOne({ userId: upperId });
      }
      if (!user && rawId.includes('@')) {
        user = await User.findOne({ email: rawId.toLowerCase() });
      }
      if (!user) return jsonResponse({ error: 'Invalid User ID or password' }, 401);
      if (user.status === 'suspended') return jsonResponse({ error: 'Account suspended. Contact admin.' }, 403);
      // Check expiry
      if (user.expiryDate && user.expiryDate < new Date()) {
        return jsonResponse({ error: 'Account expired. Contact admin.' }, 403);
      }
      const match = await comparePassword(password, user.password);
      if (!match) return jsonResponse({ error: 'Invalid User ID or password' }, 401);
      // Update last active + IP
      user.lastActiveAt = new Date();
      user.ipAddress = clientIP;
      await user.save();
      const displayId = user.userId || user.email;
      await logActivity(user._id.toString(), 'user', displayId, 'login', 'User logged in', clientIP);
      const token = await createToken({ userId: user._id.toString(), role: 'user', loginId: displayId });
      const res = jsonResponse({
        success: true, role: 'user', loginId: displayId, email: user.email || '',
        limit: user.sendingLimit, sent: user.sentCount,
        expiryDate: user.expiryDate, inboxRate: user.inboxRate,
      });
      res.headers.set('Set-Cookie', `token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`);
      return res;
    }

    // ===== ACTION: getUserDashboard (user stats) =====
    if (action === 'getUserDashboard') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const user = await User.findById(auth.decoded.userId).select('-password').lean();
      if (!user) return jsonResponse({ error: 'User not found' }, 404);
      const now = new Date();
      // Update last active
      await User.findByIdAndUpdate(user._id, { lastActiveAt: now, ipAddress: clientIP });
      return jsonResponse({
        success: true,
        email: user.email,
        loginId: user.userId || user.email,
        limit: user.sendingLimit,
        sent: user.sentCount,
        remaining: user.sendingLimit - user.sentCount,
        expiryDate: user.expiryDate,
        expiryDaysLeft: user.expiryDate ? Math.ceil((user.expiryDate - now) / (24 * 60 * 60 * 1000)) : null,
        inboxRate: user.inboxRate,
        spamRate: user.spamRate,
        invalidHits: user.invalidHits,
        totalInbox: user.totalInbox,
        totalSpam: user.totalSpam,
        totalDelivered: user.totalDelivered,
        totalUndelivered: user.totalUndelivered,
      });
    }

    // ===== ACTION: getUserCampaigns =====
    if (action === 'getUserCampaigns') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      // Resolve the user's identifier (loginId for new accounts, email for legacy)
      const userDoc = await User.findById(auth.decoded.userId).lean();
      const userIdentifier = userDoc ? (userDoc.userId || userDoc.email) : (auth.decoded.loginId || auth.decoded.email);
      const campaigns = await Campaign.find({ $or: [ { userEmail: userIdentifier }, { userEmail: auth.decoded.email }, { userId: auth.decoded.userId } ] }).sort({ createdAt: -1 }).limit(50).lean();
      return jsonResponse({ success: true, campaigns });
    }

    // ===== ACTION: getDeliveryReports =====
    if (action === 'getDeliveryReports') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { campaignId } = body;
      const userDoc = await User.findById(auth.decoded.userId).lean();
      const userIdentifier = userDoc ? (userDoc.userId || userDoc.email) : (auth.decoded.loginId || auth.decoded.email);
      const filter = campaignId
        ? { campaignId }
        : { $or: [ { userEmail: userIdentifier }, { userEmail: auth.decoded.email }, { userId: auth.decoded.userId } ] };
      const reports = await DeliveryReport.find(filter).sort({ sentAt: -1 }).limit(500).lean();
      return jsonResponse({ success: true, reports });
    }

    // ===== ACTION: sendCampaign (auto-routing, invalid check, spam check) =====
    if (action === 'sendCampaign') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { message, numbers, sendType, templateUsed, aiSuggestion, options } = body;

      if (!message || !numbers || !Array.isArray(numbers) || numbers.length === 0) {
        return jsonResponse({ error: 'Message and numbers required' }, 400);
      }

      const user = await User.findById(auth.decoded.userId);
      if (!user) return jsonResponse({ error: 'User not found' }, 404);
      if (user.status === 'suspended') return jsonResponse({ error: 'Account suspended' }, 403);
      if (user.expiryDate && user.expiryDate < new Date()) return jsonResponse({ error: 'Account expired' }, 403);

      const remaining = user.sendingLimit - user.sentCount;
      if (remaining <= 0) return jsonResponse({ error: 'Sending limit reached' }, 403);

      // Check blacklist
      const blacklist = await Blacklist.find({ number: { $in: numbers } }).lean();
      const blacklistedSet = new Set(blacklist.map(b => b.number));

      // Validate numbers
      const validNumbers = [];
      const invalidNumbers = [];
      const countryInfo = {};

      for (const num of numbers) {
        if (blacklistedSet.has(num)) {
          invalidNumbers.push({ number: num, reason: 'Blacklisted' });
          continue;
        }
        const validation = validatePhoneNumber(num);
        if (validation.valid) {
          validNumbers.push(validation.cleaned);
          const ci = getCountryCode(validation.cleaned);
          countryInfo[validation.cleaned] = ci;
        } else {
          invalidNumbers.push({ number: num, reason: validation.reason });
        }
      }

      if (validNumbers.length === 0) {
        return jsonResponse({
          success: false,
          error: 'No valid numbers to send',
          invalidNumbers,
        });
      }

      // Limit to remaining quota
      const numbersToSend = validNumbers.slice(0, remaining);

      // Get best Gemini API for spam check / AI routing
      const geminiApi = await getBestGeminiApi();

      // Get app settings (spam protection, rate limits, country rules)
      const appSettings = await getAppSettings();

      // Create campaign record (status pending — engine will set 'running')
      const firstCountry = countryInfo[numbersToSend[0]] || {};
      const campaign = await Campaign.create({
        userEmail: user.userId || user.email,
        userId: user._id,
        message,
        numbers: numbersToSend,
        validNumbers: numbersToSend,
        invalidNumbers: invalidNumbers.map(i => i.number),
        status: 'pending',
        country: firstCountry.country || null,
        countryCode: firstCountry.countryCode || null,
        geminiApiId: geminiApi?._id || null,
        templateUsed: templateUsed || null,
        sendType: sendType || 'manual',
        aiSuggestion: aiSuggestion || null,
      });

      // ── Run the REAL bulk send engine ────────────────────────────────────
      const sendOpts = {
        batchSize: (options && options.batchSize) || 5,
        delayMs: (options && options.delayMs) || 1200,
        mediaUrl: (options && options.mediaUrl) || null,
        perMinute: (options && options.perMinute) || 0,
        perHour: (options && options.perHour) || 0,
        maxRetries: (options && options.maxRetries != null ? options.maxRetries : 2),
      };

      const result = await bulkSendEngine({
        user,
        message,
        numbers: numbersToSend,
        invalidNumbers: invalidNumbers.map(i => i.number),
        countryInfo,
        geminiApi,
        campaign,
        appSettings,
        options: sendOpts,
      });

      // ── Spam-blocked: stop here ──────────────────────────────────────────
      if (result.blocked) {
        return jsonResponse({
          success: false,
          blocked: true,
          campaignId: campaign._id,
          spamScore: result.spamScore,
          spamLevel: result.spamLevel,
          spamReasons: result.spamReasons,
          aiReview: result.aiReview,
          totalInvalid: result.totalInvalid,
          invalidNumbers,
          message: 'Message blocked by spam protection. Rewrite your content and try again.',
        });
      }

      // ── No sender API available ──────────────────────────────────────────
      if (result.error === 'no_sender_api') {
        return jsonResponse({
          success: false,
          error: 'No active sender API configured. Admin must add a sender API in API Management.',
          campaignId: campaign._id,
          spamScore: result.spamScore,
          spamLevel: result.spamLevel,
        }, 503);
      }

      // ── Update user stats ────────────────────────────────────────────────
      user.sentCount += result.totalSent;
      user.lastSendAt = new Date();
      user.lastActiveAt = new Date();
      user.totalDelivered += result.totalDelivered;
      user.totalUndelivered += result.totalUndelivered;
      user.invalidHits += result.totalInvalid;
      const totalSentAll = user.totalInbox + user.totalSpam;
      if (totalSentAll > 0) {
        user.inboxRate = Math.round((user.totalInbox / totalSentAll) * 100);
        user.spamRate = Math.round((user.totalSpam / totalSentAll) * 100);
      }
      await user.save();

      // ── Log activity ─────────────────────────────────────────────────────
      await logActivity(
        user._id.toString(),
        'user',
        user.email,
        'send_campaign',
        `Sent ${result.totalSent} (delivered ${result.totalDelivered}, undelivered ${result.totalUndelivered}) via ${result.senderApiUsed || 'N/A'}`,
        clientIP
      );

      // ── Alert if any sender API is running low ───────────────────────────
      try {
        const lowApis = await SenderApi.find({ status: 'warning' }).lean();
        for (const la of lowApis) {
          if (la.remaining < la.limit * 0.1) {
            await sendAlert('api_warning', `Sender API "${la.name}" is running low: ${la.remaining} remaining`);
          }
        }
      } catch (_e) {
        // non-fatal
      }

      return jsonResponse({
        success: true,
        campaignId: campaign._id,
        totalSent: result.totalSent,
        totalDelivered: result.totalDelivered,
        totalUndelivered: result.totalUndelivered,
        totalInvalid: result.totalInvalid,
        invalidNumbers,
        spamScore: result.spamScore,
        spamLevel: result.spamLevel,
        spamReasons: result.spamReasons,
        aiReview: result.aiReview,
        senderApiUsed: result.senderApiUsed,
        apisUsed: result.apisUsed,
        remainingQuota: user.sendingLimit - user.sentCount,
      });
    }

    // ===== ACTION: getCampaignProgress (live progress polling) =====
    if (action === 'getCampaignProgress') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { campaignId } = body;
      if (!campaignId) return jsonResponse({ error: 'campaignId required' }, 400);
      const campaign = await Campaign.findById(campaignId).lean();
      if (!campaign) return jsonResponse({ error: 'Campaign not found' }, 404);
      // Ensure the requester owns the campaign
      if (campaign.userId && String(campaign.userId) !== String(auth.decoded.userId)) {
        return jsonResponse({ error: 'Unauthorized' }, 403);
      }
      const recentDeliveries = await DeliveryReport.find({ campaignId })
        .sort({ sentAt: -1 })
        .limit(20)
        .lean();
      return jsonResponse({
        success: true,
        campaign: {
          _id: campaign._id,
          status: campaign.status,
          spamScore: campaign.spamScore,
          spamLevel: campaign.spamLevel,
          totalSent: campaign.totalSent,
          totalDelivered: campaign.totalDelivered,
          totalUndelivered: campaign.totalUndelivered,
          totalInvalid: campaign.totalInvalid,
          senderApiName: campaign.senderApiName,
          batchSize: campaign.batchSize,
          delayMs: campaign.delayMs,
        },
        recentDeliveries: recentDeliveries.map((d) => ({
          number: d.number,
          status: d.status,
          provider: d.provider,
          providerMsgId: d.providerMsgId,
          errorCode: d.errorCode,
          errorMessage: d.errorMessage,
          attempts: d.attempts,
          sentAt: d.sentAt,
        })),
      });
    }

    // ===== ACTION: spamCheck (preview spam score without sending) =====
    if (action === 'spamCheck') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { message } = body;
      if (!message) return jsonResponse({ error: 'message required' }, 400);
      const heuristic = scoreSpamHeuristic(message);
      const geminiApi = await getBestGeminiApi();
      let aiReview = null;
      if (geminiApi) {
        try {
          aiReview = await geminiSpamReview(message, geminiApi);
          if (aiReview && aiReview.spam_score != null) {
            await updateGeminiApiUsage(geminiApi._id, 1);
          }
        } catch (_e) {
          // non-fatal
        }
      }
      let spamScore = heuristic.score;
      if (aiReview && aiReview.spam_score != null) {
        spamScore = Math.round(heuristic.score * 0.5 + aiReview.spam_score * 0.5);
      }
      const spamLevel = spamScore >= 60 ? 'high' : spamScore >= 30 ? 'moderate' : 'clean';
      return jsonResponse({
        success: true,
        spamScore,
        spamLevel,
        spamReasons: heuristic.reasons,
        aiReview,
      });
    }

    // ===== ACTION: testSenderApi (admin: test a sender API with one number) =====
    if (action === 'testSenderApi') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { apiId, testNumber, testMessage } = body;
      if (!apiId || !testNumber) return jsonResponse({ error: 'apiId and testNumber required' }, 400);
      const api = await SenderApi.findById(apiId);
      if (!api) return jsonResponse({ error: 'Sender API not found' }, 404);
      const msg = testMessage || 'Test message from MMS Sender platform';
      try {
        const result = await sendWithRetry(api, testNumber, msg, null, 1);
        return jsonResponse({
          success: result.success,
          provider: api.provider,
          providerMsgId: result.providerMsgId,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
          attempts: result.attempts,
        });
      } catch (e) {
        return jsonResponse({
          success: false,
          errorMessage: String(e.message || e),
        }, 500);
      }
    }

    // ===== ACTION: deliveryStatus (PUBLIC webhook — no auth) =====
    if (action === 'deliveryStatus') {
      await connectDB();
      // Providers send webhook callbacks (POST form or JSON) with delivery updates.
      // Common fields: MessageSid/MessageId, MessageStatus, To, ErrorCode
      const providerMsgId =
        body.MessageSid || body.messageSid || body.MessageId || body.messageId || body.id || null;
      const status =
        body.MessageStatus || body.messageStatus || body.status || null;
      const errorCode = body.ErrorCode || body.errorCode || null;
      const to = body.To || body.to || null;

      if (!providerMsgId && !to) {
        return jsonResponse({ error: 'No message identifier provided' }, 400);
      }

      // Find the delivery report by providerMsgId or number
      let report = null;
      if (providerMsgId) {
        report = await DeliveryReport.findOne({ providerMsgId });
      }
      if (!report && to) {
        report = await DeliveryReport.findOne({ number: to }).sort({ sentAt: -1 });
      }
      if (!report) {
        return jsonResponse({ success: false, error: 'No matching delivery report' }, 404);
      }

      // Map provider status → our status
      const statusMap = {
        delivered: 'delivered',
        sent: 'sent',
        queued: 'queued',
        accepted: 'sent',
        undelivered: 'undelivered',
        failed: 'failed',
        rejected: 'failed',
        bounced: 'failed',
      };
      const mapped = statusMap[String(status).toLowerCase()] || report.status;

      report.status = mapped;
      if (errorCode) report.errorCode = String(errorCode);
      if (mapped === 'delivered') report.deliveredAt = new Date();
      await report.save();

      // Update campaign totals if delivered
      if (mapped === 'delivered' && report.campaignId) {
        await Campaign.updateOne(
          { _id: report.campaignId },
          { $inc: { totalDelivered: 1, totalUndelivered: -1 } }
        ).catch(() => {});
      }

      return jsonResponse({ success: true, status: mapped });
    }

    // ===== ACTION: bulkImport (CSV numbers) =====
    if (action === 'bulkImport') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      const { csvData } = body;
      if (!csvData) return jsonResponse({ error: 'CSV data required' }, 400);
      // Parse CSV — extract numbers (first column or "number" column)
      const lines = csvData.split('\n').map(l => l.trim()).filter(l => l);
      const numbers = [];
      for (const line of lines) {
        const cols = line.split(',');
        const num = cols[0].replace(/[^0-9+]/g, '');
        if (num) numbers.push(num);
      }
      return jsonResponse({ success: true, numbers, count: numbers.length });
    }

    // ===== ACTION: checkSession =====
    if (action === 'checkSession') {
      const token = getTokenFromReq(req);
      if (!token) return jsonResponse({ error: 'No session' }, 401);
      const decoded = await verifyToken(token);
      if (!decoded) return jsonResponse({ error: 'Invalid session' }, 401);
      await connectDB();
      if (decoded.role === 'user') {
        const user = await User.findById(decoded.userId).select('-password').lean();
        if (!user) return jsonResponse({ error: 'User not found' }, 404);
        if (user.status === 'suspended') return jsonResponse({ error: 'Suspended' }, 403);
        // Update last active
        await User.findByIdAndUpdate(user._id, { lastActiveAt: new Date(), ipAddress: clientIP });
        return jsonResponse({
          role: 'user', email: user.email, loginId: user.userId || user.email,
          limit: user.sendingLimit, sent: user.sentCount,
          expiryDate: user.expiryDate,
        });
      } else if (decoded.role === 'admin' || decoded.role === 'superadmin' || decoded.role === 'subadmin') {
        return jsonResponse({
          role: decoded.role === 'subadmin' ? 'subadmin' : 'admin',
          username: decoded.username,
          permissions: decoded.permissions,
        });
      }
      return jsonResponse({ error: 'Unknown role' }, 403);
    }

    // ===== ACTION: aiChat (Advanced Gemini chat — reads user logs/data, language-aware incl. Sylheti) =====
    if (action === 'aiChat') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { message, language } = body;
      if (!message) return jsonResponse({ error: 'Message required' }, 400);
      const geminiApi = await getBestGeminiApi();
      if (!geminiApi) return jsonResponse({ error: 'AI support not available (no Gemini API configured by admin)' }, 503);

      try {
        // ---- Gather user context so the AI can answer based on REAL data ----
        const userObj = await User.findById(auth.decoded.userId).select('-password').lean();
        const userIdentifier = userObj ? (userObj.userId || userObj.email) : (auth.decoded.loginId || auth.decoded.email);

        // Recent campaigns (last 10)
        const recentCampaigns = await Campaign.find({
          $or: [ { userEmail: userIdentifier }, { userEmail: auth.decoded.email }, { userId: auth.decoded.userId } ]
        }).sort({ createdAt: -1 }).limit(10).lean().catch(() => []);

        // Recent activity logs for this user (last 15)
        const recentLogs = await ActivityLog.find({ actorId: String(auth.decoded.userId) })
          .sort({ timestamp: -1 }).limit(15).lean().catch(() => []);

        // Recent delivery reports summary (last 20)
        const recentReports = await DeliveryReport.find({
          $or: [ { userEmail: userIdentifier }, { userEmail: auth.decoded.email } ]
        }).sort({ sentAt: -1 }).limit(20).lean().catch(() => []);

        // Build a compact context string for the AI
        const ctxParts = [];
        if (userObj) {
          ctxParts.push(`USER ACCOUNT: ID=${userIdentifier}, Status=${userObj.status}, SendingLimit=${userObj.sendingLimit}, SentCount=${userObj.sentCount}, Remaining=${userObj.sendingLimit - userObj.sentCount}, InboxRate=${userObj.inboxRate}%, SpamRate=${userObj.spamRate}%, TotalInbox=${userObj.totalInbox}, TotalSpam=${userObj.totalSpam}, TotalDelivered=${userObj.totalDelivered}, TotalUndelivered=${userObj.totalUndelivered}, InvalidHits=${userObj.invalidHits}, Expiry=${userObj.expiryDate ? new Date(userObj.expiryDate).toISOString().split('T')[0] : 'none'}`);
        }
        if (recentCampaigns && recentCampaigns.length) {
          const campSummary = recentCampaigns.map(c =>
            `[${c.status}] ${c.message ? c.message.slice(0, 50) : ''}... numbers=${(c.numbers || []).length} sent=${c.totalSent || 0} delivered=${c.totalDelivered || 0} undelivered=${c.totalUndelivered || 0} spam=${c.totalSpam || 0} at=${c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : ''}`
          ).join(' | ');
          ctxParts.push(`RECENT CAMPAIGNS (last 10): ${campSummary}`);
        }
        if (recentLogs && recentLogs.length) {
          const logSummary = recentLogs.map(l =>
            `${l.action || l.eventType || 'event'}: ${(l.details || l.description || '').slice(0, 60)} @ ${l.timestamp ? new Date(l.timestamp).toISOString().split('T')[0] : ''}`
          ).join(' | ');
          ctxParts.push(`RECENT ACTIVITY LOGS (last 15): ${logSummary}`);
        }
        if (recentReports && recentReports.length) {
          const deliveredCount = recentReports.filter(r => r.status === 'delivered').length;
          const undeliveredCount = recentReports.filter(r => r.status === 'undelivered').length;
          const spamCount = recentReports.filter(r => r.status === 'spam').length;
          ctxParts.push(`DELIVERY REPORTS (last 20): delivered=${deliveredCount}, undelivered=${undeliveredCount}, spam=${spamCount}`);
        }
        const userContext = ctxParts.length ? ctxParts.join('\n') : 'No user data available yet (new account).';

        // ---- Language instruction (now supports Sylheti) ----
        let langInstruction = 'Respond in English.';
        if (language === 'bn') langInstruction = 'Respond in Bengali (Bangla).';
        else if (language === 'syl') langInstruction = 'Respond in Sylheti (Siloti) dialect — this is the language of the Sylhet region of Bangladesh, written in Bengali script. Use common Sylheti expressions and vocabulary.';

        // ---- Build the AI prompt with context ----
        const systemPrompt = `You are an advanced AI support assistant for an enterprise MMS/SMS sending platform. You have access to the user's REAL account data and recent activity logs below. Use this data to give specific, helpful, data-driven answers. If the user asks about their sending stats, campaign performance, delivery rates, or account status, refer to the actual data provided. If data is missing, say so honestly. Be concise but thorough. ${langInstruction}

=== USER ACCOUNT DATA & RECENT LOGS ===
${userContext}
=== END DATA ===

User question: ${message}`;

        const geminiUrl = `${geminiApi.endpoint}/${geminiApi.model}:generateContent?key=${geminiApi.apiKey}`;
        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
          }),
        });
        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const aiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not process that request.';
          await updateGeminiApiUsage(geminiApi._id, 1);
          // Log the AI chat interaction
          await logActivity(auth.decoded.userId, 'user', userIdentifier, 'ai_chat', `Q: ${message.slice(0, 80)}`, null).catch(() => {});
          return jsonResponse({ success: true, reply: aiText });
        }
        const errText = await geminiRes.text().catch(() => '');
        return jsonResponse({ error: 'AI request failed: ' + geminiRes.status, detail: errText.slice(0, 200) }, 502);
      } catch (e) {
        return jsonResponse({ error: 'AI error: ' + e.message }, 500);
      }
    }

    // ===== ACTION: getAutoReplyConfig (user's SMS auto-reply settings) =====
    if (action === 'getAutoReplyConfig') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const userDoc = await User.findById(auth.decoded.userId).lean();
      const userIdentifier = userDoc ? (userDoc.userId || userDoc.email) : (auth.decoded.loginId || auth.decoded.email);
      let config = await AutoReplyConfig.findOne({ $or: [ { userId: auth.decoded.userId }, { userEmail: userIdentifier } ] }).lean();
      if (!config) {
        // Return defaults
        return jsonResponse({
          success: true,
          config: {
            enabled: false,
            languagePrompt: {
              bn: 'আমাদের সাথে যোগাযোগের জন্য ধন্যবাদ। ভাষা নির্বাচন করুন:\n1 - বাংলা\n2 - English\n3 - সিলেটি\n(Reply with 1, 2 or 3)',
              en: 'Thanks for contacting us. Choose your language:\n1 - Bangla\n2 - English\n3 - Sylheti\n(Reply with 1, 2 or 3)',
            },
            replyMessage: {
              bn: 'আসসালামু আলাইকুম। আমরা আপনার বার্তা পেয়েছি। আমাদের প্রতিনিধি শীঘ্রই আপনার সাথে যোগাযোগ করবে। ধন্যবাদ।',
              en: 'Hello! We have received your message. Our representative will contact you shortly. Thank you.',
              syl: 'আসসালামু আলাইকুম। আমরা আপনার খবর পাইছি। আমাগো প্রতিনিধি অইগো তোমার লগে যোগাযোগ করমু। ধন্যবাদ।',
            },
          },
          webhookUrl: `${new URL(req.url).origin}/api/system`,
        });
      }
      return jsonResponse({ success: true, config, webhookUrl: `${new URL(req.url).origin}/api/system` });
    }

    // ===== ACTION: setAutoReplyConfig (save user's SMS auto-reply settings) =====
    if (action === 'setAutoReplyConfig') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const userDoc = await User.findById(auth.decoded.userId).lean();
      const userIdentifier = userDoc ? (userDoc.userId || userDoc.email) : (auth.decoded.loginId || auth.decoded.email);
      const { enabled, languagePrompt, replyMessage } = body;
      let config = await AutoReplyConfig.findOne({ $or: [ { userId: auth.decoded.userId }, { userEmail: userIdentifier } ] });
      if (!config) {
        config = new AutoReplyConfig({ userId: auth.decoded.userId, userEmail: userIdentifier });
      }
      config.enabled = enabled !== false;
      if (languagePrompt) config.languagePrompt = { ...config.languagePrompt, ...languagePrompt };
      if (replyMessage) config.replyMessage = { ...config.replyMessage, ...replyMessage };
      config.updatedAt = new Date();
      await config.save();
      return jsonResponse({ success: true, config });
    }

    // ===== ACTION: getInboxMessages (user's received SMS log) =====
    if (action === 'getInboxMessages') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const userDoc = await User.findById(auth.decoded.userId).lean();
      const userIdentifier = userDoc ? (userDoc.userId || userDoc.email) : (auth.decoded.loginId || auth.decoded.email);
      const messages = await SmsInbound.find({
        $or: [ { userId: auth.decoded.userId }, { userEmail: userIdentifier } ]
      }).sort({ receivedAt: -1 }).limit(100).lean();
      return jsonResponse({ success: true, messages });
    }

    // ===== ACTION: smsInbound (PUBLIC webhook — receives inbound SMS, handles language selection) =====
    // Providers (textbee, Twilio, etc.) POST inbound SMS here.
    // The flow: 1st SMS → send language prompt; sender replies 1/2/3 → send the configured reply in that language.
    if (action === 'smsInbound') {
      await connectDB();
      // Extract fields from various provider formats
      const fromNumber = body.From || body.from || body.sender || body.msisdn || null;
      const incomingMessage = body.Body || body.body || body.message || body.text || '';
      const toNumber = body.To || body.to || body.receiver || null;
      const userEmail = body.userEmail || body.user || null; // some gateways pass a custom field

      if (!fromNumber) return jsonResponse({ error: 'No sender number (From) provided' }, 400);

      // Find the user who owns this inbound number (match by the number they send from, or a custom userEmail field)
      let userDoc = null;
      if (userEmail) {
        userDoc = await User.findOne({ $or: [ { userId: userEmail.toUpperCase() }, { email: userEmail.toLowerCase() } ] }).lean();
      }
      // If we can't identify the user, return a generic acknowledgment
      if (!userDoc) {
        // Log as orphan inbound
        await SmsInbound.create({ fromNumber, incomingMessage: String(incomingMessage).slice(0, 500), state: 'direct', replySent: 'No user account matched this inbound number.' }).catch(() => {});
        return jsonResponse({ success: true, reply: '', message: 'Inbound logged but no matching user account.' });
      }

      const userIdentifier = userDoc.userId || userDoc.email;
      let config = await AutoReplyConfig.findOne({ $or: [ { userId: userDoc._id }, { userEmail: userIdentifier } ] });
      if (!config || !config.enabled) {
        await SmsInbound.create({ userId: userDoc._id, userEmail: userIdentifier, fromNumber, incomingMessage: String(incomingMessage).slice(0, 500), state: 'direct', replySent: 'Auto-reply disabled.' }).catch(() => {});
        return jsonResponse({ success: true, reply: '', message: 'Auto-reply is disabled for this account.' });
      }

      // Check for a recent 'awaiting_language' state from this sender (within last 30 minutes)
      const recentPending = await SmsInbound.findOne({
        userId: userDoc._id, fromNumber, state: 'awaiting_language',
        receivedAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) },
      }).sort({ receivedAt: -1 });

      let replyText = '';
      let selectedLang = null;
      let newState = 'awaiting_language';

      if (recentPending) {
        // This is a reply to the language prompt — parse 1/2/3
        const msg = String(incomingMessage).trim();
        if (msg === '1' || /^1/.test(msg)) { selectedLang = 'bn'; }
        else if (msg === '2' || /^2/.test(msg)) { selectedLang = 'en'; }
        else if (msg === '3' || /^3/.test(msg)) { selectedLang = 'syl'; }
        else {
          // Invalid choice — re-send the prompt
          replyText = config.languagePrompt?.en || 'Please reply with 1, 2, or 3 to choose your language.';
          newState = 'awaiting_language';
        }
        if (selectedLang) {
          replyText = config.replyMessage?.[selectedLang] || config.replyMessage?.en || 'Thank you for your message.';
          newState = 'replied';
          // Mark the pending one as resolved
          recentPending.state = 'replied';
          recentPending.selectedLanguage = selectedLang;
          recentPending.replySent = replyText;
          await recentPending.save().catch(() => {});
        }
      } else {
        // First message from this sender — send the language prompt
        // Detect language from the app settings to pick which prompt language, default English prompt
        const settings = await getAppSettings();
        const promptLang = settings.language || 'en';
        replyText = config.languagePrompt?.[promptLang] || config.languagePrompt?.en || 'Choose your language: 1-Bangla, 2-English, 3-Sylheti';
        newState = 'awaiting_language';
      }

      // Log the inbound message
      await SmsInbound.create({
        userId: userDoc._id, userEmail: userIdentifier,
        fromNumber, incomingMessage: String(incomingMessage).slice(0, 500),
        state: newState, selectedLanguage: selectedLang,
        replySent: replyText,
      }).catch(() => {});

      // Attempt to send the reply via the best sender API (best-effort, non-blocking)
      let sendResult = null;
      if (replyText) {
        try {
          const senderApi = await getBestSenderApi();
          if (senderApi) {
            sendResult = await executeRealSend({
              to: fromNumber,
              message: replyText,
              senderApi,
            }).catch((e) => ({ error: e.message }));
          }
        } catch (e) {
          sendResult = { error: e.message };
        }
      }

      return jsonResponse({ success: true, reply: replyText, sendResult });
    }

    // ===== ACTION: getScheduledSends =====
    if (action === 'getScheduledSends') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const userDoc = await User.findById(auth.decoded.userId).lean();
      const userIdentifier = userDoc ? (userDoc.userId || userDoc.email) : (auth.decoded.loginId || auth.decoded.email);
      const sends = await ScheduledSend.find({ $or: [ { userEmail: userIdentifier }, { userEmail: auth.decoded.email } ], status: 'scheduled' }).sort({ scheduledAt: 1 }).lean();
      return jsonResponse({ success: true, scheduledSends: sends });
    }

    // ===== ACTION: scheduleSend =====
    if (action === 'scheduleSend') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { message, numbers, scheduledAt, templateUsed } = body;
      if (!message || !numbers || !scheduledAt) return jsonResponse({ error: 'Message, numbers, and scheduled time required' }, 400);
      const userDoc = await User.findById(auth.decoded.userId).lean();
      const userIdentifier = userDoc ? (userDoc.userId || userDoc.email) : (auth.decoded.loginId || auth.decoded.email);
      const send = await ScheduledSend.create({
        userEmail: userIdentifier,
        message, numbers, scheduledAt: new Date(scheduledAt),
        templateUsed: templateUsed || null,
      });
      return jsonResponse({ success: true, id: send._id });
    }

    // ===== Unknown action =====
    return jsonResponse({ error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    console.error('API Error:', err);
    return jsonResponse({ error: 'Internal server error: ' + err.message }, 500);
  }
}

// Helper: time ago string
function timeAgoStr(date, now) {
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export async function GET() {
  return jsonResponse({ status: 'ok', message: 'MMS Sender API is running' });
}
