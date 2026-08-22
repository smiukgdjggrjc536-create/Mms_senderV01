// ============================================================================
// MODULE 6: Origin IP Masking & Proxy Routing — proxyRouter.js
// ============================================================================
// [DESIGN_PATTERN: Forward Proxy & Serverless Edge Routing]
//
// CRITICAL: No email or dispatch request fires directly from the Node.js
// server (Render/VPS) to a telecom server. ALL outbound dispatch requests
// are routed through Cloudflare Workers or a Rotating Proxy Pool.
//
// Core responsibilities:
//   1. selectProxy()  — weighted / round-robin / least-latency / random
//                        selection of an enabled, healthy proxy from Mongo
//                        (cached in Redis for 5 minutes).
//   2. proxiedFetch() — wraps a fetch() so the request goes THROUGH the
//                        selected proxy with strict header stripping.
//   3. stripOriginHeaders() — removes X-Forwarded-For / Via / X-Real-IP etc.
//   4. isIpMaskingEnabled() — reads the Redis toggle (on/off, no restart).
//   5. toggleIpMasking()   — flips the toggle live.
//   6. recordProxyResult() — updates health, latency, failure count.
//
// NON-DESTRUCTIVE: brand-new service. Reuses Redis helpers + the ProxyConfig
// model. Does not modify existing dispatch code — it is composed AROUND the
// existing send logic.
// ============================================================================

import { connectDB, logActivity } from '@/lib/core';
import { proxyConfigSchema } from '../../models/proxyConfig.js';
import {
  getRedis,
  cacheGet,
  cacheSet,
  cacheDel,
  getDynamicConfig,
  setDynamicConfig,
  incrMetric,
  acquireMutex,
} from '@/lib/redis';
import {
  PROXY_TYPES,
  IP_MASKING_TOGGLE_KEY,
  ACTIVE_PROXY_CACHE_KEY,
  ACTIVE_PROXY_CACHE_TTL,
  STRIP_HEADERS,
  PROXY_TIMEOUT_MS,
  PROXY_FAILURE_THRESHOLD,
} from '@/lib/gateway/constants';
import mongoose from 'mongoose';

// ---------------------------------------------------------------------------
// Register the ProxyConfig model (project pattern: cached registration)
// ---------------------------------------------------------------------------
const ProxyConfig =
  mongoose.models.ProxyConfig || mongoose.model('ProxyConfig', proxyConfigSchema);

// ---------------------------------------------------------------------------
// In-memory fallback for the active-proxy selection pointer (when Redis is
// absent we keep the last-selected proxy index in a module-level Map so
// round-robin still works within a single process).
// ---------------------------------------------------------------------------
const _rrPointer = new Map(); // key -> last index

// ===========================================================================
// 1. IP MASKING TOGGLE (on/off WITHOUT restart — stored in Redis)
// ===========================================================================

/**
 * Check whether IP masking (proxy routing) is globally enabled.
 * Default is TRUE — meaning ALL dispatch goes through proxies.
 * Reads from Redis dynamic-config; falls back to SystemConfig; default true.
 */
export async function isIpMaskingEnabled() {
  const val = await getDynamicConfig(IP_MASKING_TOGGLE_KEY, null);
  if (val === 'true' || val === true) return true;
  if (val === 'false' || val === false) return false;
  // Default: masking ON
  return true;
}

/**
 * Toggle IP masking on/off live (no restart). Stored in Redis.
 * When OFF, the gateway dispatches directly from the origin server.
 */
export async function toggleIpMasking(enabled) {
  const value = enabled ? 'true' : 'false';
  await setDynamicConfig(IP_MASKING_TOGGLE_KEY, value);
  // Invalidate the active-proxy cache so the next dispatch re-evaluates.
  await cacheDel(ACTIVE_PROXY_CACHE_KEY);
  await incrMetric('ip_masking_toggles');
  return { ipMaskingEnabled: enabled };
}

// ===========================================================================
// 2. PROXY SELECTION (weighted / round-robin / least-latency / random)
// ===========================================================================

/**
 * Select an active, healthy proxy from the database.
 * Strategy:
 *   - 'weighted'      → weighted random by proxy.weight
 *   - 'round_robin'   → rotate sequentially (pointer in memory / Redis)
 *   - 'least_latency' → pick the proxy with lowest avgLatencyMs
 *   - 'random'        → uniform random
 *
 * Result is cached in Redis (5-min TTL) to avoid a Mongo round-trip on every
 * dispatch. The cache is invalidated on any CRUD operation.
 */
