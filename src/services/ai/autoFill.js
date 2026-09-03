// ============================================================================
// V7 P4.3 — Sender Auto-Fill + Auto-Rotate + God-Mode AI Quota
// ============================================================================
// This is the unified entry point that ties credential upload → capability
// probe → persist → AI pool feed → quota-aware restock.
//
// Flow:
//   1. Parse credentials JSON (reuse P3.1 credentialParser contract).
//   2. Probe capabilities for each sender (reuse P3.2 capabilityProbe).
//   3. Persist senders to MongoDB "senders" collection (upsert).
//   4. Feed the AI names pool with display names from the parsed senders
//      (so the from-name rotation has real names immediately, before the
//      restock worker fills it with Gemini-generated names).
//   5. Build route pools for any campaign that uses these senders
//      (so resolveSenderRoute can rotate immediately).
//
// Quota integration:
//   - getAiQuotaCeiling(): reads featureToggle.packageConfig.aiQuotaPerDay.
//     The Package Manager (P5) can override this per-user; here we read the
//     global ceiling. Returns 0 = unlimited.
//   - runRestockWithQuota(): convenience that reads the ceiling and calls
//     runRestockCycle so restock never exceeds the admin-set daily quota.
//
// Exports:
//   autoFillFromCredentials, probeAndPersist, feedNamesFromSenders,
//   getAiQuotaCeiling, runRestockWithQuota, AutoFillResult
// ============================================================================

import { parseCredentialsJson, persistSenders, Sender } from '../../lib/routing/credentialParser.js';
import { probeSender, probeSenders, needsReprobe } from '../../lib/routing/capabilityProbe.js';
import {
  buildSenderPool,
  determineMode,
  getRoutingConfig,
} from '../../lib/routing/rotationStrategy.js';
import {
  feedNamesPool,
  feedSubjectsPool,
  feedCampaignPools,
  produceItems,
  POOL_TYPES,
} from './engine.js';
// NOTE: feedNamesPool/SubjectsPool move items FROM the global AI pool INTO a
// campaign's route pool (they take a campaignId). To PUT names INTO the global
// pool from parsed credentials, we use produceItems(POOL_TYPES.SENDER, names).
import { runRestockCycle, getRestockStatus } from './restockWorker.js';
import { connectDB } from '../../lib/core.js';

// Lazy-load FeatureToggle to avoid circular import (featureToggle → mongoose)
async function _getFeatureToggleModel() {
  const mod = await import('@/models/featureToggle.js');
  return mod.default;
}

// ---------------------------------------------------------------------------
// getAiQuotaCeiling(ownerId?)
//   Reads the admin-set AI quota from the God-Mode Matrix singleton.
//   Returns 0 = unlimited, or a positive integer (max Gemini calls/day).
//   Gracefully degrades to 0 (unlimited) if DB is unreachable.
// ---------------------------------------------------------------------------
export async function getAiQuotaCeiling(ownerId = null) {
  try {
    const FeatureToggle = await _getFeatureToggleModel();
    const doc = await FeatureToggle.getOrCreate();
    const ceiling = doc?.packageConfig?.aiQuotaPerDay;
    if (Number.isFinite(ceiling) && ceiling > 0) return ceiling;
    return 0; // unlimited
  } catch (err) {
    console.error(`[autoFill] getAiQuotaCeiling failed: ${err.message}`);
    return 0; // fail-open (unlimited) so restock never starves on a DB glitch
  }
}

// ---------------------------------------------------------------------------
// probeAndPersist(senders, ownerId)
//   Probe capabilities for each sender (only stale ones), then persist to DB.
//   Returns the persisted documents with capabilities merged.
// ---------------------------------------------------------------------------
export async function probeAndPersist(senders, ownerId = null) {
  if (!senders || senders.length === 0) return [];

  // Probe only senders that need it (stale or no cache)
  const probed = [];
  for (const s of senders) {
    try {
      // Attach a minimal Sender doc reference so probeSender can persist
      // the capability result directly to the senders collection.
      const senderObj = {
        _id: s._id,
        email: s.email,
        provider: s.provider,
        capabilities: s.capabilities,
        probedAt: s.probedAt,
      };
      if (needsReprobe(senderObj)) {
        const caps = await probeSender(senderObj);
        s.capabilities = {
          supportsSpoofing: caps.supportsSpoofing,
          supportsDynamicRouting: caps.supportsDynamicRouting,
          maxFromAddresses: caps.maxFromAddresses,
          dailyLimitEstimate: caps.dailyLimitEstimate,
        };
        s.probedAt = caps.probedAt;
      }
      probed.push(s);
    } catch (err) {
      // Probe failed — keep the sender with defaults (never drop it)
      console.error(`[autoFill] probe failed for ${s.email}: ${err.message}`);
      if (!s.capabilities) {
        s.capabilities = {
          supportsSpoofing: false,
          supportsDynamicRouting: false,
          maxFromAddresses: 1,
          dailyLimitEstimate: 400,
        };
      }
      probed.push(s);
    }
  }

  // Persist (upsert) — this is the "auto-populate sender list" step
  const persisted = await persistSenders(probed, ownerId);
  return persisted;
}

