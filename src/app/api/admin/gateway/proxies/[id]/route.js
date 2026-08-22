// ============================================================================
// MODULE 6: Individual Proxy CRUD — REST API
// ============================================================================
// GET    /api/admin/gateway/proxies/[id]  → Get a single proxy's details
// PATCH  /api/admin/gateway/proxies/[id]  → Edit / update a proxy (any config)
// POST   /api/admin/gateway/proxies/[id]  → Toggle enable/disable OR test proxy
// DELETE /api/admin/gateway/proxies/[id]  → Delete a proxy
//
// All operations are LIVE — no server restart required. The active-proxy
// cache in Redis is invalidated on every change.
//
// NON-DESTRUCTIVE: brand-new route. Reuses shared admin auth helpers.
// ============================================================================

import {
  connectDB,
  verifyToken,
  jsonResponse,
  logActivity,
  ProxyConfig,
  invalidateProxyCache,
  proxiedFetch,
} from '@/lib/core';

// ---------------------------------------------------------------------------
// Auth helpers
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

// ===========================================================================
// GET — Single proxy details
// ===========================================================================
export async function GET(req, { params }) {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return jsonResponse({ error: auth.error }, auth.code);

    const { id } = await params;
    await connectDB();
    const proxy = await ProxyConfig.findById(id).lean();
    if (!proxy) {
      return jsonResponse({ error: 'Proxy not found' }, 404);
    }

    return jsonResponse({
      success: true,
      proxy: {
        id: proxy._id.toString(),
        label: proxy.label,
        type: proxy.type,
        url: proxy.url,
        authKey: proxy.authKey ? '***' : '', // don't leak the key in GET
        region: proxy.region,
        weight: proxy.weight,
        enabled: proxy.enabled,
        status: proxy.status,
        consecutiveFailures: proxy.consecutiveFailures,
        avgLatencyMs: proxy.avgLatencyMs,
        totalRequests: proxy.totalRequests,
        lastUsedAt: proxy.lastUsedAt,
        config: proxy.config,
        createdAt: proxy.createdAt,
        updatedAt: proxy.updatedAt,
      },
    });
  } catch (err) {
    console.error('[gateway/proxies/[id] GET] error:', err);
    return jsonResponse({ error: 'Internal server error', detail: err.message }, 500);
  }
}

// ===========================================================================
// PATCH — Edit / update any field of a proxy
// ===========================================================================
export async function PATCH(req, { params }) {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return jsonResponse({ error: auth.error }, auth.code);

    const { id } = await params;
    const body = await req.json();
    await connectDB();

    const proxy = await ProxyConfig.findById(id);
    if (!proxy) {
      return jsonResponse({ error: 'Proxy not found' }, 404);
    }

    const updatable = [
      'label',
      'type',
      'url',
      'authKey',
      'weight',
      'region',
      'enabled',
      'config',
    ];

    const changes = {};
    for (const field of updatable) {
      if (field in body) {
        let value = body[field];
        if (field === 'weight') value = Number(value);
        if (field === 'enabled') value = value === true || value === 'true';
        if (field === 'config') value = value || {};
        changes[field] = { from: proxy[field], to: value };
        proxy[field] = value;
      }
    }

    await proxy.save();
    await invalidateProxyCache();

    await logActivity(
      auth.decoded.userId,
      'admin',
      auth.decoded.username,
      'proxy_update',
      `Updated proxy ${proxy.label}: ${Object.keys(changes).join(', ')}`,
      proxy._id.toString()
    );

    return jsonResponse({
      success: true,
      message: 'Proxy updated — live, no restart needed',
      proxy: {
        id: proxy._id.toString(),
        label: proxy.label,
        type: proxy.type,
        url: proxy.url,
        enabled: proxy.enabled,
        weight: proxy.weight,
        region: proxy.region,
      },
    });
  } catch (err) {
    console.error('[gateway/proxies/[id] PATCH] error:', err);
    return jsonResponse({ error: 'Internal server error', detail: err.message }, 500);
  }
}

