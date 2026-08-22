// ============================================================================
// MODULE 4: Dynamic AI Polymorphism (Gemini Engine) — Pre-Flight Middleware
// ============================================================================
// Target: Carrier Spam Filter Evasion via Unique Payloads
// Design Pattern: Pre-Flight Middleware Injection
//
// Core Logic:
//   1. Inject the Gemini API call as a pre-flight middleware step right
//      before the Nodemailer/Graph API dispatch function.
//   2. The AI prompt instructs the model to rewrite the message body for
//      structural uniqueness while keeping core intent intact.
//   3. FALLBACK LOGIC: Wrap the AI call in try-catch. If Gemini times out
//      or fails, fall back to a local Regex-based synonym spinner so the
//      queue NEVER halts.
//
// Integration:
//   prepareMms.js calls rewriteWithPolymorph(originalText, { geminiApiKey })
//     → returns { text, source: 'gemini' | 'local_spinner' | 'original', rewritten: bool }
//
// NON-DESTRUCTIVE: brand-new service module. Reuses callGemini from @/lib/core
// for the AI call (same key/endpoint logic as the rest of the platform).
// ============================================================================

import { connectDB, callGemini, GeminiApi, SystemConfig } from '@/lib/core';
import {
  AI_POLYMORPH_PROMPT,
  LOCAL_SYNONYMS,
  AI_REWRITE_TIMEOUT_MS,
  DYNAMIC_CONFIG_KEYS,
} from '@/lib/gateway/constants';
import { getDynamicConfig } from '@/lib/redis';

// ---------------------------------------------------------------------------
// Pre-Flight Middleware: rewriteWithPolymorph(originalText, opts)
// ---------------------------------------------------------------------------
// This is the core pre-flight function. It:
//   1. Checks if AI polymorphism is enabled (Redis dynamic config → SystemConfig)
//   2. Calls Gemini to rewrite the message for structural uniqueness
//   3. On ANY failure (timeout, API error, empty response) → local Regex spinner
//   4. If local spinner also can't help → returns original (queue never halts)
//
// Returns: { text, source, rewritten, error }
//   • source: 'gemini' | 'local_spinner' | 'original'
//   • rewritten: true if the text was changed from the original
//   • error: null on success, error string on fallback
// ---------------------------------------------------------------------------
export async function rewriteWithPolymorph(originalText, opts = {}) {
  if (!originalText || typeof originalText !== 'string' || originalText.trim().length === 0) {
    return { text: originalText || '', source: 'original', rewritten: false, error: 'Empty input' };
  }

  // ── Check if AI polymorphism is enabled ──
  // Priority: Redis dynamic config (admin can toggle without restart) → SystemConfig
  let aiEnabled;
  try {
    const dynEnabled = await getDynamicConfig(DYNAMIC_CONFIG_KEYS.aiPolymorphEnabled, null);
    if (dynEnabled !== null) {
      aiEnabled = dynEnabled;
    } else {
      await connectDB();
      const cfg = await SystemConfig.findOne({}).lean() || {};
      aiEnabled = cfg.aiPolymorphEnabled !== false; // default true unless explicitly disabled
    }
  } catch (_e) {
    aiEnabled = true; // default to enabled on config read error
  }

  if (!aiEnabled) {
    return { text: originalText, source: 'original', rewritten: false, error: null };
  }

  // ── Step 1: Attempt Gemini rewrite ──
  try {
    const geminiResult = await callGeminiForRewrite(originalText, opts);
    if (geminiResult.ok && geminiResult.text && geminiResult.text.trim().length > 0) {
      const rewritten = geminiResult.text.trim();
      // Safety: ensure the rewrite isn't drastically different in length
      // (carrier spam filters flag messages that balloon or shrink).
      const lenRatio = rewritten.length / originalText.length;
      if (lenRatio > 0.5 && lenRatio < 2.0) {
        return {
          text: rewritten,
          source: 'gemini',
          rewritten: rewritten !== originalText,
          error: null,
        };
      }
    }
    // Gemini returned empty or length-mismatched → fall through to local spinner
    throw new Error(geminiResult.error || 'Gemini returned unusable response');
  } catch (geminiError) {
    // ── Step 2: FALLBACK — Local Regex Synonym Spinner ──
    try {
      const spun = localSynonymSpin(originalText);
      if (spun && spun !== originalText) {
        return {
          text: spun,
          source: 'local_spinner',
          rewritten: true,
          error: `Gemini failed (${geminiError.message}), used local spinner`,
        };
      }
    } catch (_spinError) {
      // Local spinner also failed — fall through to original
    }

    // ── Step 3: Ultimate fallback — return original (queue never halts) ──
    return {
      text: originalText,
      source: 'original',
      rewritten: false,
      error: `Gemini failed (${geminiError.message}), local spinner no-op`,
    };
  }
}

