// ============================================================================
// Safety Filter — Email-to-MMS Gateway Backend Engine (Phase 2)
// ============================================================================
// Inspects an outbound message body against the `blockedKeywords` list stored
// in the SystemConfig singleton. If any blocked keyword/phrase is present, the
// send is aborted and a `BLOCKED_BY_SAFETY_FILTER` activity log entry is
// recorded so admins can audit blocked attempts from the dashboard.
//
// This is the phishing / sensitive-content guard rail: it runs BEFORE the AI
// rewriter and BEFORE carrier lookup so a blocked message never costs a Gemini
// token, a carrier-lookup API call, or an email send.
//
// NON-DESTRUCTIVE: brand-new service module. It only reads SystemConfig and
// writes to the existing ActivityLog model (via the project's logActivity
// helper from @/lib/core). No existing model, route, or service is modified.
// ============================================================================

import { connectDB, SystemConfig, logActivity } from '@/lib/core';

// ---------------------------------------------------------------------------
// SystemConfig helper (singleton read — same pattern as Phase 1)
// ---------------------------------------------------------------------------

/**
 * Fetch the singleton SystemConfig document, creating defaults if absent.
 * @returns {Promise<object>} the SystemConfig mongoose doc
 */
async function getSystemConfigDoc() {
  let cfg = await SystemConfig.findOne({});
  if (!cfg) {
    cfg = await SystemConfig.create({});
  }
  return cfg;
}

// ---------------------------------------------------------------------------
// Keyword matching
// ---------------------------------------------------------------------------

/**
 * Determine whether the message body contains any blocked keyword/phrase.
 *
 * Matching is case-insensitive and substring-based on whole tokens where
 * practical. Because blockedKeywords can be multi-word phrases (e.g.
 * "credit card", "verify code"), we do a straightforward case-insensitive
 * substring search on the normalized text — this is intentionally conservative
 * (better to over-block a sensitive phrase than to leak it). Word-boundary
 * handling is approximated by lowercasing both sides and searching for the
 * keyword as a standalone fragment.
 *
 * @param {string} text - message body to inspect
 * @param {string[]} blockedKeywords - keywords from SystemConfig
 * @returns {{blocked: boolean, matchedKeyword: string|null, matchedIndex: number}}
 */
function findBlockedKeyword(text, blockedKeywords) {
  if (!text || typeof text !== 'string') return { blocked: false, matchedKeyword: null, matchedIndex: -1 };
  if (!Array.isArray(blockedKeywords) || blockedKeywords.length === 0) {
    return { blocked: false, matchedKeyword: null, matchedIndex: -1 };
  }

  const lowerText = text.toLowerCase();
  for (let i = 0; i < blockedKeywords.length; i++) {
    const kw = String(blockedKeywords[i] || '').trim().toLowerCase();
    if (!kw) continue;
    if (lowerText.includes(kw)) {
      return { blocked: true, matchedKeyword: kw, matchedIndex: i };
    }
  }
  return { blocked: false, matchedKeyword: null, matchedIndex: -1 };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Inspect a message body against the blockedKeywords in SystemConfig.
 *
 * If the safety filter is enabled (`enablePhishingFilter === true`) AND a
 * blocked keyword is found, the function:
 *   1. Records a `BLOCKED_BY_SAFETY_FILTER` activity log entry (so admins can
 *      audit blocked attempts).
 *   2. Throws an Error with the code `BLOCKED_BY_SAFETY_FILTER` so the caller
 *      (prepareMMSPayload) can abort the send pipeline cleanly.
 *
 * If the filter is disabled, or no keyword matches, the function resolves
 * normally and the pipeline continues.
 *
 * @param {string} text - the outbound message body to inspect
 * @param {object} [context] - optional metadata for the activity log
 *   @param {string} [context.userId] - acting user id (for logActivity)
 *   @param {string} [context.actorType] - 'admin' | 'user' (default 'user')
 *   @param {string} [context.username] - acting username
 *   @param {string} [context.phoneNumber] - target phone (for traceability)
 * @returns {Promise<{safe: boolean, checkedKeywords: number}>}
 * @throws {Error} with message starting `BLOCKED_BY_SAFETY_FILTER` when blocked.
 */
export async function safetyFilter(text, context = {}) {
  await connectDB();

  const cfg = await getSystemConfigDoc();

  // Master switch: if the admin has disabled the phishing filter, pass through.
  if (cfg.enablePhishingFilter === false) {
    return { safe: true, checkedKeywords: 0, filterEnabled: false };
  }

  const blockedKeywords = Array.isArray(cfg.blockedKeywords) ? cfg.blockedKeywords : [];
  const { blocked, matchedKeyword } = findBlockedKeyword(text, blockedKeywords);

  if (blocked) {
    // Log the blocked attempt so it is auditable in the admin dashboard.
    const actorType = context.actorType || 'user';
    const actorId = context.userId || 'system';
    const username = context.username || 'unknown';
    const phoneHint = context.phoneNumber ? ` to ${context.phoneNumber}` : '';
    const detail = `BLOCKED_BY_SAFETY_FILTER — outbound message blocked${phoneHint}. Matched keyword: "${matchedKeyword}". Message preview: "${String(text).substring(0, 120)}".`;

    try {
      await logActivity(actorId, actorType, username, 'BLOCKED_BY_SAFETY_FILTER', detail, null);
    } catch (logErr) {
      // Logging must never mask the block decision — swallow log errors.
      console.warn('[safetyFilter] logActivity failed (block still enforced):', logErr.message);
    }

    // Abort the pipeline with a clearly-typed error the caller can detect.
    const err = new Error(`BLOCKED_BY_SAFETY_FILTER: message contains blocked keyword "${matchedKeyword}"`);
    err.code = 'BLOCKED_BY_SAFETY_FILTER';
    err.matchedKeyword = matchedKeyword;
    throw err;
  }

  return { safe: true, checkedKeywords: blockedKeywords.length, filterEnabled: true };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { findBlockedKeyword };
