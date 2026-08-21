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
const ALLOWED_PROVIDERS = ['GMAIL_OAUTH', 'OUTLOOK_GRAPH', 'YAHOO', 'AOL', 'CUSTOM_SMTP'];

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
    // POST /api/admin/gateway/accounts -> Add/Update email account
    // ====================================================================
    if (resource === 'accounts') {
      const { provider, email, credentials, dailyLimit, label } = body;

      if (!provider || !ALLOWED_PROVIDERS.includes(provider)) {
        return jsonResponse({ error: 'Invalid provider. Allowed: ' + ALLOWED_PROVIDERS.join(', ') }, 400);
      }
      if (!email || !isValidEmail(email)) {
        return jsonResponse({ error: 'A valid email address is required' }, 400);
      }
      if (!credentials || typeof credentials !== 'object' || Object.keys(credentials).length === 0) {
        return jsonResponse({ error: 'credentials object is required (OAuth tokens or SMTP auth)' }, 400);
      }

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
