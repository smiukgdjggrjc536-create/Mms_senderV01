// ============================================================================
// MODULE 6: proxyFetch.js — Proxy-aware fetch wrapper for outbound dispatch
// ============================================================================
// [DESIGN_PATTERN: Forward Proxy & Serverless Edge Routing]
//
// Per [CRITICAL RED ALERT: NO UI / NO ADMIN PANEL ON RENDER] + Module 6:
//   "No email/request fires directly from Node.js server to telecom — ALL
//    dispatch must route through Cloudflare Workers or Rotating Proxy Pool."
//
// This helper is the SINGLE integration point between the sender modules
// (outlookSender, gmailSender) and the proxyRouter service. It:
//   1. Checks if IP masking is enabled (Redis toggle, live on/off, no restart).
//   2. If enabled + a healthy proxy is available → route through proxiedFetch.
//   3. If disabled or no proxy available → fall back to direct fetch (so the
//      gateway never hard-fails just because no proxy is configured yet).
//
// The proxyRouter strips ALL origin-revealing headers (X-Forwarded-For, Via,
// X-Real-IP, etc.) before the request leaves the edge, so the telecom can
// NEVER trace the real Render/VPS server IP.
//
// NON-DESTRUCTIVE: brand-new helper. Existing sender logic (headers, body,
// error classification) is unchanged — only the transport layer is swapped.
// ============================================================================

// Dynamically import the proxyRouter to avoid circular-dependency issues at
// build time (proxyRouter imports from @/lib/core which imports many models).
// We cache the module so repeated calls don't re-import.
// NOTE: relative path because @/services/* alias maps to ROOT ./services/,
// but proxyRouter.js lives in ./src/services/. From ./services/senders/ →
// ../../src/services/proxyRouter.js.
let _proxyRouterPromise = null;
function getProxyRouter() {
  if (!_proxyRouterPromise) {
    _proxyRouterPromise = import('@/services/proxyRouter.js');
  }
  return _proxyRouterPromise;
}

// ---------------------------------------------------------------------------
// routedFetch(url, options) — the single outbound transport function.
// ---------------------------------------------------------------------------
// Drops in wherever `fetch(url, options)` was used for an outbound dispatch
// or token-refresh request. Returns a standard Response object (same shape as
// the global fetch), so callers need ZERO changes beyond swapping the call.
// ---------------------------------------------------------------------------
export async function routedFetch(url, options = {}) {
  let maskingEnabled = false;
  try {
    const { isIpMaskingEnabled } = await getProxyRouter();
    maskingEnabled = await isIpMaskingEnabled();
  } catch (_e) {
    // If Redis/proxyRouter isn't available, fall back to direct fetch.
    maskingEnabled = false;
  }

  if (!maskingEnabled) {
    // IP masking OFF → direct fetch (fast path, no proxy overhead).
    return fetch(url, options);
  }

  // IP masking ON → route through the proxy edge.
  try {
    const { proxiedFetch, selectProxy } = await getProxyRouter();
    const proxy = await selectProxy();
    if (!proxy) {
      // No healthy proxy configured yet → fall back to direct fetch so the
      // send still goes through (admin can add proxies later without restart).
      console.warn('[proxyFetch] IP masking ON but no healthy proxy available — using direct fetch.');
      return fetch(url, options);
    }
    return proxiedFetch(url, options);
  } catch (err) {
    // If the proxy layer throws (timeout, bad worker URL, etc.), fall back to
    // direct fetch rather than dropping the send entirely.
    console.warn('[proxyFetch] Proxy routing failed, falling back to direct fetch:', err.message);
    return fetch(url, options);
  }
}

export default routedFetch;
