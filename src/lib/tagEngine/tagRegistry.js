// ============================================================================
// V7 P2.1 — Tag Registry
// ============================================================================
// The tag registry is the single source of truth for every #TOKEN# that the
// sending engine can resolve. It defines 17 built-in tags plus a registration
// path for user-defined custom tags (persisted in MongoDB "custom_tags").
//
// Key invariants:
//   • The compiled regex /#([A-Z0-9_]+)#/g is created ONCE and reused by
//     every consumer (applier, mapping engine, preview route) — no regex is
//     recompiled per call.
//   • Registry lookup is O(1) via a Map keyed by token string.
//   • Unknown tokens are NEVER corrupted — resolveToken leaves them untouched
//     and only returns the tokens it actually knows about.
//   • Custom tags are loaded asynchronously from MongoDB and merged into the
//     lookup Map; the built-in Map is never mutated (a merged copy is returned).
//
// Exports:
//   TAGS, BUILTIN_TAGS, TOKEN_REGEX, BUILTIN_LOOKUP,
//   resolveTokens(body), getTag(token), isKnownToken(token),
//   registerCustomTag({ token, rule, userId }),
//   removeCustomTag({ id, userId }), listCustomTags(userId),
//   getMergedRegistry(userId), validateCustomTagRule(rule), tokenExists(token, userId),
//   _resetRegistry (test helper)
// ============================================================================

import mongoose from 'mongoose';

// ---------------------------------------------------------------------------
// Compiled regex — single instance, reused everywhere.
// Captures the inner token name (uppercase letters, digits, underscore).
// ---------------------------------------------------------------------------
export const TOKEN_REGEX = /#([A-Z0-9_]+)#/g;

// ---------------------------------------------------------------------------
// Built-in tag definitions.
//   id            — stable internal id
//   token         — exact #TOKEN# string as it appears in body/subject
//   label         — human-readable label for the UI tag pills
//   category      — grouping for the UI ("identity" | "financial" | "logistics"
//                   | "datetime" | "generic")
//   generatorId   — which generator file produces the value
//   samplePattern — a static example for preview pills (not the real generator)
// ---------------------------------------------------------------------------
export const BUILTIN_TAGS = [
  {
    id: 'name',
    token: '#NAME#',
    label: 'Recipient Name',
    category: 'identity',
    generatorId: 'identity',
    samplePattern: 'John Smith',
  },
  {
    id: 'email',
    token: '#EMAIL#',
    label: 'Recipient Email',
    category: 'identity',
    generatorId: 'identity',
    samplePattern: 'recipient@example.com',
  },
  {
    id: 'invoice',
    token: '#INVOICE#',
    label: 'Invoice Number',
    category: 'financial',
    generatorId: 'invoice',
    samplePattern: 'INV-2026-482913',
  },
  {
    id: 'snumber',
    token: '#SNUMBER#',
    label: 'Serial Number',
    category: 'financial',
    generatorId: 'serial',
    samplePattern: 'A7F2-K9X3-M4Q8',
  },
  {
    id: 'tfn',
    token: '#TFN#',
    label: 'Tax File Number',
    category: 'financial',
    generatorId: 'tfn',
    samplePattern: '839 472 615',
  },
  {
    id: 'date',
    token: '#DATE#',
    label: 'Smart Date',
    category: 'datetime',
    generatorId: 'date',
    samplePattern: '12 Mar 2026',
  },
  {
    id: 'helpdesk',
    token: '#HELPDESK#',
    label: 'Helpdesk Ticket ID',
    category: 'logistics',
    generatorId: 'helpdesk',
    samplePattern: 'HD-738291',
  },
  {
    id: 'orderid',
    token: '#ORDERID#',
    label: 'Order ID',
    category: 'logistics',
    generatorId: 'orderid',
    samplePattern: 'ORD-K7M3X9Q2',
  },
  {
    id: 'tracking',
    token: '#TRACKING#',
    label: 'Tracking Number',
    category: 'logistics',
    generatorId: 'tracking',
    samplePattern: '9400111205217384920573',
  },
  {
    id: 'amount',
    token: '#AMOUNT#',
    label: 'Money Amount',
    category: 'financial',
    generatorId: 'amount',
    samplePattern: '$1,250.00',
  },
  {
    id: 'due',
    token: '#DUE#',
    label: 'Due Date',
    category: 'datetime',
    generatorId: 'date',
    samplePattern: '15 Apr 2026',
  },
  {
    id: 'city',
    token: '#CITY#',
    label: 'City',
    category: 'identity',
    generatorId: 'identity',
    samplePattern: 'Melbourne',
  },
  {
    id: 'zip',
    token: '#ZIP#',
    label: 'Postal Code',
    category: 'identity',
    generatorId: 'identity',
    samplePattern: '3000',
  },
  {
    id: 'phone',
    token: '#PHONE#',
    label: 'Phone Number',
    category: 'identity',
    generatorId: 'identity',
    samplePattern: '+61 400 123 456',
  },
  {
    id: 'company',
    token: '#COMPANY#',
    label: 'Company Name',
    category: 'identity',
    generatorId: 'identity',
    samplePattern: 'Acme Holdings Pty Ltd',
  },
  {
    id: 'random',
    token: '#RANDOM#',
    label: 'Random Alphanumeric',
    category: 'generic',
    generatorId: 'random',
    samplePattern: 'K7M3X9Q2',
  },
  {
    id: 'uuid',
    token: '#UUID#',
    label: 'UUID v4',
    category: 'generic',
    generatorId: 'uuid',
    samplePattern: 'a3f5c8e2-1b4d-4f7a-9c6e-2d8b0f3a1e5c',
  },
];

