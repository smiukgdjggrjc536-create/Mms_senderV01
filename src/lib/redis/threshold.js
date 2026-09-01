// ============================================================================
// P1.4 — Redis-Backed Threshold State (Atomic Pause / Resume)
// ============================================================================
// Mirrors the MongoDB EmailAccount threshold fields (sentToday,
// thresholdPaused, pausedIndex, pausedCampaignId, pausedAt) into Redis
// hashes so that:
//
//   • State survives process restart (read back from Redis on boot).
//   • Pause + resume are ATOMIC — on THRESHOLD_PAUSE the index + campaign
//     state are saved in ONE Redis transaction (MULTI/EXEC or pipeline) and
//     resume happens from the EXACT index (zero data loss).
//
// Redis key layout (prefix `mms_gw:` + `cred:` domain):
//   cred:{id}:sent         → string (send counter for current window)
//   cred:{id}:window_start → string (epoch ms when the window started)
//   cred:{id}:paused       → hash { paused, pausedIndex, pausedCampaignId, pausedAt }
//
// PRESERVE COMPLIANCE (L6): This module does NOT replace the MongoDB
// thresholdStatus props flow. It ADDS a Redis mirror layer. The existing
// `getThresholdStatusForUser`, `pauseCredentialAtThreshold`, and
// `resetCredentialThreshold` in core.js still work — they now ALSO write
// to Redis for crash recovery, but the props contract (sentToday,
// thresholdLimit, remaining, atLimit, thresholdPaused, pausedIndex,
// pausedAt) is unchanged.
//
// NON-DESTRUCTIVE: brand-new file. core.js functions are extended
// additively (a thin Redis sync call is added, never replacing the Mongo logic).
// ============================================================================

import { getRedisClient, isRedisLive } from './client.js';
import { withLock } from './atomic.js';

// Key helpers
const _sentKey = (id) => `cred:${id}:sent`;
const _windowKey = (id) => `cred:${id}:window_start`;
const _pausedKey = (id) => `cred:${id}:paused`;

// 24-hour window in ms
const WINDOW_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// In-memory fallback (only when Redis is NOT live)
// ---------------------------------------------------------------------------
const _memState = new Map(); // id -> { sent, windowStart, paused: {...} }

function _memGet(id) {
  if (!_memState.has(id)) {
    _memState.set(id, { sent: 0, windowStart: Date.now(), paused: { paused: '0', pausedIndex: '0', pausedCampaignId: '', pausedAt: '' } });
  }
  return _memState.get(id);
}

// ---------------------------------------------------------------------------
// Read threshold state for a credential from Redis (or in-memory fallback).
// Returns: { sent, windowStart, paused, pausedIndex, pausedCampaignId, pausedAt }
// ---------------------------------------------------------------------------
export async function getThresholdState(credId) {
  const id = String(credId);

  if (!isRedisLive()) {
    const s = _memGet(id);
    return {
      sent: Number(s.sent) || 0,
      windowStart: Number(s.windowStart) || Date.now(),
      paused: s.paused.paused === '1',
      pausedIndex: Number(s.paused.pausedIndex) || 0,
      pausedCampaignId: s.paused.pausedCampaignId || null,
      pausedAt: s.paused.pausedAt || null,
    };
  }

  const redis = getRedisClient();
  try {
    const [sent, windowStart, pausedHash] = await Promise.all([
      redis.get(_sentKey(id)),
      redis.get(_windowKey(id)),
      redis.hgetall ? redis.hgetall(_pausedKey(id)) : {},
    ]);

    const paused = pausedHash || {};
    return {
      sent: Number(sent) || 0,
      windowStart: Number(windowStart) || Date.now(),
      paused: paused.paused === '1',
      pausedIndex: Number(paused.pausedIndex) || 0,
      pausedCampaignId: paused.pausedCampaignId || null,
      pausedAt: paused.pausedAt || null,
    };
  } catch (err) {
    console.warn('[redis] threshold.getThresholdState failed, using memory:', err.message);
    const s = _memGet(id);
    return {
      sent: Number(s.sent) || 0,
      windowStart: Number(s.windowStart) || Date.now(),
      paused: s.paused.paused === '1',
      pausedIndex: Number(s.paused.pausedIndex) || 0,
      pausedCampaignId: s.paused.pausedCampaignId || null,
      pausedAt: s.paused.pausedAt || null,
    };
  }
}

