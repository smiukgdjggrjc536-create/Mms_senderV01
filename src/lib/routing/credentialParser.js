// ============================================================================
// V7 P3.1 — Credential Parser
// ============================================================================
// parseCredentialsJson(rawText): accepts the user's credentials.json upload.
//   • Detects shape variants (array of accounts, {accounts:[...]}, single
//     object).
//   • Normalizes each entry: { email, provider, authFields, displayName,
//     status }.
//   • On upload complete: AUTO-FILL the sender mailbox — write parsed senders
//     to MongoDB "senders" collection and return them.
//
// validateSender(entry): provider-specific sanity checks.
//   • gmail needs refresh token + client id/secret
//   • outlook needs client id/secret/refresh
//   • smtp needs host/port/user/pass
//   • Invalid entries get status:"invalid" with reason — never silently dropped.
//
// Exports:
//   parseCredentialsJson, normalizeEntry, validateSender,
//   persistSenders, SENDER_PROVIDERS, Sender model
// ============================================================================

import mongoose from 'mongoose';

// ---------------------------------------------------------------------------
// Sender model — MongoDB "senders" collection.
// Stores parsed/normalized sender accounts for the routing engine.
// ---------------------------------------------------------------------------
const senderSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  provider: {
    type: String,
    enum: ['gmail', 'outlook', 'smtp'],
    required: true,
  },
  displayName: { type: String, default: '' },
  authFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: {
    type: String,
    enum: ['active', 'invalid', 'exhausted', 'cooldown'],
    default: 'active',
  },
  invalidReason: { type: String, default: '' },
  // Capability probe results (P3.2 writes these)
  capabilities: {
    supportsSpoofing: { type: Boolean, default: false },
    supportsDynamicRouting: { type: Boolean, default: false },
    maxFromAddresses: { type: Number, default: 1 },
    dailyLimitEstimate: { type: Number, default: 400 },
  },
  probedAt: { type: Date, default: null },
  ownerId: { type: String, default: null, index: true },
  // Track whether this is the campaign's primary sender
  isPrimary: { type: Boolean, default: false },
  lastUsedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Unique sender per (email, ownerId) — no duplicate credentials
senderSchema.index({ email: 1, ownerId: 1 }, { unique: true, sparse: true });

export const Sender =
  mongoose.models.Sender || mongoose.model('Sender', senderSchema);

export const SENDER_PROVIDERS = ['gmail', 'outlook', 'smtp'];

// ---------------------------------------------------------------------------
// detectProvider(entry) — infer the provider from auth field shapes.
// ---------------------------------------------------------------------------
function detectProvider(entry) {
  // Explicit provider field
  if (entry.provider) {
    const p = String(entry.provider).toLowerCase();
    if (p.includes('gmail') || p.includes('google')) return 'gmail';
    if (p.includes('outlook') || p.includes('microsoft') || p.includes('office')) return 'outlook';
    if (p.includes('smtp')) return 'smtp';
  }
  // Infer from fields
  // SMTP is the most distinctive — check first (host/port/user/pass)
  if (entry.smtp_host || entry.smtp_port || entry.smtp_user || entry.smtp_pass) return 'smtp';
  if (entry.host && (entry.port || entry.user || entry.pass)) return 'smtp';

  // Google-specific hints win the gmail classification
  const hasGoogleHint =
    entry.project_id ||
    entry.projectId ||
    (entry.token_uri && String(entry.token_uri).includes('google')) ||
    (entry.tokenUri && String(entry.tokenUri).includes('google')) ||
    entry.installed ||
    entry.web ||
    entry.redirect_uris;

  // Full OAuth2 trio (client_id + client_secret + refresh_token)
  const hasOAuthTrio =
    (entry.client_id || entry.clientId) &&
    (entry.client_secret || entry.clientSecret) &&
    (entry.refresh_token || entry.refreshToken);

  if (hasOAuthTrio) {
    // If there's a google-specific hint OR no outlook hint → gmail
    const hasOutlookHint =
      entry.tenant_id || entry.tenantId ||
      (entry.authority && String(entry.authority).includes('microsoft')) ||
      (entry.provider && String(entry.provider).toLowerCase().includes('outlook'));
    if (hasOutlookHint && !hasGoogleHint) return 'outlook';
    // gmail is the default for the generic OAuth2 trio (most common workflow)
    if (hasGoogleHint) return 'gmail';
    // Ambiguous trio with no hints: check the email domain for a strong signal
    const emailDomain = (entry.email || entry.user_email || entry.account || '').toLowerCase();
    if (emailDomain.includes('outlook') || emailDomain.includes('hotmail') || emailDomain.includes('live.') || emailDomain.includes('office')) {
      return 'outlook';
    }
    if (emailDomain.includes('gmail') || emailDomain.includes('googlemail')) {
      return 'gmail';
    }
    // No domain signal: default to gmail (most common)
    return 'gmail';
  }

  // Partial gmail (refresh_token + client_id, no secret) → gmail unless domain says outlook
  if ((entry.refresh_token || entry.refreshToken) && (entry.client_id || entry.clientId)) {
    const emailDomain = (entry.email || entry.user_email || entry.account || '').toLowerCase();
    if (emailDomain.includes('outlook') || emailDomain.includes('hotmail') || emailDomain.includes('live.') || emailDomain.includes('office')) {
      return 'outlook';
    }
    return 'gmail';
  }

  // Default: gmail (most common)
  return 'gmail';
}