// ===========================================================================
// POST — Toggle enable/disable OR test the proxy
// ===========================================================================
export async function POST(req, { params }) {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return jsonResponse({ error: auth.error }, auth.code);

    const { id } = await params;
    const body = await req.json();
    const { action } = body;
    await connectDB();

    const proxy = await ProxyConfig.findById(id);
    if (!proxy) {
      return jsonResponse({ error: 'Proxy not found' }, 404);
    }

    // ── ACTION: test — send a test request through the proxy ───────────────
    if (action === 'test') {
      const testUrl = body.testUrl || 'https://httpbin.org/get';
      const startTime = Date.now();
      try {
        // Temporarily route a fetch through this specific proxy
        const sep = proxy.url.includes('?') ? '&' : '?';
        const proxiedUrl = `${proxy.url}${sep}target=${encodeURIComponent(testUrl)}`;
        const headers = {};
        if (proxy.authKey) {
          headers['Authorization'] = `Bearer ${proxy.authKey}`;
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(proxiedUrl, { headers, signal: controller.signal });
        clearTimeout(timer);
        const latency = Date.now() - startTime;
        const ok = response.ok;
        const responseBody = await response.text().catch(() => '');

        // Update health
        proxy.totalRequests = (proxy.totalRequests || 0) + 1;
        proxy.lastUsedAt = new Date();
        if (ok) {
          proxy.avgLatencyMs = proxy.avgLatencyMs > 0 ? Math.round(proxy.avgLatencyMs * 0.5 + latency * 0.5) : latency;
          proxy.consecutiveFailures = 0;
          proxy.status = 'healthy';
        } else {
          proxy.consecutiveFailures = (proxy.consecutiveFailures || 0) + 1;
          proxy.status = 'degraded';
        }
        await proxy.save();
        await invalidateProxyCache();

        return jsonResponse({
          success: true,
          test: {
            ok,
            status: response.status,
            latencyMs: latency,
            bodyPreview: responseBody.slice(0, 500),
          },
        });
      } catch (testErr) {
        const latency = Date.now() - startTime;
        proxy.consecutiveFailures = (proxy.consecutiveFailures || 0) + 1;
        proxy.status = proxy.consecutiveFailures >= 5 ? 'down' : 'degraded';
        await proxy.save();
        await invalidateProxyCache();
        return jsonResponse({
          success: false,
          test: { ok: false, latencyMs: latency, error: testErr.message },
        });
      }
    }

    // ── DEFAULT: toggle enable/disable ──────────────────────────────────────
    const newEnabled = !proxy.enabled;
    proxy.enabled = newEnabled;
    await proxy.save();
    await invalidateProxyCache();

    await logActivity(
      auth.decoded.userId,
      'admin',
      auth.decoded.username,
      'proxy_toggle',
      `Proxy ${proxy.label} ${newEnabled ? 'ENABLED' : 'DISABLED'}`,
      proxy._id.toString()
    );

    return jsonResponse({
      success: true,
      message: `Proxy ${newEnabled ? 'enabled' : 'disabled'} — live`,
      proxy: {
        id: proxy._id.toString(),
        label: proxy.label,
        enabled: proxy.enabled,
      },
    });
  } catch (err) {
    console.error('[gateway/proxies/[id] POST] error:', err);
    return jsonResponse({ error: 'Internal server error', detail: err.message }, 500);
  }
}

// ===========================================================================
// DELETE — Remove a proxy
// ===========================================================================
export async function DELETE(req, { params }) {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return jsonResponse({ error: auth.error }, auth.code);

    const { id } = await params;
    await connectDB();
    const proxy = await ProxyConfig.findById(id);
    if (!proxy) {
      return jsonResponse({ error: 'Proxy not found' }, 404);
    }

    const label = proxy.label;
    await ProxyConfig.findByIdAndDelete(id);
    await invalidateProxyCache();

    await logActivity(
      auth.decoded.userId,
      'admin',
      auth.decoded.username,
      'proxy_delete',
      `Deleted proxy: ${label}`,
      id
    );

    return jsonResponse({
      success: true,
      message: `Proxy '${label}' deleted — live`,
    });
  } catch (err) {
    console.error('[gateway/proxies/[id] DELETE] error:', err);
    return jsonResponse({ error: 'Internal server error', detail: err.message }, 500);
  }
}
