// ============================================================================
// V7 P4.1 — Background AI Engine v2: Pool model on Redis primitives
// ============================================================================
// Pool model:
//   - Redis sorted set  ai:pool:{type}   (type = sender | subject)
//   - score = generation timestamp (Date.now())
//   - Consumption = ZPOPMIN via src/lib/redis/pools.js (atomic, race-free)
//
// Capacity targets:
//   - sender pool >= 50,000   subject pool >= 50,000
//   - HIGH watermark 90%  → stop restocking
//   - LOW  watermark 40%  → trigger restock
//
// Feeds Account 1's rotation pools:
//   route:names:<campaignId>    (consumed by rotationStrategy.resolveSenderRoute)
//   route:subjects:<campaignId>
// The pick logic lives in rotationStrategy.js — we only FEED, never duplicate.
//
// Built on pools.js (poolPush / poolPopFresh / poolCount / poolDrainRefill)
// and atomic.js (withLock for single-writer restock). Graceful in-memory
// fallback when Redis is unavailable (S5 reliability).
// ============================================================================

import { poolPush, poolPopFresh, poolPopFreshBatch, poolCount, poolPeekMin, poolRemove } from '../../lib/redis/pools.js';
import { withLock, incrWithCeiling, resetCeiling } from '../../lib/redis/atomic.js';
import { getRedisClient, isRedisLive } from '../../lib/redis/client.js';
import { poolPushRoute, poolCountRoute } from '../../lib/routing/rotationStrategy.js';

// ---------------------------------------------------------------------------
// Constants & watermarks
// ---------------------------------------------------------------------------
export const POOL_TYPES = {
  SENDER: 'sender',
  SUBJECT: 'subject',
};

export const POOL_NAMES = {
  sender: 'ai:pool:sender',
  subject: 'ai:pool:subject',
};

export const TARGET_SIZE = 50000;       // pool target capacity
export const HIGH_WATERMARK_PCT = 0.90; // stop restock at 90% of target
export const LOW_WATERMARK_PCT = 0.40;  // trigger restock below 40% of target
export const MAX_AGE_MS = 7 * 24 * 3600 * 1000; // reject items older than 7 days

export const HIGH_WATERMARK = Math.floor(TARGET_SIZE * HIGH_WATERMARK_PCT); // 45000
export const LOW_WATERMARK = Math.floor(TARGET_SIZE * LOW_WATERMARK_PCT);   // 20000

const RESTOCK_LOCK_TTL_MS = 90 * 1000;   // restock lock: 90s
const FEED_LOCK_TTL_MS = 30 * 1000;      // feed lock: 30s
const FEED_BATCH = 1000;                 // items pushed to route pool per feed

let _fallbackWarned = false;
function warnFallback() {
  if (!_fallbackWarned) {
    console.warn('[ai:engine] WARNING: in-memory fallback — pools are process-local only.');
    _fallbackWarned = true;
  }
}

// ---------------------------------------------------------------------------
// Pool stats
// ---------------------------------------------------------------------------

/**
 * Get the current size of a pool (sender or subject).
 * @param {'sender'|'subject'} type
 * @returns {Promise<number>}
 */
export async function getPoolSize(type) {
  const name = POOL_NAMES[type];
  if (!name) throw new Error(`Unknown pool type: ${type}`);
  try {
    return await poolCount(name);
  } catch (err) {
    console.error(`[ai:engine] getPoolSize(${type}) failed: ${err.message}`);
    return 0;
  }
}

/**
 * Get stats for both pools + watermark status.
 * @returns {Promise<{sender:number,subject:number,senderPct:number,subjectPct:number,senderLow:boolean,subjectLow:boolean,senderHigh:boolean,subjectHigh:boolean,target:number,low:number,high:number}>}
 */
export async function getStats() {
  const [senderSize, subjectSize] = await Promise.all([
    getPoolSize(POOL_TYPES.SENDER),
    getPoolSize(POOL_TYPES.SUBJECT),
  ]);
  const sPct = TARGET_SIZE > 0 ? senderSize / TARGET_SIZE : 0;
  const subPct = TARGET_SIZE > 0 ? subjectSize / TARGET_SIZE : 0;
  return {
    sender: senderSize,
    subject: subjectSize,
    senderPct: Math.round(sPct * 100),
    subjectPct: Math.round(subPct * 100),
    senderLow: senderSize < LOW_WATERMARK,
    subjectLow: subjectSize < LOW_WATERMARK,
    senderHigh: senderSize >= HIGH_WATERMARK,
    subjectHigh: subjectSize >= HIGH_WATERMARK,
    target: TARGET_SIZE,
    low: LOW_WATERMARK,
    high: HIGH_WATERMARK,
  };
}

