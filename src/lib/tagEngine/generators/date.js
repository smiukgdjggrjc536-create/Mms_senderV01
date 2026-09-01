// ============================================================================
// V7 P2.2 — Generator Library: Smart Date generator
// ============================================================================
// smartDate(offsetDaysMin, offsetDaysMax, format)
//   • Random offset in [offsetDaysMin, offsetDaysMax] from today.
//   • Formats: "ISO" (2026-03-12), "DD/MM/YYYY" (12/03/2026),
//     "DD MMM YYYY" (12 Mar 2026), "MM/DD/YYYY" (03/12/2026).
//   • The offset is derived from crypto.randomInt so two recipients get
//     different dates with overwhelming probability.
//
// Used by #DATE# and #DUE# tokens.
// ============================================================================

import crypto from 'crypto';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Format a Date object into the requested format.
 * @param {Date} d
 * @param {string} format — "ISO" | "DD/MM/YYYY" | "DD MMM YYYY" | "MM/DD/YYYY"
 * @returns {string}
 */
export function formatDate(d, format) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const monthName = MONTHS[d.getMonth()];

  switch (format) {
    case 'ISO':
      return `${yyyy}-${mm}-${dd}`;
    case 'DD/MM/YYYY':
      return `${dd}/${mm}/${yyyy}`;
    case 'MM/DD/YYYY':
      return `${mm}/${dd}/${yyyy}`;
    case 'DD MMM YYYY':
      return `${dd} ${monthName} ${yyyy}`;
    default:
      // Unknown format → fall back to DD MMM YYYY (most readable)
      return `${dd} ${monthName} ${yyyy}`;
  }
}

/**
 * Generate a smart date.
 * @param {object} ctx - { recipientEmail, campaignId, salt, index }
 * @param {object} [opts] - { offsetDaysMin, offsetDaysMax, format }
 * @returns {string} formatted date string
 */
export function smartDate(ctx = {}, opts = {}) {
  const offsetDaysMin = opts.offsetDaysMin !== undefined ? Number(opts.offsetDaysMin) : 7;
  const offsetDaysMax = opts.offsetDaysMax !== undefined ? Number(opts.offsetDaysMax) : 30;
  const format = opts.format || 'DD MMM YYYY';

  // Ensure min <= max
  const lo = Math.min(offsetDaysMin, offsetDaysMax);
  const hi = Math.max(offsetDaysMin, offsetDaysMax);

  // Crypto-random offset in [lo, hi] (inclusive)
  const offset = lo + crypto.randomInt(0, hi - lo + 1);

  const d = new Date();
  d.setDate(d.getDate() + offset);

  return formatDate(d, format);
}

/**
 * Parse a formatted date back to a Date object — used by tests to verify
 * that generated dates round-trip correctly.
 * @param {string} str
 * @param {string} format
 * @returns {Date|null}
 */
export function parseDate(str, format) {
  if (!str || typeof str !== 'string') return null;
  try {
    switch (format) {
      case 'ISO': {
        // 2026-03-12
        const [y, m, d] = str.split('-').map(Number);
        return new Date(y, m - 1, d);
      }
      case 'DD/MM/YYYY': {
        const [d, m, y] = str.split('/').map(Number);
        return new Date(y, m - 1, d);
      }
      case 'MM/DD/YYYY': {
        const [m, d, y] = str.split('/').map(Number);
        return new Date(y, m - 1, d);
      }
      case 'DD MMM YYYY': {
        // 12 Mar 2026
        const parts = str.split(' ');
        const d = parseInt(parts[0], 10);
        const monthIdx = MONTHS.indexOf(parts[1]);
        const y = parseInt(parts[2], 10);
        if (monthIdx < 0) return null;
        return new Date(y, monthIdx, d);
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

// smartDate is the default export (aliased from the function declaration above)
export { smartDate as default };
