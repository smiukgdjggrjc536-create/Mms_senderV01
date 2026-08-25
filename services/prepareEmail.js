// ============================================================================
// Email Payload Preparation — Email Sending Module
// ============================================================================
// Orchestrates the two preparation steps into a single helper that the
// bulk send engine calls before dispatching an email:
//
//   prepareEmailPayload(emailAddress, text, context)
//     1. Safety filter — aborts with BLOCKED_BY_SAFETY_FILTER if the text
//        contains a blocked keyword (no Gemini token / send spent).
//     2. AI rewriter — produces a unique variant of the (safe) text via Gemini.
//        (No carrier lookup — the recipient IS an email address, so there is
//         nothing to resolve. The "to" field is the email the user provided.)
//
// Returns a ready-to-send payload object: { to, text, originalText, email,
// domain, rewritten, safe }. Any abort (safety block) is thrown as a typed
// Error so the bulk engine can branch cleanly.
//
// This is the EMAIL equivalent of the former prepareMMSPayload(), with the
// carrier-lookup step removed (carriers are irrelevant for direct email sends).
// ============================================================================

import { connectDB } from '@/lib/core';
import { rewriteMessage } from './aiRewriter.js';
import { safetyFilter } from './safetyFilter.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Prepare a complete email payload for sending.
 *
 * @param {string} emailAddress - the recipient email address (raw is fine)
 * @param {string} text - the original message body
 * @param {object} [context] - optional metadata forwarded to safetyFilter for
 *   audit logging (userId, actorType, username, email).
 * @returns {Promise<object>} payload:
 *   {
 *     to: string,            // the recipient email address (lowercased domain)
 *     text: string,          // final (rewritten) message body
 *     originalText: string,  // original message body
 *     email: string,         // normalized recipient email
 *     domain: string,        // recipient domain (e.g. "gmail.com")
 *     rewritten: boolean,    // whether the AI rewriter changed the text
 *     safe: boolean          // always true if we got here (blocked => throw)
 *   }
 * @throws {Error} BLOCKED_BY_SAFETY_FILTER (err.code) if a blocked keyword is
 *   found.
 */
export async function prepareEmailPayload(emailAddress, text, context = {}) {
  if (!emailAddress || typeof emailAddress !== 'string') {
    throw new Error('emailAddress is required');
  }
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('text is required and must be non-empty');
  }

  // Ensure the DB connection is warm before the services run.
  await connectDB();

  // Normalize the email (trim, strip angle brackets, lowercase domain).
  let to = emailAddress.trim();
  if (to.startsWith('<') && to.endsWith('>')) to = to.slice(1, -1).trim();
  const atIdx = to.lastIndexOf('@');
  const email = atIdx > -1
    ? to.slice(0, atIdx) + '@' + to.slice(atIdx + 1).toLowerCase()
    : to;
  const domain = atIdx > -1 ? email.slice(atIdx + 1) : '';

  // --- Step 1: Safety filter ------------------------------------------------
  // Throws BLOCKED_BY_SAFETY_FILTER on match (and logs the attempt).
  await safetyFilter(text, { ...context, email });

  // --- Step 2: AI rewrite ---------------------------------------------------
  // Fail-open: returns the original text if no Gemini key / API error.
  const rewritten = await rewriteMessage(text);
  const wasRewritten = rewritten !== text && rewritten.trim().length > 0;

  return {
    to: email,
    text: wasRewritten ? rewritten : text,
    originalText: text,
    email,
    domain,
    rewritten: wasRewritten,
    safe: true,
  };
}

// ---------------------------------------------------------------------------
// Re-exports — convenience single import for the bulk send engine
// ---------------------------------------------------------------------------

export { rewriteMessage, safetyFilter };