// ---------------------------------------------------------------------------
// Consumption (ZPOPMIN — atomic, race-free)
// ---------------------------------------------------------------------------

/**
 * Pop one fresh item from a pool (atomic ZPOPMIN).
 * @param {'sender'|'subject'} type
 * @returns {Promise<string|null>} item or null if pool empty
 */
export async function consumeOne(type) {
  const name = POOL_NAMES[type];
  if (!name) throw new Error(`Unknown pool type: ${type}`);
  try {
    return await poolPopFresh(name, MAX_AGE_MS);
  } catch (err) {
    console.error(`[ai:engine] consumeOne(${type}) failed: ${err.message}`);
    return null;
  }
}

/**
 * Pop N fresh items from a pool (batch).
 * @param {'sender'|'subject'} type
 * @param {number} count
 * @returns {Promise<string[]>}
 */
export async function consumeBatch(type, count) {
  const name = POOL_NAMES[type];
  if (!name) throw new Error(`Unknown pool type: ${type}`);
  try {
    return await poolPopFreshBatch(name, count, MAX_AGE_MS);
  } catch (err) {
    console.error(`[ai:engine] consumeBatch(${type}) failed: ${err.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Production (push items into the pool)
// ---------------------------------------------------------------------------

/**
 * Push generated items into a pool. Items with empty/duplicate content are
 * skipped. Each item gets score = Date.now() (so oldest is consumed first).
 *
 * @param {'sender'|'subject'} type
 * @param {string[]} items    array of content strings
 * @returns {Promise<number>} number of items actually pushed
 */
export async function produceItems(type, items) {
  const name = POOL_NAMES[type];
  if (!name) throw new Error(`Unknown pool type: ${type}`);
  if (!Array.isArray(items) || items.length === 0) return 0;

  const seen = new Set();
  let pushed = 0;
  const baseTs = Date.now();
  for (let i = 0; i < items.length; i++) {
    const content = typeof items[i] === 'string' ? items[i].trim() : '';
    if (!content || seen.has(content)) continue;
    seen.add(content);
    try {
      // micro-stagger scores so ZPOPMIN ordering is deterministic within a batch
      await poolPush(name, content, baseTs + i);
      pushed++;
    } catch (err) {
      console.error(`[ai:engine] produceItems push failed: ${err.message}`);
    }
    // respect HIGH watermark — stop pushing once we hit it
    if (pushed > 0 && pushed % 500 === 0) {
      const size = await poolCount(name);
      if (size >= HIGH_WATERMARK) break;
    }
  }
  return pushed;
}

/**
 * Peek at the oldest item without removing it (for stats/preview).
 */
export async function peekOne(type) {
  const name = POOL_NAMES[type];
  if (!name) throw new Error(`Unknown pool type: ${type}`);
  try {
    return await poolPeekMin(name);
  } catch (err) {
    console.error(`[ai:engine] peekOne(${type}) failed: ${err.message}`);
    return null;
  }
}

/**
 * Remove a specific item from the pool (e.g. on invalidation/audit).
 */
export async function removeItem(type, item) {
  const name = POOL_NAMES[type];
  if (!name) throw new Error(`Unknown pool type: ${type}`);
  try {
    return await poolRemove(name, String(item));
  } catch (err) {
    console.error(`[ai:engine] removeItem(${type}) failed: ${err.message}`);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Feed rotation pools (route:names / route:subjects) — P3 contract
// ---------------------------------------------------------------------------
// The pick logic lives in rotationStrategy.resolveSenderRoute. We ONLY feed
// the route pools here so the rotation engine has material to pick from.
// A distributed lock ensures multiple instances don't double-feed.

/**
 * Feed the route:names:<campaignId> pool from the AI sender pool.
 * @param {string} campaignId
 * @param {number} batchSize  items to feed (default FEED_BATCH)
 * @returns {Promise<number>} items fed
 */
export async function feedNamesPool(campaignId, batchSize = FEED_BATCH) {
  if (!campaignId) throw new Error('feedNamesPool: campaignId required');
  const lockRes = await withLock(`feed:names:${campaignId}`, FEED_LOCK_TTL_MS, async () => {
    try {
      const current = await poolCountRoute('names', String(campaignId));
      if (current >= batchSize) return 0; // pool already has enough
      const items = await consumeBatch(POOL_TYPES.SENDER, batchSize);
      if (!items || items.length === 0) return 0;
      let pushed = 0;
      for (const name of items) {
        if (!name) continue;
        await poolPushRoute('names', String(campaignId), name, Date.now());
        pushed++;
      }
      return pushed;
    } catch (err) {
      console.error(`[ai:engine] feedNamesPool(${campaignId}) failed: ${err.message}`);
      return 0;
    }
  });
  return lockRes && lockRes.acquired ? lockRes.result : 0;
}

/**
 * Feed the route:subjects:<campaignId> pool from the AI subject pool.
 * @param {string} campaignId
 * @param {number} batchSize  items to feed (default FEED_BATCH)
 * @returns {Promise<number>} items fed
 */
export async function feedSubjectsPool(campaignId, batchSize = FEED_BATCH) {
  if (!campaignId) throw new Error('feedSubjectsPool: campaignId required');
  const lockRes = await withLock(`feed:subjects:${campaignId}`, FEED_LOCK_TTL_MS, async () => {
    try {
      const current = await poolCountRoute('subjects', String(campaignId));
      if (current >= batchSize) return 0;
      const items = await consumeBatch(POOL_TYPES.SUBJECT, batchSize);
      if (!items || items.length === 0) return 0;
      let pushed = 0;
      for (const subj of items) {
        if (!subj) continue;
        await poolPushRoute('subjects', String(campaignId), subj, Date.now());
        pushed++;
      }
      return pushed;
    } catch (err) {
      console.error(`[ai:engine] feedSubjectsPool(${campaignId}) failed: ${err.message}`);
      return 0;
    }
  });
  return lockRes && lockRes.acquired ? lockRes.result : 0;
}

/**
 * Feed both route pools for a campaign in one call.
 */
export async function feedCampaignPools(campaignId, batchSize = FEED_BATCH) {
  const [names, subjects] = await Promise.all([
    feedNamesPool(campaignId, batchSize),
    feedSubjectsPool(campaignId, batchSize),
  ]);
  return { names, subjects };
}

// ---------------------------------------------------------------------------
// Quota gate (P4.3 / P5 integration)
// ---------------------------------------------------------------------------
// Restock respects the admin-set AI quota. The Package Manager (P5) sets
// per-day ceilings; we check via incrWithCeiling before each generation call.
// If the ceiling is reached, restock degrades gracefully (no crash).

const AI_QUOTA_KEY = 'ai:quota:daily';

/**
 * Check & consume one AI generation slot against the daily quota.
 * @param {number} ceiling  max generations per day (from package config)
 * @returns {Promise<boolean>} true if allowed, false if quota exhausted
 */
export async function checkAiQuota(ceiling) {
  if (!Number.isFinite(ceiling) || ceiling <= 0) return true; // unlimited
  try {
    const res = await incrWithCeiling(AI_QUOTA_KEY, ceiling);
    return res && res.allowed === true;
  } catch (err) {
    console.error(`[ai:engine] checkAiQuota failed: ${err.message}`);
    return true; // fail-open so the pool never starves on a Redis glitch
  }
}

/**
 * Reset the daily AI quota counter (called by a midnight cron / admin).
 */
export async function resetAiQuota() {
  try {
    // resetCeiling clears both the Redis key and the in-memory fallback Map.
    await resetCeiling(AI_QUOTA_KEY);
  } catch (err) {
    console.error(`[ai:engine] resetAiQuota failed: ${err.message}`);
  }
}

export default {
  POOL_TYPES,
  POOL_NAMES,
  TARGET_SIZE,
  HIGH_WATERMARK,
  LOW_WATERMARK,
  getPoolSize,
  getStats,
  consumeOne,
  consumeBatch,
  produceItems,
  peekOne,
  removeItem,
  feedNamesPool,
  feedSubjectsPool,
  feedCampaignPools,
  checkAiQuota,
  resetAiQuota,
};
