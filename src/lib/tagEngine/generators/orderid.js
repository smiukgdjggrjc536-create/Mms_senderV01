// ============================================================================
// V7 P2.2 — Generator Library: Order ID generator
// ============================================================================
// Produces order IDs like ORD-<8 alphanumeric>.
// All randomness from Node crypto.randomInt.
// ============================================================================

import crypto from 'crypto';

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Generate an order ID.
 * @param {object} ctx - { recipientEmail, campaignId, salt, index }
 * @param {object} [opts] - { prefix, length, charset }
 * @returns {string} e.g. "ORD-K7M3X9Q2"
 */
export function generateOrderId(ctx = {}, opts = {}) {
  const prefix = opts.prefix || 'ORD';
  const length = opts.length || 8;
  const charset = opts.charset || CHARSET;
  const separator = opts.separator || '-';

  let body = '';
  for (let i = 0; i < length; i++) {
    body += charset[crypto.randomInt(0, charset.length)];
  }
  return `${prefix}${separator}${body}`;
}

export default generateOrderId;
