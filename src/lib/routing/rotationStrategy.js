// ============================================================================
// V7 P3.3 — Rotation Strategy (rotationStrategy.js)
// ============================================================================
// resolveSenderRoute(campaign, sendAttemptId): returns
//   { fromEmail, fromName, subjectRouteId, mode, delayJitterMs } for ONE send.
//
// Modes:
//   ROTATE_POOL — when ALL active senders support spoofing/dynamic routing.
//     • Sender pool in Redis "route:senders:<campaignId>" (sorted set, LRU by
//       last-used score so anti-repeat naturally falls out).
//     • anti-repeat window: an email used within the last K sends
//       (K = min(poolSize-1, 20)) is skipped; weighted random among remaining.
//     • jitter: delayJitterMs (0..1500) added to inter-send delay so rotation
//       never forms a metronome pattern.
//   LOCK_MAIN — else always the campaign's primary API email.
//
// Sender NAME routing: pool "route:names:<campaignId>" — anti-repeat-windowed
//   random name, paired with the picked fromEmail (pairing stored on attempt
//   so audit shows the exact (email, name) combo).
//
// SUBJECT routing: pool "route:subjects:<campaignId>" — same anti-repeat pick;
//   subjectRouteId returned so the send pipeline resolves subject text at
//   dispatch time (Account 2 wires pool feeding + final resolution).
//
// Every resolution emits a routing audit record (MongoDB "routing_audit":
//   sendId, campaignId, fromEmail, fromName, subjectRouteId, mode, jitterMs,
//   createdAt, TTL 30 days).
//
// Uses P1.3 pools.js primitives (poolPush/poolPopFresh/poolCount) on the
// route:* namespace, and the shared ioredis client for the anti-repeat list.
// Graceful in-memory fallback when Redis is unavailable (S5 reliability).
// ============================================================================
import mongoose from 'mongoose';
import { getRedisClient, isRedisLive } from '../redis/client.js';
import { withLock } from '../redis/atomic.js';

// ---------------------------------------------------------------------------
// RoutingAudit model — MongoDB "routing_audit" collection, TTL 30 days.
// ---------------------------------------------------------------------------
const routingAuditSchema = new mongoose.Schema({
  sendId: { type: String, required: true, index: true },
  campaignId: { type: String, required: true, index: true },
  fromEmail: { type: String, required: true },
  fromName: { type: String, default: '' },
  subjectRouteId: { type: String, default: '' },
  mode: { type: String, enum: ['ROTATE_POOL', 'LOCK_MAIN'], required: true },
  jitterMs: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, expires: 30 * 24 * 60 * 60 }, // 30-day TTL
});
export const RoutingAudit =
  mongoose.models.RoutingAudit || mongoose.model('RoutingAudit', routingAuditSchema);

// ---------------------------------------------------------------------------
// RoutingConfig model — MongoDB "routing_configs" collection.
// Per-campaign routing configuration (mode, antiRepeatWindow, jitterMaxMs).
// ---------------------------------------------------------------------------
const routingConfigSchema = new mongoose.Schema({
  campaignId: { type: String, required: true, unique: true, index: true },
  mode: { type: String, enum: ['ROTATE_POOL', 'LOCK_MAIN', 'auto'], default: 'auto' },
  antiRepeatWindow: { type: Number, default: null }, // null → auto = min(poolSize-1,20)
  jitterMaxMs: { type: Number, default: 1500 },
  primaryEmail: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});
export const RoutingConfig =
  mongoose.models.RoutingConfig || mongoose.model('RoutingConfig', routingConfigSchema);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const MAX_JITTER_MS = 1500;
export const MAX_ANTI_REPEAT = 20;
export const DEFAULT_JITTER_MAX = 1500;
export const ROUTE_POOL_TTL_SEC = 7 * 24 * 3600; // pool members expire after 7 days
export const ANTI_REPEAT_TTL_SEC = 6 * 3600; // anti-repeat history lives 6h
export const POOL_NAMESPACES = {
  senders: 'route:senders',
  names: 'route:names',
  subjects: 'route:subjects',
};

let _memWarned = new Set();
function warnOnce(ns) {
  if (!_memWarned.has(ns)) {
    _memWarned.add(ns);
    console.warn(`[routing] WARNING: in-memory fallback for ${ns} — pools are process-local only.`);
  }
}

