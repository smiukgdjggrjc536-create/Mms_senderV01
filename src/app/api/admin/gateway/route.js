// ============================================================================
// Email-to-MMS Gateway Engine — Admin Config Endpoints (Phase 1)
// ============================================================================
// Secure, asynchronous REST endpoints that sync with the existing Admin UI:
//   POST /api/admin/gateway/config   -> Create/Update SystemConfig (singleton)
//   GET  /api/admin/gateway/config   -> Retrieve current SystemConfig
//   POST /api/admin/gateway/accounts -> Add/Update email account credentials
//   GET  /api/admin/gateway/accounts -> Fetch all accounts with health status
//
// NON-DESTRUCTIVE: this is a brand-new route file. It does NOT modify the
// existing /api/system route or any existing model. It reuses the project's
// shared auth + response helpers (verifyToken, jsonResponse, connectDB) from
// @/lib/core so admin security is consistent across the whole platform.
//
// All endpoints require a valid admin/superadmin JWT (same 3-layer login the
// Admin Panel uses). The action/resource is selected via a `resource` field in
// the JSON body (POST) or a `?resource=` query param (GET), keeping a single
// clean route file that the Admin Panel can call.
// ============================================================================

import {
  connectDB,
  verifyToken,
  jsonResponse,
  EmailAccount,
  CarrierCache,
  SystemConfig,
} from '@/lib/core';
import nodemailer from 'nodemailer';
import { sendByProvider } from '@/services/senders/index.js';


// ---------------------------------------------------------------------------
// Auth helpers (mirrors the pattern in /api/system/route.js)
// ---------------------------------------------------------------------------
function getTokenFromReq(req) {
  const cookieHeader = req.headers.get('cookie') || '';
  const tokenMatch = cookieHeader.match(/token=([^;]+)/);
  return tokenMatch ? tokenMatch[1] : null;
}

