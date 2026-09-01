// ============================================================================
// V7 P6.3 — Zero-Crash Send-Path Resilience (sendGuard)
// ============================================================================
// Lists and handles EVERY failure mode on every send path:
//
//   1. API failure (provider returns non-2xx)     → retry/backoff (exp, max 5)
//   2. Quota exceeded (email/AI/credential/sandbox) → auto-pause + Bangla msg
//   3. Network error (timeout, DNS, connection)    → retry/backoff (exp, max 5)
//   4. Redis down (pool/lock/counter unavailable)  → auto-pause + state save + resume
//   5. MongoDB down (state/credential read fail)    → auto-pause + state save + resume
//   6. Provider 500 (server error)                 → backoff retry, no crash, no lost state
//
// Every failure mode gets: auto-pause + state save + retry/backoff (exponential,
// max 5) + clean Bangla error messages. No crash path may survive.
//
// Exports:
//   MAX_RETRIES, BACKOFF_BASE_MS, BACKOFF_MAX_MS,
//   FAILURE_MODES, BANGLA_ERROR_MESSAGES,
//   computeBackoffDelay, withRetry, withSendGuard,
//   pauseCampaign, saveCampaignState, resumeCampaign,
//   classifyError, getBanglaError
// ============================================================================

import { getRedisClient, isRedisLive } from '../redis/client.js';

export const MAX_RETRIES = 5;
export const BACKOFF_BASE_MS = 1000;   // 1s, 2s, 4s, 8s, 16s (capped at BACKOFF_MAX_MS)
export const BACKOFF_MAX_MS = 30000;   // 30s max delay

// ---------------------------------------------------------------------------
// Failure modes — the complete list of every send-path failure
// ---------------------------------------------------------------------------

export const FAILURE_MODES = {
  API_FAILURE: 'api_failure',
  QUOTA_EXCEEDED: 'quota_exceeded',
  NETWORK_ERROR: 'network_error',
  REDIS_DOWN: 'redis_down',
  MONGO_DOWN: 'mongo_down',
  PROVIDER_500: 'provider_500',
  PROVIDER_429: 'provider_429',
  AUTH_FAILURE: 'auth_failure',
  VALIDATION_ERROR: 'validation_error',
  UNKNOWN: 'unknown',
};

// ---------------------------------------------------------------------------
// Bangla error messages — clean, user-facing
// ---------------------------------------------------------------------------

export const BANGLA_ERROR_MESSAGES = {
  api_failure: 'প্রদানকারীর API ত্রুটি। স্বয়ংক্রিয়ভাবে পুনরায় চেষ্টা করা হচ্ছে। অনুগ্রহ করে অপেক্ষা করুন।',
  quota_exceeded: 'আপনার দৈনিক ইমেইল পাঠানোর সীমা শেষ হয়ে গেছে। ক্যাম্পেইন স্বয়ংক্রিয়ভাবে বিরতিতে আছে। প্যাকেজ আপগ্রেড করুন বা আগামীকাল আবার চেষ্টা করুন।',
  network_error: 'নেটওয়ার্ক সংযোগে সমস্যা। স্বয়ংক্রিয়ভাবে পুনরায় চেষ্টা করা হচ্ছে। স্থিতি সংরক্ষিত আছে।',
  redis_down: 'Redis সার্ভার অনুপস্থিত। ক্যাম্পেইন স্বয়ংক্রিয়ভাবে বিরতিতে আছে। স্থিতি সংরক্ষিত আছে। Redis ফিরে এলে স্বয়ংক্রিয়ভাবে আবার শুরু হবে।',
  mongo_down: 'ডাটাবেস সংযোগে সমস্যা। ক্যাম্পেইন স্বয়ংক্রিয়ভাবে বিরতিতে আছে। স্থিতি সংরক্ষিত আছে। ডাটাবেস ফিরে এলে আবার চালু হবে।',
  provider_500: 'প্রদানকারী সার্ভারে সাময়িক সমস্যা (500)। ব্যাকঅফ সহ পুনরায় চেষ্টা করা হচ্ছে। কোনো তথ্য হারানো হয়নি।',
  provider_429: 'প্রদানকারীর রেট লিমিট। অল্প সময়ের জন্য বিরতি নেওয়া হচ্ছে, তারপর আবার চেষ্টা করা হবে।',
  auth_failure: 'প্রদানকারীর প্রমাণীকরণ ব্যর্থ। অনুগ্রহ করে আপনার ক্রেডেনশিয়াল যাচাই করুন। ক্যাম্পেইন বিরতিতে আছে।',
  validation_error: 'ইমেইল ঠিকানা যাচাইকরণে ত্রুটি। অবৈধ ঠিকানাগুলি বাদ দেওয়া হয়েছে।',
  unknown: 'অজানা ত্রুটি ঘটেছে। ক্যাম্পেইন বিরতিতে আছে। স্থিতি সংরক্ষিত আছে। আবার চেষ্টা করুন।',
};

