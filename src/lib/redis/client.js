// ============================================================================
// client.js — Shared ioredis client (V7 P1.3)
// ----------------------------------------------------------------------------
// SPEC:
//   - Single shared ioredis client with retryStrategy and lazyConnect.
//   - All atomic/pool modules import THIS client (no ad-hoc connections).
//
// This module is the V7 canonical Redis entry point. The legacy src/lib/redis.js
// (with its MemoryShim + getRedis/acquireMutex/cache helpers) is PRESERVED (L6)
// and continues to serve the existing services. The new atomic primitives in
// atomic.js + pools.js build on top of THIS shared connection so they get true
// Lua-script atomicity when Redis is live, with an in-memory fallback otherwise.
//
// GRACEFUL DEGRADATION: if no REDIS_URL / connection fails, we expose a
// minimal in-memory surface (get/del/incr/eval fallback) so atomic.js + pools.js
// can still operate process-locally with a loud warn. Production always prefers
// a real Redis (set REDIS_URL).
// ============================================================================

import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || process.env.REDISCLOUD_URL || '';
const REDIS_KEY_PREFIX = process.env.REDIS_KEY_PREFIX || 'mms_gw:';

let _client = null;
let _isRedis = false;
let _fallbackWarned = false;

// ---------------------------------------------------------------------------
// In-memory fallback surface — exposes the subset atomic.js + pools.js need.
// Methods are async to keep call-sites identical to ioredis.
// ---------------------------------------------------------------------------
class MemoryFallback {
  constructor() {
    this._store = new Map();  // key -> { value, expiresAt }
    this._zsets = new Map();  // key -> Map(member -> { score, addedAt })
    this._locks = new Map();  // key -> { token, expiresAt }
  }

  _full(key) { return REDIS_KEY_PREFIX + key; }
  _raw(key) { return key.startsWith(REDIS_KEY_PREFIX) ? key : REDIS_KEY_PREFIX + key; }

  _isExpired(entry) { return entry && entry.expiresAt && Date.now() >= entry.expiresAt; }

  _cleanKey(fullKey) {
    const entry = this._store.get(fullKey);
    if (this._isExpired(entry)) { this._store.delete(fullKey); return null; }
    return entry;
  }

