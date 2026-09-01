// ============================================================================
// V7 P5.2 — Package Manager (server-authoritative quota enforcement)
// ============================================================================
// Per-package limits: email quota/day, API credential limit, sandbox count
// (1-4), AI quota, TFN/HelpDesk field availability, validator depth.
//
// Enforcement is server-side only — exceeding a quota returns 403 + a clean
// Bangla message. Uses incrWithCeiling (Account 1's atomic.js) for atomic
// quota consumption. Counters are Redis-backed → survive process restart.
//
// Exports:
//   PACKAGE_REGISTRY, getPackage, assignPackage, getUserPackage,
//   checkEmailQuota, consumeEmailQuota, checkCredentialLimit,
//   consumeCredentialSlot, checkSandboxLimit, checkAiQuota, consumeAiQuota,
//   checkValidatorDepth, enforcePackageLimit, getPackageStatus
// ============================================================================

import mongoose from 'mongoose';
import { incrWithCeiling, resetCeiling } from '../redis/atomic.js';
import { getRedisClient } from '../redis/client.js';
import { sanitizeInput } from '../validate/sanitize.js';

// ---------------------------------------------------------------------------
// PACKAGE_REGISTRY — the canonical package definitions.
// Each package defines limits that the server enforces atomically.
// ---------------------------------------------------------------------------

export const PACKAGE_REGISTRY = {
  free: {
    name: 'free',
    label: 'Free',
    tier: 0,
    emailQuotaPerDay: 100,
    credentialLimit: 1,
    sandboxCount: 1,
    aiQuotaPerDay: 50,
    tfnAvailable: false,
    helpDeskAvailable: false,
    validatorDepth: 'basic',
  },
  basic: {
    name: 'basic',
    label: 'Basic',
    tier: 1,
    emailQuotaPerDay: 1000,
    credentialLimit: 3,
    sandboxCount: 2,
    aiQuotaPerDay: 500,
    tfnAvailable: true,
    helpDeskAvailable: true,
    validatorDepth: 'standard',
  },
  pro: {
    name: 'pro',
    label: 'Professional',
    tier: 2,
    emailQuotaPerDay: 5000,
    credentialLimit: 10,
    sandboxCount: 4,
    aiQuotaPerDay: 2000,
    tfnAvailable: true,
    helpDeskAvailable: true,
    validatorDepth: 'deep',
  },
  enterprise: {
    name: 'enterprise',
    label: 'Enterprise',
    tier: 3,
    emailQuotaPerDay: 50000,
    credentialLimit: 50,
    sandboxCount: 4,
    aiQuotaPerDay: 10000,
    tfnAvailable: true,
    helpDeskAvailable: true,
    validatorDepth: 'deep',
  },
};

const _PACKAGE_NAMES = Object.keys(PACKAGE_REGISTRY);

// ---------------------------------------------------------------------------
// UserPackage model — per-user package assignment.
// ---------------------------------------------------------------------------

const userPackageSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  packageName: {
    type: String,
    enum: _PACKAGE_NAMES,
    default: 'free',
    required: true,
  },
  // Custom overrides (admin can set per-user limits that differ from package)
  overrides: {
    emailQuotaPerDay: { type: Number, default: null },
    credentialLimit: { type: Number, default: null },
    sandboxCount: { type: Number, default: null },
    aiQuotaPerDay: { type: Number, default: null },
  },
  assignedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const UserPackage =
  mongoose.models.UserPackage || mongoose.model('UserPackage', userPackageSchema);

// ---------------------------------------------------------------------------
// getPackage(packageName)
//   Returns the package definition (pure function, no DB).
// ---------------------------------------------------------------------------
export function getPackage(packageName) {
  return PACKAGE_REGISTRY[packageName] || PACKAGE_REGISTRY.free;
}

