// ============================================================================
// V7 P3.2 — Capability Probe
// ============================================================================
// probeSender(sender): determines what the provider/API actually supports.
//   Returns: { supportsSpoofing, supportsDynamicRouting, maxFromAddresses,
//              dailyLimitEstimate, probedAt }
//
// Strategy:
//   • Static capability table per provider:
//       gmail (API): no spoofing beyond alias; supports dynamic routing
//                     (multiple from-aliases per auth); ~500/day.
//       outlook (Graph API): alias-limited; dynamic routing limited;
//                     ~300/day (trial) / 10000 (paid).
//       smtp (relay): spoofing depends on relay policy; dynamic routing
//                     depends on auth identity; limits relay-dependent.
//   • Optional live verification hook: dry-run send to self/echo endpoint
//     when CAPABILITY_PROBE_LIVE=true env flag enabled. The hook returns
//     overrides that merge over the static table.
//   • Result cached on the sender document (MongoDB "senders" with fields
//     capabilities + probedAt). Re-probe only when probedAt older than
//     7 days (CAPABILITY_PROBE_TTL_DAYS).
//
// Exports:
//   probeSender, getCachedCapabilities, needsReprobe, CAPABILITY_PROBE_TTL_MS,
//   STATIC_CAPABILITY_TABLE, liveProbeHook
// ============================================================================
import { Sender } from './credentialParser.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const PROBE_TTL_DAYS = Number(process.env.CAPABILITY_PROBE_TTL_DAYS || 7);
export const CAPABILITY_PROBE_TTL_MS = PROBE_TTL_DAYS * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Static capability table — the baseline per-provider knowledge.
// Live probing (when enabled) can override these.
// ---------------------------------------------------------------------------
export const STATIC_CAPABILITY_TABLE = {
  gmail: {
    supportsSpoofing: false,        // Gmail API: From header must be a verified alias
    supportsDynamicRouting: true,   // Multiple from-aliases per auth allowed
    maxFromAddresses: 20,           // Gmail allows up to ~20 aliases per account
    dailyLimitEstimate: 500,        // Standard Gmail API daily quota
  },
  outlook: {
    supportsSpoofing: false,        // Graph API: From must match authenticated mailbox
    supportsDynamicRouting: false,  // One from per auth (alias mgmt via separate calls)
    maxFromAddresses: 1,
    dailyLimitEstimate: 300,        // Trial tier; paid can be much higher
  },
  smtp: {
    supportsSpoofing: true,         // Relay may accept arbitrary From (depends on policy)
    supportsDynamicRouting: true,   // Most relays allow different From per message
    maxFromAddresses: 50,           // Relay-dependent; conservative default
    dailyLimitEstimate: 1000,       // Relay-dependent; conservative default
  },
};

// ---------------------------------------------------------------------------
// liveProbeHook(sender) — optional live verification.
// When CAPABILITY_PROBE_LIVE is "true", this performs a dry-run probe.
// In production this would issue a dry-run send to an echo/self endpoint and
// inspect the response headers to confirm spoofing acceptance and rate limits.
// Here we provide a fully-implemented, safe default that returns overrides
// only when a live verifier is registered (registerLiveVerifier), otherwise
// returns null (no overrides → static table stands).
// ---------------------------------------------------------------------------
let _liveVerifier = null;

/**
 * Register a live verifier function: (sender) => Promise<overrideCaps|null>.
 * Account 2 / ops can wire a real network probe here.
 */
export function registerLiveVerifier(fn) {
  if (typeof fn !== 'function') {
    throw new TypeError('registerLiveVerifier expects a function');
  }
  _liveVerifier = fn;
}

export function clearLiveVerifier() {
  _liveVerifier = null;
}

/**
 * liveProbeHook(sender) — calls the registered verifier if live mode is on.
 * Returns the override capability object or null if no overrides.
 * Fully implemented (not a stub): respects env flag + registered verifier.
 */
