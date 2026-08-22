// ============================================================================
// MODULE 6: Proxy/Worker CRUD + IP Masking Toggle — REST API
// ============================================================================
// GET    /api/admin/gateway/proxies            → List all proxies + masking status
// POST   /api/admin/gateway/proxies            → Add a new proxy/worker
// POST   /api/admin/gateway/proxies?action=toggle  → Toggle IP masking on/off (no restart)
// POST   /api/admin/gateway/proxies?action=strategy → Change proxy strategy (no restart)
// PATCH  /api/admin/gateway/proxies            → Update global proxy settings (timeout, strip)
//
// All operations are LIVE — no server restart required. Active proxy selection
// is cached in Redis and invalidated on every CRUD change.
//
// NON-DESTRUCTIVE: brand-new route. Reuses shared admin auth helpers.
// ============================================================================

import {
  connectDB,
  verifyToken,
  jsonResponse,
  logActivity,
  ProxyConfig,
  isIpMaskingEnabled,
  toggleIpMasking,
  invalidateProxyCache,
  getProxyStatus,
} from '@/lib/core';
import { setDynamicConfig, getDynamicConfig } from '@/lib/redis';
import { PROXY_TYPES, IP_MASKING_TOGGLE_KEY } from '@/lib/gateway/constants';

// ---------------------------------------------------------------------------
// Auth helpers (mirrors /api/admin/gateway/route.js)
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

const ALLOWED_TYPES = [
  PROXY_TYPES.CLOUDFLARE_WORKER,
  PROXY_TYPES.ROTATING_PROXY,
  PROXY_TYPES.STATIC_PROXY,
];

const ALLOWED_STRATEGIES = ['weighted', 'round_robin', 'least_latency', 'random'];

// ===========================================================================
// GET — List all proxies + full proxy routing status
// ===========================================================================
export async function GET(req) {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return jsonResponse({ error: auth.error }, auth.code);

    const status = await getProxyStatus();
    return jsonResponse({ success: true, ...status });
  } catch (err) {
    console.error('[gateway/proxies GET] error:', err);
    return jsonResponse({ error: 'Internal server error', detail: err.message }, 500);
  }
}

