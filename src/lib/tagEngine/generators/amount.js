// ============================================================================
// V7 P2.2 — Generator Library: Money / Amount generator
// ============================================================================
// Produces money-formatted values with currency symbol, thousand separators,
// and two decimal places. The integer and decimal parts are crypto-random
// within configurable bounds.
// All randomness from Node crypto.randomInt.
// ============================================================================

import crypto from 'crypto';

/**
 * Format a number as currency.
 * @param {number} cents — value in cents (integer)
 * @param {object} [opts] - { currency, locale }
 * @returns {string} e.g. "$1,250.00"
 */
export function formatMoney(cents, opts = {}) {
  const currency = opts.currency || 'USD';
  const symbols = { USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$' };
  const symbol = symbols[currency] || '$';
  const dollars = Math.floor(cents / 100);
  const remainingCents = cents % 100;
  // Thousand separators
  const dollarStr = dollars.toLocaleString('en-US');
  const centStr = String(remainingCents).padStart(2, '0');
  return `${symbol}${dollarStr}.${centStr}`;
}

/**
 * Generate a money amount.
 * @param {object} ctx - { recipientEmail, campaignId, salt, index }
 * @param {object} [opts] - { minCents, maxCents, currency }
 * @returns {string} e.g. "$1,250.00"
 */
export function generateAmount(ctx = {}, opts = {}) {
  const minCents = opts.minCents !== undefined ? Number(opts.minCents) : 1000; // $10.00
  const maxCents = opts.maxCents !== undefined ? Number(opts.maxCents) : 500000; // $5,000.00
  const currency = opts.currency || 'USD';

  const lo = Math.min(minCents, maxCents);
  const hi = Math.max(minCents, maxCents);

  // Random cents in [lo, hi]
  const cents = lo + crypto.randomInt(0, hi - lo + 1);

  return formatMoney(cents, { currency });
}

// formatMoney is already exported via `export function` above
export default generateAmount;