// ---------------------------------------------------------------------------
// Full tag list (built-ins first; custom tags are merged at runtime).
// Exported as TAGS for backwards-compatible imports and UI listing.
// ---------------------------------------------------------------------------
export const TAGS = BUILTIN_TAGS;

// ---------------------------------------------------------------------------
// O(1) lookup Map for built-in tags. Keyed by the token string WITH hashes
// (e.g. "#INVOICE#") to match exactly what the regex captures.
// ---------------------------------------------------------------------------
export const BUILTIN_LOOKUP = new Map(BUILTIN_TAGS.map((t) => [t.token, t]));

// ---------------------------------------------------------------------------
// Custom Tag Mongoose model — uses the project's safe registration pattern.
// Collection: "custom_tags"
// Fields:     token, userId, rule, createdAt
// Unique index on (token, userId) — no duplicate tags per user.
// ---------------------------------------------------------------------------
const customTagSchema = new mongoose.Schema({
  token: { type: String, required: true, trim: true, uppercase: true },
  userId: { type: String, required: true, index: true },
  rule: {
    type: {
      type: String,
      enum: ['pattern', 'sequence', 'random'],
      required: true,
    },
    charset: { type: String, default: 'A-Z0-9' },
    minLength: { type: Number, default: 6, min: 1, max: 128 },
    maxLength: { type: Number, default: 10, min: 1, max: 128 },
    prefix: { type: String, default: '' },
    suffix: { type: String, default: '' },
    dateFormat: { type: String, default: 'DD/MM/YYYY' },
    incrementStart: { type: Number, default: 1 },
    incrementStep: { type: Number, default: 1 },
  },
  createdAt: { type: Date, default: Date.now },
});

customTagSchema.index({ token: 1, userId: 1 }, { unique: true });

export const CustomTag =
  mongoose.models.CustomTag || mongoose.model('CustomTag', customTagSchema);

// ---------------------------------------------------------------------------
// In-memory cache of custom tags per user. Keyed by userId → Map(token→def).
// Cleared on register/remove. Falls back to empty if MongoDB unavailable.
// ---------------------------------------------------------------------------
const _customCache = new Map(); // userId -> Map(token -> def)
let _customCacheLoadedAll = false;

