// ============================================================================
// V7 P2.2 — Generator Library: Random alphanumeric generator
// ============================================================================
// Charset-driven random with min/max length.
// All randomness from Node crypto.randomInt.
// ============================================================================

import crypto from 'crypto';

const DEFAULT_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Parse a charset shorthand (e.g. "A-Z0-9") into the actual character set.
 * Supports ranges like A-Z, a-z, 0-9.
 * @param {string} shorthand
 * @returns {string}
 */
function expandCharset(shorthand) {
  if (!shorthand) return DEFAULT_CHARSET;
  // If it contains literal characters (not just ranges), use as-is
  if (!/[A-Z]-[A-Z]|a-z|[0-9]-[0-9]/.test(shorthand)) {
    return shorthand;
  }
  let result = '';
  let i = 0;
  while (i < shorthand.length) {
    if (
      i + 2 < shorthand.length &&
      shorthand[i + 1] === '-' &&
      /[A-Za-z0-9]/.test(shorthand[i]) &&
      /[A-Za-z0-9]/.test(shorthand[i + 2])
    ) {
      // Range like A-Z
      const start = shorthand.charCodeAt(i);
      const end = shorthand.charCodeAt(i + 2);
      for (let c = start; c <= end; c++) {
        result += String.fromCharCode(c);
      }
      i += 3;
    } else {
      result += shorthand[i];
      i++;
    }
  }
  return result || DEFAULT_CHARSET;
}

/**
 * Generate a random alphanumeric string.
 * @param {object} ctx - { recipientEmail, campaignId, salt, index }
 * @param {object} [opts] - { minLength, maxLength, charset, prefix, suffix }
 * @returns {string}
 */
export function generateRandom(ctx = {}, opts = {}) {
  const minLength = Number(opts.minLength) || 8;
  const maxLength = Number(opts.maxLength) || 12;
  const charset = expandCharset(opts.charset);
  const prefix = opts.prefix || '';
  const suffix = opts.suffix || '';

  const lo = Math.min(minLength, maxLength);
  const hi = Math.max(minLength, maxLength);
  // Random length in [lo, hi]
  const length = lo + crypto.randomInt(0, hi - lo + 1);

  let body = '';
  for (let i = 0; i < length; i++) {
    body += charset[crypto.randomInt(0, charset.length)];
  }
  return `${prefix}${body}${suffix}`;
}

export default generateRandom;
export { expandCharset };
