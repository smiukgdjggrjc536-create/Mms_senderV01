// ============================================================================
// pools.js — Generic Pool Primitives on Redis Sorted Sets (V7 P1.3)
// ----------------------------------------------------------------------------
// SPEC:
//   - poolPush(pool, item, score): ZADD item with a score (typically Date.now()).
//   - poolPopFresh(pool, maxAgeMs): ZPOPMIN + re-push-if-stale loop — returns the
//     oldest item that is fresher than maxAgeMs, else refills/returns null.
//   - poolCount(pool): ZCARD.
//   - poolDrainRefill(pool, source, batchSize): drain a batch from `source`
//     (a generator function returning an array of {item, score}) and push into
//     `pool`. Foundation for the AI body/subject pools (Account 2, P4) and the
//     rotation pools (P3).
//
// Builds on the shared client in client.js. Never creates ad-hoc connections.
// In-memory fallback when Redis is unavailable (loud warn).
// ============================================================================

import { getRedisClient, isRedisLive } from './client.js';

let _fallbackWarned = false;
function warnFallback() {
  if (!_fallbackWarned) {
    console.warn('[redis:pools] WARNING: in-memory fallback — pools are process-local only.');
    _fallbackWarned = true;
  }
}

const POOL_TTL_SEC = 7 * 24 * 3600; // pool members expire after 7 days if untouched

// ---------------------------------------------------------------------------
// poolPush
// ---------------------------------------------------------------------------

/**
 * Add an item to a pool sorted set with the given score.
 * @param {string} pool   pool name (without prefix)
 * @param {string} item   member
 * @param {number} score  numeric score (e.g. Date.now() for LRU-ish ordering)
 * @returns {Promise<number>} 1 if added/updated
 */
export async function poolPush(pool, item, score) {
  const key = `pool:${pool}`;
  const redis = getRedisClient();

  if (isRedisLive()) {
    try {
      const res = await redis.zadd(key, String(score), String(item));
      // refresh TTL so the pool key itself doesn't vanish
      await redis.expire(key, POOL_TTL_SEC).catch(() => {});
      return Number(res);
    } catch (err) {
      warnFallback();
    }
  }

  warnFallback();
  await redis.zadd(key, score, item);
  return 1;
}

// ---------------------------------------------------------------------------
// poolPopFresh
// ---------------------------------------------------------------------------

/**
 * Pop the lowest-scored item that is fresher than maxAgeMs (score >= now-maxAge).
 * If the lowest item is stale (older than maxAgeMs), it is removed and we retry
 * with the next. Returns the item string or null if the pool is empty/exhausted.
 *
 * @param {string} pool
 * @param {number} maxAgeMs  reject items older than this (by score)
 * @returns {Promise<string|null>}
 */
export async function poolPopFresh(pool, maxAgeMs = Infinity) {
  const key = `pool:${pool}`;
  const redis = getRedisClient();
  const now = Date.now();
  const minScore = maxAgeMs === Infinity ? -Infinity : now - maxAgeMs;

  if (isRedisLive()) {
    try {
      // ZPOPMIN returns [member, score, member, score, ...]
      while (true) {
        const popped = await redis.zpopmin(key, 1);
        if (!popped || popped.length === 0) return null;
        const member = popped[0];
        const score = Number(popped[1]);
        if (score >= minScore || maxAgeMs === Infinity) {
          return member;
        }
        // stale — drop it (already popped) and continue
      }
    } catch (err) {
      warnFallback();
    }
  }

  warnFallback();
  while (true) {
    const popped = await redis.zpopmin(key, 1);
    if (!popped || popped.length === 0) return null;
    const member = popped[0];
    const score = Number(popped[1]);
    if (score >= minScore || maxAgeMs === Infinity) return member;
  }
}

/**
 * Pop N fresh items at once (convenience). Returns array of item strings.
 */
export async function poolPopFreshBatch(pool, count, maxAgeMs = Infinity) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const item = await poolPopFresh(pool, maxAgeMs);
    if (item === null) break;
    out.push(item);
  }
  return out;
}

// ---------------------------------------------------------------------------
// poolCount
// ---------------------------------------------------------------------------

/**
 * Number of items currently in the pool.
 */
export async function poolCount(pool) {
  const key = `pool:${pool}`;
  const redis = getRedisClient();

  if (isRedisLive()) {
    try {
      const n = await redis.zcard(key);
      return Number(n);
    } catch (err) {
      warnFallback();
    }
  }

  warnFallback();
  return await redis.zcard(key);
}

// ---------------------------------------------------------------------------
// poolDrainRefill
// ---------------------------------------------------------------------------

/**
 * Drain a batch from a source generator and push into the pool.
 * @param {string} pool         target pool name
 * @param {function} source     async fn(batchSize) -> array of { item, score }
 * @param {number} batchSize    how many items to fetch from source
 * @returns {Promise<number>}   number of items pushed
 */
export async function poolDrainRefill(pool, source, batchSize) {
  try {
    const items = await source(batchSize);
    if (!items || items.length === 0) return 0;
    let pushed = 0;
    for (const { item, score } of items) {
      if (item == null) continue;
      await poolPush(pool, item, score == null ? Date.now() : score);
      pushed++;
    }
    return pushed;
  } catch (err) {
    console.error(`[redis:pools] poolDrainRefill failed for "${pool}": ${err.message}`);
    return 0;
  }
}

/**
 * Peek at the lowest-scored item without removing it (for stats/preview).
 */
export async function poolPeekMin(pool) {
  const key = `pool:${pool}`;
  const redis = getRedisClient();
  try {
    const arr = await redis.zrange(key, 0, 0);
    return arr && arr.length ? arr[0] : null;
  } catch (err) {
    warnFallback();
    return null;
  }
}

/**
 * Remove a specific item from the pool (e.g. on invalidation).
 */
export async function poolRemove(pool, item) {
  const key = `pool:${pool}`;
  const redis = getRedisClient();
  try {
    return await redis.zrem(key, String(item));
  } catch (err) {
    warnFallback();
    return 0;
  }
}

export default {
  poolPush,
  poolPopFresh,
  poolPopFreshBatch,
  poolCount,
  poolDrainRefill,
  poolPeekMin,
  poolRemove,
};