export async function selectProxy() {
  // Check cache first
  const cached = await cacheGet(ACTIVE_PROXY_CACHE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (_e) {
      // corrupt cache — fall through
    }
  }

  await connectDB();

  // Load all enabled proxies
  const proxies = await ProxyConfig.find({ enabled: true })
    .sort({ weight: -1, createdAt: 1 })
    .lean();

  if (!proxies || proxies.length === 0) {
    return null; // No proxy configured → caller decides whether to direct-send
  }

  // Exclude 'down' proxies (mini circuit-breaker)
  const usable = proxies.filter(
    (p) => p.status !== 'down' && (p.consecutiveFailures || 0) < PROXY_FAILURE_THRESHOLD
  );

  const pool = usable.length > 0 ? usable : proxies; // fallback to all if all degraded

  // Read the selection strategy from Redis dynamic config
  const strategy = await getDynamicConfig('proxyStrategy', 'weighted');

  let selected;

  if (strategy === 'round_robin') {
    const idx = ((_rrPointer.get('global') || 0) + 1) % pool.length;
    _rrPointer.set('global', idx);
    selected = pool[idx];
  } else if (strategy === 'least_latency') {
    selected = pool.reduce((best, p) => {
      if (!best) return p;
      return (p.avgLatencyMs || 999999) < (best.avgLatencyMs || 999999) ? p : best;
    }, null);
  } else if (strategy === 'random') {
    selected = pool[Math.floor(Math.random() * pool.length)];
  } else {
    // weighted (default)
    const totalWeight = pool.reduce((sum, p) => sum + (p.weight || 1), 0);
    let r = Math.random() * totalWeight;
    selected = pool[0];
    for (const p of pool) {
      r -= p.weight || 1;
      if (r <= 0) {
        selected = p;
        break;
      }
    }
  }

  // Cache the selection (strip Mongo internals)
  const serializable = {
    _id: selected._id.toString(),
    label: selected.label,
    type: selected.type,
    url: selected.url,
    authKey: selected.authKey || '',
    region: selected.region || 'default',
    weight: selected.weight || 1,
    config: selected.config || {},
  };
  await cacheSet(ACTIVE_PROXY_CACHE_KEY, JSON.stringify(serializable), ACTIVE_PROXY_CACHE_TTL);

  return serializable;
}

// ===========================================================================
// 3. HEADER STRIPPING — remove all origin-revealing headers
// ===========================================================================

/**
 * Strip all headers that could reveal the origin server IP to telecom filters.
 * Also injects clean headers so the request looks like a genuine client request.
 */
export function stripOriginHeaders(headers = {}) {
  const cleaned = {};
  const lowerStrip = new Set(STRIP_HEADERS.map((h) => h.toLowerCase()));

  for (const [key, value] of Object.entries(headers)) {
    if (lowerStrip.has(key.toLowerCase())) {
      continue; // REMOVE origin-revealing header
    }
    cleaned[key] = value;
  }

  // Inject a fresh random request ID (no proxy chain signature)
  cleaned['X-Request-ID'] =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);

  return cleaned;
}

// ===========================================================================
// 4. PROXIED FETCH — route a request THROUGH the selected proxy
// ===========================================================================

/**
 * Wrap an outbound fetch so it goes through the selected proxy.
 *
 * For 'cloudflare_worker' proxies, the worker URL is the base; the target
 * URL is appended as a path/query param so the worker fetches it on behalf
 * of the gateway (the telecom only sees the Worker's Cloudflare edge IP).
 *
 * For 'rotating_proxy' / 'static_proxy', the proxy URL is used as an HTTP
 * CONNECT proxy via the `dispatcher` option (Node undici) or as an
 * `https-proxy-agent` if available.
 *
 * If IP masking is OFF or no proxy is configured, this falls back to a
 * DIRECT fetch (with headers still stripped).
 */
export async function proxiedFetch(targetUrl, options = {}) {
  const maskingEnabled = await isIpMaskingEnabled();
  const stripEnabled = await getDynamicConfig('proxyStripHeaders', 'true');
  const shouldStrip = stripEnabled !== 'false' && stripEnabled !== false;

  // Clean headers always (even in direct mode, stripping is defence-in-depth)
  const finalHeaders = shouldStrip
    ? stripOriginHeaders(options.headers || {})
    : { ...(options.headers || {}) };

  // If masking is off OR no proxy available → direct fetch (headers stripped)
  if (!maskingEnabled) {
    return fetch(targetUrl, {
      ...options,
      headers: finalHeaders,
    });
  }

  const proxy = await selectProxy();
  if (!proxy) {
    // No proxy configured — fall back to direct (with stripped headers)
    await incrMetric('proxy_fallback_direct');
    return fetch(targetUrl, {
      ...options,
      headers: finalHeaders,
    });
  }

  const timeoutMs = await getDynamicConfig('proxyTimeoutMs', PROXY_TIMEOUT_MS);
  const startTime = Date.now();
  let success = false;
  let errorMsg = null;

  try {
    let proxiedUrl = targetUrl;
    let proxiedHeaders = { ...finalHeaders };

    if (proxy.type === PROXY_TYPES.CLOUDFLARE_WORKER) {
      // Cloudflare Worker pattern: append the target URL as an encoded query param
      // The worker script fetches the target and returns the response.
      const sep = proxy.url.includes('?') ? '&' : '?';
      proxiedUrl = `${proxy.url}${sep}target=${encodeURIComponent(targetUrl)}`;
      // Worker may expect a bearer auth key
      if (proxy.authKey) {
        proxiedHeaders['Authorization'] = `Bearer ${proxy.authKey}`;
      }
      // Allow worker-specific config overrides
      if (proxy.config && proxy.config.customHeaders) {
        proxiedHeaders = { ...proxiedHeaders, ...proxy.config.customHeaders };
      }
    } else {
      // rotating_proxy / static_proxy: use the proxy URL as the HTTP proxy
      // In a serverless/edge environment we can't easily open a CONNECT tunnel,
      // so we use the proxy as a forwarding relay (same as worker pattern).
      const sep = proxy.url.includes('?') ? '&' : '?';
      proxiedUrl = `${proxy.url}${sep}target=${encodeURIComponent(targetUrl)}`;
      if (proxy.authKey) {
        proxiedHeaders['X-Proxy-Auth'] = proxy.authKey;
      }
    }

    // AbortController for timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number(timeoutMs));

    const response = await fetch(proxiedUrl, {
      ...options,
      headers: proxiedHeaders,
      signal: controller.signal,
    });

    clearTimeout(timer);
    success = response.ok;
    return response;
  } catch (err) {
    errorMsg = err.message || String(err);
    throw err;
  } finally {
    const latency = Date.now() - startTime;
    await recordProxyResult(proxy._id, success, latency, errorMsg);
  }
}

