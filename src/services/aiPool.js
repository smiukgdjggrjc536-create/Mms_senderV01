// ============================================================================
// V7 P4.1 — aiPool.js (modular wrapper / refactor)
// ============================================================================
// Thin facade over src/services/ai/engine.js that preserves the legacy
// AiPool model interface (getStats / consume / addItems) while routing
// the real pool operations through the Redis-based engine.
//
// This keeps existing import sites working:
//   import AiPool from '@/models/aiPool';
//   import { getAiPoolStats, consumeAiPool, addAiPoolItems } from '@/services/aiPool';
//
// The MongoDB AiPool collection is kept as a durable audit/log store; the
// live pool lives in Redis (engine.js) for atomic ZPOPMIN consumption.
// ============================================================================

import { connectDB } from '@/lib/core';
import AiPool from '@/models/aiPool';
import {
  POOL_TYPES,
  getStats as getEngineStats,
  consumeBatch,
  produceItems,
  getPoolSize,
} from './engine.js';

// Map legacy poolType strings → engine pool types
const TYPE_MAP = {
  sender_name: POOL_TYPES.SENDER,
  subject_line: POOL_TYPES.SUBJECT,
};

/**
 * Unified stats (Redis engine + Mongo audit counts).
 * Preserves the shape legacy callers expect: { senderName, subjectLine }.
 */
export async function getAiPoolStats() {
  const engine = await getEngineStats();
  // Best-effort Mongo counts for audit (available/used)
  let nameUsed = 0, subjUsed = 0;
  try {
    await connectDB();
    [nameUsed, subjUsed] = await Promise.all([
      AiPool.countDocuments({ poolType: 'sender_name', used: true }).catch(() => 0),
      AiPool.countDocuments({ poolType: 'subject_line', used: true }).catch(() => 0),
    ]);
  } catch (_e) { /* Mongo optional in test env */ }

  return {
    senderName: {
      available: engine.sender,
      used: nameUsed,
      total: engine.sender + nameUsed,
      pct: engine.senderPct,
      low: engine.senderLow,
      high: engine.senderHigh,
    },
    subjectLine: {
      available: engine.subject,
      used: subjUsed,
      total: engine.subject + subjUsed,
      pct: engine.subjectPct,
      low: engine.subjectLow,
      high: engine.subjectHigh,
    },
    target: engine.target,
    lowWatermark: engine.low,
    highWatermark: engine.high,
  };
}

/**
 * Consume N items from a pool (atomic via Redis ZPOPMIN).
 * Also marks them used in Mongo for audit (best-effort, non-blocking).
 *
 * @param {'sender_name'|'subject_line'} poolType
 * @param {number} count
 * @param {string|null} userId
 * @returns {Promise<string[]>} consumed content strings
 */
export async function consumeAiPool(poolType, count, userId = null) {
  const type = TYPE_MAP[poolType];
  if (!type) throw new Error(`Unknown poolType: ${poolType}`);
  const items = await consumeBatch(type, count);
  // Best-effort Mongo audit (never blocks the send path)
  if (items.length > 0 && userId) {
    try {
      await connectDB();
      // find + mark the oldest unused docs matching content
      for (const content of items) {
        await AiPool.updateOne(
          { poolType, content, used: false },
          { $set: { used: true, usedAt: new Date(), usedBy: userId } },
        ).catch(() => {});
      }
    } catch (_e) { /* Mongo optional */ }
  }
  return items;
}

/**
 * Add generated items to the pool (Redis engine + Mongo audit).
 *
 * @param {'sender_name'|'subject_line'} poolType
 * @param {string[]} contents
 * @param {string} batchId
 * @returns {Promise<{inserted:number, pushed:number}>}
 */
export async function addAiPoolItems(poolType, contents, batchId = '') {
  const type = TYPE_MAP[poolType];
  if (!type) throw new Error(`Unknown poolType: ${poolType}`);
  const pushed = await produceItems(type, contents);

  // Best-effort Mongo audit store
  let inserted = 0;
  if (Array.isArray(contents) && contents.length > 0) {
    try {
      await connectDB();
      const docs = contents
        .filter((c) => typeof c === 'string' && c.trim())
        .map((content) => ({ poolType, content: content.trim(), used: false, batchId }));
      if (docs.length > 0) {
        const res = await AiPool.insertMany(docs, { ordered: false });
        inserted = res ? res.length : 0;
      }
    } catch (err) {
      console.error(`[aiPool] Mongo insertMany failed: ${err.message}`);
    }
  }
  return { inserted, pushed };
}

/**
 * Get the live Redis pool size for a type (shorthand).
 */
export async function getAiPoolSize(poolType) {
  const type = TYPE_MAP[poolType];
  if (!type) throw new Error(`Unknown poolType: ${poolType}`);
  return getPoolSize(type);
}

export default {
  getAiPoolStats,
  consumeAiPool,
  addAiPoolItems,
  getAiPoolSize,
  POOL_TYPES,
  TYPE_MAP,
};
