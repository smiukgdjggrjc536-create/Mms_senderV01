// ============================================================================
// V7 P2.2 — Generator Library: TFN (Tax File Number) generator
// ============================================================================
// Produces a 9-digit TFN with valid checksum formatting variant.
// The Australian TFN uses a weighted-sum checksum algorithm (weights
// [1,4,3,7,5,8,6,9,11]); the generator produces a number whose checksum
// is divisible by 11, then formats it as "XXX XXX XXX".
// All randomness from Node crypto.randomInt.
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
 * Generate a valid 9-digit TFN.
 * Strategy: generate the first 8 digits randomly, then solve for the 9th
 * digit such that the weighted sum is divisible by 11.
 * @param {object} ctx - { recipientEmail, campaignId, salt, index }
 * @param {object} [opts] - { formatted } — if true, returns "XXX XXX XXX"
 * @returns {string} e.g. "839 472 615"
 */
export function generateTfn(ctx = {}, opts = {}) {
  const formatted = opts.formatted !== false; // default true

  const digits = [];
  // First 8 digits: random 0-9 (first digit 1-9 to avoid leading zero)
  digits.push(crypto.randomInt(1, 10));
  for (let i = 1; i < 8; i++) {
    digits.push(crypto.randomInt(0, 10));
  }

  // Solve for the 9th digit: weighted sum of first 8 + d9 * 11 ≡ 0 (mod 11)
  // d9 * 11 mod 11 = 0, so we need (sum8) mod 11 == 0.
  // Since d9's weight is 11 (≡ 0 mod 11), d9 doesn't affect the checksum.
  // The real TFN algorithm: total sum must be divisible by 11.
  // Because weight[8]=11, digit 9 contributes d9*11 which is always 0 mod 11.
  // So we need sum8 ≡ 0 mod 11. Adjust digit 8 (weight=9) to achieve this.
  let sum8 = tfnChecksum(digits.slice(0, 8));
  let remainder = sum8 % 11;
  // We need (sum8 - d8*9 + d8'*9) ≡ 0 mod 11 → adjust d8
  // Current contribution of d8: digits[7] * 9
  // We want: (sum8 - digits[7]*9 + newD8*9) % 11 == 0
  // newD8*9 ≡ -(sum8 - digits[7]*9) mod 11
  const sumWithoutD8 = sum8 - digits[7] * 9;
  const target = (11 - (sumWithoutD8 % 11)) % 11;
  // newD8 * 9 ≡ target mod 11 → 9^-1 mod 11 = 5 (since 9*5=45≡1)
  const inv9mod11 = 5;
  let newD8 = (target * inv9mod11) % 11;
  if (newD8 > 9) {
    // If newD8 >= 10, we can't use a single digit — regenerate digit 7 instead
    // Try digit 6 (weight=6): 6^-1 mod 11 = 2 (since 6*2=12≡1)
    const sumWithoutD7 = sum8 - digits[6] * 6;
    const target7 = (11 - (sumWithoutD7 % 11)) % 11;
    const inv6mod11 = 2;
    let newD7 = (target7 * inv6mod11) % 11;
    if (newD7 <= 9) {
      digits[6] = newD7;
    } else {
      // Fallback: brute-force adjust by regenerating until valid
      // This is cryptographically fine — we just retry with new random digits
      for (let attempt = 0; attempt < 100; attempt++) {
        digits[0] = crypto.randomInt(1, 10);
        for (let i = 1; i < 8; i++) digits[i] = crypto.randomInt(0, 10);
        sum8 = tfnChecksum(digits.slice(0, 8));
        const sumWithoutD8b = sum8 - digits[7] * 9;
        const targetB = (11 - (sumWithoutD8b % 11)) % 11;
        const newD8b = (targetB * inv9mod11) % 11;
        if (newD8b <= 9) {
          digits[7] = newD8b;
          break;
        }
      }
    }
  } else {
    digits[7] = newD8;
  }

  // 9th digit: random (its weight is 11, so it doesn't affect checksum)
  digits[8] = crypto.randomInt(0, 10);

  if (formatted) {
    return `${digits[0]}${digits[1]}${digits[2]} ${digits[3]}${digits[4]}${digits[5]} ${digits[6]}${digits[7]}${digits[8]}`;
  }
  return digits.join('');
}

export default generateTfn;
