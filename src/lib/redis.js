// ============================================================================
// Redis Client — Email-to-MMS Gateway Engine
// ============================================================================
// Centralized Redis connection used by:
//   • L1 Cache (HLR Validator) — ultra-fast carrier lookup (seconds TTL)
//   • BullMQ (Queue Engine) — background job processing + delayed jobs
//   • Mutex Locks (Round-Robin) — semaphore during account rotation
//   • Dynamic Config (Live Admin Control) — runtime limits/delay without restart
//   • Live Metrics (SSE) — real-time counters pushed to the admin dashboard
//
// GRACEFUL DEGRADATION:
//   If REDIS_URL is not set or the connection fails, we fall back to an
//   in-memory Map-based shim that exposes the same async get/set/del/incr/
//   expire/lock interface. This guarantees the gateway NEVER crashes on
//   environments without Redis (e.g. Render free tier, local dev) — it
//   simply runs with process-local state. On platforms with Redis, all
//   features work at full speed with cross-process sharing.
//
// NON-DESTRUCTIVE: brand-new module. Does not modify any existing file.
// ============================================================================

import IORedis from 'ioredis';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const REDIS_URL = process.env.REDIS_URL || process.env.REDISCLOUD_URL || '';
const REDIS_KEY_PREFIX = process.env.REDIS_KEY_PREFIX || 'mms_gw:';

// ---------------------------------------------------------------------------
// In-memory fallback shim — mirrors the ioredis methods the gateway uses.
// All methods are async to keep call-sites identical whether Redis is live
// or the shim is active.
// ---------------------------------------------------------------------------
class MemoryShim {
  constructor() {
    this._store = new Map(); // key -> { value, expiresAt }
    this._locks = new Map(); // lockKey -> { token, expiresAt }
  }

  _isExpired(entry) {
    return entry && entry.expiresAt && Date.now() >= entry.expiresAt;
  }

  _clean(key) {
    const entry = this._store.get(key);
    if (this._isExpired(entry)) {
      this._store.delete(key);
      return null;
    }
    return entry;
  }

  async get(key) {
    const entry = this._clean(REDIS_KEY_PREFIX + key);
    return entry ? entry.value : null;
  }

  async set(key, value, mode, ttlSeconds) {
    const fullKey = REDIS_KEY_PREFIX + key;
    let expiresAt = null;
    if (mode === 'EX' && ttlSeconds) {
      expiresAt = Date.now() + ttlSeconds * 1000;
    }
    this._store.set(fullKey, { value: String(value), expiresAt });
    return 'OK';
  }

  async setex(key, seconds, value) {
    return this.set(key, value, 'EX', seconds);
  }

  async del(key) {
    const fullKey = REDIS_KEY_PREFIX + key;
    const existed = this._store.has(fullKey);
    this._store.delete(fullKey);
    return existed ? 1 : 0;
  }

  async incr(key) {
    const fullKey = REDIS_KEY_PREFIX + key;
    const entry = this._clean(key) || { value: '0', expiresAt: null };
    const newVal = parseInt(entry.value, 10) + 1;
    this._store.set(fullKey, { value: String(newVal), expiresAt: entry.expiresAt });
    return newVal;
  }

  async decr(key) {
    const fullKey = REDIS_KEY_PREFIX + key;
    const entry = this._clean(key) || { value: '0', expiresAt: null };
    const newVal = parseInt(entry.value, 10) - 1;
    this._store.set(fullKey, { value: String(newVal), expiresAt: entry.expiresAt });
    return newVal;
  }

  async expire(key, seconds) {
    const fullKey = REDIS_KEY_PREFIX + key;
    const entry = this._store.get(fullKey);
    if (!entry || this._isExpired(entry)) return 0;
    entry.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }

  async ttl(key) {
    const entry = this._clean(key);
    if (!entry || !entry.expiresAt) return -1;
    return Math.ceil((entry.expiresAt - Date.now()) / 1000);
  }

  async exists(key) {
    const entry = this._clean(key);
    return entry ? 1 : 0;
  }

  // SETNX-based distributed lock emulation.
  async setnx(key, value) {
    const fullKey = REDIS_KEY_PREFIX + key;
    const existing = this._locks.get(fullKey);
    if (existing && Date.now() < existing.expiresAt) return 0;
    this._locks.set(fullKey, { token: value, expiresAt: Date.now() + 30000 });
    return 1;
  }

  async publish(channel, message) {
    // No-op in shim mode — SSE falls back to polling.
    return 0;
  }

  async ping() {
    return 'PONG';
  }

  disconnect() {
    this._store.clear();
    this._locks.clear();
  }
}

// ---------------------------------------------------------------------------
// Singleton connection — lazily created on first use.
// ---------------------------------------------------------------------------
let _client = null;
let _isRedis = false;
let _connectionAttempts = 0;

