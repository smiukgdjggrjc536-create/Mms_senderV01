// ============================================================================
// Gemini AI Message Engine — Email-to-MMS Gateway Backend Engine (Phase 2)
// ============================================================================
// Rewrites an outbound message body into a unique variant before MMS delivery.
// The rewrite preserves the exact meaning, tone, phone numbers, URLs, and
// numeric values, but subtly alters phrasing so each message is distinct —
// this protects sender reputation and reduces the chance of duplicate-content
// filtering by carriers.
//
// The Gemini API key is read live from the SystemConfig singleton (set by the
// admin via the Phase 1 gateway config endpoint), so rotating the key never
// requires a redeploy.
//
// NON-DESTRUCTIVE: brand-new service module. Reuses the project's established
// Gemini fetch pattern (see src/lib/sendingEngine.js geminiSpamReview) — same
// endpoint, same model fallback list, same key validation — but operates on
// the SystemConfig.geminiApiKey rather than the legacy GeminiApi pool, so the
// existing spam-review / sender-ranking logic is untouched.
// ============================================================================

import { connectDB, SystemConfig } from '@/lib/core';

// ---------------------------------------------------------------------------
// Constants — mirror sendingEngine.js so model fallback is consistent
// ---------------------------------------------------------------------------

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models';

// Candidate models tried in order. The newest flash models are preferred for
// a fast, cheap rewrite; older models are fallbacks if a 404 is returned.
const GEMINI_FB_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-flash-latest',
];

// The rewrite prompt. Instructs the model to keep meaning/tone/numbers exact
// and to return RAW text only (no markdown, no preamble) so the output can be
// dropped straight into the MMS body.
const REWRITE_PROMPT_PREFIX =
  'Rewrite this message for MMS delivery. Retain exact meaning, tone, and numbers. ' +
  'Subtly alter phrasing for uniqueness. Return RAW text only. Message: ';

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
// Core rewrite function
// ---------------------------------------------------------------------------

/**
 * Rewrite a message body into a unique variant using Gemini.
 *
 * Behaviour:
 *   - Reads `geminiApiKey` from SystemConfig (live, no redeploy needed).
 *   - If no valid key is configured (missing or not starting with "AIza"),
 *     returns the original text unchanged so the pipeline never blocks on a
 *     missing key in dev/preview — the send still goes out.
 *   - Tries each candidate model in order; on 404 (model not found) it tries
 *     the next; on 400/403/429 (key/quota issue) it stops and returns the
 *     original text (fail-open, never block a send on an AI hiccup).
 *   - Strips any accidental markdown fences / preamble from the response so
 *     the returned string is raw text only.
 *
 * @param {string} text - the original message body
 * @returns {Promise<string>} the rewritten (or original on fallback) text
 */
export async function rewriteMessage(text) {
  // Fail-open: if there's nothing to rewrite, return as-is.
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return text || '';
  }

  await connectDB();

  const cfg = await getSystemConfigDoc();
  const apiKey = (cfg.geminiApiKey || '').trim();

  // No key or invalid format -> return original (fail-open for dev/preview).
  if (!apiKey || !apiKey.startsWith('AIza')) {
    console.warn('[aiRewriter] No valid Gemini API key configured in SystemConfig — returning original text.');
    return text;
  }

  const prompt = REWRITE_PROMPT_PREFIX + JSON.stringify(text.substring(0, 4000));

  for (const model of GEMINI_FB_MODELS) {
    try {
      const url = `${GEMINI_ENDPOINT}/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            // Low temperature for faithful, deterministic-ish rewrites that
            // preserve numbers/tone; just enough variance for uniqueness.
            temperature: 0.4,
            maxOutputTokens: 1024,
          },
        }),
      });

      if (!res.ok) {
        if (res.status === 404) continue; // model not available -> try next
        // 400 / 403 / 429 -> key or quota issue; stop trying (fail-open).
        if (res.status === 400 || res.status === 403 || res.status === 429) {
          const errBody = await res.text().catch(() => '');
          console.warn(`[aiRewriter] Gemini ${res.status} on ${model}: ${errBody.slice(0, 200)}`);
          return text;
        }
        continue; // other transient errors -> try next model
      }

      const data = await res.json();
      const raw =
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') ||
        '';

      const cleaned = stripMarkdownAndPreamble(raw);
      if (cleaned && cleaned.trim().length > 0) {
        return cleaned.trim();
      }
      // Empty output from this model -> try the next one.
      continue;
    } catch (err) {
      // Network/parse error on this model -> try the next.
      console.warn(`[aiRewriter] ${model} threw: ${err.message}`);
      continue;
    }
  }

  // All models failed -> fail-open with the original text.
  console.warn('[aiRewriter] All Gemini models exhausted — returning original text.');
  return text;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip accidental markdown fences (``` ... ```), leading "Here is ...:" style
 * preambles, and surrounding quotes so the output is raw text only.
 * @param {string} raw
 * @returns {string}
 */
function stripMarkdownAndPreamble(raw) {
  if (!raw) return '';
  let out = raw;

  // Remove ```text ... ``` or ``` ... ``` fences.
  out = out.replace(/^```[a-zA-Z]*\n?/g, '').replace(/```$/g, '');

  // Remove a common leading preamble like "Here is the rewritten message:" or
  // "Rewritten: " that some models emit despite the RAW-only instruction.
  out = out.replace(/^(here(?:'s| is)[^:\n]*:|rewritten(?: message)?:|sure[,!]?\s*)\s*/i, '');

  // Strip wrapping double/straight quotes that wrap the whole body.
  out = out.replace(/^["“']\s*/, '').replace(/\s*["”']$/, '');

  return out.trim();
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { stripMarkdownAndPreamble, GEMINI_FB_MODELS, REWRITE_PROMPT_PREFIX };
