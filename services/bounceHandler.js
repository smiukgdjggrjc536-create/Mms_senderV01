// ============================================================================
// bounceHandler.js — Bounce & Reputation Handler (Phase 3, Step 3)
// ============================================================================
// Wraps every outbound send (from queueRouter → sendByProvider) in a
// try/catch interceptor that maintains the EmailAccount's reputation state
// and purges stale CarrierCache entries on hard bounces.
//
// On SUCCESS:
//   - Increment the account's sentToday by 1.
//   - Reset consecutiveBounces to 0.
//   - Set lastUsedAt = now (so Round-Robin rotates away from it).
//   - Clear lastError.
//
// On HARD BOUNCE (e.g. 550 User Unknown / "recipient address rejected"):
//   - Delete the matching CarrierCache entry for the recipient's phone number
//     so the next send to that number forces a fresh carrier lookup.
//   - Increment consecutiveBounces.
//   - Set lastError to the bounce reason.
//   - If consecutiveBounces >= 3 → set status = 'COOLDOWN' and
//     cooldownUntil = Date.now() + 2 hours.
//   - Re-throw the error (the caller decides how to surface the failure).
//
// On RATE_LIMIT / TRANSIENT / AUTH errors:
//   - Set lastError.
//   - For RATE_LIMIT: also set a short cooldown (cooldownUntil = now + 15 min)
//     and bump consecutiveBounces by 1 (so sustained rate limiting also trips
//     the 3-strike cooldown).
//   - For AUTH: set status = 'SUSPENDED' (credentials are broken — no point
//     retrying automatically) and lastError.
//   - For TRANSIENT: leave status ACTIVE (transient = retry later) but record
//     lastError and bump consecutiveBounces by 1.
//   - Re-throw the error.
//
// All DB updates use findOneAndUpdate with $inc / $set so they are atomic
// and safe under serverless concurrency.
//
// NON-DESTRUCTIVE: brand-new module.
// ============================================================================

import { connectDB, EmailAccount, CarrierCache } from '@/lib/core';

// Cooldown applied after 3 consecutive bounces (2 hours per the spec).
const BOUNCE_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours
// Short cooldown for a single rate-limit hit (15 min) so the router backs off
// without fully disabling the account.
const RATE_LIMIT_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes
// Number of consecutive bounces that triggers a full cooldown.
const BOUNCE_COOLDOWN_THRESHOLD = 3;

// ---------------------------------------------------------------------------
// Extract the recipient phone number from a carrier-gateway email address.
//   "12125551234@vzwpix.com" → "12125551234"
//   "+13175550199@tmomail.net" → "+13175550199"
// Returns null if the local part is not digit-ish (not a phone-number address).
// ---------------------------------------------------------------------------
function extractPhoneFromCarrierEmail(carrierEmail) {
  if (!carrierEmail || typeof carrierEmail !== 'string') return null;
  const atIdx = carrierEmail.indexOf('@');
  if (atIdx <= 0) return null;
  let local = carrierEmail.slice(0, atIdx);
  // Keep a leading + and digits only
  const hasPlus = local.startsWith('+');
  const digits = local.replace(/\D/g, '');
  if (digits.length < 7) return null; // not a phone number
  return (hasPlus ? '+' : '') + digits;
}

// ---------------------------------------------------------------------------
// On a hard bounce: delete the CarrierCache entry for the recipient phone so
// the next send forces a fresh carrier lookup (the carrier may have changed,
// the number may have been ported, or the cached domain was wrong).
// ---------------------------------------------------------------------------
async function purgeCarrierCache(carrierEmail) {
  const phone = extractPhoneFromCarrierEmail(carrierEmail);
  if (!phone) return;
  try {
    // CarrierCache.phoneNumber is the normalized phone; try both with and
    // without a leading + to be safe.
    const variants = [phone, phone.replace(/^\+/, '')];
    for (const v of variants) {
      await CarrierCache.deleteOne({ phoneNumber: v });
    }
  } catch (_e) {
    // Non-fatal: a failed cache purge must not mask the original bounce error.
  }
}

// ---------------------------------------------------------------------------
// Apply success-state mutations atomically.
// ---------------------------------------------------------------------------
async function recordSuccess(account) {
  await EmailAccount.findByIdAndUpdate(account._id, {
    $inc: { sentToday: 1 },
    $set: {
      consecutiveBounces: 0,
      lastUsedAt: new Date(),
      lastError: null,
      updatedAt: new Date(),
    },
  });
}

// ---------------------------------------------------------------------------
// Apply hard-bounce mutations:
//   - purge carrier cache for the recipient
//   - increment consecutiveBounces
//   - if >= 3 → COOLDOWN + cooldownUntil = now + 2h
// Returns the updated consecutiveBounces count (for logging).
// ---------------------------------------------------------------------------
async function recordHardBounce(account, carrierEmail, errorMsg) {
  await purgeCarrierCache(carrierEmail);

  const now = new Date();
  const updated = await EmailAccount.findByIdAndUpdate(
    account._id,
    {
      $inc: { consecutiveBounces: 1 },
      $set: {
        lastUsedAt: now,
        lastError: `HARD_BOUNCE: ${String(errorMsg).slice(0, 280)}`,
        updatedAt: now,
      },
    },
    { new: true }
  );

  const newCount = updated ? updated.consecutiveBounces : (account.consecutiveBounces || 0) + 1;

  if (newCount >= BOUNCE_COOLDOWN_THRESHOLD) {
    const cooldownUntil = new Date(now.getTime() + BOUNCE_COOLDOWN_MS);
    await EmailAccount.findByIdAndUpdate(account._id, {
      $set: {
        status: 'COOLDOWN',
        cooldownUntil,
        updatedAt: now,
      },
    });
  }

  return newCount;
}

