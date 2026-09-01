// ============================================================================
// V7 P2.2 — Generator Library: Serial number generator
// ============================================================================
// Produces uppercase alphanumeric serials, groups of 4-5 separated by "-".
// All randomness from Node crypto.randomInt / crypto.randomBytes.
// ============================================================================

import crypto from 'crypto';

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Generate a serial number.
 * @param {object} ctx - { recipientEmail, campaignId, salt, index }
 * @param {object} [opts] - { groups, charsPerGroup, separator, charset }
 * @returns {string} e.g. "A7F2-K9X3-M4Q8"
 */
export function generateSerial(ctx = {}, opts = {}) {
  const groups = opts.groups || 3;
  const charsPerGroup = opts.charsPerGroup || 4;
  const separator = opts.separator || '-';
  const charset = opts.charset || CHARSET;

  const parts = [];
  for (let g = 0; g < groups; g++) {
    let group = '';
    for (let c = 0; c < charsPerGroup; c++) {
      const idx = crypto.randomInt(0, charset.length);
      group += charset[idx];
    }
    parts.push(group);
  }
  return parts.join(separator);
}

export default generateSerial;
