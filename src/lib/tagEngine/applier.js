// ============================================================================
// V7 P2.4 — Tag Applier
// ============================================================================
// applyTags(htmlOrText, map): single-pass regex replacement using the same
// compiled token regex; values inserted as-is (they are already safe text);
// unknown tokens left untouched; function is idempotent (running twice with
// the same map = same output).
//
// Works on both raw HTML mode and plain-text mode.
// Never escapes or double-encodes: if body contains &amp; it stays &amp;.
// ============================================================================

import { TOKEN_REGEX } from './tagRegistry.js';

/**
 * Apply a token→value map to a string (HTML or plain text).
 *
 * Single-pass: the regex /#([A-Z0-9_]+)#/g is executed once. For each match,
 * if the token exists in the map, it's replaced with the mapped value.
 * Unknown tokens are left untouched.
 *
 * Idempotency: since the replaced values do NOT contain #TOKEN# patterns
 * (generators produce values like "INV-2026-482913", "12 Mar 2026", etc.),
 * running applyTags twice with the same map produces the same output.
 *
 * Safety: values are inserted as-is. They are already safe text produced by
 * the generators (no user input flows directly into values without generation).
 * The function does NOT escape or double-encode — &amp; stays &amp;.
 *
 * @param {string} htmlOrText — the body or subject text
 * @param {Map<string, string>|object} map — token → value (Map or plain object)
 * @returns {string} the text with known tokens replaced
 */
export function applyTags(htmlOrText, map) {
  if (!htmlOrText || typeof htmlOrText !== 'string') {
    return htmlOrText || '';
  }
  if (!map) {
    return htmlOrText;
  }

  // Normalize map to a plain object for O(1) lookup
  const lookup = map instanceof Map ? Object.fromEntries(map) : map;

  // Reset the global regex lastIndex (defensive — the regex is shared)
  TOKEN_REGEX.lastIndex = 0;

  // Single-pass replacement
  return htmlOrText.replace(TOKEN_REGEX, (fullMatch) => {
    if (Object.prototype.hasOwnProperty.call(lookup, fullMatch)) {
      return String(lookup[fullMatch]);
    }
    // Unknown token — leave untouched
    return fullMatch;
  });
}

/**
 * Count how many tokens in the text would be replaced by this map.
 * Useful for preview and diagnostics.
 * @param {string} htmlOrText
 * @param {Map<string, string>|object} map
 * @returns {number}
 */
export function countReplacedTokens(htmlOrText, map) {
  if (!htmlOrText || !map) return 0;
  const lookup = map instanceof Map ? Object.fromEntries(map) : map;
  TOKEN_REGEX.lastIndex = 0;
  let count = 0;
  let match;
  while ((match = TOKEN_REGEX.exec(htmlOrText)) !== null) {
    if (Object.prototype.hasOwnProperty.call(lookup, match[0])) {
      count++;
    }
  }
  return count;
}

/**
 * List unknown tokens in the text (tokens that appear as #TOKEN# but are
 * not in the map and not built-in). Useful for diagnostics.
 * @param {string} htmlOrText
 * @param {Map<string, string>|object} map
 * @returns {string[]} array of unknown token strings
 */
export function listUnknownTokens(htmlOrText, map) {
  if (!htmlOrText) return [];
  const lookup = map instanceof Map ? Object.fromEntries(map) : map;
  TOKEN_REGEX.lastIndex = 0;
  const unknown = new Set();
  let match;
  while ((match = TOKEN_REGEX.exec(htmlOrText)) !== null) {
    if (!Object.prototype.hasOwnProperty.call(lookup, match[0])) {
      unknown.add(match[0]);
    }
  }
  return Array.from(unknown);
}

export default {
  applyTags,
  countReplacedTokens,
  listUnknownTokens,
};
