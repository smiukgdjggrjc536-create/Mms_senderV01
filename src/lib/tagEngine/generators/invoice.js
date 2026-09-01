// ============================================================================
// V7 P2.2 — Generator Library: Invoice generator
// ============================================================================
// Produces invoice numbers like INV-2026-482913 (configurable prefix/segments).
// All randomness from Node crypto.randomInt — NEVER Math.random.
//
// Context: { recipientEmail, campaignId, salt, index }
// The generator MUST produce different values for different recipients and
// for the same recipient across different send attempts (salt varies).
// ============================================================================

import crypto from 'crypto';

/**
 * Generate an invoice number.
 * @param {object} ctx - { recipientEmail, campaignId, salt, index }
 * @param {object} [opts] - { prefix, year, segments, digitsPerSegment, separator }
 * @returns {string} e.g. "INV-2026-482913"
 */
export function generateInvoice(ctx = {}, opts = {}) {
  const prefix = opts.prefix || 'INV';
  const year = opts.year || new Date().getFullYear();
  const segments = opts.segments || 1;
  const digitsPerSegment = opts.digitsPerSegment || 9;
  const separator = opts.separator || '-';

  const parts = [prefix, String(year)];
  for (let s = 0; s < segments; s++) {
    let seg = '';
    for (let d = 0; d < digitsPerSegment; d++) {
      seg += crypto.randomInt(0, 10).toString();
    }
    parts.push(seg);
  }
  return parts.join(separator);
}

export default generateInvoice;
