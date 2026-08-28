// ============================================================================
// KEEP-ALIVE SELF-PING MODULE — src/lib/keepAlive.js
// ============================================================================
// Prevents the Render free-tier web service from spinning down due to
// inactivity. Render's free plan sleeps the instance after ~15 minutes with
// zero traffic, causing a ~50 second cold-start delay on the next request.
//
// This module starts a server-side setInterval that pings the service's own
// public /api/ping endpoint every KEEPALIVE_INTERVAL_MS (default 5 minutes).
// While the app is awake the interval fires and keeps the instance warm. This
// is a best-effort self-ping — the interval naturally stops when the instance
// sleeps, but combined with an external cron (cron-job.org / UptimeRobot) it
// guarantees the instance is woken and kept alive.
//
// ACTIVATION:
//   Only runs when NEXT_PUBLIC_PANEL_MODE === 'api' (i.e. on Render).
//   Started by src/instrumentation.ts on server boot (Edge runtime excluded).
//
// EXTERNAL MONITOR (recommended belt-and-suspenders):
//   Set up a free external cron (cron-job.org) to GET:
//     https://mms-gateway-engine.onrender.com/api/ping
//   every 5-14 minutes. This wakes the instance even after a full sleep.
// ============================================================================

let keepAliveTimer = null;
let pingCount = 0;
let lastPingAt = null;
let lastPingOk = null;

// Default 5 minutes — well under Render's ~15 min inactivity threshold.
const DEFAULT_INTERVAL = 5 * 60 * 1000;

// The public URL of this service. Can be overridden via KEEPALIVE_URL
// or the platform-specific external URL env var. Falls back to the known
// domains (Render legacy / Netlify admin panel).
const SELF_URL =
  process.env.KEEPALIVE_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  (process.env.RENDER_SERVICE_ID ? `https://${process.env.RENDER_SERVICE_ID}.onrender.com` : '') ||
  process.env.URL || // Netlify sets this to the site's production URL at runtime
  process.env.DEPLOY_PRIME_URL ||
  'https://emailengineadminaccesspanel.netlify.app';

const PING_PATH = process.env.KEEPALIVE_PATH || '/api/ping';

/**
 * Perform a single self-ping to keep the instance awake.
 */
async function pingOnce() {
  const url = `${SELF_URL}${PING_PATH}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'MMS-KeepAlive/1.0 (self-ping)', Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeoutId);
    pingCount += 1;
    lastPingAt = new Date().toISOString();
    lastPingOk = res.ok;
    if (!res.ok) {
      console.warn(`[keepAlive] ping returned HTTP ${res.status} from ${url}`);
    }
  } catch (err) {
    lastPingAt = new Date().toISOString();
    lastPingOk = false;
    // Non-fatal — network blips happen. The interval will retry next cycle.
    console.warn(`[keepAlive] self-ping failed (${err.name || 'error'}): ${err.message || err}`);
  }
}

/**
 * Start the keep-alive self-ping loop. Safe to call multiple times —
 * re-calling will not duplicate timers.
 *
 * @param {number} intervalMs — override ping interval (ms). Defaults to env
 *   KEEPALIVE_INTERVAL_MS or 5 minutes.
 */
export function startKeepAlive(intervalMs) {
  // Run on admin mode (Netlify — now also hosts the gateway engine) and on
  // api mode (legacy Render). Never on user mode (Vercel).
  const mode = process.env.NEXT_PUBLIC_PANEL_MODE;
  if (mode !== 'api' && mode !== 'admin') {
    return false;
  }

  if (keepAliveTimer) {
    return true; // already running
  }

  const interval = intervalMs || parseInt(process.env.KEEPALIVE_INTERVAL_MS || '', 10) || DEFAULT_INTERVAL;

  // Initial ping shortly after boot (give the server a moment to be ready).
  setTimeout(pingOnce, 30000);

  keepAliveTimer = setInterval(pingOnce, interval);

  // Don't keep the Node.js process alive solely for this timer — let Render
  // manage the process lifecycle.
  if (keepAliveTimer && typeof keepAliveTimer.unref === 'function') {
    keepAliveTimer.unref();
  }

  console.log(`[keepAlive] started — pinging ${SELF_URL}${PING_PATH} every ${Math.round(interval / 1000)}s`);
  return true;
}

/**
 * Stop the keep-alive loop (for tests / graceful shutdown).
 */
export function stopKeepAlive() {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
    console.log('[keepAlive] stopped');
  }
}

/**
 * Get current keep-alive status — useful for diagnostics / admin display.
 */
export function getKeepAliveStatus() {
  return {
    active: !!keepAliveTimer,
    mode: process.env.NEXT_PUBLIC_PANEL_MODE,
    targetUrl: `${SELF_URL}${PING_PATH}`,
    intervalMs: parseInt(process.env.KEEPALIVE_INTERVAL_MS || '', 10) || DEFAULT_INTERVAL,
    pingCount,
    lastPingAt,
    lastPingOk,
  };
}
