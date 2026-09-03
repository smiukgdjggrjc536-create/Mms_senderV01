// ============================================================================
// MMS Payload Preparation — Email-to-MMS Gateway Backend Engine (Phase 2)
// ============================================================================
// Orchestrates the three Phase 2 services into a single helper that the
// Phase 3 sending router will call before dispatching an email-to-MMS message:
//
//   prepareMMSPayload(phoneNumber, text, context)
//     1. Safety filter — aborts with BLOCKED_BY_SAFETY_FILTER if the text
//        contains a blocked keyword (no Gemini token / lookup / send spent).
//     2. AI rewriter — produces a unique variant of the (safe) text via Gemini.
//     3. Carrier lookup — resolves the phone number to its MMS gateway address
//        (cache-first, external lookup fallback). Landlines abort.
//
// Returns a ready-to-send payload object: { to, text, carrier, lineType,
// rewritten, originalText, phoneNumber }. Any abort (safety block or landline)
// is thrown as a typed Error so the Phase 3 router can branch cleanly.
//
// NON-DESTRUCTIVE: brand-new service module. It only composes the three new
// Phase 2 services; no existing code is modified.
// ============================================================================

import { connectDB } from '@/lib/core';
import { getCarrierGateway } from './carrierLookup.js';
import { rewriteMessage } from './aiRewriter.js';
import { safetyFilter } from './safetyFilter.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Prepare a complete MMS payload for sending.
 *
 * @param {string} phoneNumber - the recipient phone number (raw is fine)
 * @param {string} text - the original message body
 * @param {object} [context] - optional metadata forwarded to safetyFilter for
 *   audit logging (userId, actorType, username, phoneNumber).
 * @returns {Promise<object>} payload:
 *   {
 *     to: string,            // "<digits>@<carrierDomain>"
 *     text: string,          // final (rewritten) message body
 *     originalText: string,  // original message body
 *     phoneNumber: string,   // normalized phone used
 *     carrierDomain: string, // gateway domain
 *     lineType: string,      // MOBILE | VOIP | UNKNOWN (LANDLINE aborts)
 *     rewritten: boolean,    // whether the AI rewriter changed the text
 *     safe: boolean          // always true if we got here (blocked => throw)
 *   }
 * @throws {Error} BLOCKED_BY_SAFETY_FILTER (err.code) if a blocked keyword is
 *   found, or "Landline cannot receive MMS" if the number is a landline.
 */
export async function prepareMMSPayload(phoneNumber, text, context = {}) {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    throw new Error('phoneNumber is required');
  }
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('text is required and must be non-empty');
  }

  // Ensure the DB connection is warm before the services run.
  await connectDB();

  // --- Step 1: Safety filter ------------------------------------------------
  // Throws BLOCKED_BY_SAFETY_FILTER on match (and logs the attempt).
  await safetyFilter(text, { ...context, phoneNumber });

  // --- Step 2: AI rewrite ---------------------------------------------------
  // Fail-open: returns the original text if no Gemini key / API error.
  const rewritten = await rewriteMessage(text);
  const wasRewritten = rewritten !== text && rewritten.trim().length > 0;

  // --- Step 3: Carrier gateway resolution -----------------------------------
  // Throws "Landline cannot receive MMS" for landlines; otherwise returns
  // "<digits>@<domain>".
  const to = await getCarrierGateway(phoneNumber);

  // Extract the carrier domain + digits from the resolved address for the
  // payload metadata (the Phase 3 router may want to group sends by carrier).
  const atIndex = to.lastIndexOf('@');
  const carrierDomain = atIndex > -1 ? to.slice(atIndex + 1) : '';
  const digits = atIndex > -1 ? to.slice(0, atIndex) : to;

  // Determine lineType from the cache (best-effort; default MOBILE since
  // landlines already aborted above). We re-read the cache doc that
  // getCarrierGateway just persisted/used to surface accurate line info.
  let lineType = 'MOBILE';
  try {
    // Late import to avoid a circular dependency at module load time.
    const { CarrierCache } = await import('@/lib/core');
    const cached = await CarrierCache.findOne({ phoneNumber: digits }).lean();
    if (cached && cached.lineType) lineType = cached.lineType;
  } catch {
    // Non-fatal: keep the MOBILE default.
  }

  return {
    to,
    text: wasRewritten ? rewritten : text,
    originalText: text,
    phoneNumber: digits,
    carrierDomain,
    lineType,
    rewritten: wasRewritten,
    safe: true,
  };
}

// ---------------------------------------------------------------------------
// Re-exports — convenience single import for the Phase 3 router
// ---------------------------------------------------------------------------

export { getCarrierGateway, rewriteMessage, safetyFilter };
