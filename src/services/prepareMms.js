// ============================================================================
// MODULE 2: prepareMms.js — MMS Payload Orchestration Service
// ============================================================================
// This is the central orchestration service that ties together all gateway
// modules into a single pipeline:
//
//   1. HLR Validator (Module 1)  → validate number + resolve carrier domain
//   2. Safety Filter             → block phishing / blocked keywords
//   3. AI Polymorphism (Module 4) → rewrite for structural uniqueness
//   4. Carrier Address Assembly  → <number>@<carrierDomain>
//
// The preview route calls prepareMMSPayload() as a DRY RUN (no send).
// The dispatch route calls prepareAndEnqueue() to enqueue a real send job.
//
// NON-DESTRUCTIVE: brand-new service. This is the file the preview route was
// already importing (it didn't exist before — now it does). Exports match the
// exact interface the preview route expects: prepareMMSPayload(phone, text, ctx).
// ============================================================================

import { connectDB, SystemConfig, logActivity, DeliveryReport } from '@/lib/core';
import { validateAndResolveCarrier } from './hlrValidator.js';
import { rewriteWithPolymorph } from './aiPolymorph.js';
import { getDynamicConfig } from '@/lib/redis';
import { DYNAMIC_CONFIG_KEYS, SEND_RESULT } from '@/lib/gateway/constants';

// ---------------------------------------------------------------------------
// Safety Filter — blocks phishing / blocked keywords
// ---------------------------------------------------------------------------
// Checks the message text against the SystemConfig.blockedKeywords list.
// Returns { blocked, reason, matchedKeyword } — blocked=true aborts the send.
// ---------------------------------------------------------------------------
async function safetyFilter(text, opts = {}) {
  // Check if the safety filter is enabled (Redis dynamic config → SystemConfig).
  let enabled;
  try {
    const dynEnabled = await getDynamicConfig(DYNAMIC_CONFIG_KEYS.safetyFilterEnabled, null);
    if (dynEnabled !== null) {
      enabled = dynEnabled;
    } else {
      await connectDB();
      const cfg = await SystemConfig.findOne({}).lean() || {};
      enabled = cfg.enablePhishingFilter !== false;
    }
  } catch (_e) {
    enabled = true;
  }

  if (!enabled) {
    return { blocked: false, reason: null, matchedKeyword: null };
  }

  // Load the blocked keywords list.
  let blockedKeywords;
  try {
    await connectDB();
    const cfg = await SystemConfig.findOne({}).lean() || {};
    blockedKeywords = Array.isArray(cfg.blockedKeywords) ? cfg.blockedKeywords : ['bank', 'otp', 'passcode', 'credit card'];
  } catch (_e) {
    blockedKeywords = ['bank', 'otp', 'passcode', 'credit card'];
  }

  const lowerText = (text || '').toLowerCase();
  for (const keyword of blockedKeywords) {
    if (keyword && lowerText.includes(keyword.toLowerCase())) {
      return {
        blocked: true,
        reason: `Message contains blocked keyword: "${keyword}"`,
        matchedKeyword: keyword,
      };
    }
  }

  return { blocked: false, reason: null, matchedKeyword: null };
}

// ---------------------------------------------------------------------------
// MAIN: prepareMMSPayload(phoneNumber, text, ctx) — DRY RUN
// ---------------------------------------------------------------------------
// Runs the full pipeline WITHOUT sending. Returns the prepared payload so
// the admin can preview exactly what would be sent.
//
// Returns:
//   { ok, phoneNumber, e164, mmsAddress, carrierDomain, carrierName, lineType,
//     originalText, rewrittenText, aiSource, safetyCheck, source, reason }
//
// Throws a controlled error with .code = 'BLOCKED_BY_SAFETY_FILTER' when the
// safety filter blocks the message (the preview route catches this).
// ---------------------------------------------------------------------------
export async function prepareMMSPayload(phoneNumber, text, ctx = {}) {
  // ── Step 1: HLR Validation + Carrier Resolution ──
  const carrier = await validateAndResolveCarrier(phoneNumber, { actorContext: ctx });

  if (!carrier.valid) {
    // Distinguish landline/VOIP from malformed.
    let errorCode = 'INVALID_NUMBER';
    if (carrier.reason && /landline/i.test(carrier.reason)) errorCode = 'LANDLINE';
    else if (carrier.reason && /voip/i.test(carrier.reason)) errorCode = 'VOIP';

    const err = new Error(carrier.reason || 'Invalid phone number');
    err.code = errorCode;
    throw err;
  }

  // ── Step 2: Safety Filter ──
  const safety = await safetyFilter(text, ctx);
  if (safety.blocked) {
    // Log the safety block.
    await logActivity(
      ctx?.userId || null,
      ctx?.actorType || 'admin',
      ctx?.username || 'admin',
      'blocked_by_safety',
      `Message to ${carrier.e164} blocked: ${safety.reason}`,
      null
    ).catch(() => {});

    const err = new Error(safety.reason);
    err.code = 'BLOCKED_BY_SAFETY_FILTER';
    err.matchedKeyword = safety.matchedKeyword;
    throw err;
  }

  // ── Step 3: AI Polymorphism (Pre-Flight Rewrite) ──
  const aiResult = await rewriteWithPolymorph(text, {});

  // ── Step 4: Assemble the payload ──
  const payload = {
    ok: true,
    phoneNumber,
    e164: carrier.e164,
    mmsAddress: carrier.mmsAddress,
    carrierDomain: carrier.carrierDomain,
    carrierName: carrier.carrierName,
    lineType: carrier.lineType,
    carrierSource: carrier.source,
    originalText: text,
    rewrittenText: aiResult.text,
    aiSource: aiResult.source,
    aiRewritten: aiResult.rewritten,
    aiError: aiResult.error,
    safetyCheck: {
      passed: true,
      filterEnabled: safety.filterEnabled,
    },
    source: carrier.source,
    reason: null,
    preparedAt: new Date().toISOString(),
  };

  return payload;
}