// ===========================================================================
// POST — Add proxy OR toggle masking OR change strategy (action-based)
// ===========================================================================
export async function POST(req) {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return jsonResponse({ error: auth.error }, auth.code);

    const body = await req.json();
    const { action } = body;

    await connectDB();

    // ── ACTION: toggle IP masking on/off (NO RESTART) ──────────────────────
    if (action === 'toggleMasking') {
      const enabled = body.enabled === true || body.enabled === 'true';
      const result = await toggleIpMasking(enabled);
      await logActivity(
        auth.decoded.userId,
        'admin',
        auth.decoded.username,
        'ip_masking_toggle',
        `IP Masking ${enabled ? 'ENABLED' : 'DISABLED'} (no restart)`,
        null
      );
      return jsonResponse({
        success: true,
        message: `IP Masking is now ${enabled ? 'ON' : 'OFF'} — live, no restart needed`,
        ...result,
      });
    }

    // ── ACTION: change proxy selection strategy (NO RESTART) ───────────────
    if (action === 'setStrategy') {
      const strategy = body.strategy;
      if (!ALLOWED_STRATEGIES.includes(strategy)) {
        return jsonResponse(
          { error: `Invalid strategy. Allowed: ${ALLOWED_STRATEGIES.join(', ')}` },
          400
        );
      }
      await setDynamicConfig('proxyStrategy', strategy);
      await invalidateProxyCache();
      await logActivity(
        auth.decoded.userId,
        'admin',
        auth.decoded.username,
        'proxy_strategy_change',
        `Proxy strategy set to: ${strategy} (no restart)`,
        null
      );
      return jsonResponse({
        success: true,
        message: `Proxy strategy updated to '${strategy}' — live`,
        strategy,
      });
    }

    // ── ACTION: update global proxy settings (timeout, strip headers) ──────
    if (action === 'updateSettings') {
      const updates = {};
      if ('proxyTimeoutMs' in body) {
        const ms = Number(body.proxyTimeoutMs);
        if (ms > 0 && ms < 120000) {
          await setDynamicConfig('proxyTimeoutMs', String(ms));
          updates.proxyTimeoutMs = ms;
        }
      }
      if ('proxyStripHeaders' in body) {
        const strip = body.proxyStripHeaders === true || body.proxyStripHeaders === 'true';
        await setDynamicConfig('proxyStripHeaders', strip ? 'true' : 'false');
        updates.proxyStripHeaders = strip;
      }
      await logActivity(
        auth.decoded.userId,
        'admin',
        auth.decoded.username,
        'proxy_settings_update',
        `Updated proxy settings: ${JSON.stringify(updates)}`,
        null
      );
      return jsonResponse({
        success: true,
        message: 'Proxy settings updated — live',
        updates,
      });
    }

    // ── DEFAULT: Add a new proxy/worker ─────────────────────────────────────
    const { label, type, url, authKey, weight, region, enabled, config } = body;

    if (!url) {
      return jsonResponse({ error: 'Proxy URL is required' }, 400);
    }
    if (type && !ALLOWED_TYPES.includes(type)) {
      return jsonResponse(
        { error: `Invalid type. Allowed: ${ALLOWED_TYPES.join(', ')}` },
        400
      );
    }

    // De-duplicate by URL (don't allow exact duplicate proxy URLs)
    const existing = await ProxyConfig.findOne({ url: url.trim() }).lean();
    if (existing) {
      return jsonResponse(
        { error: 'A proxy with this URL already exists', existingId: existing._id },
        409
      );
    }

    const proxy = await ProxyConfig.create({
      label: label || 'Unnamed Proxy',
      type: type || PROXY_TYPES.CLOUDFLARE_WORKER,
      url: url.trim(),
      authKey: authKey || '',
      weight: weight != null ? Number(weight) : 1,
      region: region || 'default',
      enabled: enabled !== false,
      config: config || {},
      createdBy: auth.decoded.username || 'admin',
    });

    // Invalidate cache so the new proxy is considered immediately
    await invalidateProxyCache();

    await logActivity(
      auth.decoded.userId,
      'admin',
      auth.decoded.username,
      'proxy_add',
      `Added proxy: ${proxy.label} (${proxy.type}) → ${proxy.url}`,
      proxy._id.toString()
    );

    return jsonResponse(
      {
        success: true,
        message: 'Proxy added successfully — live, no restart needed',
        proxy: {
          id: proxy._id.toString(),
          label: proxy.label,
          type: proxy.type,
          url: proxy.url,
          region: proxy.region,
          weight: proxy.weight,
          enabled: proxy.enabled,
        },
      },
      201
    );
  } catch (err) {
    console.error('[gateway/proxies POST] error:', err);
    return jsonResponse({ error: 'Internal server error', detail: err.message }, 500);
  }
}

// ===========================================================================
// PATCH — Bulk update global proxy settings (alias for action=updateSettings)
// ===========================================================================
export async function PATCH(req) {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return jsonResponse({ error: auth.error }, auth.code);

    const body = await req.json();
    const updates = {};

    if ('ipMaskingEnabled' in body) {
      const enabled = body.ipMaskingEnabled === true || body.ipMaskingEnabled === 'true';
      await toggleIpMasking(enabled);
      updates.ipMaskingEnabled = enabled;
    }
    if ('proxyStrategy' in body) {
      if (ALLOWED_STRATEGIES.includes(body.proxyStrategy)) {
        await setDynamicConfig('proxyStrategy', body.proxyStrategy);
        updates.proxyStrategy = body.proxyStrategy;
      }
    }
    if ('proxyTimeoutMs' in body) {
      const ms = Number(body.proxyTimeoutMs);
      if (ms > 0 && ms < 120000) {
        await setDynamicConfig('proxyTimeoutMs', String(ms));
        updates.proxyTimeoutMs = ms;
      }
    }
    if ('proxyStripHeaders' in body) {
      const strip = body.proxyStripHeaders === true || body.proxyStripHeaders === 'true';
      await setDynamicConfig('proxyStripHeaders', strip ? 'true' : 'false');
      updates.proxyStripHeaders = strip;
    }

    await invalidateProxyCache();

    return jsonResponse({
      success: true,
      message: `Updated ${Object.keys(updates).length} proxy setting(s) — live`,
      updates,
    });
  } catch (err) {
    console.error('[gateway/proxies PATCH] error:', err);
    return jsonResponse({ error: 'Internal server error', detail: err.message }, 500);
  }
}
