// ============================================================================
// MODULE 3: Advanced Omnichannel Round-Robin Queue Engine
// ============================================================================
// Target: Flawless Account Rotation & IP Protection
// Algorithm: Weighted Round-Robin & Token Bucket Rate Limiting
//
// Core Logic:
//   1. BullMQ + Redis as the core background job processor.
//   2. Mutex Locks (Semaphore) during account rotation to prevent race
//      conditions when multiple workers fetch the next available account.
//   3. Queue rotates between: Gmail (OAuth2), MS Graph API, Enterprise SMTP.
//   4. Token Bucket algorithm to enforce admin-defined daily limits per account.
//   5. Asynchronous setTimeout / BullMQ delayed job to enforce the exact
//      admin-defined micro-delay (e.g. 3000ms) between dispatches.
//
// NON-DESTRUCTIVE: brand-new service module. Reuses EmailAccount model +
// Redis mutex + dynamic config. Does not modify existing code.
// ============================================================================

import { Queue, Worker } from 'bullmq';
import { connectDB, EmailAccount, SystemConfig, logActivity } from '@/lib/core';
import { getRedis, acquireMutex, getDynamicConfig, setDynamicConfig, incrMetric, cacheGet, cacheSet } from '@/lib/redis';
import {
  ROUND_ROBIN_CONFIG,
  TOKEN_BUCKET_CONFIG,
  PROVIDER_WEIGHTS,
  DYNAMIC_CONFIG_KEYS,
  CIRCUIT_BREAKER_CONFIG,
} from '@/lib/gateway/constants';

// ---------------------------------------------------------------------------
// Queue + Worker singletons (lazily created)
// ---------------------------------------------------------------------------
let _queue = null;
let _worker = null;

// The dispatch handler — set by prepareMms.js or the dispatch route. This
// decouples the queue engine from the actual send logic so the queue can be
// tested/started independently.
let _dispatchHandler = null;

export function setDispatchHandler(handler) {
  _dispatchHandler = handler;
}

