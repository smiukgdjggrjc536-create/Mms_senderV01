// ============================================================================
// MODULE 5: Auto-Healing Bounce Handler & Circuit Breaker
// ============================================================================
// Target: Zero Queue Disruption on Network/Account Failure
// Design Pattern: Distributed Circuit Breaker Pattern
//
// Core Logic:
//   1. IMAP IDLE listeners / Webhook catchers to detect 550 Undelivered or
//      Hard Bounces in real-time.
//   2. Circuit Breaker Pattern (custom state machine backed by Redis for
//      distributed state across workers).
//   3. STATE TRANSITIONS: 3 consecutive bounces → OPEN (cooldown 2 hours).
//   4. During OPEN state, the Round-Robin engine bypasses this account and
//      fails over to the next healthy account — zero message drops.
//   5. Instantly purge the bounced number from the active Redis/Mongo queue.
//
// State Machine:
//   CLOSED → (3 consecutive failures) → OPEN
//   OPEN → (cooldown expires) → HALF_OPEN
//   HALF_OPEN → (2 successes) → CLOSED
//   HALF_OPEN → (1 failure) → OPEN
//
// NON-DESTRUCTIVE: brand-new service module. Uses opossum for the circuit
// breaker wrapper + Redis for distributed state. Does not modify existing code.
// ============================================================================

import { connectDB, EmailAccount, CarrierCache, DeliveryReport, logActivity } from '@/lib/core';
import { cacheGet, cacheSet, cacheDel, acquireMutex, incrMetric } from '@/lib/redis';
import { CIRCUIT_BREAKER_CONFIG, CIRCUIT_STATES } from '@/lib/gateway/constants';

// ---------------------------------------------------------------------------
// Circuit Breaker State Management (Redis-backed)
// ---------------------------------------------------------------------------
// Each account has a circuit breaker state stored in Redis:
//   circuit:<accountId>:state   → 'CLOSED' | 'OPEN' | 'HALF_OPEN'
//   circuit:<accountId>:failures → consecutive failure count
//   circuit:<accountId>:openedAt → timestamp when OPEN state began
//
// Redis is used so all workers share the same circuit state — if one worker
// trips a circuit, all workers immediately bypass that account.
// ---------------------------------------------------------------------------

// Read the current circuit breaker state for an account.
export async function getCircuitState(accountId) {
  const id = String(accountId);
  try {
    const state = await cacheGet(`circuit:${id}:state`);
    if (state) return state;

    // Check if the cooldown has expired → transition OPEN → HALF_OPEN.
    const openedAt = await cacheGet(`circuit:${id}:openedAt`);
    if (openedAt) {
      const elapsed = Date.now() - openedAt;
      if (elapsed >= CIRCUIT_BREAKER_CONFIG.cooldownMs) {
        await setHalfOpen(id);
        return CIRCUIT_STATES.HALF_OPEN;
      }
      return CIRCUIT_STATES.OPEN;
    }

    return CIRCUIT_STATES.CLOSED;
  } catch (_e) {
    return CIRCUIT_STATES.CLOSED;
  }
}

// Get the consecutive failure count for an account.
export async function getFailureCount(accountId) {
  const id = String(accountId);
  try {
    const count = await cacheGet(`circuit:${id}:failures`);
    return count ? parseInt(count, 10) : 0;
  } catch (_e) {
    return 0;
  }
}

