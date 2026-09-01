// ============================================================================
// V7 P2.2 — Generator Library: Tracking number generator
// ============================================================================
// Produces carrier-plausible tracking numbers (e.g., 9400 + 11 digits for
// USPS-style). Configurable prefix and digit count.
// All randomness from Node crypto.randomInt.
// ============================================================================

import crypto from 'crypto';

/**
 * Generate a tracking number.
 * @param {object} ctx - { recipientEmail, campaignId, salt, index }
 * @param {object} [opts] - { prefix, digits }
 * @returns {string} e.g. "9400111205217384920573"
 */
export function generateTracking(ctx = {}, opts = {}) {
  const prefix = opts.prefix || '9400';
  const digits = opts.digits || 11;

  let body = '';
  for (let i = 0; i < digits; i++) {
    body += crypto.randomInt(0, 10).toString();
  }
  return `${prefix}${body}`;
}

export default generateTracking;
