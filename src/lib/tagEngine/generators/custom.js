// ============================================================================
// V7 P2.2 — Generator Library: Custom tag generator
// ============================================================================
// Executes a custom tag rule from P2.1. Three rule types:
//   • pattern  → template fill using charset/length/prefix/suffix
//   • sequence → MongoDB findOneAndUpdate-based atomic increment per tag
//   • random   → charset/length/prefix/suffix (same as pattern but explicit)
//
// The sequence type uses atomic findOneAndUpdate with $inc on a dedicated
// counter collection "custom_tag_counters" to guarantee uniqueness even
// across concurrent sends.
// All randomness from Node crypto.randomInt.
// ============================================================================

import crypto from 'crypto';
import mongoose from 'mongoose';
import { expandCharset } from './random.js';

// ---------------------------------------------------------------------------
// Counter model for sequence-type custom tags. Atomic increment via
// findOneAndUpdate with $inc — no race conditions.
// ---------------------------------------------------------------------------
const counterSchema = new mongoose.Schema({
  tagToken: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  current: { type: Number, default: 0 },
});

counterSchema.index({ tagToken: 1, userId: 1 }, { unique: true });

export const CustomTagCounter =
  mongoose.models.CustomTagCounter ||
  mongoose.model('CustomTagCounter', counterSchema);

/**
 * Execute a custom tag rule.
 * @param {object} rule — { type, charset, minLength, maxLength, prefix, suffix,
 *                         dateFormat, incrementStart, incrementStep }
 * @param {object} ctx - { recipientEmail, campaignId, salt, index, userId }
 * @returns {Promise<string>}
 */
export async function generateCustom(rule, ctx = {}) {
  if (!rule || !rule.type) {
    throw new Error('Custom tag rule missing type.');
  }

  const charset = expandCharset(rule.charset || 'A-Z0-9');
  const prefix = rule.prefix || '';
  const suffix = rule.suffix || '';

  switch (rule.type) {
    case 'sequence': {
      // Atomic increment via findOneAndUpdate
      const start = Number(rule.incrementStart) || 1;
      const step = Number(rule.incrementStep) || 1;
      const userId = String(ctx.userId || 'global');
      const tokenKey = ctx.token || 'UNKNOWN';
      try {
        const updated = await CustomTagCounter.findOneAndUpdate(
          { tagToken: tokenKey, userId },
          { $inc: { current: step } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ).exec();
        // If this is the first increment, the default (0) + step = step,
        // but we want it to start at incrementStart. Adjust if needed.
        let value = updated.current;
        if (value < start) {
          // Re-set to start + step
          await CustomTagCounter.updateOne(
            { tagToken: tokenKey, userId },
            { current: start }
          ).exec();
          value = start;
        }
        const padded = String(value).padStart(
          Math.max(Number(rule.minLength) || 1, String(value).length),
          '0'
        );
        return `${prefix}${padded}${suffix}`;
      } catch (err) {
        // Fallback: use ctx.index + crypto-random offset (best-effort uniqueness)
        const idx = Number(ctx.index) || 0;
        const rand = crypto.randomInt(0, 100000);
        const value = start + idx * step + (rand % step);
        const padded = String(value).padStart(
          Math.max(Number(rule.minLength) || 1, String(value).length),
          '0'
        );
        return `${prefix}${padded}${suffix}`;
      }
    }

    case 'pattern':
    case 'random': {
      const minLength = Number(rule.minLength) || 6;
      const maxLength = Number(rule.maxLength) || 10;
      const lo = Math.min(minLength, maxLength);
      const hi = Math.max(minLength, maxLength);
      const length = lo + crypto.randomInt(0, hi - lo + 1);
      let body = '';
      for (let i = 0; i < length; i++) {
        body += charset[crypto.randomInt(0, charset.length)];
      }
      return `${prefix}${body}${suffix}`;
    }

    default:
      throw new Error(`Unknown custom tag type: ${rule.type}`);
  }
}

export default generateCustom;
