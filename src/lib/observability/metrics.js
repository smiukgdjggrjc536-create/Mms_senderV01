// ============================================================================
// V7 P7.1 — Observability: Metrics recorder + aggregator
// ----------------------------------------------------------------------------
// Records API latency samples and send events into Redis sorted sets keyed
// by timestamp (score = epoch ms). This enables true 24h-windowed throughput,
// failure breakdown, and p95 latency calculation without a separate metrics DB.
//
// All functions degrade gracefully when Redis is down (in-memory fallback):
//   - recordLatency → no-op (returns 0)
//   - recordSendEvent → no-op (returns 0)
//   - getThroughput24h → returns { sent: 0, failed: 0 }
//   - getP95Latency24h → returns 0
//
// Non-destructive: brand-new module. Does not modify existing code.
// ============================================================================
import { getRedis, isRedisLive } from '@/lib/redis';

// ---------------------------------------------------------------------------
// Redis key constants
// ---------------------------------------------------------------------------
const LATENCY_ZSET_KEY = 'obs:latency:api';      // score = ts, member = "ts:ms"
const SEND_ZSET_KEY = 'obs:sends';                // score = ts, member = "ts:status:mode"
const WINDOW_MS = 24 * 60 * 60 * 1000;            // 24 hours
const TRIM_BEFORE_MS = 25 * 60 * 60 * 1000;       // trim entries older than 25h

// ---------------------------------------------------------------------------
// recordLatency(routeName, durationMs)
//   Records one API latency sample. Member format: "{ts}:{ms}:{route}"
//   Returns 1 on success, 0 if Redis unavailable.
// ---------------------------------------------------------------------------
export async function recordLatency(routeName, durationMs) {
  const redis = getRedis();
  const ts = Date.now();
  const member = `${ts}:${Math.round(durationMs)}:${routeName || 'unknown'}`;
  try {
    if (isRedisLive()) {
      const added = await redis.zadd(LATENCY_ZSET_KEY, ts, member);
      // Trim old entries occasionally (every ~100 inserts by random check)
      const cutoff = ts - TRIM_BEFORE_MS;
      await redis.zremrangebyscore(LATENCY_ZSET_KEY, '-inf', cutoff);
      return added;
    }
    // In-memory fallback: keep a small ring buffer
    if (!globalThis.__obsLatencyBuf) globalThis.__obsLatencyBuf = [];
    globalThis.__obsLatencyBuf.push({ ts, ms: Math.round(durationMs), route: routeName });
    if (globalThis.__obsLatencyBuf.length > 5000) globalThis.__obsLatencyBuf.shift();
    return 0;
  } catch (err) {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// recordSendEvent(status, failureMode)
//   status: 'sent' | 'failed'
//   failureMode: string (from sendGuard FAILURE_MODES) or '' for success
//   Member format: "{ts}:{status}:{mode}"
// ---------------------------------------------------------------------------
export async function recordSendEvent(status, failureMode = '') {
  const redis = getRedis();
  const ts = Date.now();
  const member = `${ts}:${status}:${failureMode || 'ok'}`;
  try {
    if (isRedisLive()) {
      const added = await redis.zadd(SEND_ZSET_KEY, ts, member);
      const cutoff = ts - TRIM_BEFORE_MS;
      await redis.zremrangebyscore(SEND_ZSET_KEY, '-inf', cutoff);
      return added;
    }
    if (!globalThis.__obsSendBuf) globalThis.__obsSendBuf = [];
    globalThis.__obsSendBuf.push({ ts, status, mode: failureMode || 'ok' });
    if (globalThis.__obsSendBuf.length > 10000) globalThis.__obsSendBuf.shift();
    return 0;
  } catch (err) {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// getThroughput24h()
//   Returns { sent, failed, total, failureBreakdown: {mode: count} }
//   Counts send events in the last 24h window.
// ---------------------------------------------------------------------------
export async function getThroughput24h() {
  const redis = getRedis();
  const now = Date.now();
  const since = now - WINDOW_MS;
  let sent = 0;
  let failed = 0;
  const failureBreakdown = {};

  try {
    let entries = [];
    if (isRedisLive()) {
      const raw = await redis.zrangebyscore(SEND_ZSET_KEY, since, now);
      entries = raw;
    } else if (globalThis.__obsSendBuf) {
      entries = globalThis.__obsSendBuf
        .filter((e) => e.ts >= since)
        .map((e) => `${e.ts}:${e.status}:${e.mode}`);
    }

    for (const member of entries) {
      const parts = String(member).split(':');
      // member = "ts:status:mode" — but mode may contain colons; reconstruct
      const status = parts[1];
      const mode = parts.slice(2).join(':') || 'ok';
      if (status === 'sent') {
        sent++;
      } else if (status === 'failed') {
        failed++;
        failureBreakdown[mode] = (failureBreakdown[mode] || 0) + 1;
      }
    }
  } catch (err) {
    // degrade
  }

  return {
    sent,
    failed,
    total: sent + failed,
    failureRate: sent + failed > 0 ? Math.round((failed / (sent + failed)) * 10000) / 100 : 0,
    failureBreakdown,
  };
}

// ---------------------------------------------------------------------------
// getP95Latency24h()
//   Returns p95 latency in ms across all API routes in the last 24h.
//   Also returns per-route breakdown.
// ---------------------------------------------------------------------------
export async function getP95Latency24h() {
  const redis = getRedis();
  const now = Date.now();
  const since = now - WINDOW_MS;

  const allDurations = [];
  const perRoute = {};

  try {
    let entries = [];
    if (isRedisLive()) {
      entries = await redis.zrangebyscore(LATENCY_ZSET_KEY, since, now);
    } else if (globalThis.__obsLatencyBuf) {
      entries = globalThis.__obsLatencyBuf
        .filter((e) => e.ts >= since)
        .map((e) => `${e.ts}:${e.ms}:${e.route}`);
    }

    for (const member of entries) {
      const parts = String(member).split(':');
      const ms = parseInt(parts[1], 10);
      const route = parts.slice(2).join(':') || 'unknown';
      if (!isNaN(ms)) {
        allDurations.push(ms);
        if (!perRoute[route]) perRoute[route] = [];
        perRoute[route].push(ms);
      }
    }
  } catch (err) {
    // degrade
  }

  const computeP95 = (arr) => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[Math.max(0, idx)];
  };

  const routeBreakdown = {};
  for (const [route, durations] of Object.entries(perRoute)) {
    routeBreakdown[route] = {
      count: durations.length,
      p95: computeP95(durations),
      avg: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
    };
  }

  return {
    p95: computeP95(allDurations),
    sampleCount: allDurations.length,
    perRoute: routeBreakdown,
  };
}

// ---------------------------------------------------------------------------
// resetObservability()  — test helper: clears all recorded metrics.
// ---------------------------------------------------------------------------
export async function resetObservability() {
  const redis = getRedis();
  try {
    if (isRedisLive()) {
      await redis.del(LATENCY_ZSET_KEY, SEND_ZSET_KEY);
    }
  } catch (err) {
    // ignore
  }
  globalThis.__obsLatencyBuf = [];
  globalThis.__obsSendBuf = [];
}

export default {
  recordLatency,
  recordSendEvent,
  getThroughput24h,
  getP95Latency24h,
  resetObservability,
  WINDOW_MS,
  LATENCY_ZSET_KEY,
  SEND_ZSET_KEY,
};
