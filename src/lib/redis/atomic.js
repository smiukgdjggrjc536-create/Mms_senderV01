// ============================================================================
// atomic.js — Redis-Atomic Core (V7 P1.3)
// ----------------------------------------------------------------------------
// SPEC:
//   - withLock(key, ttlMs, fn): SET key value NX PX ttl + release-by-owner
//     Lua script (safe compare-and-delete). Runs fn while holding the lock.
//   - incrWithCeiling(key, ceiling): atomic increment that returns false at
//     ceiling (used by quota systems). Returns { allowed, value }.
//   - redisRateLimit(key, limit, windowSec): fixed-window Lua counter.
//     Returns { allowed, count, retryAfterSec }.
//   - redisTokenBucket(key, capacity, refillPerSec): Lua atomic bucket.
//     Returns { allowed, tokensRemaining }.
//   - Every function has a fallback: no Redis -> in-memory + loud warn.
//
// Builds on the shared client in client.js. Never creates ad-hoc connections.
// ============================================================================

import { getRedisClient, isRedisLive } from './client.js';

let _fallbackWarned = false;
function warnFallback() {
  if (!_fallbackWarned) {
    console.warn('[redis:atomic] WARNING: operating in in-memory fallback mode — atomicity is process-local only.');
    _fallbackWarned = true;
  }
}

// ---------------------------------------------------------------------------
// Lua scripts (only executed when isRedisLive())
// ---------------------------------------------------------------------------

// Release a lock only if the stored value matches the owner token.
const RELEASE_LOCK_LUA = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end
`;

// incrWithCeiling: increment KEYS[1] but never exceed ARGV[1] (ceiling).
// Returns the new value if allowed, or -1 if at/above ceiling.
const INCR_CEILING_LUA = `
local current = tonumber(redis.call('get', KEYS[1]) or '0')
local ceiling = tonumber(ARGV[1])
if current >= ceiling then
  return -1
end
local nv = redis.call('incr', KEYS[1])
if nv > ceiling then
  -- raced past ceiling; decrement back and deny
  redis.call('decr', KEYS[1])
  return -1
end
return nv
`;

// Fixed-window rate limit: INCR KEYS[1]; if 1, EXPIRE ARGV[1]; deny if > ARGV[2].
const RATE_LIMIT_LUA = `
local count = redis.call('incr', KEYS[1])
if count == 1 then
  redis.call('expire', KEYS[1], tonumber(ARGV[1]))
end
local limit = tonumber(ARGV[2])
if count > limit then
  local ttl = redis.call('ttl', KEYS[1])
  return {0, count, ttl}
end
return {1, count, 0}
`;

// Token bucket: KEYS[1]=tokens, KEYS[2]=last refill ts.
// ARGV: capacity, refillPerSec (as millis), now ms, requested tokens, bucketTtlSec
const TOKEN_BUCKET_LUA = `
local capacity = tonumber(ARGV[1])
local refillPerMs = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])
local ttl = tonumber(ARGV[5])

local tokens = tonumber(redis.call('get', KEYS[1]) or capacity)
local last = tonumber(redis.call('get', KEYS[2]) or now)

if last > now then last = now end
local delta = math.max(0, now - last)
tokens = math.min(capacity, tokens + (delta * refillPerMs))

local allowed = 0
if tokens >= requested then
  tokens = tokens - requested
  allowed = 1
end