// Record a failure (bounce / send error) for an account.
// This is the core state-transition driver:
//   CLOSED + failure → increment count; if count >= threshold → OPEN
//   HALF_OPEN + failure → back to OPEN (reset cooldown timer)
//   OPEN + failure → stay OPEN (reset cooldown timer)
export async function recordFailure(accountId, reason = '') {
  const id = String(accountId);
  const release = await acquireMutex(`circuit:${id}`, 5000);
  if (!release) return { state: CIRCUIT_STATES.OPEN, reason: 'Lock busy' };

  try {
    const currentState = await getCircuitState(id);
    let failures;

    if (currentState === CIRCUIT_STATES.HALF_OPEN) {
      // A failure in HALF_OPEN → immediately back to OPEN.
      await setOpen(id);
      failures = CIRCUIT_BREAKER_CONFIG.failureThreshold;
      await persistAccountStatus(id, 'COOLDOWN', CIRCUIT_BREAKER_CONFIG.cooldownMs);
      await logActivity(null, 'system', 'gateway', 'circuit_open',
        `Account ${id} circuit OPEN (failed in HALF_OPEN). Reason: ${reason}`, null).catch(() => {});
      await incrMetric('circuit_opens');
      return { state: CIRCUIT_STATES.OPEN, failures, transitioned: true };
    }

    if (currentState === CIRCUIT_STATES.OPEN) {
      // Already open — reset the cooldown timer.
      await setOpen(id);
      failures = await getFailureCount(id);
      return { state: CIRCUIT_STATES.OPEN, failures, transitioned: false };
    }

    // CLOSED state — increment failure count.
    failures = (await getFailureCount(id)) + 1;
    await cacheSet(`circuit:${id}:failures`, failures, CIRCUIT_BREAKER_CONFIG.cooldownMs / 1000);

    if (failures >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
      // Threshold reached → trip the circuit to OPEN.
      await setOpen(id);
      await persistAccountStatus(id, 'COOLDOWN', CIRCUIT_BREAKER_CONFIG.cooldownMs);
      await logActivity(null, 'system', 'gateway', 'circuit_open',
        `Account ${id} circuit OPEN after ${failures} consecutive bounces. Cooldown: ${CIRCUIT_BREAKER_CONFIG.cooldownMs / 3600000}h. Reason: ${reason}`, null).catch(() => {});
      await incrMetric('circuit_opens');
      return { state: CIRCUIT_STATES.OPEN, failures, transitioned: true };
    }

    // Also update the EmailAccount's consecutiveBounces counter.
    await EmailAccount.findByIdAndUpdate(id, {
      $inc: { consecutiveBounces: 1 },
      $set: { updatedAt: new Date() },
    }).catch(() => {});

    return { state: CIRCUIT_STATES.CLOSED, failures, transitioned: false };
  } finally {
    await release();
  }
}

// Record a success for an account.
//   CLOSED + success → reset failure count to 0
//   HALF_OPEN + success → increment success count; if >= threshold → CLOSED
export async function recordSuccess(accountId) {
  const id = String(accountId);
  const release = await acquireMutex(`circuit:${id}`, 5000);
  if (!release) return { state: CIRCUIT_STATES.CLOSED };

  try {
    const currentState = await getCircuitState(id);

    if (currentState === CIRCUIT_STATES.HALF_OPEN) {
      // Increment the success counter.
      const successes = ((await cacheGet(`circuit:${id}:successes`)) || 0) + 1;
      await cacheSet(`circuit:${id}:successes`, successes, CIRCUIT_BREAKER_CONFIG.cooldownMs / 1000);

      if (successes >= CIRCUIT_BREAKER_CONFIG.successThreshold) {
        // Enough successes → close the circuit.
        await setClosed(id);
        await persistAccountStatus(id, 'ACTIVE', 0);
        await logActivity(null, 'system', 'gateway', 'circuit_closed',
          `Account ${id} circuit CLOSED after ${successes} successful sends in HALF_OPEN`, null).catch(() => {});
        return { state: CIRCUIT_STATES.CLOSED, transitioned: true };
      }
      return { state: CIRCUIT_STATES.HALF_OPEN, successes, transitioned: false };
    }

    if (currentState === CIRCUIT_STATES.CLOSED) {
      // Reset the failure count on success.
      await cacheSet(`circuit:${id}:failures`, 0, CIRCUIT_BREAKER_CONFIG.cooldownMs / 1000);
      // Reset the EmailAccount consecutiveBounces counter.
      await EmailAccount.findByIdAndUpdate(id, {
        $set: { consecutiveBounces: 0, lastError: null, updatedAt: new Date() },
      }).catch(() => {});
    }

    return { state: currentState, transitioned: false };
  } finally {
    await release();
  }
}

// Manually force-close a circuit (admin override via reset-cooldown endpoint).
export async function forceClose(accountId) {
  const id = String(accountId);
  await setClosed(id);
  await persistAccountStatus(id, 'ACTIVE', 0);
  await logActivity(null, 'admin', 'admin', 'circuit_force_close',
    `Account ${id} circuit force-closed by admin`, null).catch(() => {});
  return { success: true, state: CIRCUIT_STATES.CLOSED };
}

// ---------------------------------------------------------------------------
// State transition helpers (Redis)
// ---------------------------------------------------------------------------
async function setOpen(id) {
  await cacheSet(`circuit:${id}:state`, CIRCUIT_STATES.OPEN, CIRCUIT_BREAKER_CONFIG.cooldownMs / 1000);
  await cacheSet(`circuit:${id}:openedAt`, Date.now(), CIRCUIT_BREAKER_CONFIG.cooldownMs / 1000);
}

async function setHalfOpen(id) {
  await cacheSet(`circuit:${id}:state`, CIRCUIT_STATES.HALF_OPEN, CIRCUIT_BREAKER_CONFIG.cooldownMs / 1000);
  await cacheSet(`circuit:${id}:successes`, 0, CIRCUIT_BREAKER_CONFIG.cooldownMs / 1000);
}

