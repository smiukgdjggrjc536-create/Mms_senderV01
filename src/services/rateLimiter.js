// ============================================================================
// P1.4 — Redis-Backed Rate Limiter Service
// ============================================================================
// Replaces the in-memory `rateWindows` Map in sendingEngine.js with a
// Redis-atomic fixed-window limiter. When Redis is live the state survives
// process restarts and is shared across all workers. When Redis is
// unavailable it falls back to an in-memory sliding window with a LOUD
// warning so operators know the limiter is process-local.
//
// PUBLIC API (signatures PRESERVED for backward compatibility):
//   checkRateLimit(apiId, perMinute, perHour) → Promise<{ allowed, waitMs, reason }>
//   recordRateHit(apiId)                      → Promise<void>
//
// The previous in-memory version was synchronous; the new version is async
// because Redis ops are inherently async. All call sites in core.js have
// been updated to `await`.
//
// NON-DESTRUCTIVE: brand-new file. sendingEngine.js delegates here.
// ============================================================================

import { redisRateLimit } from '../lib/redis/atomic.js';
import { getRedisClient, isRedisLive } from '../lib/redis/client.js';

// ---------------------------------------------------------------------------
// In-memory fallback — mirrors the old sendingEngine.js sliding window.
// Used only when Redis is NOT live so the build gate and dev environments
// work without a Redis server.
// ---------------------------------------------------------------------------
const _memWindows = new Map(); // apiId -> { minute: [ts], hour: [ts] }

function _memCheck(apiId, perMinute, perHour) {
  const now = Date.now();
  const key = String(apiId);
  if (!_memWindows.has(key)) _memWindows.set(key, { minute: [], hour: [] });
  const w = _memWindows.get(key);
  w.minute = w.minute.filter((t) => now - t < 60000);
  w.hour = w.hour.filter((t) => now - t < 3600000);

  if (perMinute > 0 && w.minute.length >= perMinute) {
    const waitMs = Math.max(60000 - (now - w.minute[0]), 1000);
    return { allowed: false, waitMs, reason: 'per_minute' };
  }
  if (perHour > 0 && w.hour.length >= perHour) {
    const waitMs = Math.max(3600000 - (now - w.hour[0]), 1000);
    return { allowed: false, waitMs, reason: 'per_hour' };
  }
  return { allowed: true, waitMs: 0 };
}

function _memRecord(apiId) {
  const key = String(apiId);
  if (!_memWindows.has(key)) _memWindows.set(key, { minute: [], hour: [] });
  const w = _memWindows.get(key);
  const now = Date.now();
  w.minute.push(now);
  w.hour.push(now);
}

// ---------------------------------------------------------------------------
// A single Redis INCR is not enough for a sliding-window rate limiter; the
// atomic.js `redisRateLimit` uses a Lua fixed-window counter which IS
// atomic and correct for "N requests per window" semantics. We map the
// per-minute limit to a 60-second window and the per-hour limit to a
// 3600-second window. Whichever rejects first wins.
//
// Key format (matches script spec): rl:{credentialId}:{windowBucket}
// The window bucket is the floored epoch divided by window seconds so all
// requests within the same minute/hour share the same counter.
// ---------------------------------------------------------------------------

/**
 * Check whether a sender credential is within its rate limits.
 * @param {string|ObjectId} apiId — credential / sender API identifier
 * @param {number} perMinute — max sends per 60s (0 = unlimited)
 * @param {number} perHour   — max sends per 3600s (0 = unlimited)
 * @returns {Promise<{ allowed: boolean, waitMs: number, reason: string|null }>}
 */
export async function checkRateLimit(apiId, perMinute, perHour) {
  const id = String(apiId);

  // If neither limit is set, allow immediately.
  if ((!perMinute || perMinute <= 0) && (!perHour || perHour <= 0)) {
    return { allowed: true, waitMs: 0, reason: null };
  }

  // If Redis is not live, use the in-memory fallback with a loud warning.
  if (!isRedisLive()) {
    if (!_memWindows.has('__warned__')) {
      _memWindows.set('__warned__', true);
      console.warn('[redis] rateLimiter: Redis NOT live — using in-memory fallback. State will NOT survive restart.');
    }
    return _memCheck(id, perMinute || 0, perHour || 0);
  }

  const redis = getRedisClient();
  const now = Math.floor(Date.now() / 1000);

  // Per-minute check (60s fixed window)
  if (perMinute > 0) {
    const minuteBucket = Math.floor(now / 60);
    const minuteKey = `rl:${id}:${minuteBucket}`;
    try {
      const result = await redisRateLimit(minuteKey, perMinute, 60);
      if (!result.allowed) {
        const waitMs = Math.max(result.retryAfterSec * 1000, 1000);
        return { allowed: false, waitMs, reason: 'per_minute' };
      }
    } catch (err) {
      console.warn('[redis] rateLimiter minute check failed, falling back to memory:', err.message);
      return _memCheck(id, perMinute || 0, perHour || 0);
    }
  }

  // Per-hour check (3600s fixed window)
  if (perHour > 0) {
    const hourBucket = Math.floor(now / 3600);
    const hourKey = `rl:${id}:${hourBucket}`;
    try {
      const result = await redisRateLimit(hourKey, perHour, 3600);
      if (!result.allowed) {
        const waitMs = Math.max(result.retryAfterSec * 1000, 1000);
        return { allowed: false, waitMs, reason: 'per_hour' };
      }
    } catch (err) {
      console.warn('[redis] rateLimiter hour check failed, falling back to memory:', err.message);
      return _memCheck(id, perMinute || 0, perHour || 0);
    }
  }

  return { allowed: true, waitMs: 0, reason: null };
}

/**
 * Record a rate-limit hit for a sender credential.
 * With the Redis fixed-window approach, `redisRateLimit` already
 * increments the counter atomically during `checkRateLimit`, so
 * `recordRateHit` is only needed for the in-memory fallback path.
 * However, we KEEP this function for backward compatibility — it is a
 * no-op when Redis is live (the counter was already incremented by the
// Lua script in `checkRateLimit`) and records into the in-memory map
 * when Redis is down.
 * @param {string|ObjectId} apiId
 * @returns {Promise<void>}
 */
export async function recordRateHit(apiId) {
  if (!isRedisLive()) {
    _memRecord(apiId);
  }
  // Redis path: the fixed-window counter was already INCR'd atomically
  // inside `checkRateLimit` via the Lua script. No additional write needed.
}

// ---------------------------------------------------------------------------
// Reset state (used by tests and admin tools)
// ---------------------------------------------------------------------------
export function _resetRateLimiter() {
  _memWindows.clear();
}

export default {
  checkRateLimit,
  recordRateHit,
  _resetRateLimiter,
};