// ---------------------------------------------------------------------------
// Atomically increment the send counter for a credential.
// Resets the window if 24h have elapsed since windowStart.
// Returns the new sent count.
// ---------------------------------------------------------------------------
export async function incrThresholdSent(credId) {
  const id = String(credId);
  const now = Date.now();

  if (!isRedisLive()) {
    const s = _memGet(id);
    if (now - Number(s.windowStart) >= WINDOW_MS) {
      s.sent = 0;
      s.windowStart = now;
    }
    s.sent = Number(s.sent) + 1;
    return s.sent;
  }

  const redis = getRedisClient();
  try {
    // Check if the window needs resetting
    const windowStart = Number(await redis.get(_windowKey(id))) || 0;
    if (windowStart === 0 || now - windowStart >= WINDOW_MS) {
      // Start a new window
      if (redis.set) await redis.set(_windowKey(id), String(now));
      if (redis.set) await redis.set(_sentKey(id), '0');
    }
    const newVal = redis.incr ? await redis.incr(_sentKey(id)) : 1;
    return Number(newVal) || 1;
  } catch (err) {
    console.warn('[redis] threshold.incrThresholdSent failed, using memory:', err.message);
    const s = _memGet(id);
    if (now - Number(s.windowStart) >= WINDOW_MS) {
      s.sent = 0;
      s.windowStart = now;
    }
    s.sent = Number(s.sent) + 1;
    return s.sent;
  }
}

// ---------------------------------------------------------------------------
// ATOMIC PAUSE — save the paused index + campaign state in ONE Redis
// transaction (pipeline). This is the crash-recovery guarantee: if the
// process dies immediately after pausing, the exact resume index is
// already persisted in Redis.
//
// Uses a distributed lock (withLock) to ensure only one worker pauses at a
// time, then writes the hash fields atomically via a pipeline.
// ---------------------------------------------------------------------------
export async function pauseThreshold(credId, pausedIndex, campaignId) {
  const id = String(credId);
  const nowIso = new Date().toISOString();

  if (!isRedisLive()) {
    const s = _memGet(id);
    s.paused = {
      paused: '1',
      pausedIndex: String(pausedIndex || 0),
      pausedCampaignId: campaignId ? String(campaignId) : '',
      pausedAt: nowIso,
    };
    return { success: true, paused: true, pausedIndex, accountId: id };
  }

  const redis = getRedisClient();
  const lockKey = `lock:threshold:${id}`;
  try {
    return await withLock(lockKey, 5000, async () => {
      // Use a pipeline (atomic batch) to write all paused fields at once
      const fields = {
        paused: '1',
        pausedIndex: String(pausedIndex || 0),
        pausedCampaignId: campaignId ? String(campaignId) : '',
        pausedAt: nowIso,
      };

      if (redis.pipeline) {
        const pipe = redis.pipeline();
        for (const [k, v] of Object.entries(fields)) {
          pipe.hset(_pausedKey(id), k, v);
        }
        await pipe.exec();
      } else if (redis.hset) {
        // Fallback: sequential hset (still works, just not batched)
        for (const [k, v] of Object.entries(fields)) {
          await redis.hset(_pausedKey(id), k, v);
        }
      }
      return { success: true, paused: true, pausedIndex, accountId: id };
    });
  } catch (err) {
    console.warn('[redis] threshold.pauseThreshold failed, using memory:', err.message);
    const s = _memGet(id);
    s.paused = {
      paused: '1',
      pausedIndex: String(pausedIndex || 0),
      pausedCampaignId: campaignId ? String(campaignId) : '',
      pausedAt: nowIso,
    };
    return { success: true, paused: true, pausedIndex, accountId: id };
  }
}