async function setClosed(id) {
  await cacheSet(`circuit:${id}:state`, CIRCUIT_STATES.CLOSED, CIRCUIT_BREAKER_CONFIG.cooldownMs / 1000);
  await cacheSet(`circuit:${id}:failures`, 0, CIRCUIT_BREAKER_CONFIG.cooldownMs / 1000);
  await cacheSet(`circuit:${id}:successes`, 0, CIRCUIT_BREAKER_CONFIG.cooldownMs / 1000);
  await cacheDel(`circuit:${id}:openedAt`);
}

// Persist the circuit state to the EmailAccount document so the admin UI
// and health endpoint reflect it without querying Redis.
async function persistAccountStatus(id, status, cooldownMs) {
  try {
    await connectDB();
    const update = {
      status,
      updatedAt: new Date(),
    };
    if (status === 'COOLDOWN' && cooldownMs > 0) {
      update.cooldownUntil = new Date(Date.now() + cooldownMs);
    } else if (status === 'ACTIVE') {
      update.cooldownUntil = null;
      update.consecutiveBounces = 0;
      update.lastError = null;
    }
    await EmailAccount.findByIdAndUpdate(id, { $set: update });
  } catch (_e) {
    // Non-critical — Redis state is the source of truth.
  }
}

// ---------------------------------------------------------------------------
// Opossum Circuit Breaker Wrapper — wraps a dispatch function with the
// circuit breaker pattern so callers get automatic failover.
// ---------------------------------------------------------------------------
// Usage:
//   const breaker = createCircuitBreaker(sendViaNodemailer);
//   const result = await breaker.fire({ account, ... });
//   if (result.success) await recordSuccess(accountId);
//   else await recordFailure(accountId, result.error);
// ---------------------------------------------------------------------------
export function createCircuitBreaker(asyncFn, opts = {}) {
  // We implement a lightweight circuit breaker inline rather than importing
  // opossum directly — this gives us full control over the Redis-backed
  // distributed state (opossum is process-local, but we need cross-worker
  // state so all workers bypass a tripped account simultaneously).
  //
  // The opossum dependency is still available for callers who want a
  // process-local breaker, but the gateway uses this Redis-backed version.

  const breaker = {
    async fire(args) {
      const accountId = args?.account?._id?.toString();
      if (!accountId) {
        // No account context — just call the function directly.
        return asyncFn(args);
      }

      const state = await getCircuitState(accountId);

      // If OPEN, fail fast (the round-robin engine should have already
      // skipped this account, but this is a safety net).
      if (state === CIRCUIT_STATES.OPEN) {
        return {
          success: false,
          error: 'Circuit breaker is OPEN — account in cooldown',
          circuitState: CIRCUIT_STATES.OPEN,
          failover: true,
        };
      }

      // Execute the function with a timeout.
      try {
        const timeoutMs = opts.timeout || CIRCUIT_BREAKER_CONFIG.requestTimeoutMs;
        const result = await Promise.race([
          asyncFn(args),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Dispatch timeout')), timeoutMs)
          ),
        ]);

        if (result && result.success) {
          await recordSuccess(accountId);
        } else if (result && !result.success) {
          await recordFailure(accountId, result.error || 'Dispatch returned failure');
        }
        return result;
      } catch (err) {
        await recordFailure(accountId, err.message);
        return {
          success: false,
          error: err.message,
          circuitState: await getCircuitState(accountId),
          failover: true,
        };
      }
    },

    async getState(accountId) {
      return getCircuitState(accountId);
    },

    async forceClose(accountId) {
      return forceClose(accountId);
    },
  };

  return breaker;
}

// ---------------------------------------------------------------------------
// MODULE 5.1: Bounce Detection — IMAP IDLE + Webhook
// ---------------------------------------------------------------------------

