// ============================================================================
// V7 P2.3 — Mapping Engine
// ============================================================================
// buildRecipientMap(recipient, campaign, sendAttemptId):
//   1. Load campaign tag usage: which tokens appear in campaign body/subject.
//   2. For each token: pick generator, build context { recipientEmail,
//      campaignId, salt: sendAttemptId, index: campaign send counter }.
//   3. Call generator → value. Return Map token→value.
//
// Caching: within one send attempt the SAME token always resolves to the
// SAME value (body and subject referencing #INVOICE# must agree).
//
// Uniqueness guarantee: sendAttemptId is a Redis INCR sequence per campaign
// combined with crypto.randomBytes(8).toString("hex") — collision-impossible.
//
// persistMap(sendId, map): store the resolved map in MongoDB collection
// "tag_maps" (fields: sendId, campaignId, recipient, map, createdAt) with a
// TTL index (30 days) — this is the audit trail proving per-mail uniqueness.
// ============================================================================

import crypto from 'crypto';
import mongoose from 'mongoose';
import { resolveTokens, getMergedRegistry } from './tagRegistry.js';
import { GENERATORS, isAsyncGenerator } from './generators/index.js';
import { isRedisLive } from '../redis/client.js';
import { incrWithCeiling } from '../redis/atomic.js';

// ---------------------------------------------------------------------------
// tag_maps Mongoose model — the per-send audit trail.
// TTL index on createdAt (30 days) is also created by scripts/mongo-indexes.js
// ---------------------------------------------------------------------------
const tagMapSchema = new mongoose.Schema({
  sendId: { type: String, required: true, index: true },
  campaignId: { type: String, required: true, index: true },
  recipient: { type: String, required: true },
  map: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now, expires: 2592000 }, // 30 days TTL
});

export const TagMap =
  mongoose.models.TagMap || mongoose.model('TagMap', tagMapSchema);

// ---------------------------------------------------------------------------
// In-memory send counter fallback (used when Redis is not live).
// Keyed by campaignId → integer counter.
// ---------------------------------------------------------------------------
const _memCounters = new Map();
const _memWarned = new Set(); // campaignIds we've already warned about

/**
 * Get the next send attempt index for a campaign.
 * Uses Redis INCR (atomic) when available; falls back to in-memory counter.
 * @param {string} campaignId
 * @returns {Promise<number>}
 */
async function nextSendIndex(campaignId) {
  const key = `tagidx:${campaignId}`;
  if (isRedisLive()) {
    try {
      const result = await incrWithCeiling(key, 0, Number.MAX_SAFE_INTEGER);
      if (result.ok) return result.value;
    } catch (err) {
      // Fall through to in-memory
    }
  }
  // In-memory fallback
  const current = _memCounters.get(campaignId) || 0;
  const next = current + 1;
  _memCounters.set(campaignId, next);
  if (!_memWarned.has(campaignId)) {
    _memWarned.add(campaignId);
    console.warn(`[tagEngine] WARNING: Redis not live — using in-memory send counter for campaign ${campaignId}. Counter will reset on restart.`);
  }
  return next;
}

/**
 * Generate a sendAttemptId: Redis INCR sequence + crypto.randomBytes(8) hex.
 * Collision-impossible in practice.
 * @param {string} campaignId
 * @returns {Promise<string>}
 */
export async function generateSendAttemptId(campaignId) {
  const index = await nextSendIndex(campaignId);
  const random = crypto.randomBytes(8).toString('hex');
  return `${campaignId}:${index}:${random}`;
}

/**
 * Build a recipient map: resolve every known token in the campaign body
 * and subject to a concrete value for this recipient.
 *
 * @param {object} recipient - { email, name, city, zip, phone, company }
 * @param {object} campaign - { _id, body, subject, userId }
 * @param {string} sendAttemptId - unique per-send salt
 * @returns {Promise<Map<string, string>>} token → value
 */
