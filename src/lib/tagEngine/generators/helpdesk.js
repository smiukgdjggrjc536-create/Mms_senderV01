// ============================================================================
// V7 P2.2 — Generator Library: Helpdesk / Ticket ID generator
// ============================================================================
// Produces HD-XXXXXX or ticket-style TKTN-<base36 timestamp>-<rand4>.
// All randomness from Node crypto.randomInt / crypto.randomBytes.
// ============================================================================

import crypto from 'crypto';

/**
 * Generate a helpdesk ticket ID.
 * @param {object} ctx - { recipientEmail, campaignId, salt, index }
 * @param {object} [opts] - { style } — "HD" (default) or "TKTN"
 * @returns {string} e.g. "HD-738291" or "TKTN-LK2Q-X9F3"
 */
export function generateHelpdesk(ctx = {}, opts = {}) {
  const style = opts.style || 'HD';

  if (style === 'TKTN') {
    // TKTN-<base36 timestamp>-<rand4>
    const ts = Date.now().toString(36).toUpperCase();
    let rand = '';
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (let i = 0; i < 4; i++) {
      rand += charset[crypto.randomInt(0, charset.length)];
    }
    return `TKTN-${ts}-${rand}`;
  }

  // Default: HD-XXXXXXXX (8 random alphanumeric for sufficient entropy)
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let body = '';
  for (let i = 0; i < 8; i++) {
    body += charset[crypto.randomInt(0, charset.length)];
  }
  return `HD-${body}`;
}

export default generateHelpdesk;