// ---------------------------------------------------------------------------
// getUserPackage(userId)
//   Returns the effective package for a user (base package + overrides).
//   Falls back to 'free' if no assignment or DB unreachable.
// ---------------------------------------------------------------------------
export async function getUserPackage(userId) {
  if (!userId) return getPackage('free');
  try {
    const doc = await UserPackage.findOne({ userId: String(userId) }).lean();
    if (!doc) return getPackage('free');
    const base = getPackage(doc.packageName);
    // Apply overrides
    return {
      ...base,
      emailQuotaPerDay: doc.overrides?.emailQuotaPerDay ?? base.emailQuotaPerDay,
      credentialLimit: doc.overrides?.credentialLimit ?? base.credentialLimit,
      sandboxCount: doc.overrides?.sandboxCount ?? base.sandboxCount,
      aiQuotaPerDay: doc.overrides?.aiQuotaPerDay ?? base.aiQuotaPerDay,
      packageName: doc.packageName,
      userId: String(userId),
    };
  } catch (err) {
    console.error(`[packages] getUserPackage failed: ${err.message}`);
    return getPackage('free');
  }
}

// ---------------------------------------------------------------------------
// assignPackage(userId, packageName, overrides?)
//   Admin: assign a package to a user. Returns the updated doc.
// ---------------------------------------------------------------------------
export async function assignPackage(userId, packageName, overrides = null) {
  if (!userId) throw new Error('userId is required');
  if (!_PACKAGE_NAMES.includes(packageName)) {
    throw new Error(`Unknown package: ${packageName}. Valid: ${_PACKAGE_NAMES.join(', ')}`);
  }

  // Sanitize overrides if provided
  let cleanOverrides = {};
  if (overrides) {
    const clean = sanitizeInput(overrides, {
      emailQuotaPerDay: { type: 'number', required: false },
      credentialLimit: { type: 'number', required: false },
      sandboxCount: { type: 'number', required: false },
      aiQuotaPerDay: { type: 'number', required: false },
    });
    if (clean.ok && clean.data) {
      cleanOverrides = {
        emailQuotaPerDay: clean.data.emailQuotaPerDay ?? null,
        credentialLimit: clean.data.credentialLimit ?? null,
        sandboxCount: clean.data.sandboxCount ?? null,
        aiQuotaPerDay: clean.data.aiQuotaPerDay ?? null,
      };
    }
  }

  try {
    const doc = await UserPackage.findOneAndUpdate(
      { userId: String(userId) },
      {
        $set: {
          userId: String(userId),
          packageName,
          overrides: cleanOverrides,
          updatedAt: new Date(),
        },
        $setOnInsert: { assignedAt: new Date() },
      },
      { upsert: true, new: true, returnDocument: 'after' },
    ).lean();

    // Reset the user's quota counters on package change (downgrade takes effect immediately)
    await resetCeiling(`quota:email:${userId}`);
    await resetCeiling(`quota:ai:${userId}`);

    return doc;
  } catch (err) {
    console.error(`[packages] assignPackage failed: ${err.message}`);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Quota key helpers
// ---------------------------------------------------------------------------
function _emailQuotaKey(userId) { return `quota:email:${userId}`; }
function _aiQuotaKey(userId) { return `quota:ai:${userId}`; }
function _credentialCountKey(userId) { return `quota:cred:${userId}`; }
function _sandboxCountKey(userId) { return `quota:sandbox:${userId}`; }

// ---------------------------------------------------------------------------
// checkEmailQuota(userId, pkg?)
//   Returns { allowed, current, ceiling } — does NOT consume.
// ---------------------------------------------------------------------------
export async function checkEmailQuota(userId, pkg = null) {
  const p = pkg || await getUserPackage(userId);
  const ceiling = p.emailQuotaPerDay;
  if (!Number.isFinite(ceiling) || ceiling <= 0) {
    return { allowed: true, current: 0, ceiling: 0 }; // unlimited
  }
  try {
    const redis = getRedisClient();
    const current = Number(await redis.get(_emailQuotaKey(userId)) || 0);
    return { allowed: current < ceiling, current, ceiling };
  } catch (err) {
    console.error(`[packages] checkEmailQuota failed: ${err.message}`);
    return { allowed: true, current: 0, ceiling }; // fail-open
  }
}

// ---------------------------------------------------------------------------
// consumeEmailQuota(userId, pkg?)
//   Atomically consume one email send slot. Returns { allowed, current, ceiling }.
//   If the quota is exceeded, returns { allowed: false } — the caller must
//   return 403 with a clean Bangla message.
// ---------------------------------------------------------------------------
export async function consumeEmailQuota(userId, pkg = null) {
  const p = pkg || await getUserPackage(userId);
  const ceiling = p.emailQuotaPerDay;
  if (!Number.isFinite(ceiling) || ceiling <= 0) {
    return { allowed: true, current: 0, ceiling: 0 }; // unlimited
  }
  try {
    const res = await incrWithCeiling(_emailQuotaKey(userId), ceiling);
    return {
      allowed: res && res.allowed === true,
      current: res ? res.value : 0,
      ceiling,
    };
  } catch (err) {
    console.error(`[packages] consumeEmailQuota failed: ${err.message}`);
    return { allowed: true, current: 0, ceiling }; // fail-open
  }
}

// ---------------------------------------------------------------------------
// checkCredentialLimit(userId, pkg?)
//   Returns { allowed, current, ceiling }.
// ---------------------------------------------------------------------------
export async function checkCredentialLimit(userId, pkg = null) {
  const p = pkg || await getUserPackage(userId);
  const ceiling = p.credentialLimit;
  try {
    const redis = getRedisClient();
    const current = Number(await redis.get(_credentialCountKey(userId)) || 0);
    return { allowed: current < ceiling, current, ceiling };
  } catch (err) {
    console.error(`[packages] checkCredentialLimit failed: ${err.message}`);
    return { allowed: true, current: 0, ceiling };
  }
}

// ---------------------------------------------------------------------------
// consumeCredentialSlot(userId, pkg?)
//   Atomically consume a credential slot. Returns { allowed, current, ceiling }.
// ---------------------------------------------------------------------------
export async function consumeCredentialSlot(userId, pkg = null) {
  const p = pkg || await getUserPackage(userId);
  const ceiling = p.credentialLimit;
  try {
    const res = await incrWithCeiling(_credentialCountKey(userId), ceiling);
    return {
      allowed: res && res.allowed === true,
      current: res ? res.value : 0,
      ceiling,
    };
  } catch (err) {
    console.error(`[packages] consumeCredentialSlot failed: ${err.message}`);
    return { allowed: true, current: 0, ceiling };
  }
}

// ---------------------------------------------------------------------------
// checkSandboxLimit(userId, pkg?)
//   Returns { allowed, current, ceiling }.
// ---------------------------------------------------------------------------
export async function checkSandboxLimit(userId, pkg = null) {
  const p = pkg || await getUserPackage(userId);
  const ceiling = p.sandboxCount;
  try {
    const redis = getRedisClient();
    const current = Number(await redis.get(_sandboxCountKey(userId)) || 0);
    return { allowed: current < ceiling, current, ceiling };
  } catch (err) {
    console.error(`[packages] checkSandboxLimit failed: ${err.message}`);
    return { allowed: true, current: 0, ceiling };
  }
}

// ---------------------------------------------------------------------------
// checkAiQuota(userId, pkg?)
//   Returns { allowed, current, ceiling }.
// ---------------------------------------------------------------------------
export async function checkAiQuota(userId, pkg = null) {
  const p = pkg || await getUserPackage(userId);
  const ceiling = p.aiQuotaPerDay;
  if (!Number.isFinite(ceiling) || ceiling <= 0) {
    return { allowed: true, current: 0, ceiling: 0 }; // unlimited
  }
  try {
    const redis = getRedisClient();
    const current = Number(await redis.get(_aiQuotaKey(userId)) || 0);
    return { allowed: current < ceiling, current, ceiling };
  } catch (err) {
    console.error(`[packages] checkAiQuota failed: ${err.message}`);
    return { allowed: true, current: 0, ceiling };
  }
}

// ---------------------------------------------------------------------------
// consumeAiQuota(userId, pkg?)
//   Atomically consume one AI generation slot.
// ---------------------------------------------------------------------------
export async function consumeAiQuota(userId, pkg = null) {
  const p = pkg || await getUserPackage(userId);
  const ceiling = p.aiQuotaPerDay;
  if (!Number.isFinite(ceiling) || ceiling <= 0) {
    return { allowed: true, current: 0, ceiling: 0 }; // unlimited
  }
  try {
    const res = await incrWithCeiling(_aiQuotaKey(userId), ceiling);
    return {
      allowed: res && res.allowed === true,
      current: res ? res.value : 0,
      ceiling,
    };
  } catch (err) {
    console.error(`[packages] consumeAiQuota failed: ${err.message}`);
    return { allowed: true, current: 0, ceiling }; // fail-open
  }
}

// ---------------------------------------------------------------------------
// checkValidatorDepth(userId, pkg?)
//   Returns the validator depth string ('basic' | 'standard' | 'deep').
// ---------------------------------------------------------------------------
export async function checkValidatorDepth(userId, pkg = null) {
  const p = pkg || await getUserPackage(userId);
  return p.validatorDepth || 'basic';
}

// ---------------------------------------------------------------------------
// enforcePackageLimit(limitType, userId, pkg?)
//   Unified enforcement helper. Returns { ok: true } or
//   { ok: false, status: 403, error: 'Bangla message' }.
//   limitType: 'email' | 'credential' | 'sandbox' | 'ai'
// ---------------------------------------------------------------------------
const _BANGLA_MESSAGES = {
  email: 'আপনার দৈনিক ইমেইল সীমা শেষ হয়ে গেছে। আগামীকাল আবার চেষ্টা করুন অথবা প্যাকেজ আপগ্রেড করুন।',
  credential: 'আপনার প্যাকেজে আর নতুন ক্রেডেনশিয়াল যোগ করার সীমা নেই। প্যাকেজ আপগ্রেড করুন।',
  sandbox: 'আপনার প্যাকেজে আর নতুন স্যান্ডবক্স তৈরি করার সীমা নেই। প্যাকেজ আপগ্রেড করুন।',
  ai: 'আপনার দৈনিক AI জেনারেশন সীমা শেষ হয়ে গেছে। আগামীকাল আবার চেষ্টা করুন অথবা প্যাকেজ আপগ্রেড করুন।',
};

export async function enforcePackageLimit(limitType, userId, pkg = null) {
  let result;
  switch (limitType) {
    case 'email':
      result = await consumeEmailQuota(userId, pkg);
      break;
    case 'credential':
      result = await consumeCredentialSlot(userId, pkg);
      break;
    case 'sandbox':
      result = await checkSandboxLimit(userId, pkg);
      break;
    case 'ai':
      result = await consumeAiQuota(userId, pkg);
      break;
    default:
      return { ok: false, status: 400, error: `Unknown limit type: ${limitType}` };
  }

  if (!result.allowed) {
    return {
      ok: false,
      status: 403,
      error: _BANGLA_MESSAGES[limitType] || 'কোটা সীমা অতিক্রান্ত।',
      current: result.current,
      ceiling: result.ceiling,
    };
  }
  return { ok: true, current: result.current, ceiling: result.ceiling };
}

// ---------------------------------------------------------------------------
// getPackageStatus(userId)
//   Read-only status: current package + all quota counters (for observability).
// ---------------------------------------------------------------------------
export async function getPackageStatus(userId) {
  const pkg = await getUserPackage(userId);
  const email = await checkEmailQuota(userId, pkg);
  const cred = await checkCredentialLimit(userId, pkg);
  const sandbox = await checkSandboxLimit(userId, pkg);
  const ai = await checkAiQuota(userId, pkg);
  const validatorDepth = await checkValidatorDepth(userId, pkg);
  return {
    package: pkg,
    quotas: { email, credential: cred, sandbox, ai },
    validatorDepth,
    timestamp: Date.now(),
  };
}

export default {
  PACKAGE_REGISTRY,
  getPackage,
  getUserPackage,
  assignPackage,
  checkEmailQuota,
  consumeEmailQuota,
  checkCredentialLimit,
  consumeCredentialSlot,
  checkSandboxLimit,
  checkAiQuota,
  consumeAiQuota,
  checkValidatorDepth,
  enforcePackageLimit,
  getPackageStatus,
  UserPackage,
};