export async function buildRecipientMap(recipient, campaign, sendAttemptId) {
  if (!recipient || !recipient.email) {
    throw new Error('buildRecipientMap: recipient.email is required.');
  }
  if (!campaign) {
    throw new Error('buildRecipientMap: campaign is required.');
  }

  const campaignId = String(campaign._id || campaign.id || 'unknown');
  const userId = String(campaign.userId || recipient.userId || 'global');

  // Combine body + subject for token scanning
  const body = campaign.body || '';
  const subject = campaign.subject || '';
  const combined = `${body}\n${subject}`;

  // Resolve all known tokens in the combined text
  const foundTokens = await resolveTokens(combined, userId);

  // Build the context for generators
  const ctx = {
    recipientEmail: recipient.email,
    recipientName: recipient.name || '',
    recipientCity: recipient.city || '',
    recipientZip: recipient.zip || '',
    recipientPhone: recipient.phone || '',
    recipientCompany: recipient.company || '',
    campaignId,
    salt: sendAttemptId,
    index: 0, // will be set below
    userId,
  };

  // Get the send index for this campaign (used in sequence generators)
  const index = await nextSendIndex(campaignId);
  ctx.index = index;

  // Resolve each unique token ONCE (body and subject referencing #INVOICE#
  // must agree → deduplicate by token)
  const seenTokens = new Set();
  const map = new Map();

  for (const { token, def } of foundTokens) {
    if (seenTokens.has(token)) continue; // already resolved
    seenTokens.add(token);

    const generatorId = def.generatorId;
    const genFn = GENERATORS[generatorId];
    if (!genFn) {
      // Unknown generator — leave token untouched (don't put in map)
      continue;
    }

    try {
      let value;
      if (isAsyncGenerator(generatorId)) {
        value = await genFn(ctx, def);
      } else {
        value = genFn(ctx, def);
        if (value && typeof value.then === 'function') {
          value = await value;
        }
      }
      if (value !== undefined && value !== null) {
        map.set(token, String(value));
      }
    } catch (err) {
      // Generator failure — don't corrupt the map, log and skip
      console.error(`[tagEngine] Generator ${generatorId} failed for token ${token}: ${err.message}`);
    }
  }

  return map;
}

/**
 * Persist a resolved map to MongoDB "tag_maps" collection.
 * This is the audit trail proving per-mail uniqueness.
 *
 * @param {string} sendId - the send attempt id
 * @param {string} campaignId
 * @param {string} recipient - recipient email
 * @param {Map|object} map - token → value (Map or plain object)
 * @returns {Promise<object>} the persisted document
 */
export async function persistMap(sendId, campaignId, recipient, map) {
  if (!sendId) throw new Error('persistMap: sendId is required.');
  if (!campaignId) throw new Error('persistMap: campaignId is required.');
  if (!recipient) throw new Error('persistMap: recipient is required.');

  // Convert Map to plain object for MongoDB storage
  const mapObj = map instanceof Map ? Object.fromEntries(map) : map;

  try {
    const doc = await TagMap.create({
      sendId: String(sendId),
      campaignId: String(campaignId),
      recipient: String(recipient),
      map: mapObj,
    });
    return doc;
  } catch (err) {
    console.error(`[tagEngine] persistMap failed for sendId ${sendId}: ${err.message}`);
    throw err;
  }
}

/**
 * Retrieve a persisted map (for audit / debugging).
 * @param {string} sendId
 * @returns {Promise<object|null>}
 */
export async function getMap(sendId) {
  try {
    return await TagMap.findOne({ sendId: String(sendId) }).lean().exec();
  } catch (err) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// _resetMappingState — test helper: clears in-memory counters.
// ---------------------------------------------------------------------------
export function _resetMappingState() {
  _memCounters.clear();
  _memWarned.clear();
}

export default {
  buildRecipientMap,
  persistMap,
  getMap,
  generateSendAttemptId,
  _resetMappingState,
};