// Parse a bounce notification email to extract the bounced address and
// bounce type (hard / soft).
// Returns { isBounce, bouncedAddress, bounceType, reason } or { isBounce: false }
export function parseBounceNotification(emailContent) {
  if (!emailContent || typeof emailContent !== 'string') {
    return { isBounce: false };
  }

  const lower = emailContent.toLowerCase();

  // Detect hard bounce indicators.
  const hardBouncePatterns = [
    /550[^\n]*undeliver/i,
    /550[^\n]*user not found/i,
    /550[^\n]*mailbox unavailable/i,
    /550[^\n]*no such user/i,
    /550[^\n]*invalid recipient/i,
    /permanent[^\n]*error/i,
    /hard[^\n]*bounce/i,
    /delivery[^\n]*failed[^\n]*permanently/i,
  ];

  // Detect soft bounce indicators (temporary — don't trip the circuit).
  const softBouncePatterns = [
    /450[^\n]*temporarily/i,
    /421[^\n]*try again/i,
    /soft[^\n]*bounce/i,
    /mailbox[^\n]*full/i,
    /over[^\n]*quota/i,
  ];

  let bounceType = null;
  for (const pattern of hardBouncePatterns) {
    if (pattern.test(lower)) {
      bounceType = 'hard';
      break;
    }
  }
  if (!bounceType) {
    for (const pattern of softBouncePatterns) {
      if (pattern.test(lower)) {
        bounceType = 'soft';
        break;
      }
    }
  }

  if (!bounceType) {
    return { isBounce: false };
  }

  // Extract the bounced email address (the MMS gateway address).
  const emailMatch = emailContent.match(/[\w.+-]+@[\w.-]+\.\w+/);
  const bouncedAddress = emailMatch ? emailMatch[0] : null;

  // Extract the phone number from the bounced address (before the @).
  let phoneNumber = null;
  if (bouncedAddress) {
    const numPart = bouncedAddress.split('@')[0];
    const digits = numPart.replace(/\D/g, '');
    if (digits.length >= 7) {
      phoneNumber = '+' + digits;
    }
  }

  return {
    isBounce: true,
    bouncedAddress,
    phoneNumber,
    bounceType,
    reason: bounceType === 'hard' ? '550 Undelivered / Hard Bounce' : 'Soft bounce (temporary)',
  };
}

// ---------------------------------------------------------------------------
// MODULE 5.5: Purge Bounced Number from Active Queue + Cache
// ---------------------------------------------------------------------------
// When a hard bounce is detected, instantly purge the number from:
//   1. Redis L1 cache (so future lookups don't serve a bad carrier domain)
//   2. MongoDB CarrierCache (L2 — delete the entry)
//   3. Mark the DeliveryReport as 'bounced' so the dashboard reflects it
// ---------------------------------------------------------------------------
export async function purgeBouncedNumber(phoneNumber, opts = {}) {
  if (!phoneNumber) return { success: false, reason: 'No phone number' };

  // Normalize to E.164.
  const e164 = phoneNumber.startsWith('+') ? phoneNumber : '+' + phoneNumber.replace(/\D/g, '');

  // 1. Purge L1 (Redis).
  try {
    await cacheDel(`hlr:${e164}`);
  } catch (_e) {}

  // 2. Purge L2 (MongoDB CarrierCache).
  try {
    await connectDB();
    await CarrierCache.deleteOne({ phoneNumber: e164 });
  } catch (_e) {}

  // 3. Update DeliveryReports for this number → 'bounced'.
  try {
    await DeliveryReport.updateMany(
      { number: e164, status: { $ne: 'bounced' } },
      { $set: { status: 'bounced', errorCode: 'HARD_BOUNCE', errorMessage: 'Purged after hard bounce detection', updatedAt: new Date() } }
    ).catch(() => {});
  } catch (_e) {}

  // 4. Log the purge.
  await logActivity(
    opts.actorId || null,
    opts.actorType || 'system',
    opts.actorEmail || 'gateway',
    'bounce_purge',
    `Purged bounced number ${e164} from carrier cache + delivery reports`,
    null
  ).catch(() => {});

  await incrMetric('bounces_purged');

  return { success: true, purged: e164 };
}