// ---------------------------------------------------------------------------
// Gemini API Call for Rewrite — uses the platform's callGemini helper
// ---------------------------------------------------------------------------
// Resolves the best Gemini API key (from GeminiApi collection or SystemConfig)
// and calls the model with the polymorphism prompt. Wrapped in a timeout so
// it never blocks the queue for more than AI_REWRITE_TIMEOUT_MS.
// ---------------------------------------------------------------------------
async function callGeminiForRewrite(originalText, opts = {}) {
  await connectDB();

  // Resolve the Gemini API key:
  //   1. Explicit key passed in opts.geminiApiKey (highest priority)
  //   2. SystemConfig.geminiApiKey (admin-configured singleton)
  //   3. Best GeminiApi from the collection (getBestGeminiApi pattern)
  let geminiApi = null;

  if (opts.geminiApiKey) {
    geminiApi = {
      _id: 'opts',
      apiKey: opts.geminiApiKey,
      endpoint: opts.geminiEndpoint || 'https://generativelanguage.googleapis.com/v1beta/models',
      model: opts.geminiModel || 'gemini-1.5-flash',
    };
  } else {
    // Check SystemConfig first.
    const cfg = await SystemConfig.findOne({}).lean() || {};
    if (cfg.geminiApiKey) {
      geminiApi = {
        _id: 'systemconfig',
        apiKey: cfg.geminiApiKey,
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
        model: 'gemini-1.5-flash',
      };
    } else {
      // Fall back to the GeminiApi collection — pick the one with no recent error.
      const candidate = await GeminiApi.findOne({ lastError: null })
        .sort({ requestCount: 1 })
        .lean();
      if (candidate) {
        geminiApi = {
          _id: candidate._id,
          apiKey: candidate.apiKey,
          endpoint: candidate.endpoint || 'https://generativelanguage.googleapis.com/v1beta/models',
          model: candidate.model || 'gemini-1.5-flash',
        };
      }
    }
  }

  if (!geminiApi || !geminiApi.apiKey) {
    return { ok: false, error: 'No Gemini API key configured', text: '' };
  }

  // Build the prompt — inject the original message into the template.
  const prompt = AI_POLYMORPH_PROMPT.replace('{MESSAGE}', originalText);

  // Race the Gemini call against a timeout so it never blocks the queue.
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Gemini rewrite timeout')), AI_REWRITE_TIMEOUT_MS)
  );

  // callGemini is imported from @/lib/core — it handles model fallback, error
  // logging, and the GeminiApi usage update. We pass a lightweight object
  // that matches the shape callGemini expects.
  try {
    const result = await Promise.race([
      callGemini(geminiApi, prompt, { temperature: 0.8, maxOutputTokens: 1024 }),
      timeoutPromise,
    ]);

    if (result.ok && result.text) {
      return { ok: true, text: result.text.trim(), error: null };
    }
    return { ok: false, error: result.error || 'Gemini returned no text', text: '' };
  } catch (err) {
    return { ok: false, error: err.message, text: '' };
  }
}

// ---------------------------------------------------------------------------
// Local Regex Synonym Spinner — FALLBACK when Gemini fails
// ---------------------------------------------------------------------------
// Replaces common words with random synonyms from the LOCAL_SYNONYMS map.
// Also applies minor structural variation (punctuation, spacing) to evade
// simple fingerprinting. This is deterministic-safe: the core meaning is
// preserved because synonyms are meaning-equivalent.
//
// This function NEVER throws — it always returns a string.
// ---------------------------------------------------------------------------
export function localSynonymSpin(text) {
  if (!text || typeof text !== 'string') return text || '';

  let spun = text;

  // Replace each known word with a random synonym (case-insensitive, whole word).
  for (const [word, synonyms] of Object.entries(LOCAL_SYNONYMS)) {
    if (synonyms.length === 0) continue;
    // Build a regex that matches the word as a whole word, case-insensitive.
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');

    spun = spun.replace(regex, (match) => {
      // Pick a random synonym that isn't the original word.
      const picks = synonyms.filter((s) => s.toLowerCase() !== match.toLowerCase());
      if (picks.length === 0) return match;
      const pick = picks[Math.floor(Math.random() * picks.length)];
      // Preserve the original case of the first letter.
      if (match[0] === match[0].toUpperCase()) {
        return pick.charAt(0).toUpperCase() + pick.slice(1);
      }
      return pick;
    });
  }

  // Minor structural variation: randomly use an em-dash instead of a hyphen
  // in some cases (carrier filters sometimes fingerprint hyphen usage).
  if (Math.random() > 0.5 && spun.includes(' - ')) {
    spun = spun.replace(' - ', ' — ');
  }

  // Occasionally swap double spaces (if any) for single — normalizes whitespace.
  spun = spun.replace(/  +/g, ' ');

  return spun;
}

// ---------------------------------------------------------------------------
// Middleware wrapper — can be composed into a dispatch pipeline
// ---------------------------------------------------------------------------
// Usage:
//   const dispatchWithAI = composePolymorphMiddleware(sendViaNodemailer);
//   await dispatchWithAI({ to, text, ... });
//
// This wraps any dispatch function so the text is rewritten before the call.
// ---------------------------------------------------------------------------
export function composePolymorphMiddleware(dispatchFn) {
  return async function polymorphDispatch(sendArgs) {
    if (!sendArgs || !sendArgs.text) {
      return dispatchFn(sendArgs);
    }

    const { text: originalText, ...rest } = sendArgs;
    const result = await rewriteWithPolymorph(originalText, {
      geminiApiKey: sendArgs.geminiApiKey,
      geminiEndpoint: sendArgs.geminiEndpoint,
      geminiModel: sendArgs.geminiModel,
    });

    // Attach the rewrite metadata so the caller can log it.
    const enriched = {
      ...rest,
      text: result.text,
      _polymorph: {
        source: result.source,
        rewritten: result.rewritten,
        error: result.error,
        originalText,
      },
    };

    return dispatchFn(enriched);
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export default {
  rewriteWithPolymorph,
  localSynonymSpin,
  composePolymorphMiddleware,
};