export function getQueue() {
  if (!_queue) {
    const connection = getRedis();
    _queue = new Queue(ROUND_ROBIN_CONFIG.queueName, {
      connection,
      defaultJobOptions: {
        attempts: ROUND_ROBIN_CONFIG.maxRetries,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }
  return _queue;
}

// ---------------------------------------------------------------------------
// MODULE 3.2: Weighted Round-Robin Account Selection
// ---------------------------------------------------------------------------
// getNextAvailableAccount():
//   Acquires a mutex lock (semaphore) to prevent race conditions when
//   multiple workers fetch the next sender account simultaneously.
//
//   Selection criteria (all must pass):
//     1. status === 'ACTIVE' (not COOLDOWN / SUSPENDED)
//     2. sentToday < dailyLimit (token bucket not exhausted)
//     3. circuit breaker state is CLOSED or HALF_OPEN (not OPEN)
//
//   Weighted selection:
//     Each account gets a weight from PROVIDER_WEIGHTS based on its provider
//     type. Accounts that were used least recently are preferred (LRU tiebreak).
//
//   Returns the selected EmailAccount document (with credentials), or null
//   if no account is available.
// ---------------------------------------------------------------------------
export async function getNextAvailableAccount() {
  const release = await acquireMutex('account_rotation', 10000);
  if (!release) {
    // Another worker is rotating — wait briefly and retry once.
    await sleep(500);
    const retryRelease = await acquireMutex('account_rotation', 10000);
    if (!retryRelease) {
      // Still locked — return null so the job retries later.
      return null;
    }
    try {
      return await selectAccountUnderLock();
    } finally {
      await retryRelease();
    }
  }

  try {
    return await selectAccountUnderLock();
  } finally {
    await release();
  }
}

// The actual selection logic — runs while holding the mutex.
async function selectAccountUnderLock() {
  await connectDB();
  const now = new Date();

  // Fetch all accounts that are potentially usable.
  const accounts = await EmailAccount.find({
    status: 'ACTIVE',
  }).lean();

  // Filter to accounts that are actually usable right now.
  const usable = [];
  for (const acc of accounts) {
    // Check cooldown expiry (if cooldownUntil has passed, treat as active).
    if (acc.cooldownUntil && new Date(acc.cooldownUntil) > now) {
      continue;
    }
    // Check daily limit (token bucket).
    const dailyLimit = await getEffectiveDailyLimit(acc);
    if ((acc.sentToday || 0) >= dailyLimit) {
      continue;
    }
    // Check circuit breaker state in Redis (if open, skip).
    const cbState = await getCircuitBreakerState(acc._id.toString());
    if (cbState === 'OPEN') {
      continue;
    }
    usable.push(acc);
  }

  if (usable.length === 0) {
    return null;
  }

  // Weighted selection: build a weighted pool and pick randomly.
  // Weight = provider weight × (1 / (sentToday + 1)) — less-used accounts
  // get a higher effective weight so load is distributed fairly.
  const weightedPool = [];
  for (const acc of usable) {
    const providerWeight = PROVIDER_WEIGHTS[acc.provider] || 1;
    const usageFactor = 1 / ((acc.sentToday || 0) + 1);
    const weight = Math.max(1, Math.round(providerWeight * usageFactor * 10));
    for (let i = 0; i < weight; i++) {
      weightedPool.push(acc);
    }
  }

  const selected = weightedPool[Math.floor(Math.random() * weightedPool.length)];

  // Atomically increment sentToday + update lastUsedAt (under the mutex).
  await EmailAccount.findByIdAndUpdate(selected._id, {
    $inc: { sentToday: 1 },
    $set: { lastUsedAt: new Date(), updatedAt: new Date() },
  });

  // Re-fetch to get the updated document with credentials.
  const updated = await EmailAccount.findById(selected._id).lean();

  return updated;
}

// ---------------------------------------------------------------------------
// MODULE 3.4: Token Bucket Rate Limiting
// ---------------------------------------------------------------------------
// checkTokenBucket(accountId):
//   Implements a Token Bucket algorithm to enforce admin-defined daily limits
//   per account. The bucket has:
//     • capacity = burst size (TOKEN_BUCKET_CONFIG.capacity)
//     • refillRate = tokens added per second (derived from daily limit)
//
//   Returns { allowed, tokensRemaining, reason }
// ---------------------------------------------------------------------------
export async function checkTokenBucket(accountId) {
  const bucketKey = `tokenbucket:${accountId}`;
  const cached = await cacheGet(bucketKey);

  let tokens;
  let lastRefill;

  if (cached) {
    tokens = cached.tokens;
    lastRefill = cached.lastRefill;
  } else {
    // Initialize the bucket at full capacity.
    tokens = TOKEN_BUCKET_CONFIG.capacity;
    lastRefill = Date.now();
  }

  // Refill tokens based on elapsed time.
  const now = Date.now();
  const elapsedSeconds = (now - lastRefill) / 1000;
  const account = await EmailAccount.findById(accountId).lean();
  const dailyLimit = await getEffectiveDailyLimit(account);
  const refillPerSecond = dailyLimit / (24 * 60 * 60); // tokens per second

  tokens = Math.min(TOKEN_BUCKET_CONFIG.capacity, tokens + elapsedSeconds * refillPerSecond);

  if (tokens >= 1) {
    // Consume one token.
    tokens -= 1;
    await cacheSet(bucketKey, { tokens, lastRefill: now }, 86400); // 24h TTL
    return { allowed: true, tokensRemaining: tokens, reason: null };
  } else {
    await cacheSet(bucketKey, { tokens, lastRefill: now }, 86400);
    return { allowed: false, tokensRemaining: 0, reason: 'Token bucket exhausted (rate limit)' };
  }
}

// ---------------------------------------------------------------------------
// MODULE 3.5: Delay Enforcement
// ---------------------------------------------------------------------------
// enforceDelay(accountId):
//   Enforces the exact admin-defined micro-delay between dispatches.
//   The delay is read from Redis dynamic config (admin can change without
//   restart) → falls back to SystemConfig.routingDelaySeconds → default.
//
//   Uses a per-account last-send timestamp in Redis to compute the wait.
// ---------------------------------------------------------------------------
export async function enforceDelay(accountId) {
  const delayMs = await getEffectiveDelayMs();
  if (delayMs <= 0) return;

  const lastSendKey = `lastsend:${accountId}`;
  const lastSend = await cacheGet(lastSendKey);
  const now = Date.now();

  if (lastSend) {
    const elapsed = now - lastSend;
    const wait = delayMs - elapsed;
    if (wait > 0) {
      await sleep(wait);
    }
  }

  // Record this send time for the next delay calculation.
  await cacheSet(lastSendKey, Date.now(), 86400);
}

// ---------------------------------------------------------------------------
// Dynamic config resolvers — read from Redis (runtime) → Mongo (SystemConfig)
// ---------------------------------------------------------------------------
async function getEffectiveDelayMs() {
  try {
    const dyn = await getDynamicConfig(DYNAMIC_CONFIG_KEYS.routingDelayMs, null);
    if (dyn !== null) return Number(dyn);
  } catch (_e) {}
  try {
    await connectDB();
    const cfg = await SystemConfig.findOne({}).lean() || {};
    return (cfg.routingDelaySeconds || 3) * 1000;
  } catch (_e) {
    return ROUND_ROBIN_CONFIG.defaultDelayMs;
  }
}

async function getEffectiveDailyLimit(account) {
  // Per-account limit takes priority, then dynamic global config, then default.
  if (account?.dailyLimit && account.dailyLimit > 0) {
    return account.dailyLimit;
  }
  try {
    const dyn = await getDynamicConfig(DYNAMIC_CONFIG_KEYS.batchSizePerAccount, null);
    if (dyn !== null) return Number(dyn) * 1; // not used as daily, but as fallback
  } catch (_e) {}
  return TOKEN_BUCKET_CONFIG.defaultDailyLimit;
}

async function getEffectiveConcurrency() {
  try {
    const dyn = await getDynamicConfig(DYNAMIC_CONFIG_KEYS.maxConcurrency, null);
    if (dyn !== null) return Number(dyn);
  } catch (_e) {}
  return ROUND_ROBIN_CONFIG.maxConcurrency;
}

// ---------------------------------------------------------------------------
// Circuit Breaker state helper (read from Redis — set by circuitBreaker.js)
// ---------------------------------------------------------------------------
async function getCircuitBreakerState(accountId) {
  const stateKey = `circuit:${accountId}:state`;
  try {
    const state = await cacheGet(stateKey);
    return state || 'CLOSED';
  } catch (_e) {
    return 'CLOSED';
  }
}

// ---------------------------------------------------------------------------
// MODULE 3.1: BullMQ Worker — processes jobs from the queue
// ---------------------------------------------------------------------------
// Each job contains: { phoneNumber, text, mediaUrl, campaignId, userId, actorContext }
//
// The worker:
//   1. Gets the next available account (weighted round-robin + mutex)
//   2. Checks the token bucket (rate limit)
//   3. Enforces the micro-delay
//   4. Calls the dispatch handler (set by prepareMms.js) to send the email
//   5. Records the result + updates metrics
// ---------------------------------------------------------------------------
export function startWorker() {
  if (_worker) return _worker;

  const connection = getRedis();
  const concurrency = 1; // start conservative; can be raised via dynamic config

  _worker = new Worker(
    ROUND_ROBIN_CONFIG.queueName,
    async (job) => {
      const { phoneNumber, text, mediaUrl, campaignId, userId, actorContext } = job.data;

      // Check if the queue is paused (admin can pause without restart).
      const paused = await getDynamicConfig(DYNAMIC_CONFIG_KEYS.queuePaused, false);
      if (paused) {
        // Move the job back to delayed — retry in 30 seconds.
        await job.moveToDelayed(Date.now() + 30000, job.token);
        throw new Error('Queue is paused — job delayed');
      }

      // ── Step 1: Get next available account (weighted round-robin + mutex) ──
      const account = await getNextAvailableAccount();
      if (!account) {
        // No account available — delay the job for 60s and retry.
        await job.moveToDelayed(Date.now() + 60000, job.token);
        await incrMetric('jobs_no_account');
        throw new Error('No available email account — job delayed 60s');
      }

      // ── Step 2: Token bucket check ──
      const bucket = await checkTokenBucket(account._id.toString());
      if (!bucket.allowed) {
        // Rate limited — delay and retry.
        await job.moveToDelayed(Date.now() + 10000, job.token);
        throw new Error(`Token bucket exhausted for ${account.email}: ${bucket.reason}`);
      }

      // ── Step 3: Enforce micro-delay ──
      await enforceDelay(account._id.toString());

      // ── Step 4: Dispatch (via the registered handler) ──
      if (!_dispatchHandler) {
        throw new Error('No dispatch handler registered — call setDispatchHandler() first');
      }

      const result = await _dispatchHandler({
        account,
        phoneNumber,
        text,
        mediaUrl,
        campaignId,
        userId,
        actorContext,
      });

      // ── Step 5: Record metrics ──
      if (result.success) {
        await incrMetric('jobs_succeeded');
      } else {
        await incrMetric('jobs_failed');
      }

      return result;
    },
    {
      connection,
      concurrency,
      stalledInterval: ROUND_ROBIN_CONFIG.stalledIntervalMs,
    }
  );

  _worker.on('failed', (job, err) => {
    console.error(`[queue] job ${job?.id} failed:`, err.message);
  });

  _worker.on('error', (err) => {
    console.error('[queue] worker error:', err.message);
  });

  console.log('[queue] worker started for queue:', ROUND_ROBIN_CONFIG.queueName);
  return _worker;
}

// ---------------------------------------------------------------------------
// Enqueue a single send job
// ---------------------------------------------------------------------------
export async function enqueueSend(jobData, opts = {}) {
  const queue = getQueue();
  const delayMs = await getEffectiveDelayMs();

  // If a delay is specified, use BullMQ's delayed job feature.
  const jobOpts = {};
  if (opts.delayMs && opts.delayMs > 0) {
    jobOpts.delay = opts.delayMs;
  }

  const job = await queue.add('mms-send', jobData, jobOpts);
  await incrMetric('jobs_enqueued');
  return job;
}

// ---------------------------------------------------------------------------
// Enqueue a batch of send jobs — with a staggered delay between each
// ---------------------------------------------------------------------------
export async function enqueueBatch(jobs, opts = {}) {
  const queue = getQueue();
  const baseDelay = await getEffectiveDelayMs();
  const results = [];

  for (let i = 0; i < jobs.length; i++) {
    const jobOpts = {
      delay: i * baseDelay, // stagger each job by the micro-delay
    };
    const job = await queue.add('mms-send', jobs[i], jobOpts);
    results.push({ id: job.id, index: i });
  }

  await incrMetric('jobs_enqueued', jobs.length);
  return results;
}

// ---------------------------------------------------------------------------
// Queue status — for the admin dashboard / SSE endpoint
// ---------------------------------------------------------------------------
export async function getQueueStatus() {
  const queue = getQueue();
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      queueName: ROUND_ROBIN_CONFIG.queueName,
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + delayed,
    };
  } catch (err) {
    return { error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Pause / resume the queue (admin control without restart)
// ---------------------------------------------------------------------------
export async function pauseQueue() {
  const queue = getQueue();
  await setDynamicConfig(DYNAMIC_CONFIG_KEYS.queuePaused, true);
  await queue.pause();
  await logActivity(null, 'admin', 'admin', 'queue_paused', 'Gateway dispatch queue paused by admin', null).catch(() => {});
  return { success: true, paused: true };
}

export async function resumeQueue() {
  const queue = getQueue();
  await setDynamicConfig(DYNAMIC_CONFIG_KEYS.queuePaused, false);
  await queue.resume();
  await logActivity(null, 'admin', 'admin', 'queue_resumed', 'Gateway dispatch queue resumed by admin', null).catch(() => {});
  return { success: true, paused: false };
}

// ---------------------------------------------------------------------------
// Daily reset — clears sentToday counters (called by a scheduler/cron)
// ---------------------------------------------------------------------------
export async function resetDailyCounters() {
  const release = await acquireMutex('daily_reset', 30000);
  if (!release) return { success: false, reason: 'Reset already in progress' };

  try {
    await connectDB();
    const result = await EmailAccount.updateMany(
      { sentToday: { $gt: 0 } },
      { $set: { sentToday: 0, updatedAt: new Date() } }
    );
    await logActivity(null, 'system', 'system', 'daily_reset', `Reset sentToday for ${result.modifiedCount} accounts`, null).catch(() => {});
    return { success: true, reset: result.modifiedCount };
  } finally {
    await release();
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export default {
  getQueue,
  startWorker,
  setDispatchHandler,
  getNextAvailableAccount,
  checkTokenBucket,
  enforceDelay,
  enqueueSend,
  enqueueBatch,
  getQueueStatus,
  pauseQueue,
  resumeQueue,
  resetDailyCounters,
};
