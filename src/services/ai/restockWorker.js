// ============================================================================
// V7 P4.2 — Restock Worker (background, invisible, never-starve guarantee)
// ============================================================================
// One singleton worker: every 60 seconds checks pool sizes → if below LOW
// watermark, generates in batches (500-2000 per batch, budget-aware).
//
// Anti-starvation guarantee:
//   - Distributed lock (atomic.withLock) so multiple serverless instances
//     never double-restock.
//   - Worker crash → the lock auto-expires (TTL) and the next cycle reclaims.
//   - All generation wrapped in try/catch → NEVER crashes the process.
//
// Gemini API key rotation:
//   - Round-robin across all keys in the GeminiApi collection (or config).
//   - One key exhausted (429/403) → next key.
//   - All keys exhausted → cooldown + log; pool degrades gracefully (never crash).
//
// Generation prompt hardening:
//   - Output must pass JSON schema validation; discard broken outputs and
//     retry (max 3 per batch).
// ============================================================================

import { connectDB, callGemini, GeminiApi, SystemConfig } from '../../lib/core.js';
import { withLock } from '../../lib/redis/atomic.js';
import { getRedisClient, isRedisLive } from '../../lib/redis/client.js';
import {
  POOL_TYPES,
  LOW_WATERMARK,
  HIGH_WATERMARK,
  TARGET_SIZE,
  getStats,
  produceItems,
  checkAiQuota,
} from './engine.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const RESTOCK_INTERVAL_MS = 60 * 1000;   // 60s cycle
export const RESTOCK_LOCK_KEY = 'ai:restock:lock';
export const RESTOCK_LOCK_TTL_MS = 55 * 1000;   // slightly less than interval
export const MIN_BATCH = 500;
export const MAX_BATCH = 2000;
export const MAX_RETRIES = 3;
export const KEY_COOLDOWN_MS = 60 * 1000;       // 1 min cooldown per dead key
export const ALL_KEYS_COOLDOWN_MS = 5 * 60 * 1000; // 5 min when all keys dead

const SENDER_PROMPT = `Generate a JSON array of %COUNT% realistic, professional sender display names for business emails. Each name should look like a real person's full name (first + last). Vary ethnicity, gender, length. Return ONLY a JSON array of strings, no commentary. Example: ["Sarah Mitchell","James Carter","Priya Sharma"]`;
const SUBJECT_PROMPT = `Generate a JSON array of %COUNT% professional email subject lines for business/marketing emails. Each 3-8 words, varied tone (urgent, informational, friendly, formal). Return ONLY a JSON array of strings, no commentary. Example: ["Important account update","Your weekly summary is ready"]`;

// ---------------------------------------------------------------------------
// Key rotation state (in-process)
// ---------------------------------------------------------------------------
const _keyState = new Map();   // keyId -> { lastError, cooldownUntil, requestCount }
let _allKeysCooldownUntil = 0;
let _roundRobinIdx = 0;

/**
 * Load all available Gemini keys (from GeminiApi collection or SystemConfig).
 * @returns {Promise<Array<{_id:string,apiKey:string,endpoint?:string,model?:string}>>}
 */
async function loadKeys() {
  try {
    await connectDB();
    const apis = await GeminiApi.find({ status: 'active' }).sort({ requestCount: 1 }).lean();
    if (apis && apis.length > 0) {
      return apis.map((a) => ({ _id: String(a._id), apiKey: a.apiKey, endpoint: a.endpoint, model: a.model }));
    }
    // fallback: SystemConfig singleton key
    const cfg = await SystemConfig.findOne({}).lean();
    if (cfg && cfg.geminiApiKey) {
      return [{ _id: 'systemconfig', apiKey: cfg.geminiApiKey }];
    }
  } catch (err) {
    console.error(`[ai:restock] loadKeys failed: ${err.message}`);
  }
  return [];
}

/**
 * Pick the next usable key (round-robin, skip cooled-down keys).
 * @returns {Promise<object|null>}
 */
async function pickKey() {
  if (Date.now() < _allKeysCooldownUntil) return null;
  const keys = await loadKeys();
  if (keys.length === 0) return null;

  for (let i = 0; i < keys.length; i++) {
    const idx = (_roundRobinIdx + i) % keys.length;
    const k = keys[idx];
    const st = _keyState.get(k._id);
    if (st && st.cooldownUntil && Date.now() < st.cooldownUntil) continue; // cooled down
    _roundRobinIdx = (idx + 1) % keys.length;
    return k;
  }
  // all keys on cooldown → set global cooldown
  _allKeysCooldownUntil = Date.now() + ALL_KEYS_COOLDOWN_MS;
  console.warn(`[ai:restock] All Gemini keys on cooldown until ${new Date(_allKeysCooldownUntil).toISOString()}`);
  return null;
}