// ---------------------------------------------------------------------------
// crypto-secure random integer in [0, max)
// ---------------------------------------------------------------------------
function secureRandomInt(max) {
  if (max <= 0) return 0;
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  const val = buf[0] * 0x1000000 + buf[1] * 0x10000 + buf[2] * 0x100 + buf[3];
  return val % max;
}

function jitterMs(max = DEFAULT_JITTER_MAX) {
  if (max <= 0) return 0;
  return secureRandomInt(max + 1); // 0..max inclusive
}

// ---------------------------------------------------------------------------
// computeAntiRepeatK(poolSize, override)
//   K = min(poolSize-1, 20). If poolSize <= 1 → 0 (no window meaningful).
// ---------------------------------------------------------------------------
export function computeAntiRepeatK(poolSize, override = null) {
  if (override != null && Number.isFinite(override)) {
    return Math.max(0, Math.min(Math.floor(override), MAX_ANTI_REPEAT));
  }
  if (poolSize <= 1) return 0;
  return Math.min(poolSize - 1, MAX_ANTI_REPEAT);
}

// ---------------------------------------------------------------------------
// determineMode(activeSenders, config)
//   ROTATE_POOL when ALL active senders support spoofing OR dynamic routing
//   AND pool size >= 2. Else LOCK_MAIN.
//   If config.mode is explicitly set (not 'auto'), honor it.
// ---------------------------------------------------------------------------
export function determineMode(activeSenders, config = {}) {
  const cfgMode = config?.mode || 'auto';
  if (cfgMode === 'ROTATE_POOL') return 'ROTATE_POOL';
  if (cfgMode === 'LOCK_MAIN') return 'LOCK_MAIN';

  // auto: need >= 2 senders and all support spoofing or dynamic routing
  if (!activeSenders || activeSenders.length < 2) return 'LOCK_MAIN';
  const allCapable = activeSenders.every((s) => {
    const caps = s.capabilities || {};
    return caps.supportsSpoofing === true || caps.supportsDynamicRouting === true;
  });
  return allCapable ? 'ROTATE_POOL' : 'LOCK_MAIN';
}

// ---------------------------------------------------------------------------
// Redis pool helpers (route:* namespace)
// ---------------------------------------------------------------------------
function poolKey(ns, campaignId) {
  return `${POOL_NAMESPACES[ns]}:${campaignId}`;
}

/**
 * Push an item into a route pool (sorted set, score = lastUsed timestamp).
 */
export async function poolPushRoute(ns, campaignId, item, score = Date.now()) {
  const key = poolKey(ns, campaignId);
  const redis = getRedisClient();
  if (isRedisLive()) {
    try {
      await redis.zadd(key, String(score), String(item));
      await redis.expire(key, ROUTE_POOL_TTL_SEC).catch(() => {});
      return 1;
    } catch (err) {
      warnOnce(ns);
    }
  }
  warnOnce(ns);
  await redis.zadd(key, score, item);
  await redis.expire(key, ROUTE_POOL_TTL_SEC).catch(() => {});
  return 1;
}

/**
 * Get all members of a route pool (with scores).
 * Returns array of [{ member, score }].
 * Uses zrange for members + zscore per member (works in both real ioredis and
 * the in-memory fallback, which does not support the WITHSCORES flag).
 */
export async function poolMembersRoute(ns, campaignId) {
  const key = poolKey(ns, campaignId);
  const redis = getRedisClient();
  try {
    const members = await redis.zrange(key, 0, -1);
    if (!members || members.length === 0) return [];
    const out = [];
    for (const m of members) {
      let score = 0;
      try {
        const s = await redis.zscore(key, m);
        score = s != null ? Number(s) : 0;
      } catch { score = 0; }
      out.push({ member: m, score });
    }
    return out;
  } catch (err) {
    warnOnce(ns);
    return [];
  }
}

/**
 * Count members in a route pool.
 */
export async function poolCountRoute(ns, campaignId) {
  const key = poolKey(ns, campaignId);
  const redis = getRedisClient();
  try {
    return Number(await redis.zcard(key));
  } catch (err) {
    warnOnce(ns);
    return 0;
  }
}

/**
 * Update an item's score (mark as recently used) — for LRU rotation.
 */
export async function poolTouchRoute(ns, campaignId, item, score = Date.now()) {
  const key = poolKey(ns, campaignId);
  const redis = getRedisClient();
  try {
    await redis.zadd(key, String(score), String(item));
    await redis.expire(key, ROUTE_POOL_TTL_SEC).catch(() => {});
    return 1;
  } catch (err) {
    warnOnce(ns);
    return 0;
  }
}