// ---------------------------------------------------------------------------
// prepareAndEnqueue(phoneNumber, text, ctx, opts) — REAL SEND
// ---------------------------------------------------------------------------
// Prepares the payload (same as prepareMMSPayload) and then enqueues a real
// send job into the BullMQ queue. The queue worker will:
//   1. Get the next available account (round-robin)
//   2. Check the token bucket (rate limit)
//   3. Enforce the micro-delay
//   4. Dispatch via Nodemailer / Graph API
//   5. Record the result + update the circuit breaker
//
// Returns: { ok, jobId, mmsAddress, ... } or { ok: false, reason } on abort.
// ---------------------------------------------------------------------------
export async function prepareAndEnqueue(phoneNumber, text, ctx = {}, opts = {}) {
  // Reuse the dry-run pipeline to prepare the payload.
  const payload = await prepareMMSPayload(phoneNumber, text, ctx);

  // Dynamically import the queue engine to avoid circular dependencies.
  const { enqueueSend } = await import('./queueEngine.js');

  // Enqueue the send job.
  const job = await enqueueSend({
    phoneNumber: payload.e164,
    text: payload.rewrittenText,
    originalText: payload.originalText,
    mmsAddress: payload.mmsAddress,
    carrierDomain: payload.carrierDomain,
    carrierName: payload.carrierName,
    aiSource: payload.aiSource,
    campaignId: ctx?.campaignId || null,
    userId: ctx?.userId || null,
    actorContext: ctx,
  }, opts);

  // Log the enqueue.
  await logActivity(
    ctx?.userId || null,
    ctx?.actorType || 'admin',
    ctx?.username || 'admin',
    'dispatch_enqueued',
    `Enqueued MMS to ${payload.e164} via ${payload.mmsAddress} (job ${job.id}). AI: ${payload.aiSource}.`,
    null
  ).catch(() => {});

  return {
    ok: true,
    jobId: job.id,
    phoneNumber: payload.e164,
    mmsAddress: payload.mmsAddress,
    carrierDomain: payload.carrierDomain,
    aiSource: payload.aiSource,
    aiRewritten: payload.aiRewritten,
  };
}

// ---------------------------------------------------------------------------
// Batch prepare + enqueue — for campaign sends
// ---------------------------------------------------------------------------
export async function prepareAndEnqueueBatch(recipients, text, ctx = {}, opts = {}) {
  // recipients: [{ phoneNumber, ... }] or ['+1234...', ...]
  const numbers = recipients.map((r) =>
    typeof r === 'string' ? r : (r.phoneNumber || r.number || r.phone)
  ).filter(Boolean);

  const results = [];
  const errors = [];

  // Prepare each payload (dry run) — collect valid ones for batch enqueue.
  const validPayloads = [];
  for (let i = 0; i < numbers.length; i++) {
    try {
      const payload = await prepareMMSPayload(numbers[i], text, ctx);
      validPayloads.push({
        phoneNumber: payload.e164,
        text: payload.rewrittenText,
        originalText: payload.originalText,
        mmsAddress: payload.mmsAddress,
        carrierDomain: payload.carrierDomain,
        carrierName: payload.carrierName,
        aiSource: payload.aiSource,
        campaignId: ctx?.campaignId || null,
        userId: ctx?.userId || null,
        actorContext: ctx,
        index: i,
      });
      results.push({ index: i, ok: true, mmsAddress: payload.mmsAddress, aiSource: payload.aiSource });
    } catch (err) {
      results.push({ index: i, ok: false, reason: err.message, code: err.code });
      errors.push({ index: i, phoneNumber: numbers[i], error: err.message });
    }
  }

  // Enqueue the valid payloads as a batch with staggered delays.
  let enqueued = [];
  if (validPayloads.length > 0) {
    const { enqueueBatch } = await import('./queueEngine.js');
    enqueued = await enqueueBatch(validPayloads, opts);
  }

  return {
    total: numbers.length,
    valid: validPayloads.length,
    rejected: errors.length,
    enqueued: enqueued.length,
    results,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export default {
  prepareMMSPayload,
  prepareAndEnqueue,
  prepareAndEnqueueBatch,
};