/**
 * Mark a key as errored (429/403) → put it on cooldown.
 */
function markKeyError(keyId, status) {
  const st = _keyState.get(keyId) || { lastError: null, cooldownUntil: 0, requestCount: 0 };
  st.lastError = status || 'error';
  st.cooldownUntil = Date.now() + KEY_COOLDOWN_MS;
  _keyState.set(keyId, st);
}

function markKeyOk(keyId) {
  const st = _keyState.get(keyId) || { lastError: null, cooldownUntil: 0, requestCount: 0 };
  st.lastError = null;
  st.cooldownUntil = 0;
  st.requestCount = (st.requestCount || 0) + 1;
  _keyState.set(keyId, st);
}

// ---------------------------------------------------------------------------
// JSON schema validation for generated output
// ---------------------------------------------------------------------------

/**
 * Validate + parse the Gemini output as a JSON array of non-empty strings.
 * Returns { ok, items } or { ok:false, error }.
 */
function validateGeneratedArray(raw, maxCount) {
  if (!raw || typeof raw !== 'string') return { ok: false, error: 'empty response' };
  let trimmed = raw.trim();
  // strip markdown code fences if present
  if (trimmed.startsWith('```')) {
    trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  // find the first [ and last ] to extract the JSON array
  const start = trimmed.indexOf('[');
  const end = trimmed.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    return { ok: false, error: 'no JSON array found' };
  }
  let arr;
  try {
    arr = JSON.parse(trimmed.slice(start, end + 1));
  } catch (err) {
    return { ok: false, error: `JSON parse failed: ${err.message}` };
  }
  if (!Array.isArray(arr)) return { ok: false, error: 'not an array' };
  const items = arr
    .filter((x) => typeof x === 'string' && x.trim().length > 0)
    .map((x) => x.trim())
    .slice(0, maxCount);
  if (items.length === 0) return { ok: false, error: 'no valid string items' };
  return { ok: true, items };
}

// ---------------------------------------------------------------------------
// Generate a batch via Gemini (with key rotation + retry)
// ---------------------------------------------------------------------------

/**
 * Generate `count` items for a pool type via Gemini.
 * @param {'sender'|'subject'} type
 * @param {number} count
 * @returns {Promise<{items:string[], source:string, error?:string}>}
 */
export async function generateBatch(type, count) {
  const promptTemplate = type === POOL_TYPES.SENDER ? SENDER_PROMPT : SUBJECT_PROMPT;
  const prompt = promptTemplate.replace('%COUNT%', String(count));

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const key = await pickKey();
    if (!key) {
      return { items: [], source: 'none', error: 'No Gemini key available (all on cooldown)' };
    }

    try {
      const geminiApi = {
        _id: key._id,
        apiKey: key.apiKey,
        endpoint: key.endpoint || 'https://generativelanguage.googleapis.com/v1beta/models',
        model: key.model || 'gemini-1.5-flash',
      };
      const result = await callGemini(geminiApi, prompt, { temperature: 0.9, maxOutputTokens: 2048 });
      if (!result || !result.ok || !result.text) {
        // could be 429/403 handled inside callGemini → check lastError
        if (result && (result.status === 429 || result.status === 403)) {
          markKeyError(key._id, result.status);
          continue; // try next key
        }
        // other failure → retry same/different key
        continue;
      }
      const parsed = validateGeneratedArray(result.text, count);
      if (parsed.ok) {
        markKeyOk(key._id);
        return { items: parsed.items, source: 'gemini' };
      }
      // validation failed → retry
      continue;
    } catch (err) {
      const msg = String(err.message || err);
      if (msg.includes('429') || msg.includes('403') || msg.includes('quota')) {
        markKeyError(key._id, msg);
      }
      // retry with next key
      continue;
    }
  }
  return { items: [], source: 'none', error: `All ${MAX_RETRIES} retries failed` };
}

// ---------------------------------------------------------------------------
// Restock cycle (the core logic)
// ---------------------------------------------------------------------------

/**
 * Compute how many items to generate to bring a pool from its current size
 * up toward the HIGH watermark (but never above TARGET).
 */
function computeBatchNeeded(currentSize) {
  if (currentSize >= HIGH_WATERMARK) return 0;
  const needed = HIGH_WATERMARK - currentSize;
  return Math.min(Math.max(MIN_BATCH, Math.ceil(needed / 10)), MAX_BATCH);
}

let _lastRunAt = 0;
let _lastRunResult = { sender: 0, subject: 0, error: null };