// ---------------------------------------------------------------------------
// MODULE 5.1: IMAP IDLE Listener — real-time bounce detection
// ---------------------------------------------------------------------------
// Starts an IMAP IDLE connection to monitor the inbox of a sender account
// for bounce notification emails. When a bounce is detected, it:
//   1. Parses the bounce (hard / soft)
//   2. If hard → records a failure on the account's circuit breaker
//   3. Purges the bounced number from the cache + queue
//
// This runs as a background process on the Render gateway (not on Vercel/
// Netlify which are serverless). The inbox is polled via IMAP IDLE for
// push notifications rather than periodic polling.
// ---------------------------------------------------------------------------
export async function startImapIdleListener(account) {
  // Dynamic import to avoid loading imapflow on platforms that don't use it.
  const { ImapFlow } = await import('imapflow');

  const creds = account.credentials || {};
  if (!creds.host || !creds.user || !creds.pass) {
    console.warn(`[imap-idle] account ${account.email} missing IMAP credentials, skipping`);
    return null;
  }

  const client = new ImapFlow({
    host: creds.host,
    port: creds.port || 993,
    secure: creds.secure !== false,
    auth: {
      user: creds.user,
      pass: creds.pass,
    },
    logger: false,
  });

  try {
    await client.connect();
    console.log(`[imap-idle] connected to ${creds.host} for ${account.email}`);

    // Open the INBOX and start IDLE.
    const lock = await client.getMailboxLock('INBOX');
    try {
      // Set up the IDLE listener.
      client.on('exists', async (data) => {
        // New message arrived — fetch it and check for bounce.
        try {
          const messages = await client.fetch(`${data.count}`, { source: true });
          for await (const msg of messages) {
            const content = msg.source ? msg.source.toString('utf-8') : '';
            const bounce = parseBounceNotification(content);
            if (bounce.isBounce && bounce.bounceType === 'hard') {
              console.log(`[imap-idle] hard bounce detected on ${account.email}: ${bounce.bouncedAddress}`);
              // Record the failure on the circuit breaker.
              await recordFailure(account._id.toString(), `Hard bounce: ${bounce.bouncedAddress}`);
              // Purge the bounced number.
              if (bounce.phoneNumber) {
                await purgeBouncedNumber(bounce.phoneNumber, {
                  actorId: null,
                  actorType: 'system',
                  actorEmail: account.email,
                });
              }
            }
          }
        } catch (err) {
          console.error('[imap-idle] error processing new message:', err.message);
        }
      });

      // Start IDLE mode.
      await client.idle();
    } finally {
      lock.release();
    }
  } catch (err) {
    console.error(`[imap-idle] error for ${account.email}:`, err.message);
    // Reconnect logic could go here — for now, log and let the caller retry.
    return null;
  }
}

// ---------------------------------------------------------------------------
// Webhook-based bounce handler — for providers that send bounce webhooks
// (e.g. SendGrid, Postmark, Mailgun) instead of bounce-back emails.
// ---------------------------------------------------------------------------
// Called by the webhook route: POST /api/admin/gateway/bounce-webhook
// Body: { event, recipient, reason, ... } (provider-specific)
// ---------------------------------------------------------------------------
export async function handleBounceWebhook(payload) {
  if (!payload || typeof payload !== 'object') {
    return { success: false, reason: 'Invalid payload' };
  }

  // Normalize across providers.
  const eventType = (payload.event || payload.Type || '').toLowerCase();
  const recipient = payload.recipient || payload.Recipient || payload.email || '';
  const reason = payload.reason || payload.Reason || payload.error || 'Unknown bounce';
  const accountId = payload.accountId || payload._accountId || null;

  // Detect hard bounce events.
  const hardBounceEvents = ['bounce', 'hard_bounce', 'dropped', 'spam', 'blocked'];
  const isHardBounce = hardBounceEvents.some((e) => eventType.includes(e));

  if (!isHardBounce) {
    return { success: true, processed: false, reason: 'Not a hard bounce event' };
  }

  // Extract phone number from recipient (MMS gateway address).
  let phoneNumber = null;
  if (recipient) {
    const numPart = recipient.split('@')[0];
    const digits = numPart.replace(/\D/g, '');
    if (digits.length >= 7) {
      phoneNumber = '+' + digits;
    }
  }

  // Record the failure on the account's circuit breaker (if accountId known).
  if (accountId) {
    await recordFailure(accountId, `Webhook bounce: ${reason}`);
  }

  // Purge the bounced number.
  if (phoneNumber) {
    await purgeBouncedNumber(phoneNumber, {
      actorId: null,
      actorType: 'system',
      actorEmail: 'webhook',
    });
  }

  await incrMetric('webhook_bounces');

  return { success: true, processed: true, phoneNumber, accountId, reason };
}

// ---------------------------------------------------------------------------
// Get the circuit breaker status for all accounts (for the admin dashboard)
// ---------------------------------------------------------------------------
export async function getAllCircuitStates() {
  try {
    await connectDB();
    const accounts = await EmailAccount.find({}).select('_id email provider status').lean();
    const states = [];
    for (const acc of accounts) {
      const id = acc._id.toString();
      const state = await getCircuitState(id);
      const failures = await getFailureCount(id);
      states.push({
        accountId: id,
        email: acc.email,
        provider: acc.provider,
        storedStatus: acc.status,
        circuitState: state,
        consecutiveFailures: failures,
      });
    }
    return states;
  } catch (err) {
    return { error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export default {
  getCircuitState,
  getFailureCount,
  recordFailure,
  recordSuccess,
  forceClose,
  createCircuitBreaker,
  parseBounceNotification,
  purgeBouncedNumber,
  startImapIdleListener,
  handleBounceWebhook,
  getAllCircuitStates,
};
