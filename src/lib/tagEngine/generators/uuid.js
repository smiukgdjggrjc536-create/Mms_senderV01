// ============================================================================
// V7 P2.2 — Generator Library: UUID v4 generator
// ============================================================================
// Uses crypto.randomUUID() — the native crypto-grade UUID v4 generator.
// No Math.random anywhere.
// ============================================================================

import crypto from 'crypto';

/**
 * Generate a UUID v4.
 * @param {object} ctx - { recipientEmail, campaignId, salt, index }
 * @param {object} [opts] - { uppercase } — if true, returns uppercase UUID
 * @returns {string} e.g. "a3f5c8e2-1b4d-4f7a-9c6e-2d8b0f3a1e5c"
 */
export function generateUuid(ctx = {}, opts = {}) {
  const uuid = crypto.randomUUID();
  if (opts.uppercase) {
    return uuid.toUpperCase();
  }
  return uuid;
}

export default generateUuid;
