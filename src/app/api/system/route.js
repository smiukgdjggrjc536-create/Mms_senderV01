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
  SystemConfig,
  SmsInbound,
  EmailAccount,
  SubjectCategory,
  SubjectTemplate,
  BodyTemplate,
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
  validateEmailAddress,
  isCommonEmailDomain,
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
  computeExpiryDate,
} from '@/lib/core';
import mongoose from 'mongoose';
import { getKeepAliveStatus } from '@/lib/keepAlive';

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
      return jsonResponse({ success: true, apis: apis.map(a => ({ ...a, apiKey: a.apiKey.substring(0, 6) + '••••••', lastError: a.lastError || null })) });
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
        name, apiKey, model: model || 'gemini-flash-lite-latest',
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

    // ===== ACTION: testGeminiApi (admin tests a Gemini API key from the module) =====
    if (action === 'testGeminiApi') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { id, apiKey, model, endpoint } = body;
      // Either pass an existing API id, or pass raw values to test before saving
      let testKey = apiKey;
      let testModel = model;
      let testEndpoint = endpoint;
      let apiDoc = null;
      if (id) {
        apiDoc = await GeminiApi.findById(id).lean();
        if (!apiDoc) return jsonResponse({ error: 'Gemini API not found' }, 404);
        testKey = testKey || apiDoc.apiKey;
        testModel = testModel || apiDoc.model;
        testEndpoint = testEndpoint || apiDoc.endpoint;
      }
      if (!testKey) return jsonResponse({ error: 'API key required to test' }, 400);
      // NOTE: We no longer hard-reject keys that don't start with "AIza".
      // The admin may use keys in any format (custom gateway keys, partner
      // keys, etc.). We attempt the real API call and report the actual
      // upstream response. A soft warning is included for non-AIza keys.
      const isStandardFormat = testKey.startsWith('AIza');
      const formatWarning = isStandardFormat ? '' : ` (Note: this key does not start with "AIza" — it may be a custom/partner key. Testing anyway.)`;
      const ep = testEndpoint || 'https://generativelanguage.googleapis.com/v1beta/models';
      const fallbackModels = [];
      if (testModel) fallbackModels.push(testModel);
      // Updated model list — Google has deprecated many older models for new users.
      // Working models verified: gemini-flash-lite-latest, gemini-3.5-flash-lite, gemini-3.1-flash-lite
      for (const m of [
        'gemini-flash-lite-latest',
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-flash-latest',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-1.5-flash',
      ]) {
        if (!fallbackModels.includes(m)) fallbackModels.push(m);
      }
      const testPrompt = 'Reply with exactly: "Gemini API test successful."';
      let lastStatus = 0;
      let lastErr = '';
      for (const mdl of fallbackModels) {
        const url = `${ep}/${mdl}:generateContent?key=${testKey}`;
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: testPrompt }] }],
              generationConfig: { temperature: 0, maxOutputTokens: 32 },
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || '(empty response)';
            // Persist the working model if we have a doc
            if (apiDoc && mdl !== apiDoc.model) {
              await GeminiApi.findByIdAndUpdate(apiDoc._id, { model: mdl, lastError: null }).catch(() => {});
            } else if (apiDoc) {
              await GeminiApi.findByIdAndUpdate(apiDoc._id, { lastError: null }).catch(() => {});
            }
            return jsonResponse({
              success: true, ok: true,
              status: 200,
              model: mdl,
              reply: replyText,
              message: `✅ Test successful! Model "${mdl}" works. The API key is valid.${formatWarning}`,
            });
          }
          lastStatus = res.status;
          lastErr = await res.text().catch(() => '');
          if (res.status === 404) continue; // try next model
          if (res.status === 400 || res.status === 403 || res.status === 429) break;
          continue;
        } catch (e) {
          lastStatus = 0;
          lastErr = e.message;
          continue;
        }
      }
      // All failed
      let hint = '';
      if (lastStatus === 403) hint = 'The API key is invalid OR the "Generative Language API" is not enabled. Create a new key at https://aistudio.google.com/apikey';
      else if (lastStatus === 400) hint = 'Bad request — the API key may be invalid or wrong format. Keys start with "AIzaSy" or "AQ.". Get a free one at https://aistudio.google.com/apikey';
      else if (lastStatus === 429) hint = 'Rate limit / quota exceeded. Wait a moment and try again, or add another key.';
      else if (lastStatus === 404) hint = `All models returned 404. The API key is likely invalid. Get a free key from https://aistudio.google.com/apikey`;
      else hint = 'Network error. Check the endpoint URL and your internet connection.';
      if (apiDoc) {
        await GeminiApi.findByIdAndUpdate(apiDoc._id, { lastError: `Test failed (HTTP ${lastStatus}): ${lastErr.slice(0, 200)}` }).catch(() => {});
      }
      return jsonResponse({
        success: false, ok: false,
        status: lastStatus,
        error: `Test FAILED (HTTP ${lastStatus || 'network'}). ${lastErr.slice(0, 200)}`,
        hint,
        modelsTried: fallbackModels,
      });
    }

    // ===== ACTION: testSystemGemini (test the Gemini key saved in SystemConfig) =====
    // This is different from testGeminiApi: it reads the key directly from the
    // database (SystemConfig.geminiApiKey) so the admin can test the SAVED key
    // without re-typing it. This fixes the 401 error that happened because the
    // gateway route masks the key in GET responses (••••••••), and the masked
    // key was being sent to Google's API.
    if (action === 'testSystemGemini') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const cfg = await SystemConfig.findOne({}).lean();
      const testKey = cfg?.geminiApiKey || '';
      if (!testKey || testKey.length < 8) {
        return jsonResponse({ success: false, ok: false, status: 400, error: 'No Gemini API key is saved in SystemConfig. Enter and save a key first, then test.' });
      }
      const ep = cfg?.geminiEndpoint || 'https://generativelanguage.googleapis.com/v1beta/models';
      const fallbackModels = [];
      if (cfg?.geminiModel) fallbackModels.push(cfg.geminiModel);
      for (const m of ['gemini-flash-lite-latest','gemini-3.5-flash-lite','gemini-3.1-flash-lite','gemini-flash-latest','gemini-2.5-flash','gemini-2.5-flash-lite','gemini-1.5-flash']) {
        if (!fallbackModels.includes(m)) fallbackModels.push(m);
      }
      const testPrompt = 'Reply with exactly: "Gemini API test successful."';
      let lastStatus = 0, lastErr = '';
      for (const mdl of fallbackModels) {
        const url = `${ep}/${mdl}:generateContent?key=${testKey}`;
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: testPrompt }] }], generationConfig: { temperature: 0, maxOutputTokens: 32 } }),
          });
          if (res.ok) {
            const data = await res.json();
            const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || '(empty)';
            return jsonResponse({ success: true, ok: true, status: 200, model: mdl, reply: replyText, message: `✅ Test successful! Model "${mdl}" works. The saved API key is valid.` });
          }
          lastStatus = res.status;
          lastErr = await res.text().catch(() => '');
          if (res.status === 404) continue;
          if (res.status === 400 || res.status === 403 || res.status === 429) break;
          continue;
        } catch (e) { lastStatus = 0; lastErr = e.message; continue; }
      }
      let hint = '';
      if (lastStatus === 403) hint = 'The API key is invalid OR the "Generative Language API" is not enabled.';
      else if (lastStatus === 400) hint = 'Bad request — the API key may be invalid. Keys start with "AIzaSy" or "AQ.".';
      else if (lastStatus === 429) hint = 'Rate limit / quota exceeded. Wait and try again.';
      else if (lastStatus === 404) hint = 'All models returned 404. The API key is likely invalid.';
      else hint = 'Network error. Check the endpoint URL.';
      return jsonResponse({ success: false, ok: false, status: lastStatus, error: `Test FAILED (HTTP ${lastStatus || 'network'}). ${lastErr.slice(0, 200)}`, hint, modelsTried: fallbackModels });
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
          // loginId is the username the user types to log in (userId preferred, email fallback)
          loginId: u.userId || u.email || '',
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
      // NEW: username + password (email is now optional). Admin sets the
      // login credentials exactly as they wish — no format restrictions.
      const { username, userId, email, password, sendingLimit, expiryValue, expiryUnit, expiryDays } = body;
      const rawUsername = (username || userId || '').trim();
      if (!rawUsername || !password) {
        return jsonResponse({ error: 'Username and password are required' }, 400);
      }
      // Store the login identifier in the userId field (uppercase-trimmed is NOT
      // forced anymore — we keep the original casing so admins can use any
      // username format they like). We DO lowercase an email if one is given.
      const loginId = rawUsername;
      // Check for duplicates on BOTH userId and email (sparse) so we never
      // accidentally create a colliding account.
      const dupQuery = { $or: [{ userId: loginId }] };
      if (email && String(email).trim()) {
        dupQuery.$or.push({ email: String(email).trim().toLowerCase() });
      }
      const existing = await User.findOne(dupQuery);
      if (existing) return jsonResponse({ error: 'This username already exists. Choose a different one.' }, 409);
      const settings = await getAppSettings();
      // Expiry: prefer the new { value, unit } system; fall back to legacy
      // expiryDays for older admin-panel builds.
      let expiryDate;
      if (expiryValue && expiryUnit) {
        expiryDate = computeExpiryDate(expiryValue, expiryUnit);
      } else if (expiryDays) {
        expiryDate = computeExpiryDate(expiryDays, 'days');
      } else {
        expiryDate = computeExpiryDate(settings.defaultUserExpiryDays || 30, 'days');
      }
      const newUserDoc = {
        userId: loginId,
        password,
        role: 'user',
        sendingLimit: sendingLimit || settings.defaultUserLimit,
        expiryDate,
      };
      if (email && String(email).trim()) {
        newUserDoc.email = String(email).trim().toLowerCase();
      }
      const newUser = new User(newUserDoc);
      await newUser.save();
      await logActivity(auth.decoded.userId, 'admin', auth.decoded.username, 'create_user', `Created user: ${loginId}`, clientIP);
      return jsonResponse({ success: true, id: newUser._id, loginId: loginId, expiryDate });
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
      // NEW: accept { expiryValue, expiryUnit } (hours/days/weeks/months/years)
      // and also keep backward compat with the old { expiryDays } field.
      const { userId, expiryValue, expiryUnit, expiryDays } = body;
      let expiryDate;
      if (expiryValue && expiryUnit) {
        expiryDate = computeExpiryDate(expiryValue, expiryUnit);
      } else if (expiryDays) {
        expiryDate = computeExpiryDate(expiryDays, 'days');
      } else {
        return jsonResponse({ error: 'expiryValue and expiryUnit (or expiryDays) required' }, 400);
      }
      if (!expiryDate) return jsonResponse({ error: 'Invalid expiry value' }, 400);
      await User.findByIdAndUpdate(userId, { expiryDate });
      const label = (expiryValue && expiryUnit) ? `${expiryValue} ${expiryUnit}` : `${expiryDays} days`;
      await logActivity(auth.decoded.userId, 'admin', auth.decoded.username, 'update_expiry', `User: ${userId}, expiry: ${label}`, clientIP);
      return jsonResponse({ success: true, expiryDate });
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
    // KEEP-ALIVE STATUS — returns the Render self-ping monitor status so
    // the admin panel can display whether the anti-sleep loop is running.
    // No DB / no auth needed (read-only runtime telemetry).
    // ================================================================
    if (action === 'getKeepAliveStatus') {
      const status = getKeepAliveStatus();
      return jsonResponse({ success: true, keepAlive: status });
    }

    // ================================================================
    // PING RENDER — the admin panel (Netlify) calls this to actively ping
    // the Render headless backend so it stays awake. Returns live status
    // + response time. No auth required (it's a health probe that helps
    // keep the gateway alive).
    // ================================================================
    if (action === 'pingRender') {
      const renderUrl =
        process.env.RENDER_EXTERNAL_URL ||
        process.env.RENDER_SERVICE_URL ||
        'https://mms-gateway-engine.onrender.com';
      const pingUrl = `${renderUrl.replace(/\/$/, '')}/api/ping`;
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        const res = await fetch(pingUrl, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
          cache: 'no-store',
        });
        clearTimeout(timeoutId);
        const elapsed = Date.now() - start;
        const data = await res.json().catch(() => ({}));
        return jsonResponse({
          success: true,
          alive: res.ok,
          status: res.status,
          responseMs: elapsed,
          renderTime: data.timestamp || null,
          renderUptime: data.uptime || null,
          renderMode: data.mode || null,
          url: pingUrl,
          checkedAt: new Date().toISOString(),
        });
      } catch (err) {
        const elapsed = Date.now() - start;
        return jsonResponse({
          success: false,
          alive: false,
          error: err.name === 'AbortError' ? 'Timeout (Render may be spinning up — try again)' : (err.message || 'fetch failed'),
          responseMs: elapsed,
          url: pingUrl,
          checkedAt: new Date().toISOString(),
        }, 504);
      }
    }

    // ================================================================
    // REAL DATABASE STATS — 100% accurate live MongoDB metrics
    // Calls db.command({dbStats:1}) + per-collection collStats for real
    // storage, dataSize, indexSize, collections, document count + a ping
    // to measure true response latency. Falls back gracefully if the
    // driver / cluster restricts a command (shared/serverless tiers).
    // ================================================================
    if (action === 'getDatabaseStats') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();

      // Measure response time of a trivial DB command (ping).
      const pingStart = Date.now();
      let responseMs = 0;
      try {
        const db = mongoose.connection.db;
        if (db) {
          await db.command({ ping: 1 });
          responseMs = Date.now() - pingStart;
        }
      } catch (_e) {
        responseMs = Date.now() - pingStart;
      }

      // Real dbStats from the live MongoDB instance.
      let stats = null;
      try {
        const db = mongoose.connection.db;
        if (db) {
          stats = await db.command({ dbStats: 1, scale: 1 });
        }
      } catch (err) {
        try {
          const db = mongoose.connection.db;
          if (db) stats = await db.command({ buildInfo: 1 });
        } catch (_e2) { /* ignore */ }
      }

      // Per-collection stats — real document counts + storage size.
      let collections = [];
      try {
        const db = mongoose.connection.db;
        if (db) {
          const allCols = await db.listCollections().toArray();
          collections = await Promise.all(allCols.map(async (col) => {
            try {
              const name = col.name;
              const collStats = await db.command({ collStats: name, scale: 1 });
              return {
                name,
                count: collStats.count || 0,
                size: collStats.size || 0,
                storageSize: collStats.storageSize || 0,
                totalIndexSize: collStats.totalIndexSize || 0,
                avgObjSize: collStats.avgObjSize || 0,
                indexes: collStats.nindexes || 0,
                capped: !!collStats.capped,
              };
            } catch (_e) {
              return {
                name: col.name,
                count: 0, size: 0, storageSize: 0,
                totalIndexSize: 0, avgObjSize: 0, indexes: 0, capped: false,
              };
            }
          }));
        }
      } catch (_e) { /* ignore */ }

      const dbStats = stats || {};
      const dataSize = dbStats.dataSize || 0;
      const storageSize = dbStats.storageSize || 0;
      const indexSize = dbStats.indexSize || 0;
      const totalSize = (dbStats.dataSize && dbStats.indexSize)
        ? (dbStats.dataSize + dbStats.indexSize)
        : (dataSize + indexSize);
      const objects = dbStats.objects || dbStats.collections || 0;
      const numCollections = dbStats.collections || (collections ? collections.length : 0);
      const numIndexes = dbStats.indexes || collections.reduce((s, c) => s + (c.indexes || 0), 0);
      const avgObjSize = dbStats.avgObjSize || (objects > 0 ? Math.round(dataSize / objects) : 0);

      // Free-tier assumption: MongoDB Atlas M0 free = 512MB. Use the
      // MongoConnection storageLimit if an active connection defines one.
      let storageLimitMB = 512;
      try {
        const activeConn = await MongoConnection.findOne({ isActive: true }).lean();
        if (activeConn && activeConn.storageLimit) {
          storageLimitMB = activeConn.storageLimit;
        }
      } catch (_e) { /* default 512 */ }

      const usedMB = +(totalSize / (1024 * 1024)).toFixed(2);
      const limitMB = storageLimitMB;
      const freeMB = +(Math.max(0, limitMB - usedMB)).toFixed(2);
      const usagePercent = limitMB > 0 ? +Math.min(100, (usedMB / limitMB) * 100).toFixed(2) : 0;
      const indexMB = +(indexSize / (1024 * 1024)).toFixed(2);
      const dataMB = +(dataSize / (1024 * 1024)).toFixed(2);
      const storageOnDiskMB = +(storageSize / (1024 * 1024)).toFixed(2);

      return jsonResponse({
        success: true,
        responseMs,
        usagePercent,
        usedMB,
        freeMB,
        limitMB,
        indexMB,
        dataMB,
        storageOnDiskMB,
        objects,
        collections: numCollections,
        indexes: numIndexes,
        avgObjSize,
        dbVersion: dbStats.version || null,
        engine: dbStats.storageEngine || (dbStats.wiredTiger ? 'wiredTiger' : null),
        collectionDetails: collections.sort((a, b) => (b.storageSize || 0) - (a.storageSize || 0)),
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host || null,
        dbName: mongoose.connection.name || null,
        measuredAt: new Date().toISOString(),
      });
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
    // This action remains for admin-created accounts. NO format restriction —
    // any username the admin chooses is accepted.
    if (action === 'registerUser') {
      await connectDB();
      const { email, password, userId, username } = body;
      if (!password) return jsonResponse({ error: 'Password required' }, 400);
      // Determine the login identifier: prefer userId/username (any format),
      // fall back to email (legacy).
      let loginId = null;
      const rawUsername = (userId || username || '').trim();
      if (rawUsername) {
        const exists = await User.findOne({ $or: [{ userId: rawUsername }, { email: rawUsername.toLowerCase() }] });
        if (exists) return jsonResponse({ error: 'This username is already taken.' }, 409);
        loginId = rawUsername;
      } else if (email) {
        const exists = await User.findOne({ email: email.toLowerCase() });
        if (exists) return jsonResponse({ error: 'Email already registered. Please login.' }, 409);
        loginId = email.toLowerCase();
      } else {
        return jsonResponse({ error: 'Username required' }, 400);
      }
      const settings = await getAppSettings();
      const newUserDoc = {
        password,
        role: 'user',
        sendingLimit: settings.defaultUserLimit,
        expiryDate: computeExpiryDate(settings.defaultUserExpiryDays || 30, 'days'),
        ipAddress: clientIP,
      };
      if (rawUsername) newUserDoc.userId = loginId; else newUserDoc.email = loginId;
      const newUser = new User(newUserDoc);
      await newUser.save();
      const displayId = newUser.userId || newUser.email;
      await logActivity(newUser._id.toString(), 'user', displayId, 'register', 'New user registered: ' + displayId, clientIP);
      const token = await createToken({ userId: newUser._id.toString(), role: 'user', loginId: displayId });
      const res = jsonResponse({ success: true, role: 'user', limit: newUser.sendingLimit, sent: newUser.sentCount, loginId: displayId, email: newUser.email || '' });
      res.headers.set('Set-Cookie', `token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`);
      return res;
    }

    // ===== ACTION: login (user login — username OR email + password) =====
    // NO format restrictions: the user logs in with whatever username/password
    // the admin created the account with.
    if (action === 'login') {
      await connectDB();
      const { email, password, loginId } = body;
      // Accept loginId (new) or email (legacy field name from old client)
      const rawId = (loginId || email || '').trim();
      if (!rawId || !password) return jsonResponse({ error: 'Username and password required' }, 400);
      // Look up the user by userId (case-insensitive) OR by email.
      // No more "4 letters + 2 digits" format requirement.
      let user = null;
      // 1) exact userId match
      user = await User.findOne({ userId: rawId });
      // 2) case-insensitive userId match (admin may have used mixed case)
      if (!user) {
        try {
          user = await User.findOne({ userId: { $regex: new RegExp('^' + rawId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') } });
        } catch (_) { /* regex escape safety */ }
      }
      // 3) email match (legacy accounts)
      if (!user && rawId.includes('@')) {
        user = await User.findOne({ email: rawId.toLowerCase() });
      }
      if (!user) return jsonResponse({ error: 'Invalid username or password' }, 401);
      if (user.status === 'suspended') return jsonResponse({ error: 'Account suspended. Contact admin.' }, 403);
      // Check expiry
      if (user.expiryDate && user.expiryDate < new Date()) {
        return jsonResponse({ error: 'Account expired. Contact admin.' }, 403);
      }
      const match = await comparePassword(password, user.password);
      if (!match) return jsonResponse({ error: 'Invalid username or password' }, 401);
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

    // ===== ACTION: listSenders (connected Gmail accounts via credentials.json rotation) =====
    if (action === 'listSenders') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      try {
        await connectDB();
        const now = new Date();
        // Multi-tenant isolation (BM2 Ultra enterprise):
        //   - Admin/superadmin → sees ALL accounts (admin pool + every user's accounts)
        //   - User → sees their OWN accounts (ownerId = their userId) + admin-pool
        //     accounts that are explicitly marked visibleToUsers = true
        const isStaff = auth.decoded.role === 'admin' || auth.decoded.role === 'superadmin';
        const filter = isStaff
          ? {}
          : { $or: [{ ownerId: auth.decoded.userId }, { ownerId: null, visibleToUsers: true }] };
        const accounts = await EmailAccount.find(filter).sort({ createdAt: 1 }).lean();
        const senders = accounts.map(a => {
          // Recompute live status: cooldown expired -> ACTIVE
          let liveStatus = a.status || 'ACTIVE';
          if (liveStatus === 'COOLDOWN' && a.cooldownUntil && new Date(a.cooldownUntil) <= now) {
            liveStatus = 'ACTIVE';
          }
          return {
            _id: a._id,
            email: a.email,
            provider: a.provider,
            label: a.label || a.email,
            status: liveStatus,
            dailyLimit: a.dailyLimit || 400,
            sentToday: a.sentToday || 0,
            remaining: Math.max(0, (a.dailyLimit || 400) - (a.sentToday || 0)),
            lastUsedAt: a.lastUsedAt || null,
            lastError: a.lastError || null,
            ownerId: a.ownerId || null,
            visibleToUsers: !!a.visibleToUsers,
          };
        });
        return jsonResponse({
          success: true,
          senders,
          activeCount: senders.filter(s => s.status === 'ACTIVE').length,
          totalCapacity: senders.reduce((sum, s) => sum + s.dailyLimit, 0),
          totalSentToday: senders.reduce((sum, s) => sum + s.sentToday, 0),
        });
      } catch (e) {
        return jsonResponse({ success: false, error: e.message }, 500);
      }
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
      const { message, subject, numbers, sendType, templateUsed, aiSuggestion, options } = body;

      if (!message || !numbers || !Array.isArray(numbers) || numbers.length === 0) {
        return jsonResponse({ error: 'Message and numbers required' }, 400);
      }

      const user = await User.findById(auth.decoded.userId);
      if (!user) return jsonResponse({ error: 'User not found' }, 404);
      if (user.status === 'suspended') return jsonResponse({ error: 'Account suspended' }, 403);
      if (user.expiryDate && user.expiryDate < new Date()) return jsonResponse({ error: 'Account expired' }, 403);

      const remaining = user.sendingLimit - user.sentCount;
      if (remaining <= 0) return jsonResponse({ error: 'Sending limit reached' }, 403);

      // ── Test Mail mode: send ONE email to a test recipient only (no campaign) ──
      if (options && options.testMail && options.testRecipient) {
        const testCheck = validateEmailAddress(options.testRecipient);
        if (!testCheck.valid) {
          return jsonResponse({ success: false, error: 'Invalid test email: ' + (testCheck.reason || 'bad format') }, 422);
        }
        try {
          const testOpts = {
            batchSize: 1, delayMs: 0, channel: 'email',
            subject: subject || (options && options.subject) || '',
            contentMode: (options && options.contentMode) || 'text',
            maxRetries: 1,
            checkBounce: !!(options && options.checkBounce),
            bodyMode: (options && options.bodyMode) || 'html',
            mailMode: (options && options.mailMode) || 'new',
            pageColor: (options && options.pageColor) || '24spi',
            eachEvery: (options && options.eachEvery) || 50,
            autoSave: !!(options && options.autoSave),
            senderMail: (options && options.senderMail) || '',
            senderRotate: !!(options && options.senderRotate),
          };
          const testRes = await bulkSendEngine({
            user, message, numbers: [testCheck.cleaned],
            invalidNumbers: [], countryInfo: {}, geminiApi, appSettings: null,
            campaign: null, options: testOpts,
          });
          return jsonResponse({
            success: !testRes.blocked,
            testMail: true,
            blocked: !!testRes.blocked,
            recipient: testCheck.cleaned,
            totalSent: testRes.blocked ? 0 : (testRes.totalSent || 1),
            totalDelivered: testRes.totalDelivered || 0,
            totalUndelivered: testRes.totalUndelivered || 0,
            senderApiUsed: testRes.senderApiUsed || testRes.senderApiName || null,
            spamScore: testRes.spamScore, spamReasons: testRes.spamReasons,
          });
        } catch (e) {
          return jsonResponse({ success: false, testMail: true, error: e.message }, 500);
        }
      }

      // Check blacklist (numbers field also stores emails for the Email module)
      const blacklist = await Blacklist.find({ number: { $in: numbers } }).lean();
      const blacklistedSet = new Set(blacklist.map(b => b.number));

      // Validate email addresses (Email Sending Module — no carrier/MMS logic)
      const validNumbers = [];
      const invalidNumbers = [];
      const countryInfo = {};

      for (const num of numbers) {
        if (blacklistedSet.has(num)) {
          invalidNumbers.push({ number: num, reason: 'Blacklisted' });
          continue;
        }
        const validation = validateEmailAddress(num);
        if (validation.valid) {
          validNumbers.push(validation.cleaned);
          // countryInfo carries the domain instead of a country code for emails
          countryInfo[validation.cleaned] = { domain: validation.domain, common: isCommonEmailDomain(validation.cleaned) };
        } else {
          invalidNumbers.push({ number: num, reason: validation.reason });
        }
      }

      if (validNumbers.length === 0) {
        return jsonResponse({
          success: false,
          error: 'No valid email addresses to send',
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
        country: firstCountry.domain || null,
        countryCode: firstCountry.common ? 'EMAIL' : null,
        channel: 'email',
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
        channel: 'email',           // force the email send path
        subject: subject || (options && options.subject) || '',
        // ── BM2-Ultra-style sending options ──────────────────────────────
        contentMode: (options && options.contentMode) || 'text',  // text | html | inline | attach
        changeAfterSent: !!(options && options.changeAfterSent),  // rewrite each send (polymorph)
        randomText: !!(options && options.randomText),            // inject random padding (anti-fingerprint)
        pageFormat: (options && options.pageFormat) || 'default', // template/page format
        jitterPct: (options && options.jitterPct) || 0,
        humanize: !!(options && options.humanize),
        polymorph: !!(options && options.polymorph),
        dripMode: !!(options && options.dripMode),
        // ── BM2 Ultra full option set ──
        checkBounce: !!(options && options.checkBounce),
        bodyMode: (options && options.bodyMode) || 'html',   // html | hint
        mailMode: (options && options.mailMode) || 'new',    // new | auto
        pageColor: (options && options.pageColor) || '24spi', // 24spi | 8spi | mono
        eachEvery: (options && options.eachEvery) || 50,      // re-render every N sends
        autoSave: !!(options && options.autoSave),
        senderMail: (options && options.senderMail) || '',
        senderRotate: !!(options && options.senderRotate),
        // ── BM2 Ultra extended option set (single-page) ──────────────
        checkResult: !!(options && options.checkResult),       // Check Result?
        checkReply: !!(options && options.checkReply),         // Check Reply?
        autoReply: !!(options && options.autoReply),           // Auto Reply
        autoSend: !!(options && options.autoSend),             // Auto Send
        importFlag: !!(options && options.importFlag),         // Import
        randomHtml: !!(options && options.randomHtml),         // Random HTML
        randomTest: !!(options && options.randomTest),         // Random Test
        speedMode: (options && options.speedMode) || 'ALL',    // Speed ALL / SLOW / SAFE
        changeAfterStart: !!(options && options.changeAfterStart), // Change After.start
        useName: !!(options && options.useName),               // Name?
        sendQuestion: !!(options && options.sendQuestion),     // Send?
        confirmedShipping: !!(options && options.confirmedShipping), // Confirmed Shipping To
        prioritySend: !!(options && options.prioritySend),     // Priority To Send
        scheduledTask: !!(options && options.scheduledTask),   // Scheduled task Check
        colorSec: (options && options.colorSec) || 5,          // Color: 05 Sec
        testMail: !!(options && options.testMail),             // Test Mail?
        testRecipient: (options && options.testRecipient) || '', // test recipient
        // ── Enterprise rotation: subject variants + body variants + from name ──
        subjectVariants: Array.isArray(options && options.subjectVariants) ? options.subjectVariants : [],
        autoChangeSubject: !!(options && options.autoChangeSubject),
        bodyVariants: Array.isArray(options && options.bodyVariants) ? options.bodyVariants : [],
        autoChangeBody: !!(options && options.autoChangeBody),
        fromName: (options && options.fromName) || '',
        fromNameVariants: Array.isArray(options && options.fromNameVariants) ? options.fromNameVariants : [],
        autoChangeName: !!(options && options.autoChangeName),
        aiNamePool: Array.isArray(options && options.aiNamePool) ? options.aiNamePool : [],
        trackPixel: !!(options && options.trackPixel),
        embedAll: !!(options && options.embedAll),
        antiDetect: !!(options && options.antiDetect),
        colorShift: !!(options && options.colorShift),
        textShift: !!(options && options.textShift),
        addUnsubscribe: !!(options && options.addUnsubscribe),
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
        .limit(50)
        .lean();
      // Enterprise: live per-recipient results (blue tick / red cross) + limit-exhaustion flag
      const recipients = recentDeliveries.map((d) => ({
        email: d.number,
        status: d.status,
        provider: d.provider,
        errorMessage: d.errorMessage,
        sentAt: d.sentAt,
      }));
      // Detect sender-API exhaustion from the most recent delivery error
      const lastFail = recentDeliveries.find((d) => d.status !== 'sent' && d.status !== 'delivered');
      const limitExhausted = !!(lastFail && /limit|exhaust|remaining|quota|no available sender/i.test(lastFail.errorMessage || ''));
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
          resumeFrom: campaign.resumeFrom || 0,
          stopRequested: !!campaign.stopRequested,
          recipients,
          limitExhausted,
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

    // ===== ACTION: stopCampaign (user-requested stop; engine honors stopRequested flag) =====
    if (action === 'stopCampaign') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { campaignId, resumeFrom } = body;
      if (!campaignId) return jsonResponse({ error: 'campaignId required' }, 400);
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) return jsonResponse({ error: 'Campaign not found' }, 404);
      if (campaign.userId && String(campaign.userId) !== String(auth.decoded.userId)) {
        return jsonResponse({ error: 'Unauthorized' }, 403);
      }
      campaign.stopRequested = true;
      if (typeof resumeFrom === 'number') campaign.resumeFrom = resumeFrom;
      if (campaign.status === 'running') campaign.status = 'partial';
      await campaign.save();
      return jsonResponse({
        success: true,
        message: 'Stop requested — campaign will halt at the next batch boundary',
        resumeFrom: campaign.resumeFrom,
        totalSent: campaign.totalSent,
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
        // If 404 (model not found), try fallback models automatically
        if (geminiRes.status === 404) {
          const fallbackModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest'];
          let fallbackSuccess = false;
          let fallbackReply = null;
          let lastErr = '';
          for (const fbModel of fallbackModels) {
            if (fbModel === geminiApi.model) continue;
            const fbUrl = `${geminiApi.endpoint}/${fbModel}:generateContent?key=${geminiApi.apiKey}`;
            try {
              const fbRes = await fetch(fbUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: systemPrompt }] }],
                  generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
                }),
              });
              if (fbRes.ok) {
                const fbData = await fbRes.json();
                const fbText = fbData.candidates?.[0]?.content?.parts?.[0]?.text;
                if (fbText) {
                  fallbackSuccess = true;
                  fallbackReply = fbText;
                  // Update the API's model in DB so future requests use the working model
                  await GeminiApi.findByIdAndUpdate(geminiApi._id, { model: fbModel }).catch(() => {});
                  break;
                }
              } else {
                lastErr = await fbRes.text().catch(() => '');
              }
            } catch (e) { lastErr = e.message; }
          }
          if (fallbackSuccess) {
            await updateGeminiApiUsage(geminiApi._id, 1);
            await logActivity(auth.decoded.userId, 'user', userIdentifier, 'ai_chat', `Q: ${message.slice(0, 80)}`, null).catch(() => {});
            return jsonResponse({ success: true, reply: fallbackReply });
          }
          return jsonResponse({
            error: 'AI request failed: model not found (404). Tried fallback models but all failed. The Gemini API key may be invalid or the model name is wrong.',
            detail: lastErr.slice(0, 300),
            hint: 'Go to Admin Panel → API Management → edit the Gemini API. Set model to "gemini-2.5-flash" and make sure the API key is valid (starts with "AIzaSy" or "AQ."). Get one from https://aistudio.google.com/apikey',
          }, 502);
        }
        const errText = await geminiRes.text().catch(() => '');
        // Provide helpful error based on status
        let helpfulError = `AI request failed: ${geminiRes.status}`;
        if (geminiRes.status === 400) helpfulError += ' — Bad request. The API key may be invalid or wrong format (starts with "AIzaSy" or "AQ."). Get a free key from https://aistudio.google.com/apikey';
        else if (geminiRes.status === 403) helpfulError += ' — API key invalid or permission denied. Check the Gemini API key in Admin Panel → API Management.';
        else if (geminiRes.status === 429) helpfulError += ' — Rate limit exceeded. Try again in a moment.';
        return jsonResponse({ error: helpfulError, detail: errText.slice(0, 300) }, 502);
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

    // ===== ACTION: ensureSubjectCategories (seed 10 default categories) =====
    if (action === 'ensureSubjectCategories') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const userId = auth.decoded.userId;
      const defaults = [
        { name: 'Payment', icon: 'Bolt', color: 'green' },
        { name: 'Invoice', icon: 'FilePdf', color: 'cyan' },
        { name: 'Notification', icon: 'Bell', color: 'blue' },
        { name: 'Promotion', icon: 'Tag', color: 'amber' },
        { name: 'Alert', icon: 'Alert', color: 'red' },
        { name: 'Reminder', icon: 'Clock', color: 'violet' },
        { name: 'Confirmation', icon: 'CheckCircle', color: 'green' },
        { name: 'Support', icon: 'Reply', color: 'cyan' },
        { name: 'Update', icon: 'Refresh', color: 'blue' },
        { name: 'Offer', icon: 'Star', color: 'amber' },
      ];
      const existing = await SubjectCategory.find({ $or: [{ ownerId: userId }, { ownerId: null }] }).lean();
      const existingNames = new Set(existing.map(c => c.name));
      const created = [];
      for (const d of defaults) {
        if (!existingNames.has(d.name)) {
          const cat = await SubjectCategory.create({
            name: d.name,
            slug: d.name.toLowerCase().replace(/\s+/g, '-'),
            icon: d.icon,
            color: d.color,
            ownerId: userId,
            isActive: true,
          });
          created.push(cat);
          existingNames.add(d.name);
        }
      }
      const all = await SubjectCategory.find({ $or: [{ ownerId: userId }, { ownerId: null }] }).sort({ name: 1 }).lean();
      return jsonResponse({ success: true, categories: all, created: created.length });
    }

    // ===== ACTION: listSubjectCategories =====
    if (action === 'listSubjectCategories') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const userId = auth.decoded.userId;
      const categories = await SubjectCategory.find({ $or: [{ ownerId: userId }, { ownerId: null }] }).sort({ name: 1 }).lean();
      return jsonResponse({ success: true, categories });
    }

    // ===== ACTION: addSubjectCategory =====
    if (action === 'addSubjectCategory') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { name, icon, color } = body;
      if (!name || !name.trim()) return jsonResponse({ error: 'Category name required' }, 400);
      const userId = auth.decoded.userId;
      const slug = name.trim().toLowerCase().replace(/\s+/g, '-');
      const exists = await SubjectCategory.findOne({ slug, $or: [{ ownerId: userId }, { ownerId: null }] });
      if (exists) return jsonResponse({ error: 'Category already exists' }, 409);
      const cat = await SubjectCategory.create({
        name: name.trim(), slug, icon: icon || 'Tag', color: color || 'violet',
        ownerId: userId, isActive: true,
      });
      return jsonResponse({ success: true, category: cat });
    }

    // ===== ACTION: deleteSubjectCategory =====
    if (action === 'deleteSubjectCategory') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { categoryId } = body;
      if (!categoryId) return jsonResponse({ error: 'categoryId required' }, 400);
      const userId = auth.decoded.userId;
      const cat = await SubjectCategory.findOne({ _id: categoryId, ownerId: userId });
      if (!cat) return jsonResponse({ error: 'Category not found or not yours' }, 404);
      await SubjectTemplate.deleteMany({ categoryId });
      await SubjectCategory.deleteOne({ _id: categoryId });
      return jsonResponse({ success: true });
    }

    // ===== ACTION: getSubjectTemplates (by category, auto-seed if empty) =====
    if (action === 'getSubjectTemplates') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { categoryId } = body;
      if (!categoryId) return jsonResponse({ error: 'categoryId required' }, 400);
      const userId = auth.decoded.userId;
      let templates = await SubjectTemplate.find({ categoryId, $or: [{ ownerId: userId }, { ownerId: null }] })
        .sort({ usedCount: 1, createdAt: 1 }).lean();
      // Auto-seed starter templates if the category has none
      if (templates.length === 0) {
        const cat = await SubjectCategory.findById(categoryId).lean();
        if (cat) {
          const seed = getSeedSubjectsForCategory(cat.name);
          const docs = seed.map(text => ({ categoryId, ownerId: userId, text, isActive: true }));
          await SubjectTemplate.insertMany(docs);
          templates = await SubjectTemplate.find({ categoryId, $or: [{ ownerId: userId }, { ownerId: null }] })
            .sort({ usedCount: 1, createdAt: 1 }).lean();
        }
      }
      return jsonResponse({ success: true, templates });
    }

    // ===== ACTION: addSubjectTemplate =====
    if (action === 'addSubjectTemplate') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { categoryId, text } = body;
      if (!categoryId || !text || !text.trim()) return jsonResponse({ error: 'categoryId and text required' }, 400);
      const userId = auth.decoded.userId;
      const tpl = await SubjectTemplate.create({
        categoryId, ownerId: userId, text: text.trim(), isActive: true,
      });
      return jsonResponse({ success: true, template: tpl });
    }

    // ===== ACTION: deleteSubjectTemplate =====
    if (action === 'deleteSubjectTemplate') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { templateId } = body;
      if (!templateId) return jsonResponse({ error: 'templateId required' }, 400);
      const userId = auth.decoded.userId;
      await SubjectTemplate.deleteOne({ _id: templateId, ownerId: userId });
      return jsonResponse({ success: true });
    }

    // ===== ACTION: pickSubjectFromCategory (auto-pick least-used unused subject) =====
    if (action === 'pickSubjectFromCategory') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { categoryId, count } = body;
      if (!categoryId) return jsonResponse({ error: 'categoryId required' }, 400);
      const userId = auth.decoded.userId;
      const n = Math.max(1, Math.min(count || 1, 500));
      const templates = await SubjectTemplate.find({ categoryId, $or: [{ ownerId: userId }, { ownerId: null }], isActive: true })
        .sort({ usedCount: 1, lastUsedAt: 1, createdAt: 1 }).limit(n).lean();
      if (templates.length === 0) {
        const cat = await SubjectCategory.findById(categoryId).lean();
        if (cat) {
          const seed = getSeedSubjectsForCategory(cat.name);
          const docs = seed.map(text => ({ categoryId, ownerId: userId, text, isActive: true }));
          await SubjectTemplate.insertMany(docs);
          const fresh = await SubjectTemplate.find({ categoryId, $or: [{ ownerId: userId }, { ownerId: null }], isActive: true })
            .sort({ usedCount: 1, lastUsedAt: 1, createdAt: 1 }).limit(n).lean();
          return jsonResponse({ success: true, subjects: fresh.map(t => t.text) });
        }
      }
      // Mark them as used
      const ids = templates.map(t => t._id);
      if (ids.length > 0) {
        await SubjectTemplate.updateMany({ _id: { $in: ids } }, { $inc: { usedCount: 1 }, $set: { lastUsedAt: new Date() } });
      }
      return jsonResponse({ success: true, subjects: templates.map(t => t.text) });
    }

    // ===== ACTION: listBodyTemplates =====
    if (action === 'listBodyTemplates') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const userId = auth.decoded.userId;
      let templates = await BodyTemplate.find({ $or: [{ ownerId: userId }, { ownerId: null }] })
        .sort({ usedCount: 1, createdAt: 1 }).lean();
      // Auto-seed preset body templates if none exist
      if (templates.length === 0) {
        const seed = getSeedBodyTemplates();
        const docs = seed.map(t => ({ ...t, ownerId: userId, isPreset: true, isActive: true }));
        await BodyTemplate.insertMany(docs);
        templates = await BodyTemplate.find({ $or: [{ ownerId: userId }, { ownerId: null }] })
          .sort({ usedCount: 1, createdAt: 1 }).lean();
      }
      return jsonResponse({ success: true, templates });
    }

    // ===== ACTION: addBodyTemplate =====
    if (action === 'addBodyTemplate') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { name, category, mode, content } = body;
      if (!name || !content) return jsonResponse({ error: 'Name and content required' }, 400);
      const userId = auth.decoded.userId;
      const tpl = await BodyTemplate.create({
        name: name.trim(), category: category || 'general', mode: mode || 'html',
        content, ownerId: userId, isPreset: false, isActive: true,
      });
      return jsonResponse({ success: true, template: tpl });
    }

    // ===== ACTION: deleteBodyTemplate =====
    if (action === 'deleteBodyTemplate') {
      const auth = await verifyAny(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { templateId } = body;
      if (!templateId) return jsonResponse({ error: 'templateId required' }, 400);
      const userId = auth.decoded.userId;
      await BodyTemplate.deleteOne({ _id: templateId, ownerId: userId });
      return jsonResponse({ success: true });
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

    // ===== ACTION: getAllScheduledSends (admin — all users) =====
    if (action === 'getAllScheduledSends') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const sends = await ScheduledSend.find({ status: 'scheduled' }).sort({ scheduledAt: 1 }).lean();
      return jsonResponse({ success: true, scheduledSends: sends });
    }

    // ===== ACTION: deleteScheduledSend (admin) =====
    if (action === 'deleteScheduledSend') {
      const auth = await verifyAdmin(req);
      if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
      await connectDB();
      const { sendId } = body;
      if (!sendId) return jsonResponse({ error: 'sendId required' }, 400);
      await ScheduledSend.findByIdAndDelete(sendId);
      return jsonResponse({ success: true });
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

// ============================================================================
// Seed subject templates per category (enterprise template system)
// Each category gets a curated set of professional, spam-safe subject lines.
// The user can add more; these are starters that auto-populate on first open.
// ============================================================================

function getSeedSubjectsForCategory(categoryName) {
  const cat = (categoryName || '').toLowerCase();
  const seeds = {
    payment: [
      'Payment Confirmation #RANDOM#',
      'Your Payment Has Been Received',
      'Payment Receipt #RANDOM_NUMBER#',
      'Payment Successful — Thank You',
      'Payment Update for Your Account',
      'We Received Your Payment #RANDOM#',
      'Payment Processed Successfully',
      'Your Recent Payment Confirmation',
      'Payment Verification Complete',
      'Thank You for Your Payment',
      'Payment Acknowledged — Order #RANDOM_NUMBER#',
      'Payment Status: Confirmed',
      'Your Payment is Now Complete',
      'Payment Receipt Inside #RANDOM#',
      'Payment Confirmed — Details Attached',
    ],
    invoice: [
      'Invoice #RANDOM_NUMBER# from #SENDER_NAME#',
      'Your Invoice is Ready',
      'Invoice #RANDOM# — Due Soon',
      'New Invoice Available #RANDOM_NUMBER#',
      'Invoice Reminder #RANDOM#',
      'Your Monthly Invoice #RANDOM_NUMBER#',
      'Invoice Statement #RANDOM#',
      'Invoice for Your Records',
      'Invoice #RANDOM_NUMBER# — Please Review',
      'Digital Invoice Available Now',
      'Your Invoice #RANDOM# is Attached',
      'Invoice Payment Due #RANDOM_NUMBER#',
      'Invoice Summary #RANDOM#',
      'Your Recent Invoice #RANDOM_NUMBER#',
      'Invoice Copy — #SENDER_NAME#',
    ],
    notification: [
      'New Notification #RANDOM#',
      'You Have a New Update',
      'Notification: Account Activity #RANDOM#',
      'Important Notification #RANDOM#',
      'New Activity on Your Account',
      'Notification — Please Review #RANDOM#',
      'You Have 1 New Notification',
      'Account Notification #RANDOM_NUMBER#',
      'New Message Notification #RANDOM#',
      'Notification: Action Required',
      'Recent Notification #RANDOM#',
      'System Notification #RANDOM_NUMBER#',
      'New Alert on Your Account',
      'Notification — #SENDER_NAME#',
      'Update Notification #RANDOM#',
    ],
    promotion: [
      'Special Offer Just for You #RANDOM#',
      'Exclusive Promotion Inside #RANDOM#',
      'Limited Time Promotion #RANDOM#',
      'Promo: Save Today #RANDOM_NUMBER#',
      'Your Exclusive Promotion Awaits',
      'Promotion — Don\'t Miss Out #RANDOM#',
      'Special Promotion for You',
      'Promo Code Inside #RANDOM#',
      'Promotion: Limited Availability',
      'Your Promotion is Ready #RANDOM#',
      'Exclusive Deal for You',
      'Promotion — #SENDER_NAME#',
      'Special Promo Offer #RANDOM_NUMBER#',
      'Your Discount Promotion #RANDOM#',
      'Promotion: Act Now',
    ],
    alert: [
      'Security Alert #RANDOM#',
      'Important Alert — Please Read',
      'Alert: Account Activity Detected #RANDOM#',
      'Urgent Alert #RANDOM#',
      'Security Alert — Action Needed',
      'Alert: Unusual Activity #RANDOM_NUMBER#',
      'Important Security Alert #RANDOM#',
      'Alert — Your Attention Required',
      'Account Alert #RANDOM#',
      'Alert: Please Verify #RANDOM_NUMBER#',
      'Security Notification Alert',
      'Alert — #SENDER_NAME#',
      'Important Alert #RANDOM#',
      'Alert: Review Your Account',
      'Security Alert #RANDOM_NUMBER#',
    ],
    reminder: [
      'Friendly Reminder #RANDOM#',
      'Reminder: Action Needed #RANDOM#',
      'Don\'t Forget — Reminder #RANDOM_NUMBER#',
      'Reminder from #SENDER_NAME#',
      'Your Scheduled Reminder #RANDOM#',
      'Reminder — Please Review',
      'Upcoming Reminder #RANDOM#',
      'Reminder: Your Attention Needed',
      'Gentle Reminder #RANDOM_NUMBER#',
      'Reminder — Time Sensitive #RANDOM#',
      'Your Reminder Inside',
      'Reminder — #SENDER_NAME#',
      'Quick Reminder #RANDOM#',
      'Reminder: Don\'t Miss This',
      'Scheduled Reminder #RANDOM_NUMBER#',
    ],
    confirmation: [
      'Confirmation #RANDOM#',
      'Your Request is Confirmed',
      'Confirmation — Thank You #RANDOM#',
      'Order Confirmation #RANDOM_NUMBER#',
      'Booking Confirmed #RANDOM#',
      'Confirmation: Details Inside',
      'Your Confirmation #RANDOM#',
      'Confirmed — #SENDER_NAME#',
      'Confirmation Receipt #RANDOM_NUMBER#',
      'Your Appointment is Confirmed',
      'Confirmation #RANDOM# — Please Review',
      'Registration Confirmed #RANDOM#',
      'Confirmation — Success',
      'Your Subscription is Confirmed',
      'Confirmation #RANDOM_NUMBER# — Welcome',
    ],
    support: [
      'Support: We\'re Here to Help #RANDOM#',
      'Your Support Request #RANDOM_NUMBER#',
      'Support Update — #SENDER_NAME#',
      'How Can We Help You Today?',
      'Support Team Follow-Up #RANDOM#',
      'Your Support Ticket #RANDOM_NUMBER#',
      'Support — We Received Your Message',
      'Customer Support Update #RANDOM#',
      'Support: Response Inside',
      'Your Support Inquiry #RANDOM#',
      'Support — #SENDER_NAME#',
      'We\'re Following Up on Your Request',
      'Support: Quick Update #RANDOM#',
      'Your Support Case #RANDOM_NUMBER#',
      'Support — How Can We Assist?',
    ],
    update: [
      'Update #RANDOM# — Please Review',
      'Important Update #RANDOM#',
      'Your Account Update #RANDOM_NUMBER#',
      'Update from #SENDER_NAME#',
      'Latest Update #RANDOM#',
      'Update — What\'s New',
      'Your Update is Ready #RANDOM#',
      'Update: Please Review',
      'Account Update #RANDOM_NUMBER#',
      'Update — #SENDER_NAME#',
      'Important Service Update #RANDOM#',
      'Your Latest Update #RANDOM#',
      'Update — Action May Be Needed',
      'System Update #RANDOM_NUMBER#',
      'Update: New Information #RANDOM#',
    ],
    offer: [
      'Special Offer for You #RANDOM#',
      'Your Exclusive Offer #RANDOM#',
      'Offer — Limited Time #RANDOM_NUMBER#',
      'An Offer You Can\'t Refuse',
      'Your Offer is Ready #RANDOM#',
      'Offer from #SENDER_NAME#',
      'Exclusive Offer Inside #RANDOM#',
      'Your Personal Offer #RANDOM_NUMBER#',
      'Offer — Just for You',
      'Special Offer #RANDOM# — Don\'t Miss',
      'Your Offer Awaits #RANDOM#',
      'Offer — #SENDER_NAME#',
      'Limited Offer #RANDOM_NUMBER#',
      'Your Discount Offer #RANDOM#',
      'Offer — Claim Now',
    ],
  };
  return seeds[cat] || seeds.notification;
}

// ============================================================================
// Seed body templates (enterprise email body system)
// Preset professional HTML + text templates auto-populate on first use.
// ============================================================================

function getSeedBodyTemplates() {
  return [
    {
      name: 'Professional Notification',
      category: 'notification',
      mode: 'html',
      content: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <h2 style="color:#4f46e5;">Hello #NAME#,</h2>
  <p style="color:#333;font-size:14px;line-height:1.6;">We wanted to let you know about an important update regarding your account. Please review the information below and take any necessary action.</p>
  <div style="background:#f8f9fa;border-left:4px solid #4f46e5;padding:15px;margin:20px 0;">
    <p style="margin:0;color:#555;font-size:13px;">Reference: #RANDOM_NUMBER#</p>
    <p style="margin:5px 0 0;color:#555;font-size:13px;">Date: #DATE#</p>
  </div>
  <p style="color:#333;font-size:14px;">If you have any questions, please don't hesitate to contact us.</p>
  <p style="color:#333;font-size:14px;">Best regards,<br/><strong>#SENDER_NAME#</strong></p>
</div>`,
    },
    {
      name: 'Invoice Template',
      category: 'invoice',
      mode: 'html',
      content: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#4f46e5;color:#fff;padding:20px;text-align:center;">
    <h1 style="margin:0;font-size:24px;">INVOICE</h1>
    <p style="margin:5px 0 0;font-size:13px;">Invoice #: #RANDOM_NUMBER#</p>
  </div>
  <div style="padding:20px;">
    <p style="color:#333;font-size:14px;">Dear #NAME#,</p>
    <p style="color:#333;font-size:14px;">Thank you for your business. Please find your invoice details below.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      <tr style="background:#f8f9fa;">
        <th style="padding:10px;text-align:left;border:1px solid #ddd;">Description</th>
        <th style="padding:10px;text-align:right;border:1px solid #ddd;">Amount</th>
      </tr>
      <tr>
        <td style="padding:10px;border:1px solid #ddd;">Service / Product</td>
        <td style="padding:10px;text-align:right;border:1px solid #ddd;">$#RANDOM_NUMBER#</td>
      </tr>
      <tr style="background:#f8f9fa;font-weight:bold;">
        <td style="padding:10px;border:1px solid #ddd;">Total Due</td>
        <td style="padding:10px;text-align:right;border:1px solid #ddd;">$#RANDOM_NUMBER#</td>
      </tr>
    </table>
    <p style="color:#333;font-size:14px;">Due Date: #DATE#</p>
    <p style="color:#333;font-size:14px;">Best regards,<br/><strong>#SENDER_NAME#</strong></p>
  </div>
</div>`,
    },
    {
      name: 'Payment Confirmation',
      category: 'invoice',
      mode: 'html',
      content: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#22c55e;color:#fff;padding:20px;text-align:center;border-radius:8px 8px 0 0;">
    <h2 style="margin:0;">✓ Payment Confirmed</h2>
  </div>
  <div style="padding:20px;border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px;">
    <p style="color:#333;font-size:14px;">Hello #NAME#,</p>
    <p style="color:#333;font-size:14px;">We have successfully received your payment. Here are your transaction details:</p>
    <div style="background:#f0fdf4;padding:15px;border-radius:6px;margin:15px 0;">
      <p style="margin:0;color:#555;font-size:13px;">Transaction ID: #RANDOM#</p>
      <p style="margin:5px 0 0;color:#555;font-size:13px;">Amount: $#RANDOM_NUMBER#</p>
      <p style="margin:5px 0 0;color:#555;font-size:13px;">Date: #DATE#</p>
    </div>
    <p style="color:#333;font-size:14px;">Thank you for your payment!</p>
    <p style="color:#333;font-size:14px;">Best regards,<br/><strong>#SENDER_NAME#</strong></p>
  </div>
</div>`,
    },
    {
      name: 'Promotional Offer',
      category: 'promotional',
      mode: 'html',
      content: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff;padding:30px;text-align:center;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;font-size:28px;">Special Offer!</h1>
    <p style="margin:10px 0 0;font-size:16px;">Just for you, #NAME#</p>
  </div>
  <div style="padding:25px;border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px;">
    <p style="color:#333;font-size:15px;line-height:1.6;">We're excited to share an exclusive offer with you. For a limited time, enjoy special savings on our premium services.</p>
    <div style="text-align:center;margin:25px 0;">
      <span style="background:#f59e0b;color:#fff;padding:12px 30px;font-size:20px;font-weight:bold;border-radius:6px;display:inline-block;">Save #RANDOM_NUMBER#% Today</span>
    </div>
    <p style="color:#333;font-size:14px;">Offer valid until #DATE#. Don't miss out!</p>
    <p style="color:#333;font-size:14px;">Best regards,<br/><strong>#SENDER_NAME#</strong></p>
  </div>
</div>`,
    },
    {
      name: 'Welcome Email',
      category: 'welcome',
      mode: 'html',
      content: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#4f46e5;color:#fff;padding:25px;text-align:center;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;font-size:26px;">Welcome, #NAME#!</h1>
  </div>
  <div style="padding:25px;border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px;">
    <p style="color:#333;font-size:15px;line-height:1.6;">We're thrilled to have you on board! Your account is now active and ready to use.</p>
    <p style="color:#333;font-size:14px;">Here's what you can do next:</p>
    <ul style="color:#555;font-size:14px;line-height:1.8;">
      <li>Explore your dashboard</li>
      <li>Set up your preferences</li>
      <li>Start using our services</li>
    </ul>
    <p style="color:#333;font-size:14px;">If you need any help, our support team is always here for you.</p>
    <p style="color:#333;font-size:14px;">Best regards,<br/><strong>#SENDER_NAME#</strong></p>
  </div>
</div>`,
    },
    {
      name: 'Plain Text Reminder',
      category: 'general',
      mode: 'text',
      content: `Hello #NAME#,

This is a friendly reminder regarding your account.

Reference: #RANDOM_NUMBER#
Date: #DATE#

Please review and take any necessary action at your earliest convenience. If you have already completed the required steps, you may disregard this message.

If you have any questions, please don't hesitate to reach out.

Best regards,
#SENDER_NAME#`,
    },
    {
      name: 'Support Response',
      category: 'general',
      mode: 'html',
      content: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <h2 style="color:#0891b2;">Hello #NAME#,</h2>
  <p style="color:#333;font-size:14px;line-height:1.6;">Thank you for reaching out to our support team. We've received your inquiry and want to assure you that we're here to help.</p>
  <div style="background:#ecfeff;border-left:4px solid #0891b2;padding:15px;margin:20px 0;">
    <p style="margin:0;color:#555;font-size:13px;">Ticket #: #RANDOM_NUMBER#</p>
    <p style="margin:5px 0 0;color:#555;font-size:13px;">Status: In Progress</p>
  </div>
  <p style="color:#333;font-size:14px;">Our team is reviewing your request and will get back to you as soon as possible with a detailed response.</p>
  <p style="color:#333;font-size:14px;">Best regards,<br/><strong>#SENDER_NAME#</strong><br/>Support Team</p>
</div>`,
    },
    {
      name: 'Account Alert',
      category: 'notification',
      mode: 'html',
      content: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#ef4444;color:#fff;padding:20px;text-align:center;border-radius:8px 8px 0 0;">
    <h2 style="margin:0;">⚠ Security Alert</h2>
  </div>
  <div style="padding:20px;border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px;">
    <p style="color:#333;font-size:14px;">Hello #NAME#,</p>
    <p style="color:#333;font-size:14px;">We detected activity on your account that may need your attention. For your security, please review the details below.</p>
    <div style="background:#fef2f2;padding:15px;border-radius:6px;margin:15px 0;">
      <p style="margin:0;color:#555;font-size:13px;">Alert ID: #RANDOM#</p>
      <p style="margin:5px 0 0;color:#555;font-size:13px;">Time: #DATETIME#</p>
    </div>
    <p style="color:#333;font-size:14px;">If this was you, no action is needed. If not, please contact us immediately.</p>
    <p style="color:#333;font-size:14px;">Best regards,<br/><strong>#SENDER_NAME#</strong></p>
  </div>
</div>`,
    },
  ];
}

export async function GET() {
  return jsonResponse({ status: 'ok', message: 'MMS Sender API is running' });
}