// ===========================================================================
// 5. HEALTH TRACKING — update proxy stats after each request
// ===========================================================================

/**
 * Record the result of a proxied request: update latency, failure count,
 * status, and total requests. Implements a mini circuit-breaker per proxy.
 */
export async function recordProxyResult(proxyId, success, latencyMs, errorMsg = null) {
  try {
    await connectDB();
    const proxy = await ProxyConfig.findById(proxyId);
    if (!proxy) return;

    proxy.totalRequests = (proxy.totalRequests || 0) + 1;
    proxy.lastUsedAt = new Date();

    // Running average latency (simple smoothing)
    if (success) {
      proxy.avgLatencyMs =
        proxy.avgLatencyMs > 0
          ? Math.round(proxy.avgLatencyMs * 0.7 + latencyMs * 0.3)
          : latencyMs;
      proxy.consecutiveFailures = 0;
      proxy.status = 'healthy';
    } else {
      proxy.consecutiveFailures = (proxy.consecutiveFailures || 0) + 1;
      if (proxy.consecutiveFailures >= PROXY_FAILURE_THRESHOLD) {
        proxy.status = 'down';
        // Invalidate cache so a different proxy is selected next time
        await cacheDel(ACTIVE_PROXY_CACHE_KEY);
      } else {
        proxy.status = 'degraded';
      }
      await incrMetric('proxy_failures');
    }

    await proxy.save();
  } catch (_e) {
    // Non-critical — don't let health-tracking break the dispatch
  }
}

// ===========================================================================
// 6. CRUD HELPERS — used by the REST API routes
// ===========================================================================

/**
 * Invalidate the active-proxy cache. Called after any CRUD operation so the
 * next dispatch re-selects from the fresh database state.
 */
export async function invalidateProxyCache() {
  await cacheDel(ACTIVE_PROXY_CACHE_KEY);
}

/**
 * Get the full proxy routing status (for the admin dashboard / health endpoint).
 */
export async function getProxyStatus() {
  await connectDB();
  const maskingEnabled = await isIpMaskingEnabled();
  const strategy = await getDynamicConfig('proxyStrategy', 'weighted');
  const timeoutMs = await getDynamicConfig('proxyTimeoutMs', PROXY_TIMEOUT_MS);
  const stripHeaders = await getDynamicConfig('proxyStripHeaders', 'true');

  const proxies = await ProxyConfig.find({})
    .sort({ enabled: -1, createdAt: 1 })
    .lean();

  const active = proxies.filter((p) => p.enabled && p.status !== 'down').length;
  const down = proxies.filter((p) => p.status === 'down').length;
  const total = proxies.length;

  return {
    ipMaskingEnabled: maskingEnabled,
    strategy,
    timeoutMs: Number(timeoutMs),
    stripHeaders: stripHeaders !== 'false' && stripHeaders !== false,
    stats: {
      total,
      active,
      down,
      degraded: proxies.filter((p) => p.status === 'degraded').length,
    },
    proxies: proxies.map((p) => ({
      id: p._id.toString(),
      label: p.label,
      type: p.type,
      url: p.url,
      region: p.region,
      weight: p.weight,
      enabled: p.enabled,
      status: p.status,
      consecutiveFailures: p.consecutiveFailures,
      avgLatencyMs: p.avgLatencyMs,
      totalRequests: p.totalRequests,
      lastUsedAt: p.lastUsedAt,
    })),
  };
}

// ---------------------------------------------------------------------------
// Default export
// ---------------------------------------------------------------------------
export default {
  isIpMaskingEnabled,
  toggleIpMasking,
  selectProxy,
  stripOriginHeaders,
  proxiedFetch,
  recordProxyResult,
  invalidateProxyCache,
  getProxyStatus,
  ProxyConfig,
};