// ---------------------------------------------------------------------------
// feedNamesFromSenders(senders)
//   Feed the AI names pool with display names extracted from the parsed
//   senders. This gives the from-name rotation real names immediately,
//   before the restock worker fills the pool with Gemini-generated names.
//   Returns the number of names fed.
// ---------------------------------------------------------------------------
export async function feedNamesFromSenders(senders) {
  if (!senders || senders.length === 0) return 0;
  const names = senders
    .map((s) => s.displayName || s.name || '')
    .filter((n) => typeof n === 'string' && n.trim().length > 0)
    .map((n) => n.trim());
  if (names.length === 0) return 0;
  try {
    const fed = await produceItems(POOL_TYPES.SENDER, names);
    return fed;
  } catch (err) {
    console.error(`[autoFill] feedNamesFromSenders failed: ${err.message}`);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// buildCampaignPools(senders, campaignId?)
//   If a campaignId is provided, build the route sender pool for that campaign
//   so resolveSenderRoute can rotate immediately. Uses determineMode to decide
//   ROTATE_POOL vs LOCK_MAIN.
//   Returns { mode, poolSize } or null if no campaignId.
// ---------------------------------------------------------------------------
export async function buildCampaignPools(senders, campaignId = null) {
  if (!campaignId || !senders || senders.length === 0) return null;
  try {
    const activeSenders = senders.filter((s) => s.status !== 'invalid');
    const config = await getRoutingConfig(String(campaignId));
    const mode = determineMode(activeSenders, config);
    if (mode === 'ROTATE_POOL') {
      const pushed = await buildSenderPool(String(campaignId), activeSenders);
      return { mode, poolSize: pushed };
    }
    return { mode, poolSize: 0 };
  } catch (err) {
    console.error(`[autoFill] buildCampaignPools failed: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// autoFillFromCredentials(rawJson, ownerId, opts?)
//   THE single entry point for credential upload.
//   1. Parse credentials JSON
//   2. Probe + persist senders (auto-populate sender list)
//   3. Feed AI names pool
//   4. (optional) Build campaign route pools
//   Returns an AutoFillResult object.
// ---------------------------------------------------------------------------
export async function autoFillFromCredentials(rawJson, ownerId = null, opts = {}) {
  const result = {
    ok: false,
    parsed: null,
    persisted: [],
    namesFed: 0,
    campaignPools: null,
    mode: null,
    errors: [],
  };

  // Step 1: Parse
  const parsed = parseCredentialsJson(rawJson);
  result.parsed = parsed;
  if (!parsed.ok) {
    result.errors = parsed.errors || ['Parse failed'];
    return result;
  }

  const validSenders = parsed.senders.filter((s) => s.status !== 'invalid');
  if (validSenders.length === 0) {
    result.errors = ['No valid senders after parsing'];
    result.ok = true; // parse succeeded but all invalid
    return result;
  }

  // Step 2: Probe + persist
  try {
    const persisted = await probeAndPersist(validSenders, ownerId);
    result.persisted = persisted;
  } catch (err) {
    result.errors.push(`Persist failed: ${err.message}`);
  }

  // Step 3: Feed AI names pool
  result.namesFed = await feedNamesFromSenders(validSenders);

  // Step 4: Build campaign pools (if campaignId provided)
  if (opts.campaignId) {
    result.campaignPools = await buildCampaignPools(validSenders, opts.campaignId);
    result.mode = result.campaignPools?.mode || null;
  }

  result.ok = true;
  return result;
}

// ---------------------------------------------------------------------------
// runRestockWithQuota(ownerId?)
//   Convenience: read the admin-set AI quota ceiling, then run a restock cycle
//   that respects it. Returns the restock result.
// ---------------------------------------------------------------------------
export async function runRestockWithQuota(ownerId = null) {
  const ceiling = await getAiQuotaCeiling(ownerId);
  return runRestockCycle({ aiQuota: ceiling });
}

// ---------------------------------------------------------------------------
// getAutoFillStatus()
//   Read-only status for observability: pool sizes + restock status + quota.
// ---------------------------------------------------------------------------
export async function getAutoFillStatus() {
  const ceiling = await getAiQuotaCeiling();
  const restock = getRestockStatus();
  return {
    aiQuotaCeiling: ceiling,
    restock,
    timestamp: Date.now(),
  };
}

export default {
  autoFillFromCredentials,
  probeAndPersist,
  feedNamesFromSenders,
  buildCampaignPools,
  getAiQuotaCeiling,
  runRestockWithQuota,
  getAutoFillStatus,
};