  async get(key) { const e = this._cleanKey(this._raw(key)); return e ? e.value : null; }
  async set(key, value, mode, ttl) {
    const full = this._raw(key);
    let expiresAt = null;
    if (mode === 'EX' && ttl) expiresAt = Date.now() + ttl * 1000;
    if (mode === 'PX' && ttl) expiresAt = Date.now() + ttl;
    this._store.set(full, { value: String(value), expiresAt });
    return 'OK';
  }
  async setnx(key, value) {
    const full = this._raw(key);
    if (this._store.has(full) && !this._isExpired(this._store.get(full))) return 0;
    this._store.set(full, { value: String(value), expiresAt: null });
    return 1;
  }
  async del(...keys) {
    let n = 0;
    for (const k of keys) { const full = this._raw(k); if (this._store.delete(full)) n++; }
    return n;
  }
  async incr(key) {
    const full = this._raw(key);
    const e = this._cleanKey(full) || { value: '0', expiresAt: null };
    const v = parseInt(e.value, 10) + 1;
    this._store.set(full, { value: String(v), expiresAt: e.expiresAt });
    return v;
  }
  async incrby(key, by) {
    const full = this._raw(key);
    const e = this._cleanKey(full) || { value: '0', expiresAt: null };
    const v = parseInt(e.value, 10) + by;
    this._store.set(full, { value: String(v), expiresAt: e.expiresAt });
    return v;
  }
  async expire(key, sec) {
    const full = this._raw(key);
    const e = this._store.get(full);
    if (!e || this._isExpired(e)) return 0;
    e.expiresAt = Date.now() + sec * 1000;
    return 1;
  }
  async pexpire(key, ms) {
    const full = this._raw(key);
    const e = this._store.get(full);
    if (!e || this._isExpired(e)) return 0;
    e.expiresAt = Date.now() + ms;
    return 1;
  }
  async ttl(key) {
    const e = this._cleanKey(key);
    if (!e || !e.expiresAt) return -1;
    return Math.ceil((e.expiresAt - Date.now()) / 1000);
  }
  async pttl(key) {
    const e = this._cleanKey(key);
    if (!e || !e.expiresAt) return -1;
    return Math.max(0, e.expiresAt - Date.now());
  }
  async eval() {
    // atomic.js passes (script, numkeys, key, ...args). We route by key intent.
    // The fallback implements the same semantics inline in atomic.js via flags,
    // so eval() here is a no-op marker. atomic.js checks isRedisLive() first.
    return null;
  }
  // --- sorted set ops (pools.js) ---
  async zadd(key, score, member) {
    const full = this._raw(key);
    if (!this._zsets.has(full)) this._zsets.set(full, new Map());
    const set = this._zsets.get(full);
    set.set(String(member), { score: Number(score), addedAt: Date.now() });
    return 1;
  }
  async zpopmin(key, count = 1) {
    const full = this._raw(key);
    const set = this._zsets.get(full);
    if (!set || set.size === 0) return [];
    const sorted = [...set.entries()].sort((a, b) => a[1].score - b[1].score);
    const out = [];
    for (let i = 0; i < count && sorted.length; i++) {
      const [member, meta] = sorted.shift();
      set.delete(member);
      out.push(member, String(meta.score));
    }
    return out;
  }
  async zcard(key) {
    const full = this._raw(key);
    const set = this._zsets.get(full);
    return set ? set.size : 0;
  }
  async zrem(key, member) {
    const full = this._raw(key);
    const set = this._zsets.get(full);
    if (!set) return 0;
    return set.delete(String(member)) ? 1 : 0;
  }
  async zrange(key, start, stop) {
    const full = this._raw(key);
    const set = this._zsets.get(full);
    if (!set) return [];
    const sorted = [...set.entries()].sort((a, b) => a[1].score - b[1].score);
    const arr = sorted.map((e) => e[0]);
    if (stop < 0) stop = arr.length + stop;
    return arr.slice(start, stop + 1);
  }
  async zscore(key, member) {
    const full = this._raw(key);
    const set = this._zsets.get(full);
    if (!set) return null;
    const m = set.get(String(member));
    return m ? String(m.score) : null;
  }
  async ping() { return 'PONG'; }
  disconnect() { this._store.clear(); this._zsets.clear(); this._locks.clear(); }
}

function warnFallback() {
  if (!_fallbackWarned) {
    console.warn('[redis:client] WARNING: REDIS_URL not set or unreachable — using in-memory fallback. Atomic ops + pools are process-local only. Set REDIS_URL in production.');
    _fallbackWarned = true;
  }
}

/**
 * Get the shared ioredis client (or in-memory fallback). Lazily created.
 */
export function getRedisClient() {
  if (_client) return _client;

  if (REDIS_URL) {
    try {
      const client = new IORedis(REDIS_URL, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        retryStrategy: (times) => Math.min(times * 200, 2000),
        lazyConnect: true,
        keepAlive: 30000,
        connectTimeout: 5000,
        // Preserve command queue resilience.
        enableOfflineQueue: true,
      });

      client.on('error', (err) => {
        console.error('[redis:client] connection error:', err.message);
      });
      client.on('connect', () => {
        console.log('[redis:client] connected to Redis server');
      });

      _client = client;
      _isRedis = true;
      return _client;
    } catch (err) {
      console.warn('[redis:client] failed to construct ioredis, using fallback:', err.message);
    }
  }

  warnFallback();
  _client = new MemoryFallback();
  _isRedis = false;
  return _client;
}

/**
 * True if the active client is a real ioredis instance (Lua scripts work).
 */
export function isRedisLive() {
  return _isRedis;
}

/**
 * Ensure the lazy connection is opened (call once at app boot if desired).
 */
export async function connectRedis() {
  const client = getRedisClient();
  if (_isRedis && client.status === 'wait' || client.status === 'ready') {
    try { await client.connect(); } catch (_) { /* may already be connecting */ }
  }
  try {
    await client.ping();
  } catch (err) {
    console.warn('[redis:client] ping failed:', err.message);
  }
  return client;
}

export const KEY_PREFIX = REDIS_KEY_PREFIX;

export default {
  getRedisClient,
  isRedisLive,
  connectRedis,
  KEY_PREFIX,
};