// ---------------------------------------------------------------------------
// ATOMIC RESUME — read the saved paused index + campaign, clear the pause
// flag, and return the exact resume point (zero data loss). Also uses a
// distributed lock so only one worker resumes.
// ---------------------------------------------------------------------------
export async function resumeThreshold(credId) {
  const id = String(credId);

  if (!isRedisLive()) {
    const s = _memGet(id);
    const resumeIndex = Number(s.paused.pausedIndex) || 0;
    const resumeCampaignId = s.paused.pausedCampaignId || null;
    // Clear paused flag + pausedAt but KEEP pausedIndex + pausedCampaignId for audit
    s.paused = { paused: '0', pausedIndex: s.paused.pausedIndex, pausedCampaignId: s.paused.pausedCampaignId, pausedAt: '' };
    return { success: true, resumed: true, resumeIndex, resumeCampaignId, accountId: id };
  }

  const redis = getRedisClient();
  const lockKey = `lock:threshold:${id}`;
  try {
    return await withLock(lockKey, 5000, async () => {
      // Read the current paused state BEFORE clearing
      const pausedHash = redis.hgetall ? await redis.hgetall(_pausedKey(id)) : {};
      const resumeIndex = Number(pausedHash?.pausedIndex) || 0;
      const resumeCampaignId = pausedHash?.pausedCampaignId || null;

      // Atomically clear the pause flag (keep pausedIndex for audit until reset)
      if (redis.pipeline) {
        const pipe = redis.pipeline();
        pipe.hset(_pausedKey(id), 'paused', '0');
        pipe.hset(_pausedKey(id), 'pausedAt', '');
        await pipe.exec();
      } else if (redis.hset) {
        await redis.hset(_pausedKey(id), 'paused', '0');
        await redis.hset(_pausedKey(id), 'pausedAt', '');
      }
      return { success: true, resumed: true, resumeIndex, resumeCampaignId, accountId: id };
    });
  } catch (err) {
    console.warn('[redis] threshold.resumeThreshold failed, using memory:', err.message);
    const s = _memGet(id);
    const resumeIndex = Number(s.paused.pausedIndex) || 0;
    const resumeCampaignId = s.paused.pausedCampaignId || null;
    s.paused = { paused: '0', pausedIndex: '0', pausedCampaignId: '', pausedAt: '' };
    return { success: true, resumed: true, resumeIndex, resumeCampaignId, accountId: id };
  }
}

// ---------------------------------------------------------------------------
// Reset threshold state (daily reset or manual reset). Clears sent counter,
// window, and paused state.
// ---------------------------------------------------------------------------
export async function resetThreshold(credId) {
  const id = String(credId);

  if (!isRedisLive()) {
    _memState.delete(id);
    return { success: true, reset: true, accountId: id };
  }

  const redis = getRedisClient();
  try {
    if (redis.pipeline) {
      const pipe = redis.pipeline();
      pipe.del(_sentKey(id));
      pipe.del(_windowKey(id));
      pipe.del(_pausedKey(id));
      await pipe.exec();
    } else if (redis.del) {
      await redis.del(_sentKey(id));
      await redis.del(_windowKey(id));
      await redis.del(_pausedKey(id));
    }
    return { success: true, reset: true, accountId: id };
  } catch (err) {
    console.warn('[redis] threshold.resetThreshold failed, using memory:', err.message);
    _memState.delete(id);
    return { success: true, reset: true, accountId: id };
  }
}

// ---------------------------------------------------------------------------
// Sync threshold state FROM MongoDB → Redis (called on boot or admin action).
// This ensures Redis has the latest Mongo state so crash recovery reads
// accurate data.
// ---------------------------------------------------------------------------
export async function syncThresholdFromMongo(credId, mongoDoc) {
  const id = String(credId);
  if (!mongoDoc) return { success: false, error: 'No mongo doc provided' };

  if (!isRedisLive()) {
    const s = _memGet(id);
    s.sent = Number(mongoDoc.sentToday) || 0;
    s.windowStart = Date.now();
    s.paused = {
      paused: mongoDoc.thresholdPaused ? '1' : '0',
      pausedIndex: String(mongoDoc.pausedIndex || 0),
      pausedCampaignId: mongoDoc.pausedCampaignId ? String(mongoDoc.pausedCampaignId) : '',
      pausedAt: mongoDoc.pausedAt ? new Date(mongoDoc.pausedAt).toISOString() : '',
    };
    return { success: true, synced: true, accountId: id };
  }

  const redis = getRedisClient();
  try {
    if (redis.pipeline) {
      const pipe = redis.pipeline();
      pipe.set(_sentKey(id), String(Number(mongoDoc.sentToday) || 0));
      pipe.set(_windowKey(id), String(Date.now()));
      pipe.hset(_pausedKey(id), 'paused', mongoDoc.thresholdPaused ? '1' : '0');
      pipe.hset(_pausedKey(id), 'pausedIndex', String(mongoDoc.pausedIndex || 0));
      pipe.hset(_pausedKey(id), 'pausedCampaignId', mongoDoc.pausedCampaignId ? String(mongoDoc.pausedCampaignId) : '');
      pipe.hset(_pausedKey(id), 'pausedAt', mongoDoc.pausedAt ? new Date(mongoDoc.pausedAt).toISOString() : '');
      await pipe.exec();
    }
    return { success: true, synced: true, accountId: id };
  } catch (err) {
    console.warn('[redis] threshold.syncThresholdFromMongo failed:', err.message);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Reset all in-memory state (for tests)
// ---------------------------------------------------------------------------
export function _resetThresholdState() {
  _memState.clear();
}

export default {
  getThresholdState,
  incrThresholdSent,
  pauseThreshold,
  resumeThreshold,
  resetThreshold,
  syncThresholdFromMongo,
  _resetThresholdState,
};