// ---------------------------------------------------------------------------
// validateCustomTagRule(rule) — validates the rule object shape before
// persisting. Returns { valid: true } or { valid: false, error: string }.
// ---------------------------------------------------------------------------
export function validateCustomTagRule(rule) {
  if (!rule || typeof rule !== 'object') {
    return { valid: false, error: 'Rule must be an object.' };
  }
  const validTypes = ['pattern', 'sequence', 'random'];
  if (!validTypes.includes(rule.type)) {
    return { valid: false, error: `type must be one of: ${validTypes.join(', ')}` };
  }
  if (rule.minLength !== undefined) {
    const min = Number(rule.minLength);
    if (!Number.isInteger(min) || min < 1 || min > 128) {
      return { valid: false, error: 'minLength must be an integer 1-128.' };
    }
  }
  if (rule.maxLength !== undefined) {
    const max = Number(rule.maxLength);
    if (!Number.isInteger(max) || max < 1 || max > 128) {
      return { valid: false, error: 'maxLength must be an integer 1-128.' };
    }
  }
  if (rule.minLength !== undefined && rule.maxLength !== undefined) {
    if (Number(rule.minLength) > Number(rule.maxLength)) {
      return { valid: false, error: 'minLength cannot exceed maxLength.' };
    }
  }
  if (rule.prefix !== undefined && typeof rule.prefix !== 'string') {
    return { valid: false, error: 'prefix must be a string.' };
  }
  if (rule.suffix !== undefined && typeof rule.suffix !== 'string') {
    return { valid: false, error: 'suffix must be a string.' };
  }
  if (rule.charset !== undefined && typeof rule.charset !== 'string') {
    return { valid: false, error: 'charset must be a string.' };
  }
  if (rule.type === 'sequence') {
    if (rule.incrementStart !== undefined && !Number.isFinite(Number(rule.incrementStart))) {
      return { valid: false, error: 'incrementStart must be a number.' };
    }
    if (rule.incrementStep !== undefined && !Number.isFinite(Number(rule.incrementStep))) {
      return { valid: false, error: 'incrementStep must be a number.' };
    }
  }
  if (rule.dateFormat !== undefined && typeof rule.dateFormat !== 'string') {
    return { valid: false, error: 'dateFormat must be a string.' };
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// tokenExists(token, userId) — checks if a token is already taken, either
// by a built-in tag or by an existing custom tag for this user.
// Returns true if the token is taken (unavailable).
// ---------------------------------------------------------------------------
export async function tokenExists(token, userId) {
  if (!token) return false;
  const upper = token.startsWith('#') ? token.toUpperCase() : `#${token.toUpperCase()}#`;
  // Built-in check — instant, O(1)
  if (BUILTIN_LOOKUP.has(upper)) return true;
  // Custom check — query MongoDB
  try {
    const existing = await CustomTag.findOne({ token: upper, userId: String(userId) })
      .lean()
      .exec();
    return !!existing;
  } catch (err) {
    // If DB is down, be conservative: check the in-memory cache
    const userMap = _customCache.get(String(userId));
    return userMap ? userMap.has(upper) : false;
  }
}

// ---------------------------------------------------------------------------
// registerCustomTag({ token, rule, userId })
//   • Validates rule shape.
//   • Reserves token (rejects duplicates vs built-in + custom).
//   • Persists to MongoDB "custom_tags".
//   • Updates in-memory cache.
// Returns { ok: true, tag } or { ok: false, error }.
// ---------------------------------------------------------------------------
export async function registerCustomTag({ token, rule, userId }) {
  if (!token || typeof token !== 'string') {
    return { ok: false, error: 'token is required.' };
  }
  // Normalize token: uppercase, wrap in #...# if not already
  let normalized = token.trim().toUpperCase();
  if (!normalized.startsWith('#')) normalized = `#${normalized}#`;
  if (!normalized.endsWith('#')) normalized = `${normalized}#`;
  // Validate token chars (uppercase letters, digits, underscore inside hashes)
  const inner = normalized.slice(1, -1);
  if (!/^[A-Z0-9_]+$/.test(inner)) {
    return { ok: false, error: 'Token may only contain uppercase letters, digits, and underscores.' };
  }
  if (inner.length < 2) {
    return { ok: false, error: 'Token must be at least 2 characters.' };
  }

  const ruleCheck = validateCustomTagRule(rule);
  if (!ruleCheck.valid) {
    return { ok: false, error: ruleCheck.error };
  }

  if (!userId) {
    return { ok: false, error: 'userId is required.' };
  }

  // Check for duplicates
  const exists = await tokenExists(normalized, userId);
  if (exists) {
    return { ok: false, error: `Token ${normalized} already exists (built-in or custom).` };
  }

  const doc = {
    token: normalized,
    userId: String(userId),
    rule: {
      type: rule.type,
      charset: rule.charset || 'A-Z0-9',
      minLength: Number(rule.minLength) || 6,
      maxLength: Number(rule.maxLength) || 10,
      prefix: rule.prefix || '',
      suffix: rule.suffix || '',
      dateFormat: rule.dateFormat || 'DD/MM/YYYY',
      incrementStart: Number(rule.incrementStart) || 1,
      incrementStep: Number(rule.incrementStep) || 1,
    },
  };

  try {
    const created = await CustomTag.create(doc);
    // Update cache
    let userMap = _customCache.get(String(userId));
    if (!userMap) {
      userMap = new Map();
      _customCache.set(String(userId), userMap);
    }
    userMap.set(normalized, {
      id: created._id.toString(),
      token: normalized,
      label: inner,
      category: 'custom',
      generatorId: 'custom',
      samplePattern: rule.prefix || 'CUSTOM',
      rule: created.rule,
      custom: true,
    });
    return { ok: true, tag: userMap.get(normalized) };
  } catch (err) {
    if (err && err.code === 11000) {
      return { ok: false, error: `Token ${normalized} already exists.` };
    }
    return { ok: false, error: `Failed to register tag: ${err.message || String(err)}` };
  }
}

// ---------------------------------------------------------------------------
// removeCustomTag({ id, userId }) — owner-only deletion.
// Returns { ok: true } or { ok: false, error }.
// ---------------------------------------------------------------------------
export async function removeCustomTag({ id, userId }) {
  if (!id) return { ok: false, error: 'id is required.' };
  if (!userId) return { ok: false, error: 'userId is required.' };
  try {
    const result = await CustomTag.deleteOne({ _id: id, userId: String(userId) }).exec();
    if (result.deletedCount === 0) {
      return { ok: false, error: 'Tag not found or not owned by this user.' };
    }
    // Clear cache for this user so it reloads fresh
    _customCache.delete(String(userId));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Failed to remove tag: ${err.message || String(err)}` };
  }
}

// ---------------------------------------------------------------------------
// listCustomTags(userId) — returns array of custom tag defs for a user.
// Loads from MongoDB (or cache if already loaded).
// ---------------------------------------------------------------------------
export async function listCustomTags(userId) {
  if (!userId) return [];
  const uid = String(userId);
  // Fast-fail: if MongoDB is not connected, return from cache or empty.
  // This prevents 10s timeouts when the DB is unreachable (e.g. test env).
  const ready = mongoose.connection.readyState;
  if (ready !== 1) {
    const cached = _customCache.get(uid);
    return cached ? Array.from(cached.values()) : [];
  }
  try {
    const docs = await CustomTag.find({ userId: uid }).lean().exec();
    const userMap = new Map();
    for (const d of docs) {
      const inner = d.token.slice(1, -1);
      userMap.set(d.token, {
        id: d._id.toString(),
        token: d.token,
        label: inner,
        category: 'custom',
        generatorId: 'custom',
        samplePattern: (d.rule && d.rule.prefix) || 'CUSTOM',
        rule: d.rule,
        custom: true,
      });
    }
    _customCache.set(uid, userMap);
    return Array.from(userMap.values());
  } catch (err) {
    const cached = _customCache.get(uid);
    return cached ? Array.from(cached.values()) : [];
  }
}

// ---------------------------------------------------------------------------
// getMergedRegistry(userId) — returns a merged Map of built-in + custom tags
// for a user. The built-in Map is never mutated; a new Map is returned.
// ---------------------------------------------------------------------------
export async function getMergedRegistry(userId) {
  const merged = new Map(BUILTIN_LOOKUP);
  if (userId) {
    const customs = await listCustomTags(userId);
    for (const c of customs) {
      merged.set(c.token, c);
    }
  }
  return merged;
}

// ---------------------------------------------------------------------------
// getTag(token, userId) — O(1) lookup for a single tag (built-in or custom).
// Returns the tag def or undefined if unknown.
// ---------------------------------------------------------------------------
export async function getTag(token, userId) {
  if (!token) return undefined;
  const upper = token.startsWith('#') ? token.toUpperCase() : `#${token.toUpperCase()}#`;
  const builtin = BUILTIN_LOOKUP.get(upper);
  if (builtin) return builtin;
  if (userId) {
    let userMap = _customCache.get(String(userId));
    if (!userMap) {
      await listCustomTags(userId);
      userMap = _customCache.get(String(userId));
    }
    return userMap ? userMap.get(upper) : undefined;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// isKnownToken(token, userId) — boolean check.
// ---------------------------------------------------------------------------
export async function isKnownToken(token, userId) {
  const t = await getTag(token, userId);
  return !!t;
}

// ---------------------------------------------------------------------------
// resolveTokens(body) — finds every #TOKEN# occurrence in a string.
// Returns an array of { token, def, index } for KNOWN tokens only.
// Unknown tokens are NOT included (they are left untouched by the applier).
//
// The regex is RESET before each call (global regex lastIndex is stateful).
// A fresh merged registry Map is used for O(1) lookup.
// ---------------------------------------------------------------------------
export async function resolveTokens(body, userId) {
  if (!body || typeof body !== 'string') return [];
  const registry = await getMergedRegistry(userId);
  const results = [];
  TOKEN_REGEX.lastIndex = 0; // reset global regex
  let match;
  while ((match = TOKEN_REGEX.exec(body)) !== null) {
    const token = match[0]; // full #TOKEN#
    const def = registry.get(token);
    if (def) {
      results.push({ token, def, index: match.index });
    }
    // Unknown tokens are silently skipped (left untouched)
  }
  return results;
}

// ---------------------------------------------------------------------------
// _resetRegistry — test helper: clears in-memory caches.
// ---------------------------------------------------------------------------
export function _resetRegistry() {
  _customCache.clear();
  _customCacheLoadedAll = false;
}