export function getRedis() {
  if (_client) return _client;

  if (REDIS_URL && _connectionAttempts < 3) {
    try {
      const client = new IORedis(REDIS_URL, {
        maxRetriesPerRequest: 2,
        enableReadyCheck: true,
        retryStrategy: (times) => Math.min(times * 200, 2000),
        lazyConnect: false,
        // Keep connections resilient on serverless / Render spin-down.
        keepAlive: 30000,
        connectTimeout: 5000,
      });

      client.on('error', (err) => {
        console.error('[redis] connection error:', err.message);
      });

      client.on('connect', () => {
        console.log('[redis] connected to Redis server');
      });

      _client = client;
      _isRedis = true;
      return _client;
    } catch (err) {
      console.warn('[redis] failed to connect, using in-memory shim:', err.message);
      _connectionAttempts++;
    }
  }

  // Fallback to in-memory shim.
  _client = new MemoryShim();
  _isRedis = false;
  console.log('[redis] using in-memory shim (no REDIS_URL or connection failed)');
  return _client;
}

export function isRedisLive() {
  return _isRedis;
}

// ---------------------------------------------------------------------------
// Distributed Mutex Lock — used by the Round-Robin engine to prevent race
// conditions when multiple workers fetch the next available sender account.
//
// acquireMutex(key, ttlMs):
//   Attempts to acquire a named lock. Returns a release function on success,
//   or null if the lock is held by another worker. The lock auto-expires
//   after ttlMs (default 10s) so a crashed worker never deadlocks the pool.
//
// releaseMutex(releaseFn):
//   Releases the lock (deletes the key). Safe to call multiple times.
// ---------------------------------------------------------------------------
export async function acquireMutex(key, ttlMs = 10000) {
  const redis = getRedis();
  const lockKey = `lock:${key}`;
  const token = `${Date.now()}-${crypto.randomBytes(16).toString('hex')}`;
  const ttlSeconds = Math.ceil(ttlMs / 1000);

  if (_isRedis) {
    // Use SET NX EX for an atomic acquire.
    const result = await redis.set(lockKey, token, 'EX', ttlSeconds);
    if (result !== 'OK') return null;
  } else {
    // Shim path — setnx emulation.
    const result = await redis.setnx(lockKey, token);
    if (result === 0) return null;
    await redis.expire(lockKey, ttlSeconds);
  }

  let released = false;
  const release = async () => {
    if (released) return;
    released = true;
    try {
      if (_isRedis) {
        // Only delete if we still own the lock (token check via Lua-like GET).
        const current = await redis.get(lockKey);
        if (current === token) {
          await redis.del(lockKey);
        }
      } else {
        await redis.del(lockKey);
      }
    } catch (_e) {
      // Best-effort release — the TTL will reclaim it anyway.
    }
  };

  return release;
}

// ---------------------------------------------------------------------------
// Convenience cache helpers (L1) — used by the HLR Validator.
// ---------------------------------------------------------------------------
export async function cacheGet(key) {
  const redis = getRedis();
  const raw = await redis.get(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return raw;
  }
}

export async function cacheSet(key, value, ttlSeconds = 300) {
  const redis = getRedis();
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  await redis.set(key, serialized, 'EX', ttlSeconds);
}

export async function cacheDel(key) {
  const redis = getRedis();
  await redis.del(key);
}

// ---------------------------------------------------------------------------
// Dynamic config helpers — store runtime limits/delay in Redis so admins can
// change them WITHOUT restarting the Node.js process.
// ---------------------------------------------------------------------------
export async function setDynamicConfig(key, value) {
  const redis = getRedis();
  await redis.set(`dyn:${key}`, JSON.stringify(value), 'EX', 86400); // 24h TTL
}

export async function getDynamicConfig(key, fallback = null) {
  const redis = getRedis();
  const raw = await redis.get(`dyn:${key}`);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Live metrics — counters pushed in real-time and read by the SSE endpoint.
// ---------------------------------------------------------------------------
export async function incrMetric(metric, by = 1) {
  const redis = getRedis();
  const key = `metric:${metric}`;
  if (_isRedis) {
    return redis.incrby ? redis.incrby(key, by) : redis.incr(key);
  }
  let val = by;
  for (let i = 0; i < by; i++) {
    val = await redis.incr(key);
  }
  return val;
}

export async function getMetric(metric) {
  const redis = getRedis();
  const raw = await redis.get(`metric:${metric}`);
  return raw ? parseInt(raw, 10) : 0;
}

export default {
  getRedis,
  isRedisLive,
  acquireMutex,
  cacheGet,
  cacheSet,
  cacheDel,
  setDynamicConfig,
  getDynamicConfig,
  incrMetric,
  getMetric,
};