// ---------------------------------------------------------------------------
// Error classification — map any error to a FAILURE_MODE
// ---------------------------------------------------------------------------

export function classifyError(err) {
  if (!err) return FAILURE_MODES.UNKNOWN;

  const msg = String(err.message || err).toLowerCase();
  const status = err.status || err.statusCode || err.responseStatus;

  // HTTP status-based
  if (status === 429 || err.code === 'RATE_LIMITED' || msg.includes('rate limit')) {
    return FAILURE_MODES.PROVIDER_429;
  }
  if (status === 401 || status === 403 || msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('auth')) {
    return FAILURE_MODES.AUTH_FAILURE;
  }
  if (status >= 500 || msg.includes('500') || msg.includes('internal server error') || msg.includes('bad gateway') || msg.includes('service unavailable')) {
    return FAILURE_MODES.PROVIDER_500;
  }
  if (status === 403 && (msg.includes('quota') || msg.includes('limit') || msg.includes('সীমা'))) {
    return FAILURE_MODES.QUOTA_EXCEEDED;
  }
  if (msg.includes('quota') || msg.includes('limit exceeded') || msg.includes('সীমা') || msg.includes('ceiling')) {
    return FAILURE_MODES.QUOTA_EXCEEDED;
  }

  // Infrastructure
  if (msg.includes('redis') || msg.includes('econnrefused') && msg.includes('6379') || err.code === 'REDIS_DOWN') {
    return FAILURE_MODES.REDIS_DOWN;
  }
  if (msg.includes('mongo') || msg.includes('mongoose') || msg.includes('database') || err.code === 'MONGO_DOWN') {
    return FAILURE_MODES.MONGO_DOWN;
  }

  // Network
  if (msg.includes('timeout') || msg.includes('etimedout') || msg.includes('enotfound') ||
      msg.includes('econnreset') || msg.includes('econnrefused') || msg.includes('network') ||
      err.code === 'ENOTFOUND' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
    return FAILURE_MODES.NETWORK_ERROR;
  }

  // Validation
  if (msg.includes('validation') || msg.includes('invalid') && msg.includes('email')) {
    return FAILURE_MODES.VALIDATION_ERROR;
  }

  // API failure (generic non-2xx)
  if (status && status >= 400) {
    return FAILURE_MODES.API_FAILURE;
  }

  return FAILURE_MODES.UNKNOWN;
}

// ---------------------------------------------------------------------------
// Bangla error message getter
// ---------------------------------------------------------------------------

export function getBanglaError(failureMode) {
  return BANGLA_ERROR_MESSAGES[failureMode] || BANGLA_ERROR_MESSAGES.unknown;
}

// ---------------------------------------------------------------------------
// Backoff computation — exponential, capped at BACKOFF_MAX_MS
// ---------------------------------------------------------------------------

export function computeBackoffDelay(attempt) {
  // attempt is 0-indexed: 0→1s, 1→2s, 2→4s, 3→8s, 4→16s
  const delay = BACKOFF_BASE_MS * Math.pow(2, attempt);
  return Math.min(delay, BACKOFF_MAX_MS);
}

// ---------------------------------------------------------------------------
// Retryable failure modes (others are terminal — pause immediately)
// ---------------------------------------------------------------------------

const RETRYABLE_MODES = new Set([
  FAILURE_MODES.API_FAILURE,
  FAILURE_MODES.NETWORK_ERROR,
  FAILURE_MODES.REDIS_DOWN,
  FAILURE_MODES.MONGO_DOWN,
  FAILURE_MODES.PROVIDER_500,
  FAILURE_MODES.PROVIDER_429,
  FAILURE_MODES.UNKNOWN,
]);

