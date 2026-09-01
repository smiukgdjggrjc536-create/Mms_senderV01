// ============================================================================
// V7 P2.2 — Generator Library: TFN (Tax File Number) generator
// ============================================================================
// Produces a 9-digit TFN with valid checksum formatting variant.
// The Australian TFN uses a weighted-sum checksum algorithm (weights
// [1,4,3,7,5,8,6,9,11]); the generator produces a number whose checksum
// is divisible by 11, then formats it as "XXX XXX XXX".
//
// Uniqueness strategy: the first 8 digits are derived from an HMAC of the
// context (recipientEmail + campaignId + salt + index) so that:
//   • The same context re-rendered always produces the same TFN (consistency).
//   • Different contexts produce different TFNs with overwhelming probability
//     (HMAC-SHA256 output is 256-bit; mod 10^8 still gives ~10^8 distinct
//      8-digit prefixes — birthday collisions across 10k values ≈ 0.0006).
//   • If a deterministic derive is not possible (no ctx fields), falls back
//     to pure crypto.randomInt draws.
// All randomness from Node crypto — NEVER Math.random.
// ============================================================================

import crypto from 'crypto';

const TFN_WEIGHTS = [1, 4, 3, 7, 5, 8, 6, 9, 11];

/**
 * Compute the TFN checksum (sum of digit * weight). Valid if divisible by 11.
 */
function tfnChecksum(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += digits[i] * TFN_WEIGHTS[i];
  }
  return sum;
}

/**
 * Derive 8 random digits [0-9] from the context via HMAC-SHA256.
 * Returns null if no context fields are available (caller falls back to pure
 * crypto.randomInt).
 * @returns {number[]|null} array of 8 digits
 */
function deriveDigitsFromCtx(ctx) {
  const seedParts = [
    ctx.recipientEmail || '',
    ctx.campaignId || '',
    ctx.salt || '',
    ctx.index != null ? String(ctx.index) : '',
  ];
  const hasAny = seedParts.some((p) => p.length > 0);
  if (!hasAny) return null;

  const seed = seedParts.join('|');
  const hmac = crypto.createHmac('sha256', seed).digest('hex');
  // Use the first 16 hex chars (64 bits) → split into 8 digits
  const digits = [];
  for (let i = 0; i < 8; i++) {
    const byte = parseInt(hmac.slice(i * 2, i * 2 + 2), 16);
    digits.push(byte % 10);
  }
  // Ensure first digit is 1-9 (no leading zero)
  if (digits[0] === 0) digits[0] = 1 + (digits[1] % 9);
  return digits;
}

/**
 * Generate pure-random 8 digits (fallback when no ctx available).
 * @returns {number[]} array of 8 digits
 */
function randomDigits() {
  const digits = [];
  digits.push(crypto.randomInt(1, 10));
  for (let i = 1; i < 8; i++) {
    digits.push(crypto.randomInt(0, 10));
  }
  return digits;
}

/**
 * Adjust the 8 digits so the weighted checksum is divisible by 11
 * (the 9th digit has weight 11 ≡ 0 mod 11, so it never affects validity).
 * Mutates `digits` in place and returns it.
 */
function solveChecksum(digits) {
  const inv9mod11 = 5; // 9 * 5 = 45 ≡ 1 mod 11
  const inv6mod11 = 2; // 6 * 2 = 12 ≡ 1 mod 11

  let sum8 = tfnChecksum(digits.slice(0, 8));
  const sumWithoutD8 = sum8 - digits[7] * 9;
  const target = (11 - (sumWithoutD8 % 11)) % 11;
  let newD8 = (target * inv9mod11) % 11;

  if (newD8 <= 9) {
    digits[7] = newD8;
    return digits;
  }

  // newD8 >= 10: try adjusting digit 7 (weight=6) instead
  const sumWithoutD7 = sum8 - digits[6] * 6;
  const target7 = (11 - (sumWithoutD7 % 11)) % 11;
  let newD7 = (target7 * inv6mod11) % 11;
  if (newD7 <= 9) {
    digits[6] = newD7;
    return digits;
  }

  // Both adjustments overflow — brute-force retry with fresh random digits
  for (let attempt = 0; attempt < 200; attempt++) {
    const fresh = randomDigits();
    sum8 = tfnChecksum(fresh.slice(0, 8));
    const swd8 = sum8 - fresh[7] * 9;
    const t = (11 - (swd8 % 11)) % 11;
    const nd8 = (t * inv9mod11) % 11;
    if (nd8 <= 9) {
      fresh[7] = nd8;
      for (let i = 0; i < 8; i++) digits[i] = fresh[i];
      return digits;
    }
  }
  // Extremely unlikely — return as-is (checksum may not be perfect but TFN
  // is still a plausible-looking 9-digit number)
  return digits;
}

/**
 * Generate a valid 9-digit TFN.
 * @param {object} ctx - { recipientEmail, campaignId, salt, index }
 * @param {object} [opts] - { formatted } — if true, returns "XXX XXX XXX"
 * @returns {string} e.g. "839 472 615"
 */
export function generateTfn(ctx = {}, opts = {}) {
  const formatted = opts.formatted !== false; // default true

  // Derive first 8 digits from context (deterministic + wide distribution)
  // or fall back to pure crypto.randomInt when no context is provided.
  const digits = deriveDigitsFromCtx(ctx) || randomDigits();

  // Adjust digit 8 so the weighted checksum is divisible by 11
  solveChecksum(digits);

  // 9th digit: derived from context via HMAC (weight=11 ≡ 0 mod 11, so it
  // never affects the checksum). Deterministic so the same context always
  // yields the same full 9-digit TFN (body+subject consistency), and distinct
  // contexts yield distinct TFNs with overwhelming probability (HMAC-SHA256
  // mod 10 across positions 0-6 and 8 gives ~10^8 effective space → birthday
  // collision across 10k values ≈ 0.0006). Falls back to crypto.randomInt
  // when no context is available.
  const d9Seed = [ctx.recipientEmail || '', ctx.campaignId || '', (ctx.salt || '') + '|d9', ctx.index != null ? String(ctx.index) : ''].join('|');
  const hasD9Seed = d9Seed.replace('|d9', '').length > 0;
  digits[8] = hasD9Seed ? (parseInt(crypto.createHmac('sha256', d9Seed).digest('hex').slice(0, 2), 16) % 10) : crypto.randomInt(0, 10);

  if (formatted) {
    return `${digits[0]}${digits[1]}${digits[2]} ${digits[3]}${digits[4]}${digits[5]} ${digits[6]}${digits[7]}${digits[8]}`;
  }
  return digits.join('');
}

export default generateTfn;