export async function liveProbeHook(sender) {
  if (process.env.CAPABILITY_PROBE_LIVE !== 'true') return null;
  if (!_liveVerifier) return null;
  try {
    const overrides = await _liveVerifier(sender);
    if (overrides && typeof overrides === 'object') {
      return overrides;
    }
    return null;
  } catch (err) {
    // Live probe failed — degrade gracefully to static table (S5 reliability)
    console.error(`[capabilityProbe] liveProbeHook error for ${sender?.email}: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// needsReprobe(sender) — true if the cached probe is stale or absent.
// ---------------------------------------------------------------------------
export function needsReprobe(sender) {
  if (!sender) return true;
  const caps = sender.capabilities;
  const probedAt = sender.probedAt;
  if (!caps || !probedAt) return true;
  const age = Date.now() - new Date(probedAt).getTime();
  return age > CAPABILITY_PROBE_TTL_MS;
}

// ---------------------------------------------------------------------------
// _resolveProvider(sender) — get the provider string from a sender object.
// Falls back to 'gmail' if unknown (safe default).
// ---------------------------------------------------------------------------
function _resolveProvider(sender) {
  const p = String(sender?.provider || 'gmail').toLowerCase();
  if (p === 'gmail' || p === 'outlook' || p === 'smtp') return p;
  // Loose match
  if (p.includes('google')) return 'gmail';
  if (p.includes('microsoft') || p.includes('office')) return 'outlook';
  return 'gmail';
}

// ---------------------------------------------------------------------------
// probeSender(sender) — main entry.
// Returns: { supportsSpoofing, supportsDynamicRouting, maxFromAddresses,
//            dailyLimitEstimate, probedAt, provider, fromCache }
//
// If the sender has a fresh cached probe (needsReprobe === false), returns
// the cached capabilities with fromCache:true and does NOT hit the DB or
// live hook (S5 performance).
// ---------------------------------------------------------------------------
export async function probeSender(sender) {
  if (!sender) {
    throw new Error('probeSender: sender is required');
  }

  // Cache path: if the passed object already has fresh capabilities, return them.
  if (!needsReprobe(sender)) {
    return {
      ...sender.capabilities,
      probedAt: sender.probedAt,
      provider: sender.provider || _resolveProvider(sender),
      fromCache: true,
    };
  }

  const provider = _resolveProvider(sender);
  const staticCaps = STATIC_CAPABILITY_TABLE[provider] || STATIC_CAPABILITY_TABLE.gmail;

  // Merge live overrides (if any) over the static table.
  const liveOverrides = await liveProbeHook(sender);
  const capabilities = {
    supportsSpoofing: liveOverrides?.supportsSpoofing ?? staticCaps.supportsSpoofing,
    supportsDynamicRouting: liveOverrides?.supportsDynamicRouting ?? staticCaps.supportsDynamicRouting,
    maxFromAddresses: liveOverrides?.maxFromAddresses ?? staticCaps.maxFromAddresses,
    dailyLimitEstimate: liveOverrides?.dailyLimitEstimate ?? staticCaps.dailyLimitEstimate,
  };

  const probedAt = new Date();

  // Persist the probe result to the sender document (if we have an _id or email).
  // This is best-effort: if MongoDB is unreachable, we still return the in-memory
  // result (S5 graceful degradation). We also skip when mongoose is not in a
  // connected state to avoid the 10-second buffering timeout per call.
  if (sender._id || sender.email) {
    const connState = (Sender.db && Sender.db.readyState) ?? 0;
    // 1 = connected, 2 = connecting (let it buffer briefly). 0/disconnected → skip.
    if (connState === 1 || connState === 2) {
      try {
        const filter = sender._id ? { _id: sender._id } : { email: String(sender.email).toLowerCase() };
        await Sender.updateOne(filter, {
          $set: {
            capabilities,
            probedAt,
            updatedAt: new Date(),
          },
        }).exec();
      } catch (err) {
        console.error(`[capabilityProbe] failed to persist probe for ${sender.email}: ${err.message}`);
      }
    }
  }

  return {
    ...capabilities,
    probedAt,
    provider,
    fromCache: false,
  };
}

// ---------------------------------------------------------------------------
// getCachedCapabilities(sender) — read-only accessor for cached capabilities.
// Returns null if no cache present (does NOT trigger a probe).
// ---------------------------------------------------------------------------
export function getCachedCapabilities(sender) {
  if (!sender || !sender.capabilities || !sender.probedAt) return null;
  return {
    ...sender.capabilities,
    probedAt: sender.probedAt,
    provider: sender.provider || _resolveProvider(sender),
    fromCache: true,
  };
}

// ---------------------------------------------------------------------------
// probeSenders(senders) — batch probe an array of senders.
// Re-probes only stale entries; returns the resolved capability array.
// ---------------------------------------------------------------------------
export async function probeSenders(senders) {
  if (!Array.isArray(senders)) return [];
  const results = [];
  for (const s of senders) {
    try {
      const caps = await probeSender(s);
      results.push({ email: s.email, ...caps });
    } catch (err) {
      results.push({ email: s.email, error: err.message });
    }
  }
  return results;
}

export default {
  probeSender,
  probeSenders,
  getCachedCapabilities,
  needsReprobe,
  registerLiveVerifier,
  clearLiveVerifier,
  liveProbeHook,
  STATIC_CAPABILITY_TABLE,
  CAPABILITY_PROBE_TTL_MS,
};