// ---------------------------------------------------------------------------
// normalizeEntry(raw) — normalize a single credential entry.
// Returns: { email, provider, displayName, authFields, status }
// ---------------------------------------------------------------------------
export function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      email: '',
      provider: 'gmail',
      displayName: '',
      authFields: {},
      status: 'invalid',
      invalidReason: 'Entry is not an object.',
    };
  }

  // Extract email from various possible field names
  const email =
    raw.email ||
    raw.user_email ||
    raw.account ||
    raw.from ||
    raw.username ||
    (raw.installed && raw.installed.client_id ? '' : '') ||
    '';

  // Extract display name
  const displayName =
    raw.displayName ||
    raw.display_name ||
    raw.name ||
    raw.label ||
    raw.senderName ||
    '';

  // Detect provider
  const provider = detectProvider(raw);

  // Extract auth fields based on provider
  let authFields = {};
  if (provider === 'gmail') {
    authFields = {
      clientId: raw.client_id || raw.clientId || raw.clientId || '',
      clientSecret: raw.client_secret || raw.clientSecret || '',
      refreshToken: raw.refresh_token || raw.refreshToken || '',
      projectId: raw.project_id || raw.projectId || '',
      tokenUri: raw.token_uri || raw.tokenUri || '',
      redirectUri: raw.redirect_uri || raw.redirectUri || raw.redirect_uris?.[0] || '',
      // OAuth2 installed/web app config
      installed: raw.installed || null,
      web: raw.web || null,
    };
  } else if (provider === 'outlook') {
    authFields = {
      clientId: raw.client_id || raw.clientId || '',
      clientSecret: raw.client_secret || raw.clientSecret || '',
      refreshToken: raw.refresh_token || raw.refreshToken || '',
      tenantId: raw.tenant_id || raw.tenantId || '',
      authority: raw.authority || 'https://login.microsoftonline.com',
    };
  } else if (provider === 'smtp') {
    authFields = {
      host: raw.smtp_host || raw.host || '',
      port: Number(raw.smtp_port || raw.port || 587),
      secure: raw.secure !== undefined ? Boolean(raw.secure) : Number(raw.port || 587) === 465,
      user: raw.smtp_user || raw.user || raw.username || email,
      pass: raw.smtp_pass || raw.pass || raw.password || '',
    };
  }

  return {
    email: String(email || '').toLowerCase().trim(),
    provider,
    displayName: String(displayName || '').trim(),
    authFields,
    status: 'active',
  };
}

// ---------------------------------------------------------------------------
// validateSender(entry) — provider-specific sanity checks.
// Returns: { valid: boolean, reason?: string }
// ---------------------------------------------------------------------------
export function validateSender(entry) {
  if (!entry || !entry.email) {
    return { valid: false, reason: 'Email is required.' };
  }
  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry.email)) {
    return { valid: false, reason: `Invalid email format: ${entry.email}` };
  }

  switch (entry.provider) {
    case 'gmail': {
      const af = entry.authFields || {};
      // Accept either explicit fields OR installed/web config block
      const hasExplicit = af.refreshToken && af.clientId && af.clientSecret;
      const hasConfigBlock = (af.installed && af.installed.client_id) || (af.web && af.web.client_id);
      if (!hasExplicit && !hasConfigBlock) {
        return {
          valid: false,
          reason: 'Gmail requires refresh_token + client_id + client_secret (or an installed/web config block).',
        };
      }
      return { valid: true };
    }
    case 'outlook': {
      const af = entry.authFields || {};
      if (!af.clientId || !af.clientSecret || !af.refreshToken) {
        return {
          valid: false,
          reason: 'Outlook requires client_id + client_secret + refresh_token.',
        };
      }
      return { valid: true };
    }
    case 'smtp': {
      const af = entry.authFields || {};
      if (!af.host || !af.port || !af.user || !af.pass) {
        return {
          valid: false,
          reason: 'SMTP requires host + port + user + pass.',
        };
      }
      if (af.port < 1 || af.port > 65535) {
        return { valid: false, reason: `Invalid SMTP port: ${af.port}` };
      }
      return { valid: true };
    }
    default:
      return { valid: false, reason: `Unknown provider: ${entry.provider}` };
  }
}

