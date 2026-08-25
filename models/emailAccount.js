// ============================================================================
// EmailAccount Schema — Email-to-MMS Gateway Backend Engine (Phase 1)
// ============================================================================
// Stores OAuth2 / SMTP credentials for email accounts used to send MMS via
// carrier gateways. Tracks per-account daily limits, cooldown/bounce state,
// and health status so the OAuth2 Dynamic Router (Phase 3) can pick the best
// available account at send time.
//
// This model is NON-DESTRUCTIVE: it is a brand-new collection and does not
// modify or overwrite any existing schema. It follows the exact same style
// as the rest of the project (inline comments, manual createdAt/updatedAt,
// mongoose.models.X || mongoose.model() registration pattern).
// ============================================================================

import mongoose from 'mongoose';

const emailAccountSchema = new mongoose.Schema({
  // Provider type determines how `credentials` is interpreted by the router.
  // GMAIL_OAUTH / OUTLOOK_GRAPH use OAuth2 tokens; CUSTOM_SMTP uses SMTP auth.
  provider: {
    type: String,
    enum: ['GMAIL_OAUTH', 'GMAIL_APP_PASSWORD', 'OUTLOOK_GRAPH', 'YAHOO', 'AOL', 'CUSTOM_SMTP'],
    required: true,
    default: 'GMAIL_OAUTH',
  },

  // The sending email address. Unique per account so the router can look up
  // accounts by email and prevent duplicate credential storage.
  email: {
    type: String,
    required: true,
    unique: true,
    index: true,
    lowercase: true,
    trim: true,
  },

  // Dynamic credential object. For OAuth providers this holds client_id,
  // client_secret, refresh_token (and access_token/expiry after first refresh).
  // For CUSTOM_SMTP it holds host, port, secure, user, pass.
  credentials: {
    type: Object,
    default: {},
  },

  // Provider-imposed daily sending cap. Router skips accounts that hit this.
  dailyLimit: {
    type: Number,
    default: 400,
  },

  // Counter reset daily by a scheduler (Phase 3). Keeps the router stateless.
  sentToday: {
    type: Number,
    default: 0,
  },

  // ACTIVE = usable now. COOLDOWN = temporarily paused (rate limit/bounce).
  // SUSPENDED = manually disabled by admin or hard-banned by provider.
  status: {
    type: String,
    enum: ['ACTIVE', 'COOLDOWN', 'SUSPENDED'],
    default: 'ACTIVE',
  },

  // When COOLDOWN ends; router checks this before selecting the account.
  cooldownUntil: {
    type: Date,
    default: null,
  },

  // Auto-bounce protection (Phase 3): too many consecutive bounces => COOLDOWN.
  consecutiveBounces: {
    type: Number,
    default: 0,
  },

  // Admin label / friendly name shown in the Admin Panel account list.
  label: {
    type: String,
    default: '',
  },

  // Multi-tenant ownership (BM2 Ultra enterprise upgrade):
  // When a USER connects their own Gmail via the user-panel credentials.json
  // OAuth flow, this stores their User._id so listSenders only returns accounts
  // they own. Admin-connected accounts have ownerId = null (shared pool).
  // Sparse index so null values don't conflict (shared pool stays unique-free).
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: { unique: false, sparse: true },
  },

  // Tracks the most recent send for ordering and rotation logic.
  lastUsedAt: {
    type: Date,
    default: null,
  },

  // Last error message from the provider (for health status display).
  lastError: {
    type: String,
    default: null,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// updatedAt is set explicitly by the gateway endpoints on every write, so no
// pre('save') hook is needed — keeps this model compatible with mongoose 9's
// document middleware expectations.

const EmailAccount =
  mongoose.models.EmailAccount ||
  mongoose.model('EmailAccount', emailAccountSchema);

export default EmailAccount;
export { emailAccountSchema };