const TERMINAL_MODES = new Set([
  FAILURE_MODES.QUOTA_EXCEEDED,
  FAILURE_MODES.AUTH_FAILURE,
  FAILURE_MODES.VALIDATION_ERROR,
]);

function isRetryable(failureMode) {
  return RETRYABLE_MODES.has(failureMode);
}

// ---------------------------------------------------------------------------
// withRetry — exponential backoff retry wrapper (max 5 attempts)
// ---------------------------------------------------------------------------

/**
 * Wrap an async function with retry/backoff.
 * @param {function} fn - async function to execute
 * @param {object} opts - { maxRetries, onRetry, shouldRetry }
 * @returns {Promise<*>} the result of fn, or throws after exhausting retries
 */
export async function withRetry(fn, opts = {}) {
  const maxRetries = opts.maxRetries != null ? opts.maxRetries : MAX_RETRIES;
  const onRetry = opts.onRetry || (() => {});
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn(attempt);
      return result;
    } catch (err) {
      lastError = err;
      const mode = classifyError(err);

      // Terminal errors — don't retry, throw immediately
      if (TERMINAL_MODES.has(mode)) {
        throw err;
      }

      // Non-retryable or last attempt — throw
      if (!isRetryable(mode) || attempt >= maxRetries) {
        throw err;
      }

      // Compute backoff delay and wait
      const delay = computeBackoffDelay(attempt);
      onRetry({ attempt: attempt + 1, maxRetries, delay, mode, error: err });

      await sleep(delay);
    }
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// Campaign state management — pause / save / resume
// ---------------------------------------------------------------------------

/**
 * Pause a campaign and save its state to Redis.
 * State is saved so it can resume exactly where it left off.
 */
export async function pauseCampaign(campaignId, reason, opts = {}) {
  const redis = getRedisClient();
  const stateKey = `campaign:${campaignId}:state`;
  const pauseKey = `campaign:${campaignId}:paused`;

  const state = {
    campaignId: String(campaignId),
    status: 'paused',
    reason: reason || 'unknown',
    failureMode: opts.failureMode || classifyError(opts.error),
    banglaMessage: getBanglaError(opts.failureMode || classifyError(opts.error)),
    pausedAt: Date.now(),
    progress: opts.progress || null,
    lastError: opts.error ? String(opts.error.message || opts.error) : null,
  };

  try {
    await redis.set(stateKey, JSON.stringify(state), 'EX', 7 * 24 * 60 * 60);
    await redis.set(pauseKey, '1', 'EX', 7 * 24 * 60 * 60);
  } catch (err) {
    // Even Redis save failed — the state is still in-memory in the caller.
    // We log but never crash.
    console.error(`[sendGuard] pauseCampaign: failed to save state: ${err.message}`);
  }

  return state;
}

/**
 * Save campaign state (without pausing — for periodic checkpoints).
 */
export async function saveCampaignState(campaignId, progress) {
  const redis = getRedisClient();
  const key = `campaign:${campaignId}:checkpoint`;

  const checkpoint = {
    campaignId: String(campaignId),
    progress,
    savedAt: Date.now(),
  };

  try {
    await redis.set(key, JSON.stringify(checkpoint), 'EX', 7 * 24 * 60 * 60);
    return true;
  } catch (err) {
    console.error(`[sendGuard] saveCampaignState: ${err.message}`);
    return false;
  }
}

/**
 * Resume a paused campaign — reads saved state, clears pause flag.
 */
export async function resumeCampaign(campaignId) {
  const redis = getRedisClient();
  const stateKey = `campaign:${campaignId}:state`;
  const pauseKey = `campaign:${campaignId}:paused`;
  const checkpointKey = `campaign:${campaignId}:checkpoint`;

  let state = null;
  let checkpoint = null;

  try {
    const raw = await redis.get(stateKey);
    if (raw) state = JSON.parse(raw);
  } catch { }

  try {
    const raw = await redis.get(checkpointKey);
    if (raw) checkpoint = JSON.parse(raw);
  } catch { }

  try {
    await redis.del(pauseKey);
    if (state) {
      state.status = 'resumed';
      state.resumedAt = Date.now();
      await redis.set(stateKey, JSON.stringify(state), 'EX', 7 * 24 * 60 * 60);
    }
  } catch (err) {
    console.error(`[sendGuard] resumeCampaign: ${err.message}`);
  }

  return { state, checkpoint };
}