// ---------------------------------------------------------------------------
// parseCredentialsJson(rawText) — main entry point.
// Accepts a string (JSON text) or a pre-parsed object.
// Detects shape variants, normalizes each entry, validates, and returns
// the array of parsed senders (with invalid entries flagged, not dropped).
//
// Returns: { ok: boolean, senders: Array, errors: Array }
// ---------------------------------------------------------------------------
export function parseCredentialsJson(rawText) {
  let parsed;
  if (typeof rawText === 'string') {
    try {
      parsed = JSON.parse(rawText);
    } catch (err) {
      return {
        ok: false,
        senders: [],
        errors: [`Invalid JSON: ${err.message}`],
      };
    }
  } else if (typeof rawText === 'object') {
    parsed = rawText;
  } else {
    return {
      ok: false,
      senders: [],
      errors: ['Input must be a JSON string or object.'],
    };
  }

  // Detect shape variants and extract the accounts array
  let accounts = [];
  if (Array.isArray(parsed)) {
    // Shape 1: array of accounts
    accounts = parsed;
  } else if (parsed.accounts && Array.isArray(parsed.accounts)) {
    // Shape 2: { accounts: [...] }
    accounts = parsed.accounts;
  } else if (parsed.senders && Array.isArray(parsed.senders)) {
    // Shape 2b: { senders: [...] }
    accounts = parsed.senders;
  } else if (parsed.email || parsed.client_id || parsed.smtp_host) {
    // Shape 3: single object
    accounts = [parsed];
  } else if (parsed.installed || parsed.web) {
    // Shape 3b: single OAuth2 config (installed/web)
    accounts = [parsed];
  } else {
    return {
      ok: false,
      senders: [],
      errors: ['Could not detect credential shape. Expected array, {accounts:[...]}, or single object.'],
    };
  }

  // Normalize and validate each entry
  const senders = [];
  const errors = [];
  for (let i = 0; i < accounts.length; i++) {
    const normalized = normalizeEntry(accounts[i]);
    const validation = validateSender(normalized);
    if (!validation.valid) {
      normalized.status = 'invalid';
      normalized.invalidReason = validation.reason;
      errors.push(`Entry ${i + 1} (${normalized.email || 'unknown'}): ${validation.reason}`);
    }
    senders.push(normalized);
  }

  return { ok: true, senders, errors };
}

// ---------------------------------------------------------------------------
// persistSenders(senders, ownerId) — write parsed senders to MongoDB
// "senders" collection. Returns the persisted documents.
// Uses upsert so re-uploading the same credentials updates rather than
// duplicates.
// ---------------------------------------------------------------------------
export async function persistSenders(senders, ownerId = null) {
  if (!senders || !Array.isArray(senders)) return [];
  const persisted = [];
  for (const s of senders) {
    if (!s.email) continue;
    try {
      const filter = { email: s.email, ownerId: String(ownerId || '') };
      const update = {
        $set: {
          email: s.email,
          provider: s.provider,
          displayName: s.displayName,
          authFields: s.authFields,
          status: s.status,
          invalidReason: s.invalidReason || '',
          ownerId: String(ownerId || ''),
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      };
      const doc = await Sender.findOneAndUpdate(filter, update, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }).exec();
      persisted.push(doc);
    } catch (err) {
      // Log but continue — don't fail the whole batch for one error
      console.error(`[credentialParser] Failed to persist sender ${s.email}: ${err.message}`);
    }
  }
  return persisted;
}

export default {
  parseCredentialsJson,
  normalizeEntry,
  validateSender,
  persistSenders,
  Sender,
  SENDER_PROVIDERS,
};