redis.call('set', KEYS[1], tokens, 'EX', ttl)
redis.call('set', KEYS[2], now, 'EX', ttl)
return {allowed, math.floor(tokens)}
`;

// ---------------------------------------------------------------------------
// In-memory fallback state
// ---------------------------------------------------------------------------
const _locks = new Map();        // key -> { token, expiresAt }
const _ceilings = new Map();     // key -> number
const _rateWindows = new Map();  // key -> { count, expiresAt }
const _buckets = new Map();      // key -> { tokens, last }

// ---------------------------------------------------------------------------
// withLock
// ---------------------------------------------------------------------------

/**
 * Acquire a distributed lock, run fn(), then release (owner-safe).
 * @param {string} key   lock name (without prefix)
 * @param {number} ttlMs lock TTL in ms
 * @param {function} fn  async function to run while holding the lock
 * @returns {Promise<{ acquired: boolean, result: any, error?: string }>}
 */
export async function withLock(key, ttlMs, fn) {
  const lockKey = `lock:${key}`;
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  const redis = getRedisClient();

  let acquired = false;

  if (isRedisLive()) {
    try {
      const res = await redis.set(lockKey, token, 'NX', 'PX', ttlMs);
      acquired = res === 'OK';
    } catch (err) {
      warnFallback();
      acquired = false;
    }
  } else {
    warnFallback();
    const now = Date.now();
    const existing = _locks.get(lockKey);
    if (!existing || existing.expiresAt <= now) {
      _locks.set(lockKey, { token, expiresAt: now + ttlMs });
      acquired = true;
    }
  }

  if (!acquired) {
    return { acquired: false, result: null, error: 'LOCK_BUSY' };
  }

  let result = null;
  let fnError = null;
  try {
    result = await fn();
  } catch (err) {
    fnError = err.message;
  } finally {
    // Release (owner-safe)
    if (isRedisLive()) {
      try {
        await redis.eval(RELEASE_LOCK_LUA, 1, lockKey, token);
      } catch (_) { /* TTL will reclaim */ }
    } else {
      const cur = _locks.get(lockKey);
      if (cur && cur.token === token) _locks.delete(lockKey);
    }
  }

  return { acquired: true, result, error: fnError };
}

// ---------------------------------------------------------------------------
// incrWithCeiling
// ---------------------------------------------------------------------------

/**
 * Atomically increment a counter, denying if at/above ceiling.
 * @returns {Promise<{ allowed: boolean, value: number }>}
 */
export async function incrWithCeiling(key, ceiling) {
  const counterKey = `ceiling:${key}`;
  const redis = getRedisClient();

  if (isRedisLive()) {
    try {
      const res = await redis.eval(INCR_CEILING_LUA, 1, counterKey, String(ceiling));
      if (res === -1) return { allowed: false, value: ceiling };
      return { allowed: true, value: Number(res) };
    } catch (err) {
      warnFallback();
    }
  }

  warnFallback();
  const cur = _ceilings.get(counterKey) || 0;
  if (cur >= ceiling) return { allowed: false, value: ceiling };
  const nv = cur + 1;
  _ceilings.set(counterKey, nv);
  return { allowed: true, value: nv };
}

// ---------------------------------------------------------------------------
// redisRateLimit (fixed window)
// ---------------------------------------------------------------------------

/**
 * Fixed-window rate limit.
 * @returns {Promise<{ allowed: boolean, count: number, retryAfterSec: number }>}
 */
export async function redisRateLimit(key, limit, windowSec) {
  const rlKey = `rl:${key}`;
  const redis = getRedisClient();

  if (isRedisLive()) {
    try {
      const res = await redis.eval(RATE_LIMIT_LUA, 1, rlKey, String(windowSec), String(limit));
      // res = [allowed, count, ttl]
      return { allowed: Number(res[0]) === 1, count: Number(res[1]), retryAfterSec: Number(res[2]) };
    } catch (err) {
      warnFallback();
    }
  }

  warnFallback();
  const now = Date.now();
  let entry = _rateWindows.get(rlKey);
  if (!entry || entry.expiresAt <= now) {
    entry = { count: 0, expiresAt: now + windowSec * 1000 };
    _rateWindows.set(rlKey, entry);
  }
  entry.count += 1;
  if (entry.count > limit) {
    const retry = Math.ceil((entry.expiresAt - now) / 1000);
    return { allowed: false, count: entry.count, retryAfterSec: Math.max(retry, 1) };
  }
  return { allowed: true, count: entry.count, retryAfterSec: 0 };
}

// ---------------------------------------------------------------------------
// redisTokenBucket
// ---------------------------------------------------------------------------

/**
 * Atomic token bucket.
 * @param {string} key
 * @param {number} capacity       max tokens (burst)
 * @param {number} refillPerSec   tokens added per second
 * @param {number} [requested=1]  tokens requested for this call
 * @returns {Promise<{ allowed: boolean, tokensRemaining: number }>}
 */
export async function redisTokenBucket(key, capacity, refillPerSec, requested = 1) {
  const tokensKey = `tb:${key}:tokens`;
  const lastKey = `tb:${key}:last`;
  const bucketTtlSec = Math.max(60, Math.ceil(capacity / Math.max(refillPerSec, 0.0001)) * 2);
  const redis = getRedisClient();

  if (isRedisLive()) {
    try {
      const now = Date.now();
      const refillPerMs = refillPerSec / 1000;
      const res = await redis.eval(
        TOKEN_BUCKET_LUA,
        2,
        tokensKey,
        lastKey,
        String(capacity),
        String(refillPerMs),
        String(now),
        String(requested),
        String(bucketTtlSec)
      );
      return { allowed: Number(res[0]) === 1, tokensRemaining: Number(res[1]) };
    } catch (err) {
      warnFallback();
    }
  }

  warnFallback();
  const now = Date.now();
  let bucket = _buckets.get(tokensKey);
  if (!bucket) bucket = { tokens: capacity, last: now };
  const refillPerMs = refillPerSec / 1000;
  const delta = Math.max(0, now - bucket.last);
  bucket.tokens = Math.min(capacity, bucket.tokens + delta * refillPerMs);
  bucket.last = now;
  let allowed = false;
  if (bucket.tokens >= requested) {
    bucket.tokens -= requested;
    allowed = true;
  }
  _buckets.set(tokensKey, bucket);
  return { allowed, tokensRemaining: Math.floor(bucket.tokens) };
}

// ---------------------------------------------------------------------------
// Reset helpers (mainly for tests)
// ---------------------------------------------------------------------------
export async function _resetAtomicState() {
  _locks.clear();
  _ceilings.clear();
  _rateWindows.clear();
  _buckets.clear();
}

export default {
  withLock,
  incrWithCeiling,
  redisRateLimit,
  redisTokenBucket,
  _resetAtomicState,
};