export { computeBatchNeeded, validateGeneratedArray };

/**
 * Run one restock cycle. Checks both pools; if below LOW watermark, generates
 * a batch and pushes. Wrapped in a distributed lock so only one instance
// restocks at a time. NEVER throws.
 *
 * @param {object} opts  { aiQuota:number } from package config (P5)
 * @returns {Promise<{sender:number,subject:number,error:string|null}>}
 */
export async function runRestockCycle(opts = {}) {
  const aiQuota = opts.aiQuota || 0; // 0 = unlimited

  const lockRes = await withLock(RESTOCK_LOCK_KEY, RESTOCK_LOCK_TTL_MS, async () => {
    const stats = await getStats();
    const result = { sender: 0, subject: 0, error: null };

    // Sender pool
    if (stats.senderLow) {
      const batch = computeBatchNeeded(stats.sender);
      if (batch > 0) {
        const quotaOk = await checkAiQuota(aiQuota);
        if (quotaOk) {
          const gen = await generateBatch(POOL_TYPES.SENDER, batch);
          if (gen.items.length > 0) {
            result.sender = await produceItems(POOL_TYPES.SENDER, gen.items);
          } else if (gen.error) {
            result.error = gen.error;
            console.warn(`[ai:restock] sender generation degraded: ${gen.error}`);
          }
        } else {
          result.error = 'AI quota exhausted';
          console.warn('[ai:restock] sender restock skipped — AI quota exhausted');
        }
      }
    }

    // Subject pool
    if (stats.subjectLow) {
      const batch = computeBatchNeeded(stats.subject);
      if (batch > 0) {
        const quotaOk = await checkAiQuota(aiQuota);
        if (quotaOk) {
          const gen = await generateBatch(POOL_TYPES.SUBJECT, batch);
          if (gen.items.length > 0) {
            result.subject = await produceItems(POOL_TYPES.SUBJECT, gen.items);
          } else if (gen.error && !result.error) {
            result.error = gen.error;
            console.warn(`[ai:restock] subject generation degraded: ${gen.error}`);
          }
        } else if (!result.error) {
          result.error = 'AI quota exhausted';
        }
      }
    }

    return result;
  });

  _lastRunAt = Date.now();
  _lastRunResult = (lockRes && lockRes.acquired) ? lockRes.result : { sender: 0, subject: 0, error: 'LOCK_BUSY' };
  return _lastRunResult;
}

/**
 * Get the last restock run info (for observability / health endpoint).
 */
export function getRestockStatus() {
  return {
    lastRunAt: _lastRunAt || null,
    lastRunResult: _lastRunResult,
    intervalMs: RESTOCK_INTERVAL_MS,
    keyCooldownMs: KEY_COOLDOWN_MS,
    allKeysCooldownUntil: _allKeysCooldownUntil > Date.now() ? _allKeysCooldownUntil : null,
    keyState: Array.from(_keyState.entries()).map(([id, st]) => ({
      keyId: id,
      lastError: st.lastError,
      cooldownUntil: st.cooldownUntil > Date.now() ? st.cooldownUntil : null,
      requestCount: st.requestCount || 0,
    })),
  };
}

// ---------------------------------------------------------------------------
// Singleton worker loop
// ---------------------------------------------------------------------------
let _timer = null;
let _running = false;

/**
 * Start the singleton restock worker. Safe to call multiple times (idempotent).
 * @param {object} opts  { intervalMs?:number, aiQuota?:number }
 */
export function startRestockWorker(opts = {}) {
  if (_timer) return; // already running
  const interval = opts.intervalMs || RESTOCK_INTERVAL_MS;
  const aiQuota = opts.aiQuota || 0;

  const tick = async () => {
    if (_running) return; // skip overlap
    _running = true;
    try {
      await runRestockCycle({ aiQuota });
    } catch (err) {
      console.error(`[ai:restock] worker tick crashed (caught): ${err.message}`);
    } finally {
      _running = false;
    }
  };

  // run immediately, then on interval
  tick();
  _timer = setInterval(tick, interval);
  // unref so the timer doesn't keep the process alive in tests
  if (typeof _timer.unref === 'function') _timer.unref();
  console.log(`[ai:restock] worker started (interval=${interval}ms)`);
}

/**
 * Stop the restock worker (for tests / shutdown).
 */
export function stopRestockWorker() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
    console.log('[ai:restock] worker stopped');
  }
}

export default {
  RESTOCK_INTERVAL_MS,
  generateBatch,
  runRestockCycle,
  getRestockStatus,
  startRestockWorker,
  stopRestockWorker,
  validateGeneratedArray,
  computeBatchNeeded,
};