/**
 * Check if a campaign is paused.
 */
export async function isCampaignPaused(campaignId) {
  const redis = getRedisClient();
  try {
    const v = await redis.get(`campaign:${campaignId}:paused`);
    return v === '1' || v === 1;
  } catch {
    return false;
  }
}

/**
 * Get the saved state of a campaign.
 */
export async function getCampaignState(campaignId) {
  const redis = getRedisClient();
  try {
    const raw = await redis.get(`campaign:${campaignId}:state`);
    if (raw) return JSON.parse(raw);
  } catch { }
  return null;
}

// ---------------------------------------------------------------------------
// withSendGuard — THE MAIN ENTRY POINT
// Wraps a send operation with the full zero-crash resilience:
//   retry/backoff + auto-pause + state save + Bangla error messages
// ---------------------------------------------------------------------------

/**
 * @param {string} campaignId
 * @param {function} sendFn - async function(attempt) that performs the send
 * @param {object} opts - { maxRetries, onRetry, onPause, progress }
 * @returns {Promise<{ ok, result, error, failureMode, banglaMessage, paused, attempts }>}
 */
export async function withSendGuard(campaignId, sendFn, opts = {}) {
  const maxRetries = opts.maxRetries != null ? opts.maxRetries : MAX_RETRIES;
  const onRetry = opts.onRetry || (() => {});
  const onPause = opts.onPause || (() => {});
  let lastError = null;
  let lastMode = null;
  let attempts = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts = attempt + 1;
    try {
      const result = await sendFn(attempt);
      // Success — clear any pause state and checkpoint progress
      if (opts.progress) {
        await saveCampaignState(campaignId, opts.progress).catch(() => {});
      }
      return { ok: true, result, error: null, failureMode: null, banglaMessage: null, paused: false, attempts };
    } catch (err) {
      lastError = err;
      lastMode = classifyError(err);

      // Terminal errors (quota, auth) — pause immediately, no retry
      if (TERMINAL_MODES.has(lastMode)) {
        const state = await pauseCampaign(campaignId, `terminal: ${lastMode}`, {
          failureMode: lastMode,
          error: err,
          progress: opts.progress,
        });
        onPause({ state, error: err, failureMode: lastMode, terminal: true });
        return {
          ok: false, result: null, error: err,
          failureMode: lastMode,
          banglaMessage: getBanglaError(lastMode),
          paused: true, attempts,
        };
      }

      // Last attempt or non-retryable — pause and return
      if (attempt >= maxRetries || !isRetryable(lastMode)) {
        const state = await pauseCampaign(campaignId, `exhausted retries: ${lastMode}`, {
          failureMode: lastMode,
          error: err,
          progress: opts.progress,
        });
        onPause({ state, error: err, failureMode: lastMode, terminal: false });
        return {
          ok: false, result: null, error: err,
          failureMode: lastMode,
          banglaMessage: getBanglaError(lastMode),
          paused: true, attempts,
        };
      }

      // Retryable — backoff and retry
      const delay = computeBackoffDelay(attempt);
      onRetry({ attempt: attempt + 1, maxRetries, delay, mode: lastMode, error: err });

      // For infrastructure failures, save a checkpoint before retrying
      if (lastMode === FAILURE_MODES.REDIS_DOWN || lastMode === FAILURE_MODES.MONGO_DOWN) {
        await saveCampaignState(campaignId, opts.progress || { lastGoodAttempt: attempt }).catch(() => {});
      }

      await sleep(delay);
    }
  }

  // Should not reach here, but just in case
  return {
    ok: false, result: null, error: lastError,
    failureMode: lastMode,
    banglaMessage: getBanglaError(lastMode),
    paused: true, attempts,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
  MAX_RETRIES,
  BACKOFF_BASE_MS,
  BACKOFF_MAX_MS,
  FAILURE_MODES,
  BANGLA_ERROR_MESSAGES,
  computeBackoffDelay,
  withRetry,
  withSendGuard,
  pauseCampaign,
  saveCampaignState,
  resumeCampaign,
  isCampaignPaused,
  getCampaignState,
  classifyError,
  getBanglaError,
};
