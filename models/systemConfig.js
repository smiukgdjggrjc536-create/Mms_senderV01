// ============================================================================
// SystemConfig Schema — Email-to-MMS Gateway Backend Engine (Phase 1)
// ============================================================================
// Single-document global configuration for the Email-to-MMS Gateway engine.
// Holds the Gemini AI key (Phase 2 rewriter), the carrier-lookup API key
// (Phase 2 carrier caching), routing tuning knobs, and the phishing/keyword
// filter that blocks sensitive content before any send is attempted.
//
// Only one config document should ever exist (singleton). Endpoints enforce
// upsert-on-the-single-doc semantics so the Admin Panel can safely GET/POST
// without managing document IDs.
//
// This model is NON-DESTRUCTIVE: brand-new collection, no existing schema is
// touched. Style matches the rest of the project.
// ============================================================================

import mongoose from 'mongoose';

const systemConfigSchema = new mongoose.Schema({
  // Gemini API key for the AI Rewriter engine (Phase 2). Admin sets via UI.
  geminiApiKey: {
    type: String,
    default: '',
  },

  // Carrier-lookup provider API key (e.g. Twilio Lookup / Numverify) used by
  // the Smart Carrier Caching engine (Phase 2) to resolve MMS gateway domains.
  carrierLookupApiKey: {
    type: String,
    default: '',
  },

  // Seconds between successive sends per account — pacing to avoid tripping
  // provider rate limits and looking spammy.
  routingDelaySeconds: {
    type: Number,
    default: 3,
  },

  // How many messages one email account sends per batch before the router
  // rotates to the next account (load distribution + reputation protection).
  batchSizePerAccount: {
    type: Number,
    default: 5,
  },

  // Master switch for the phishing/keyword filter. When true, outbound
  // message bodies are scanned against `blockedKeywords` before sending.
  enablePhishingFilter: {
    type: Boolean,
    default: true,
  },

  // Keywords/phrases that block a send outright (finance/OTP/PII bait).
  // Admin can extend this list from the UI.
  blockedKeywords: {
    type: [String],
    default: ['bank', 'otp', 'passcode', 'credit card'],
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// updatedAt is set explicitly by the gateway endpoint on every config write,
// so no pre('save') hook is needed.

const SystemConfig =
  mongoose.models.SystemConfig ||
  mongoose.model('SystemConfig', systemConfigSchema);

export default SystemConfig;
export { systemConfigSchema };