async function verifyAdmin(req) {
  const token = getTokenFromReq(req);
  if (!token) return { error: 'Unauthorized', code: 401 };
  const decoded = await verifyToken(token);
  if (!decoded) return { error: 'Invalid Token', code: 403 };
  if (decoded.role !== 'admin' && decoded.role !== 'superadmin') {
    return { error: 'Forbidden: Admin only', code: 403 };
  }
  return { decoded };
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------
const ALLOWED_PROVIDERS = ['GMAIL_OAUTH', 'GMAIL_APP_PASSWORD', 'OUTLOOK_GRAPH', 'YAHOO', 'AOL', 'CUSTOM_SMTP'];

function isValidEmail(str) {
  return typeof str === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

// Compute a live health status for an email account based on its stored state.
// Returns { status, health, usable, reason } for the Admin Panel UI.
function computeAccountHealth(acc) {
  const now = new Date();
  let status = acc.status || 'ACTIVE';
  let reason = null;

  // If cooldown period has passed, the account is effectively ACTIVE again
  // (the scheduler in Phase 3 will persist this flip, but we reflect it live).
  if (status === 'COOLDOWN' && acc.cooldownUntil && new Date(acc.cooldownUntil) <= now) {
    status = 'ACTIVE';
  }

  // Daily limit reached -> not usable until the daily reset.
  let usable = status === 'ACTIVE' && acc.sentToday < (acc.dailyLimit || 400);

  if (status === 'SUSPENDED') {
    reason = 'Manually suspended or hard-banned by provider';
    usable = false;
  } else if (status === 'COOLDOWN') {
    reason = 'In cooldown until ' + (acc.cooldownUntil ? new Date(acc.cooldownUntil).toISOString() : 'unknown');
    usable = false;
  } else if (acc.sentToday >= (acc.dailyLimit || 400)) {
    reason = 'Daily sending limit reached (' + acc.sentToday + '/' + (acc.dailyLimit || 400) + ')';
    usable = false;
  } else if (acc.consecutiveBounces >= 5) {
    reason = 'High bounce rate (' + acc.consecutiveBounces + ' consecutive bounces)';
    usable = false;
  }

  // Health score: simple heuristic 0-100 for the dashboard.
  let health = 100;
  if (!usable) health = 30;
  if (status === 'SUSPENDED') health = 0;
  if (acc.lastError) health = Math.min(health, 50);

  const remaining = Math.max(0, (acc.dailyLimit || 400) - (acc.sentToday || 0));

  return {
    status,
    health,
    usable,
    reason,
    remainingToday: remaining,
  };
}

// ---------------------------------------------------------------------------
// Credential validation — provider-specific required fields
// ---------------------------------------------------------------------------
// Returns an error STRING if invalid, or null if valid.
function validateCredentials(provider, credentials) {
  if (!credentials || typeof credentials !== 'object') {
    return 'credentials object is required';
  }
  switch (provider) {
    case 'GMAIL_OAUTH':
      if (!credentials.refreshToken) return 'Gmail OAuth requires refreshToken';
      if (!credentials.clientId) return 'Gmail OAuth requires clientId';
      if (!credentials.clientSecret) return 'Gmail OAuth requires clientSecret';
      return null;
    case 'GMAIL_APP_PASSWORD':
      if (!credentials.appPassword || typeof credentials.appPassword !== 'string') {
        return 'Gmail App Password requires appPassword (16-char code from Google Account)';
      }
      // App passwords are 16 chars, possibly with spaces. Strip spaces for the check.
      if (credentials.appPassword.replace(/\s/g, '').length < 16) {
        return 'Gmail App Password appears too short (expected 16 characters)';
      }
      return null;
    case 'OUTLOOK_GRAPH':
      if (!credentials.accessToken && !credentials.refreshToken) {
        return 'Outlook Graph requires accessToken or refreshToken';
      }
      if (!credentials.clientId) return 'Outlook Graph requires clientId';
      return null;
    case 'YAHOO':
    case 'AOL':
      if (!credentials.password) return (provider === 'YAHOO' ? 'Yahoo' : 'AOL') + ' requires password (app password)';
      return null;
    case 'CUSTOM_SMTP':
      if (!credentials.host) return 'Custom SMTP requires host';
      if (!credentials.port) return 'Custom SMTP requires port';
      if (!credentials.user) return 'Custom SMTP requires user';
      if (!credentials.pass) return 'Custom SMTP requires pass';
      return null;
    default:
      return 'Unknown provider: ' + provider;
  }
}

// ---------------------------------------------------------------------------
// Connectivity test — lightweight SMTP verify for SMTP-based providers
// ---------------------------------------------------------------------------
// Performs a nodemailer "verify" call (connects + authenticates, does NOT
// send mail). For OAuth providers we can't easily verify without token
// refresh logic, so we return a soft-pass with a note.
// Returns { success: boolean, message: string }
async function testEmailAccountConnectivity(acc) {
  try {
    const provider = acc.provider;
    const cred = acc.credentials || {};

    if (provider === 'GMAIL_APP_PASSWORD' || provider === 'YAHOO' || provider === 'AOL') {
      // SMTP-based providers — do a real connection test.
      const hostMap = {
        GMAIL_APP_PASSWORD: 'smtp.gmail.com',
        YAHOO: 'smtp.mail.yahoo.com',
        AOL: 'smtp.aol.com',
      };
      const port = 465;
      const user = acc.email;
      let pass = cred.appPassword || cred.password || '';
      pass = String(pass).replace(/\s/g, ''); // strip spaces from app passwords

      const transporter = nodemailer.createTransport({
        host: hostMap[provider],
        port,
        secure: true,
        auth: { user, pass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });

      await transporter.verify();
      return { success: true, message: `SMTP connection to ${hostMap[provider]}:465 verified successfully for ${user}` };
    }

    if (provider === 'CUSTOM_SMTP') {
      const port = Number(cred.port) || 587;
      const transporter = nodemailer.createTransport({
        host: cred.host,
        port,
        secure: port === 465,
        auth: { user: cred.user, pass: cred.pass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });
      await transporter.verify();
      return { success: true, message: `SMTP connection to ${cred.host}:${port} verified successfully` };
    }

    if (provider === 'GMAIL_OAUTH' || provider === 'OUTLOOK_GRAPH') {
      // OAuth-based — would need token refresh to fully verify. Soft-pass.
      return {
        success: true,
        message: 'OAuth account stored. Full connectivity test requires token refresh at send-time. Credentials validated structurally.',
      };
    }

    return { success: false, message: 'Unknown provider — cannot test connectivity' };
  } catch (err) {
    return { success: false, message: 'Connectivity test failed: ' + (err.message || String(err)) };
  }
}

// ---------------------------------------------------------------------------
// SystemConfig helpers (singleton pattern — only one config document)
// ---------------------------------------------------------------------------
async function getSystemConfigDoc() {
  // Always return the single config doc, creating defaults if none exists.
  let cfg = await SystemConfig.findOne({});
  if (!cfg) {
    cfg = await SystemConfig.create({});
  }
  return cfg;
}

// Mask sensitive keys for GET responses so they never leak in full.
function maskConfig(cfg) {
  if (!cfg) return null;
  const obj = cfg.toObject ? cfg.toObject() : { ...cfg };
  if (obj.geminiApiKey) {
    obj.geminiApiKey = obj.geminiApiKey.length > 8
      ? obj.geminiApiKey.substring(0, 4) + '••••••••' + obj.geminiApiKey.slice(-4)
      : '••••••••';
  }
  if (obj.carrierLookupApiKey) {
    obj.carrierLookupApiKey = obj.carrierLookupApiKey.length > 8
      ? obj.carrierLookupApiKey.substring(0, 4) + '••••••••' + obj.carrierLookupApiKey.slice(-4)
      : '••••••••';
  }
  // Phase 4: mask the Render deploy URL token (it carries a secret in the path).
  if (obj.renderDeployUrl) {
    try {
      const u = new URL(obj.renderDeployUrl);
      // Mask the pathname (which contains the secret deploy token) but keep
      // the host visible so the admin knows which Render service it targets.
      const maskedPath = u.pathname.length > 8
        ? u.pathname.substring(0, 4) + '••••••••' + u.pathname.slice(-4)
        : '••••••••';
      obj.renderDeployUrl = u.protocol + '//' + u.host + maskedPath;
    } catch (_e) {
      obj.renderDeployUrl = '••••••••';
    }
  }
  return obj;
}

// ---------------------------------------------------------------------------
// POST handler — create/update config OR add/update accounts
// ---------------------------------------------------------------------------
export async function POST(req) {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
    await connectDB();

    const body = await req.json();
    const { resource } = body;

    // ====================================================================
    // POST /api/admin/gateway/config  -> Create/Update SystemConfig
    // ====================================================================
    if (resource === 'config') {
      const update = {};
      if (typeof body.geminiApiKey === 'string') update.geminiApiKey = body.geminiApiKey.trim();
      if (typeof body.carrierLookupApiKey === 'string') update.carrierLookupApiKey = body.carrierLookupApiKey.trim();

      if (body.routingDelaySeconds !== undefined) {
        const v = Number(body.routingDelaySeconds);
        if (!Number.isFinite(v) || v < 0) {
          return jsonResponse({ error: 'routingDelaySeconds must be a non-negative number' }, 400);
        }
        update.routingDelaySeconds = v;
      }

      if (body.batchSizePerAccount !== undefined) {
        const v = Number(body.batchSizePerAccount);
        if (!Number.isFinite(v) || v < 1) {
          return jsonResponse({ error: 'batchSizePerAccount must be a positive number' }, 400);
        }
        update.batchSizePerAccount = v;
      }

      if (typeof body.enablePhishingFilter === 'boolean') {
        update.enablePhishingFilter = body.enablePhishingFilter;
      }

      if (Array.isArray(body.blockedKeywords)) {
        update.blockedKeywords = body.blockedKeywords
          .map((k) => String(k).trim().toLowerCase())
          .filter((k) => k.length > 0);
      }

      // Phase 4: Render.com deploy hook URL (optional, stored for the
      // deploy-hook endpoint to trigger fresh builds).
      if (typeof body.renderDeployUrl === 'string') {
        const url = body.renderDeployUrl.trim();
        if (url.length > 0) {
          // Basic validation — must be an https URL.
          try {
            const parsed = new URL(url);
            if (parsed.protocol !== 'https:') {
              return jsonResponse({ error: 'renderDeployUrl must use HTTPS' }, 400);
            }
            update.renderDeployUrl = url;
          } catch (_e) {
            return jsonResponse({ error: 'renderDeployUrl is not a valid URL' }, 400);
          }
        } else {
          // Empty string clears the stored URL.
          update.renderDeployUrl = '';
        }
      }

      // Upsert the singleton config document.
      const cfg = await SystemConfig.findOneAndUpdate(
        {},
        { $set: { ...update, updatedAt: new Date() } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      return jsonResponse({
        success: true,
        message: 'System configuration saved',
        config: maskConfig(cfg),
      });
    }

    // ====================================================================
    // POST /api/admin/gateway/accounts -> Add/Update/Delete/Test email account
    // ====================================================================
    if (resource === 'accounts') {
      // Support both flat payload (legacy) and { action, account } payload (frontend).
      const action = body.action || 'create';
      const acc = body.account || body; // frontend nests under .account; legacy is flat
      const accountId = body.accountId || acc._id || null;

      // DELETE
      if (action === 'delete' && accountId) {
        await EmailAccount.findByIdAndDelete(accountId);
        return jsonResponse({ success: true, message: 'Email account deleted' });
      }

      // TEST (verify the account can actually send via its provider)
      if (action === 'test' && accountId) {
        const acc2 = await EmailAccount.findById(accountId).lean();
        if (!acc2) return jsonResponse({ error: 'Account not found' }, 404);
        const testRes = await testEmailAccountConnectivity(acc2);
        return jsonResponse(testRes);
      }

      // SEND TEST EMAIL — sends a REAL test email FROM the configured email
      // account TO a destination email address the admin provides. This uses
      // the actual provider sender (sendByProvider) so it exercises the real
      // send path (Gmail OAuth token refresh + REST, or SMTP, or App Password).
      // Required body: { resource: 'accounts', action: 'sendTestEmail',
      //   accountId: '<id>', toEmail: '<destination@gmail.com>' }
      // Optional: subject, message
      if (action === 'sendTestEmail' && accountId) {
        const acc3 = await EmailAccount.findById(accountId).lean();
        if (!acc3) return jsonResponse({ error: 'Account not found' }, 404);

        const toEmail = (body.toEmail || '').trim();
        if (!toEmail || !isValidEmail(toEmail)) {
          return jsonResponse({ error: 'A valid destination email (toEmail) is required' }, 400);
        }

        const subject = body.subject || 'MMS Gateway — Test Email ✉️';
        const message = body.message || `This is a test email sent from the MMS Sender Gateway to verify that the email account ${acc3.email} can send mail successfully.\n\nTimestamp: ${new Date().toISOString()}\nProvider: ${acc3.provider}\n\nIf you received this email, the account is working correctly.`;

        try {
          const result = await sendByProvider({
            account: acc3,
            to: toEmail,
            subject,
            body: message,
          });

          // Update lastUsedAt + clear lastError on success
          await EmailAccount.findByIdAndUpdate(accountId, {
            lastUsedAt: new Date(),
            lastError: null,
          }).catch(() => {});

          return jsonResponse({
            success: true,
            message: `Test email sent successfully from ${acc3.email} to ${toEmail}`,
            provider: result.provider,
            messageId: result.messageId,
            from: acc3.email,
            to: toEmail,
          });
        } catch (sendErr) {
          // Record the error on the account for diagnostics
          const errMsg = `${sendErr.bounceType || 'SEND_ERROR'}: ${sendErr.message || String(sendErr)}`;
          await EmailAccount.findByIdAndUpdate(accountId, {
            lastError: errMsg.slice(0, 300),
          }).catch(() => {});

          return jsonResponse({
            success: false,
            error: `Test email FAILED: ${sendErr.message || String(sendErr)}`,
            bounceType: sendErr.bounceType || 'UNKNOWN',
            status: sendErr.status || 0,
            from: acc3.email,
            to: toEmail,
          }, 500);
        }
      }

      // RESET COOLDOWN
      if (action === 'reset' && accountId) {
        await EmailAccount.findByIdAndUpdate(accountId, { status: 'ACTIVE', cooldownUntil: null, consecutiveBounces: 0, lastError: null });
        return jsonResponse({ success: true, message: 'Cooldown reset' });
      }

      // CREATE / UPDATE (upsert by email)
      const { provider, email, credentials, dailyLimit, label } = acc;

      if (!provider || !ALLOWED_PROVIDERS.includes(provider)) {
        return jsonResponse({ error: 'Invalid provider. Allowed: ' + ALLOWED_PROVIDERS.join(', ') }, 400);
      }
      if (!email || !isValidEmail(email)) {
        return jsonResponse({ error: 'A valid email address is required' }, 400);
      }
      if (!credentials || typeof credentials !== 'object' || Object.keys(credentials).length === 0) {
        return jsonResponse({ error: 'credentials object is required (OAuth tokens, app password, or SMTP auth)' }, 400);
      }

      // Validate provider-specific credentials
      const credErr = validateCredentials(provider, credentials);
      if (credErr) return jsonResponse({ error: credErr }, 400);

      // Build the update payload — password/secret fields are kept as-is.
      const update = {
        provider,
        email: email.toLowerCase().trim(),
        credentials,
        updatedAt: new Date(),
      };
      if (typeof label === 'string') update.label = label.trim();
      if (dailyLimit !== undefined) {
        const v = Number(dailyLimit);
        if (!Number.isFinite(v) || v < 1) {
          return jsonResponse({ error: 'dailyLimit must be a positive number' }, 400);
        }
        update.dailyLimit = v;
      }

      // Upsert by email so re-adding the same account updates it instead of
      // creating a duplicate.
      const account = await EmailAccount.findOneAndUpdate(
        { email: email.toLowerCase().trim() },
        { $set: update },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      // Don't echo full credentials back.
      const safe = account.toObject();
      delete safe.credentials;

      return jsonResponse({
        success: true,
        message: 'Email account saved',
        account: safe,
      });
    }

    return jsonResponse({ error: 'Unknown resource. Use resource=config or resource=accounts' }, 400);
  } catch (err) {
    console.error('[gateway POST] error:', err);
    return jsonResponse({ error: 'Internal server error', detail: err.message }, 500);
  }
}

// ---------------------------------------------------------------------------
// GET handler — retrieve config OR list accounts with health
// ---------------------------------------------------------------------------
export async function GET(req) {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
    await connectDB();

    const url = new URL(req.url);
    const resource = url.searchParams.get('resource');

    // ====================================================================
    // GET /api/admin/gateway/config  -> Retrieve current config
    // ====================================================================
    if (resource === 'config') {
      const cfg = await getSystemConfigDoc();
      return jsonResponse({
        success: true,
        config: maskConfig(cfg),
      });
    }

    // ====================================================================
    // GET /api/admin/gateway/accounts -> All accounts with health status
    // ====================================================================
    if (resource === 'accounts') {
      const accounts = await EmailAccount.find({}).sort({ createdAt: 1 }).lean();
      const withHealth = accounts.map((acc) => {
        // Strip credentials from the response.
        const { credentials, ...safe } = acc;
        const health = computeAccountHealth(acc);
        return { ...safe, ...health };
      });

      const summary = {
        total: withHealth.length,
        active: withHealth.filter((a) => a.status === 'ACTIVE').length,
        cooldown: withHealth.filter((a) => a.status === 'COOLDOWN').length,
        suspended: withHealth.filter((a) => a.status === 'SUSPENDED').length,
        usable: withHealth.filter((a) => a.usable).length,
      };

      return jsonResponse({
        success: true,
        summary,
        accounts: withHealth,
      });
    }

    return jsonResponse({ error: 'Unknown resource. Use ?resource=config or ?resource=accounts' }, 400);
  } catch (err) {
    console.error('[gateway GET] error:', err);
    return jsonResponse({ error: 'Internal server error', detail: err.message }, 500);
  }
}