/**
 * Drain + refill a route pool from a source generator.
 * @param {string} ns          pool namespace key ('senders'|'names'|'subjects')
 * @param {string} campaignId
 * @param {function} source    async fn() -> array of strings (or {item,score})
 * @returns {Promise<number>}  items pushed
 */
export async function refillRoutePool(ns, campaignId, source) {
  try {
    const items = await source();
    if (!items || items.length === 0) return 0;
    let pushed = 0;
    for (const it of items) {
      const item = typeof it === 'string' ? it : it.item;
      const score = typeof it === 'string' ? Date.now() : (it.score ?? Date.now());
      if (item == null || item === '') continue;
      await poolPushRoute(ns, campaignId, item, score);
      pushed++;
    }
    return pushed;
  } catch (err) {
    console.error(`[routing] refillRoutePool(${ns}) failed: ${err.message}`);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Anti-repeat window — implemented on a Redis sorted set (works in both real
// Redis and the in-memory fallback, which does NOT implement list ops).
// The set stores members with score = send sequence number (monotonic).
// "Recently used" = members with the top-K highest scores.
// ---------------------------------------------------------------------------
function recentKey(ns, campaignId) {
  return `route:recent:${ns}:${campaignId}`;
}

/**
 * Get the set of recently-used items (top-K highest scores) for a namespace.
 * Returns a Set of member strings.
 */
async function getRecent(ns, campaignId, k) {
  if (k <= 0) return new Set();
  const key = recentKey(ns, campaignId);
  const redis = getRedisClient();
  try {
    if (isRedisLive()) {
      // zrevrange returns highest-score-first; take first K
      const items = await redis.zrevrange(key, 0, k - 1);
      return new Set(items || []);
    }
    warnOnce(ns);
    // fallback: zrange returns lowest-first, reverse for top-K
    const all = await redis.zrange(key, 0, -1);
    if (!all || all.length === 0) return new Set();
    // fallback zrange is sorted ascending by score → reverse slice
    return new Set(all.slice(-k).reverse());
  } catch (err) {
    warnOnce(ns);
    return new Set();
  }
}

// Monotonic sequence counter per (ns, campaignId) — uses Redis INCR (fallback supports it).
const _seqCounters = new Map();
async function _nextSeq(ns, campaignId) {
  const ck = `${ns}:${campaignId}`;
  const redis = getRedisClient();
  try {
    const seqKey = `route:seq:${ns}:${campaignId}`;
    const v = await redis.incr(seqKey);
    await redis.expire(seqKey, ANTI_REPEAT_TTL_SEC).catch(() => {});
    return Number(v);
  } catch (err) {
    // local counter fallback
    const v = (_seqCounters.get(ck) || 0) + 1;
    _seqCounters.set(ck, v);
    return v;
  }
}

/**
 * Record an item as recently used: add to the anti-repeat sorted set with
 * a monotonic score, and prune old entries beyond MAX_ANTI_REPEAT+5 to keep
 * the set bounded.
 */
async function recordRecent(ns, campaignId, item, k) {
  if (!item) return;
  const key = recentKey(ns, campaignId);
  const redis = getRedisClient();
  const seq = await _nextSeq(ns, campaignId);
  try {
    await redis.zadd(key, String(seq), String(item));
    await redis.expire(key, ANTI_REPEAT_TTL_SEC).catch(() => {});
    // Prune entries below the (current seq - (MAX_ANTI_REPEAT + 5)) threshold.
    // This keeps only recent entries, bounding memory.
    const pruneBelow = seq - (MAX_ANTI_REPEAT + 5);
    if (pruneBelow > 0) {
      // zremrangebyscore removes members with score <= pruneBelow
      // Fallback doesn't have it, so we guard with isRedisLive; fallback set
      // stays small because zadd overwrites the same member (update score).
      if (isRedisLive()) {
        await redis.zremrangebyscore(key, '-inf', String(pruneBelow)).catch(() => {});
      }
    }
  } catch (err) {
    warnOnce(ns);
  }
}

// ---------------------------------------------------------------------------
// Weighted random pick among candidates, excluding recently used.
// Falls back to: if all candidates are recently used, pick least-recently-used.
// ---------------------------------------------------------------------------
function pickWeightedRandom(candidates, recentSet) {
  if (candidates.length === 0) return null;
  const fresh = candidates.filter((c) => !recentSet.has(c.member));
  if (fresh.length > 0) {
    // weighted random: prefer items with lower score (used longer ago).
    // Weight = (maxScore - score + 1) so lower score → higher weight.
    const scores = fresh.map((c) => c.score || 0);
    const maxScore = Math.max(...scores, 1);
    const weights = fresh.map((c) => Math.max(1, maxScore - (c.score || 0) + 1));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = secureRandomInt(total);
    for (let i = 0; i < fresh.length; i++) {
      r -= weights[i];
      if (r < 0) return fresh[i].member;
    }
    return fresh[fresh.length - 1].member;
  }
  // All recently used — pick the least-recently-used (lowest score = oldest)
  let chosen = candidates[0];
  for (const c of candidates) {
    if ((c.score || 0) < (chosen.score || 0)) chosen = c;
  }
  return chosen.member;
}

// ---------------------------------------------------------------------------
// persistRoutingAudit — write the audit row (best-effort).
// ---------------------------------------------------------------------------
async function persistRoutingAudit(record) {
  const connState = (RoutingAudit.db && RoutingAudit.db.readyState) ?? 0;
  if (connState !== 1 && connState !== 2) return; // skip if not connected
  try {
    await RoutingAudit.create(record);
  } catch (err) {
    console.error(`[routing] audit persist failed: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// getRoutingConfig — read per-campaign config from MongoDB or default.
// ---------------------------------------------------------------------------
export async function getRoutingConfig(campaignId) {
  if (!campaignId) return null;
  const connState = (RoutingConfig.db && RoutingConfig.db.readyState) ?? 0;
  if (connState !== 1 && connState !== 2) {
    return { campaignId, mode: 'auto', antiRepeatWindow: null, jitterMaxMs: DEFAULT_JITTER_MAX, primaryEmail: '' };
  }
  try {
    const doc = await RoutingConfig.findOne({ campaignId }).lean().exec();
    return doc || { campaignId, mode: 'auto', antiRepeatWindow: null, jitterMaxMs: DEFAULT_JITTER_MAX, primaryEmail: '' };
  } catch (err) {
    console.error(`[routing] getRoutingConfig failed: ${err.message}`);
    return { campaignId, mode: 'auto', antiRepeatWindow: null, jitterMaxMs: DEFAULT_JITTER_MAX, primaryEmail: '' };
  }
}

/**
 * Persist per-campaign routing config (upsert).
 */
export async function setRoutingConfig(campaignId, patch) {
  const connState = (RoutingConfig.db && RoutingConfig.db.readyState) ?? 0;
  if (connState !== 1 && connState !== 2) {
    return { campaignId, ...patch };
  }
  try {
    const doc = await RoutingConfig.findOneAndUpdate(
      { campaignId },
      { $set: { campaignId, ...patch, updatedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean().exec();
    return doc;
  } catch (err) {
    console.error(`[routing] setRoutingConfig failed: ${err.message}`);
    return { campaignId, ...patch };
  }
}

// ---------------------------------------------------------------------------
// buildSenderPool — populate route:senders:<campaignId> from active senders.
// Only ADDS senders not already in the pool (preserves LRU scores from prior
// rotations). Returns the number of senders added.
// ---------------------------------------------------------------------------
export async function buildSenderPool(campaignId, activeSenders) {
  if (!activeSenders || activeSenders.length === 0) return 0;
  let pushed = 0;
  for (const s of activeSenders) {
    if (!s.email) continue;
    const existing = await poolMemberScore('senders', String(campaignId), s.email);
    if (existing !== null) continue; // already in pool — keep its LRU score
    const score = s.lastUsedAt ? new Date(s.lastUsedAt).getTime() : 0;
    await poolPushRoute('senders', String(campaignId), s.email, score);
    pushed++;
  }
  return pushed;
}

/**
 * Get the score of a specific member in a route pool (null if not present).
 */
export async function poolMemberScore(ns, campaignId, item) {
  const key = poolKey(ns, campaignId);
  const redis = getRedisClient();
  try {
    const s = await redis.zscore(key, String(item));
    return s != null ? Number(s) : null;
  } catch (err) {
    warnOnce(ns);
    return null;
  }
}

// ---------------------------------------------------------------------------
// resolveSenderRoute — THE MAIN ENTRY POINT.
// Returns: { fromEmail, fromName, subjectRouteId, mode, delayJitterMs, sendId }
// ---------------------------------------------------------------------------
export async function resolveSenderRoute(campaign, sendAttemptId, opts = {}) {
  const campaignId = campaign?.id || campaign?._id || campaign?.campaignId || 'default';
  const sendId = sendAttemptId || `send-${Date.now()}-${secureRandomInt(1e9)}`;
  const config = opts.config || (await getRoutingConfig(String(campaignId)));

  // Active senders for this campaign (from opts or campaign.senders)
  const activeSenders = (opts.activeSenders || campaign?.senders || []).filter(
    (s) => s && s.email && s.status !== 'invalid',
  );

  const mode = determineMode(activeSenders, config);

  if (mode === 'LOCK_MAIN') {
    // Always the campaign's primary API email
    const primary =
      config?.primaryEmail ||
      campaign?.primaryEmail ||
      campaign?.primaryApiEmail ||
      (activeSenders.find((s) => s.isPrimary)?.email) ||
      activeSenders[0]?.email ||
      '';
    const name = await _pickFromPool('names', campaignId, config);
    const subjectRouteId = await _pickFromPool('subjects', campaignId, config);
    const jit = jitterMs(config?.jitterMaxMs ?? DEFAULT_JITTER_MAX);
    const record = {
      sendId,
      campaignId: String(campaignId),
      fromEmail: primary,
      fromName: name || '',
      subjectRouteId: subjectRouteId || '',
      mode: 'LOCK_MAIN',
      jitterMs: jit,
    };
    await persistRoutingAudit(record);
    return { ...record, delayJitterMs: jit };
  }

  // ROTATE_POOL mode
  // Ensure the sender pool is populated
  await buildSenderPool(String(campaignId), activeSenders);
  const members = await poolMembersRoute('senders', String(campaignId));
  const poolSize = members.length;
  const k = computeAntiRepeatK(poolSize, config?.antiRepeatWindow);
  const recentSet = await getRecent('senders', String(campaignId), k);
  const fromEmail = pickWeightedRandom(members, recentSet) || activeSenders[0]?.email || '';

  // Record anti-repeat + touch the pool (LRU)
  if (fromEmail) {
    await recordRecent('senders', String(campaignId), fromEmail, k);
    await poolTouchRoute('senders', String(campaignId), fromEmail, Date.now());
  }

  const name = await _pickFromPool('names', campaignId, config);
  const subjectRouteId = await _pickFromPool('subjects', campaignId, config);
  const jit = jitterMs(config?.jitterMaxMs ?? DEFAULT_JITTER_MAX);

  const record = {
    sendId,
    campaignId: String(campaignId),
    fromEmail,
    fromName: name || '',
    subjectRouteId: subjectRouteId || '',
    mode: 'ROTATE_POOL',
    jitterMs: jit,
  };
  await persistRoutingAudit(record);
  return { ...record, delayJitterMs: jit };
}

// ---------------------------------------------------------------------------
// _pickFromPool — anti-repeat-windowed pick from names/subjects pool.
// Returns the picked item string (or '' if pool empty).
// ---------------------------------------------------------------------------
async function _pickFromPool(ns, campaignId, config) {
  const cid = String(campaignId);
  const members = await poolMembersRoute(ns, cid);
  if (members.length === 0) return '';
  const k = computeAntiRepeatK(members.length, config?.antiRepeatWindow);
  const recentSet = await getRecent(ns, cid, k);
  const picked = pickWeightedRandom(members, recentSet);
  if (picked) {
    await recordRecent(ns, cid, picked, k);
    await poolTouchRoute(ns, cid, picked, Date.now());
  }
  return picked || '';
}

// ---------------------------------------------------------------------------
// getPoolStats — for the API GET /api/routing/config?campaignId=
// Returns pool sizes + last 20 audit entries.
// ---------------------------------------------------------------------------
export async function getPoolStats(campaignId) {
  const cid = String(campaignId);
  const [sendersCount, namesCount, subjectsCount] = await Promise.all([
    poolCountRoute('senders', cid),
    poolCountRoute('names', cid),
    poolCountRoute('subjects', cid),
  ]);

  let recentAudit = [];
  const connState = (RoutingAudit.db && RoutingAudit.db.readyState) ?? 0;
  if (connState === 1 || connState === 2) {
    try {
      recentAudit = await RoutingAudit.find({ campaignId: cid })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean()
        .exec();
    } catch (err) {
      console.error(`[routing] getPoolStats audit query failed: ${err.message}`);
    }
  }

  return {
    campaignId: cid,
    poolSizes: { senders: sendersCount, names: namesCount, subjects: subjectsCount },
    recentAudit,
  };
}

// ---------------------------------------------------------------------------
// dryRunResolve — resolve N routes WITHOUT sending, for the API test endpoint.
// Uses a lock so concurrent dry-runs don't corrupt the anti-repeat window.
// Returns array of { fromEmail, fromName, subjectRouteId, jitter, mode }.
// ---------------------------------------------------------------------------
export async function dryRunResolve(campaign, count = 10) {
  const campaignId = String(campaign?.id || campaign?._id || campaign?.campaignId || 'default');
  // Allow an explicit config override passed on the campaign object (used by
  // the /api/routing/test dry-run endpoint so operators can test a candidate
  // mode without persisting a config first).
  const config = campaign?._dryRunConfig || (await getRoutingConfig(campaignId));
  const activeSenders = (campaign?.senders || []).filter((s) => s && s.email && s.status !== 'invalid');
  const mode = determineMode(activeSenders, config);

  const results = [];
  // For dry-run we use ephemeral anti-repeat (in-memory within this call)
  // so the real anti-repeat window is not polluted by test resolutions.
  const localRecent = { senders: [], names: [], subjects: [] };

  for (let i = 0; i < count; i++) {
    const sendId = `dryrun-${campaignId}-${i}-${secureRandomInt(1e9)}`;
    if (mode === 'LOCK_MAIN') {
      const primary = config?.primaryEmail || campaign?.primaryEmail || activeSenders.find((s) => s.isPrimary)?.email || activeSenders[0]?.email || '';
      const jit = jitterMs(config?.jitterMaxMs ?? DEFAULT_JITTER_MAX);
      results.push({ fromEmail: primary, fromName: '', subjectRouteId: '', jitter: jit, mode: 'LOCK_MAIN', sendId });
      continue;
    }

    // ROTATE_POOL dry-run
    await buildSenderPool(campaignId, activeSenders);
    const members = await poolMembersRoute('senders', campaignId);
    const k = computeAntiRepeatK(members.length, config?.antiRepeatWindow);
    const recentSet = new Set(localRecent.senders.slice(0, k));
    const fromEmail = pickWeightedRandom(members, recentSet) || activeSenders[0]?.email || '';
    if (fromEmail) {
      localRecent.senders.unshift(fromEmail);
      if (localRecent.senders.length > MAX_ANTI_REPEAT) localRecent.senders.pop();
      // touch pool for LRU (so dry-run reflects realistic ordering)
      await poolTouchRoute('senders', campaignId, fromEmail, Date.now());
    }

    // names + subjects from pools (also local anti-repeat)
    const nameMembers = await poolMembersRoute('names', campaignId);
    const nameK = computeAntiRepeatK(nameMembers.length, config?.antiRepeatWindow);
    const nameRecentSet = new Set(localRecent.names.slice(0, nameK));
    const fromName = pickWeightedRandom(nameMembers, nameRecentSet) || '';
    if (fromName) { localRecent.names.unshift(fromName); if (localRecent.names.length > MAX_ANTI_REPEAT) localRecent.names.pop(); }

    const subjMembers = await poolMembersRoute('subjects', campaignId);
    const subjK = computeAntiRepeatK(subjMembers.length, config?.antiRepeatWindow);
    const subjRecentSet = new Set(localRecent.subjects.slice(0, subjK));
    const subjectRouteId = pickWeightedRandom(subjMembers, subjRecentSet) || '';
    if (subjectRouteId) { localRecent.subjects.unshift(subjectRouteId); if (localRecent.subjects.length > MAX_ANTI_REPEAT) localRecent.subjects.pop(); }

    const jit = jitterMs(config?.jitterMaxMs ?? DEFAULT_JITTER_MAX);
    results.push({ fromEmail, fromName, subjectRouteId, jitter: jit, mode: 'ROTATE_POOL', sendId });
  }

  return results;
}

export default {
  resolveSenderRoute,
  dryRunResolve,
  determineMode,
  computeAntiRepeatK,
  buildSenderPool,
  poolPushRoute,
  poolMembersRoute,
  poolMemberScore,
  poolCountRoute,
  poolTouchRoute,
  refillRoutePool,
  getRoutingConfig,
  setRoutingConfig,
  getPoolStats,
  RoutingAudit,
  RoutingConfig,
  MAX_JITTER_MS,
  MAX_ANTI_REPEAT,
  POOL_NAMESPACES,
};