// ---------------------------------------------------------------------------
// Apply rate-limit mutations: short cooldown + bump consecutiveBounces.
// ---------------------------------------------------------------------------
async function recordRateLimit(account, errorMsg) {
  const now = new Date();
  const cooldownUntil = new Date(now.getTime() + RATE_LIMIT_COOLDOWN_MS);
  const updated = await EmailAccount.findByIdAndUpdate(
    account._id,
    {
      $inc: { consecutiveBounces: 1 },
      $set: {
        lastUsedAt: now,
        lastError: `RATE_LIMIT: ${String(errorMsg).slice(0, 280)}`,
        cooldownUntil,
        updatedAt: now,
      },
    },
    { new: true }
  );
  const newCount = updated ? updated.consecutiveBounces : (account.consecutiveBounces || 0) + 1;
  if (newCount >= BOUNCE_COOLDOWN_THRESHOLD) {
    await EmailAccount.findByIdAndUpdate(account._id, {
      $set: {
        status: 'COOLDOWN',
        cooldownUntil: new Date(now.getTime() + BOUNCE_COOLDOWN_MS),
        updatedAt: now,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Apply AUTH mutations: suspend the account (broken credentials).
// ---------------------------------------------------------------------------
async function recordAuthFailure(account, errorMsg) {
  const now = new Date();
  await EmailAccount.findByIdAndUpdate(account._id, {
    $set: {
      status: 'SUSPENDED',
      lastUsedAt: now,
      lastError: `AUTH: ${String(errorMsg).slice(0, 280)}`,
      updatedAt: now,
    },
  });
}

// ---------------------------------------------------------------------------
// Apply transient-error mutations: record the error, bump the bounce counter
// (so a long run of transient errors also trips cooldown), but keep ACTIVE.
// ---------------------------------------------------------------------------
async function recordTransient(account, errorMsg) {
  const now = new Date();
  const updated = await EmailAccount.findByIdAndUpdate(
    account._id,
    {
      $inc: { consecutiveBounces: 1 },
      $set: {
        lastUsedAt: now,
        lastError: `TRANSIENT: ${String(errorMsg).slice(0, 280)}`,
        updatedAt: now,
      },
    },
    { new: true }
  );
  const newCount = updated ? updated.consecutiveBounces : (account.consecutiveBounces || 0) + 1;
  if (newCount >= BOUNCE_COOLDOWN_THRESHOLD) {
    await EmailAccount.findByIdAndUpdate(account._id, {
      $set: {
        status: 'COOLDOWN',
        cooldownUntil: new Date(now.getTime() + BOUNCE_COOLDOWN_MS),
        updatedAt: now,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Public API: withBounceHandling({ account, sendFn, carrierEmail })
//   account     — the EmailAccount doc (lean) used for this send
//   sendFn      — async () => providerResult  (the actual sendByProvider call)
//   carrierEmail — the recipient carrier-gateway address (for cache purge)
//
// Runs sendFn. On success → recordSuccess + return the provider result.
// On error → classify by err.bounceType, apply the matching reputation
// mutation, then re-throw the original error (with .bounceType preserved).
// ---------------------------------------------------------------------------
export async function withBounceHandling({ account, sendFn, carrierEmail }) {
  await connectDB();

  let result;
  try {
    result = await sendFn();
  } catch (err) {
    // Ensure a bounceType exists (default TRANSIENT if the provider didn't set one)
    if (!err.bounceType) err.bounceType = 'TRANSIENT';

    try {
      switch (err.bounceType) {
        case 'HARD_BOUNCE':
          await recordHardBounce(account, carrierEmail, err.message);
          break;
        case 'RATE_LIMIT':
          await recordRateLimit(account, err.message);
          break;
        case 'AUTH':
          await recordAuthFailure(account, err.message);
          break;
        case 'TRANSIENT':
        default:
          await recordTransient(account, err.message);
          break;
      }
    } catch (_mutationErr) {
      // A failed reputation mutation must not mask the original send error.
    }

    // Re-throw so the caller sees the failure.
    throw err;
  }

  // Success path
  try {
    await recordSuccess(account);
  } catch (_mutationErr) {
    // Non-fatal: the send already succeeded; we don't want a DB update
    // failure to turn a success into a failure.
  }

  return result;
}

export {
  extractPhoneFromCarrierEmail,
  purgeCarrierCache,
  recordSuccess,
  recordHardBounce,
  recordRateLimit,
  recordAuthFailure,
  recordTransient,
  BOUNCE_COOLDOWN_MS,
  RATE_LIMIT_COOLDOWN_MS,
  BOUNCE_COOLDOWN_THRESHOLD,
};
