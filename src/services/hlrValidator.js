// ============================================================================
// MODULE 1: HLR Validator & Carrier Lookup — Multi-Tier Caching + Fast-Fail
// ============================================================================
// Target: 100% Zero-Bounce Routing
// Design Pattern: Multi-Tier Caching & Fast-Fail
//
// Core Logic:
//   1. Fast-Fail Regex pre-filter → instantly drops malformed numbers
//   2. L1 Cache (Redis) → ultra-fast lookup of previously validated numbers
//   3. L2 Cache (MongoDB CarrierCache) → persistent storage (60-day TTL)
//   4. Only if L1 & L2 miss → external HLR API call (Twilio Lookup / Numverify)
//   5. Filter out VOIP/Landlines → extract ONLY valid cellular MMS domains
//
// Flow:
//   validateAndResolveCarrier(phoneNumber)
//     → fastFailCheck()        [regex pre-filter, 0ms]
//     → L1 cache lookup        [Redis, ~1ms]
//     → L2 cache lookup        [MongoDB, ~5-20ms]
//     → external HLR API       [only on miss, ~100-500ms]
//     → VOIP/Landline filter   [reject non-mobile]
//     → carrier domain resolve [map carrier name → MMS gateway domain]
//     → write-back to L1 + L2  [populate cache for next time]
//
// NON-DESTRUCTIVE: brand-new service module. Reuses CarrierCache model from
// @/lib/core and Redis helpers from @/lib/redis. Does not modify existing code.
// ============================================================================

import { connectDB, CarrierCache, SystemConfig, logActivity } from '@/lib/core';
import {
  cacheGet,
  cacheSet,
} from '@/lib/redis';
import {
  CARRIER_MMS_DOMAINS,
  DEFAULT_CARRIER_DOMAIN,
  FAST_FAIL_REGEX,
  FAST_FAIL_REJECT_PATTERNS,
  normalizeE164,
} from '@/lib/gateway/constants';

// L1 cache TTL — carrier info doesn't change often, 6 hours is safe.
const L1_TTL_SECONDS = 6 * 60 * 60;
const L1_KEY_PREFIX = 'hlr:';

// ---------------------------------------------------------------------------
// Step 1: Fast-Fail Regex Pre-Filter
// ---------------------------------------------------------------------------
// Instantly drops malformed numbers BEFORE any cache lookup or API call.
// Returns { passed, e164, reason } — reason is null when passed=true.
// ---------------------------------------------------------------------------
export function fastFailCheck(rawNumber) {
  if (!rawNumber || typeof rawNumber !== 'string') {
    return { passed: false, e164: null, reason: 'Empty or non-string phone number' };
  }

  const e164 = normalizeE164(rawNumber);
  if (!e164) {
    return { passed: false, e164: null, reason: 'Could not normalize phone number' };
  }

  // Strip the leading + for the regex check (regex expects digits only or +digits).
  if (!FAST_FAIL_REGEX.test(e164)) {
    return { passed: false, e164, reason: `Number fails format check: ${e164}` };
  }

  // Reject obviously fake / test patterns.
  const digitsOnly = e164.replace(/\+/g, '');
  for (const pattern of FAST_FAIL_REJECT_PATTERNS) {
    if (pattern.test(digitsOnly)) {
      return { passed: false, e164, reason: `Number matches rejected pattern: ${e164}` };
    }
  }

  return { passed: true, e164, reason: null };
}

// ---------------------------------------------------------------------------
// Step 2 + 3: L1 (Redis) + L2 (MongoDB) Cache Lookup
// ---------------------------------------------------------------------------
// Returns the cached carrier info if found in either cache tier, or null.
// L1 is checked first (ultra-fast), then L2 (persistent). On an L1 miss but
// L2 hit, we back-fill L1 so the next request is served from Redis.
// ---------------------------------------------------------------------------
async function checkCaches(e164) {
  const l1Key = L1_KEY_PREFIX + e164;

  // ── L1: Redis ──
  try {
    const l1Hit = await cacheGet(l1Key);
    if (l1Hit && l1Hit.lineType) {
      return { source: 'L1', data: l1Hit };
    }
  } catch (_e) {
    // Redis down — continue to L2 gracefully.
  }

  // ── L2: MongoDB CarrierCache ──
  await connectDB();
  const l2Doc = await CarrierCache.findOne({ phoneNumber: e164 }).lean();
  if (l2Doc) {
    // Check TTL — if expired, treat as miss (Mongo TTL index will delete it).
    if (l2Doc.ttlExpiresAt && new Date(l2Doc.ttlExpiresAt) > new Date()) {
      const data = {
        carrierDomain: l2Doc.carrierDomain,
        lineType: l2Doc.lineType,
        carrierName: l2Doc.carrierName,
        lastVerified: l2Doc.lastVerified,
      };
      // Back-fill L1 so next lookup is served from Redis.
      try {
        await cacheSet(l1Key, data, L1_TTL_SECONDS);
      } catch (_e) {
        // Non-critical — L2 hit is still valid.
      }
      return { source: 'L2', data };
    }
  }

  return { source: 'MISS', data: null };
}

// ---------------------------------------------------------------------------
// Step 4: External HLR API Call (cache miss path)
// ---------------------------------------------------------------------------
// Calls the carrier-lookup provider API to resolve the line type and carrier
// name for a phone number. Uses the carrierLookupApiKey from SystemConfig.
//
// Supported providers (auto-detected by key prefix / endpoint):
//   • Twilio Lookup API  (https://lookups.twilio.com/v2/PhoneNumbers/{number})
//   • Numverify           (http://apilayer.net/api/validate)
//   • Generic JSON API   (any endpoint returning { carrier, line_type })
//
// Returns { lineType, carrierName, carrierDomain } or throws on API error.
// ---------------------------------------------------------------------------
async function externalHLRLookup(e164, config) {
  const apiKey = config?.carrierLookupApiKey;
  const endpoint = config?.carrierLookupEndpoint || '';

  // If no API key is configured, we fall back to a heuristic: assume the
  // number is MOBILE and use the default carrier domain. This keeps the
  // gateway functional even without a paid HLR API — the circuit breaker
  // will catch any real landline/VOIP bounces and purge them.
  if (!apiKey || !endpoint) {
    return {
      lineType: 'MOBILE',
      carrierName: 'unknown',
      carrierDomain: DEFAULT_CARRIER_DOMAIN,
      source: 'heuristic_fallback',
    };
  }

  // ── Twilio Lookup API ──
  if (endpoint.includes('lookups.twilio.com') || endpoint.includes('twilio.com')) {
    return await twilioLookup(e164, apiKey, endpoint);
  }

  // ── Numverify API ──
  if (endpoint.includes('apilayer.net') || endpoint.includes('numverify')) {
    return await numverifyLookup(e164, apiKey, endpoint);
  }

  // ── Generic JSON API ──
  return await genericLookup(e164, apiKey, endpoint);
}

// Twilio Lookup API v2 — Basic auth with API key as SID:secret.
async function twilioLookup(e164, apiKey, endpoint) {
  const url = (endpoint || 'https://lookups.twilio.com/v2/PhoneNumbers/') + encodeURIComponent(e164);
  // Twilio expects the key as "SID:token" in Basic auth. If the admin stored
  // it as a single token, we use it directly as the bearer.
  const authHeader = apiKey.includes(':')
    ? 'Basic ' + Buffer.from(apiKey).toString('base64')
    : 'Bearer ' + apiKey;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Twilio Lookup failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const lineType = (data.line_type || '').toUpperCase(); // 'mobile' | 'landline' | 'voip'
  const carrierName = data.carrier?.name || data.carrier?.mobile_country_code || 'unknown';

  return {
    lineType: mapLineType(lineType),
    carrierName,
    carrierDomain: resolveCarrierDomain(carrierName),
    source: 'twilio',
  };
}

// Numverify API — GET with access_key query param.
async function numverifyLookup(e164, apiKey, endpoint) {
  const base = endpoint || 'http://apilayer.net/api/validate';
  const numParam = e164.replace(/^\+/, '');
  const url = `${base}?access_key=${encodeURIComponent(apiKey)}&number=${encodeURIComponent(numParam)}&format=1`;

  const res = await fetch(url, {
    method: 'GET',
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Numverify failed (${res.status})`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`Numverify error: ${data.error.info || data.error.code}`);
  }

  const lineType = (data.line_type || '').toUpperCase();
  const carrierName = data.carrier || 'unknown';

  return {
    lineType: mapLineType(lineType),
    carrierName,
    carrierDomain: resolveCarrierDomain(carrierName),
    source: 'numverify',
  };
}

// Generic JSON API — expects { line_type, carrier } or { lineType, carrierName }.
async function genericLookup(e164, apiKey, endpoint) {
  const url = endpoint.replace('{number}', encodeURIComponent(e164));
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Generic HLR API failed (${res.status})`);
  }

  const data = await res.json();
  const lineType = (data.line_type || data.lineType || '').toUpperCase();
  const carrierName = data.carrier || data.carrierName || 'unknown';

  return {
    lineType: mapLineType(lineType),
    carrierName,
    carrierDomain: resolveCarrierDomain(carrierName),
    source: 'generic',
  };
}

// ---------------------------------------------------------------------------
// Helpers — line type mapping + carrier domain resolution
// ---------------------------------------------------------------------------

// Normalize various provider line-type strings into our enum.
function mapLineType(raw) {
  const t = String(raw || '').toUpperCase();
  if (t === 'MOBILE' || t === 'CELLULAR' || t === 'WIRELESS') return 'MOBILE';
  if (t === 'LANDLINE' || t === 'FIXED' || t === 'FIXED_LINE') return 'LANDLINE';
  if (t === 'VOIP' || t === 'VOIP_-_FIXED' || t === 'VOIP_MOBILE' || t === 'SIP') return 'VOIP';
  if (t === 'UNKNOWN' || t === '') return 'UNKNOWN';
  return 'UNKNOWN';
}

// Map a carrier name to its MMS gateway domain using the constant map.
// Case-insensitive substring match — falls back to DEFAULT_CARRIER_DOMAIN.
export function resolveCarrierDomain(carrierName) {
  if (!carrierName) return DEFAULT_CARRIER_DOMAIN;
  const lower = String(carrierName).toLowerCase();
  for (const [key, domain] of Object.entries(CARRIER_MMS_DOMAINS)) {
    if (lower.includes(key)) {
      return domain;
    }
  }
  return DEFAULT_CARRIER_DOMAIN;
}

// ---------------------------------------------------------------------------
// Step 5: VOIP / Landline Filter
// ---------------------------------------------------------------------------
// Strictly filters out VOIP and Landline numbers — only MOBILE can receive MMS.
// Returns { allowed, reason }.
// ---------------------------------------------------------------------------
export function filterLineType(lineType) {
  switch (String(lineType).toUpperCase()) {
    case 'MOBILE':
      return { allowed: true, reason: null };
    case 'LANDLINE':
      return { allowed: false, reason: 'Landline cannot receive MMS' };
    case 'VOIP':
      return { allowed: false, reason: 'VOIP numbers cannot receive MMS' };
    default:
      // UNKNOWN — we allow it (the circuit breaker will purge real bounces).
      // This is safer than blocking because some HLR APIs return UNKNOWN for
      // valid mobile numbers, and blocking would lose legitimate recipients.
      return { allowed: true, reason: 'Line type unknown — allowed with circuit-breaker safety net' };
  }
}

// ---------------------------------------------------------------------------
// Cache Write-Back — populate L1 + L2 after a successful HLR lookup
// ---------------------------------------------------------------------------
async function writeBackCaches(e164, info) {
  const l1Key = L1_KEY_PREFIX + e164;
  const data = {
    carrierDomain: info.carrierDomain,
    lineType: info.lineType,
    carrierName: info.carrierName,
    lastVerified: new Date(),
  };

  // L1 write (Redis) — 6-hour TTL.
  try {
    await cacheSet(l1Key, data, L1_TTL_SECONDS);
  } catch (_e) {
    // Non-critical.
  }

  // L2 write (MongoDB) — 60-day TTL via the schema's ttlExpiresAt field.
  try {
    await connectDB();
    await CarrierCache.findOneAndUpdate(
      { phoneNumber: e164 },
      {
        $set: {
          carrierDomain: info.carrierDomain,
          lineType: info.lineType,
          carrierName: info.carrierName,
          lastVerified: new Date(),
          ttlExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  } catch (_e) {
    // Non-critical — L1 is still populated.
  }
}

// ---------------------------------------------------------------------------
// MAIN ENTRY POINT — validateAndResolveCarrier(phoneNumber)
// ---------------------------------------------------------------------------
// Runs the full multi-tier pipeline:
//   fast-fail → L1 → L2 → HLR API → VOIP filter → domain resolve → cache write-back
//
// Returns:
//   { valid, e164, lineType, carrierName, carrierDomain, mmsAddress, source, reason }
//
//   • valid=false + reason → number is rejected (malformed, landline, VOIP)
//   • valid=true  + mmsAddress → ready to send: <e164>@<carrierDomain>
//
// The `source` field indicates which tier served the result:
//   'fast_fail' | 'L1' | 'L2' | 'twilio' | 'numverify' | 'generic' | 'heuristic_fallback'
// ---------------------------------------------------------------------------
export async function validateAndResolveCarrier(rawNumber, opts = {}) {
  const actorContext = opts.actorContext || null;

  // ── Step 1: Fast-Fail ──
  const ff = fastFailCheck(rawNumber);
  if (!ff.passed) {
    return {
      valid: false,
      e164: ff.e164,
      lineType: null,
      carrierName: null,
      carrierDomain: null,
      mmsAddress: null,
      source: 'fast_fail',
      reason: ff.reason,
    };
  }

  const e164 = ff.e164;

  // ── Step 2 + 3: L1 + L2 Cache Lookup ──
  const cached = await checkCaches(e164);
  if (cached.data) {
    const lineFilter = filterLineType(cached.data.lineType);
    if (!lineFilter.allowed) {
      return {
        valid: false,
        e164,
        lineType: cached.data.lineType,
        carrierName: cached.data.carrierName,
        carrierDomain: cached.data.carrierDomain,
        mmsAddress: null,
        source: cached.source,
        reason: lineFilter.reason,
      };
    }
    return {
      valid: true,
      e164,
      lineType: cached.data.lineType,
      carrierName: cached.data.carrierName,
      carrierDomain: cached.data.carrierDomain,
      mmsAddress: `${e164.replace(/^\+/, '')}@${cached.data.carrierDomain}`,
      source: cached.source,
      reason: null,
    };
  }

  // ── Step 4: External HLR API (cache miss) ──
  let hlrResult;
  try {
    await connectDB();
    const config = await SystemConfig.findOne({}).lean() || {};
    hlrResult = await externalHLRLookup(e164, config);

    // Log the API lookup for the cache hit-ratio metric (health endpoint).
    await logActivity(
      actorContext?.userId || null,
      actorContext?.actorType || 'system',
      actorContext?.username || 'gateway',
      'carrier_api_lookup',
      `HLR API lookup for ${e164} via ${hlrResult.source}: lineType=${hlrResult.lineType}, carrier=${hlrResult.carrierName}`,
      null
    ).catch(() => {});
  } catch (err) {
    // HLR API failed — fall back to heuristic (assume MOBILE + default domain).
    // The circuit breaker will catch any real bounces.
    hlrResult = {
      lineType: 'MOBILE',
      carrierName: 'unknown',
      carrierDomain: DEFAULT_CARRIER_DOMAIN,
      source: 'heuristic_fallback',
    };
  }

  // ── Step 5: VOIP / Landline Filter ──
  const lineFilter = filterLineType(hlrResult.lineType);
  if (!lineFilter.allowed) {
    // Cache the rejection so we don't call the API again for this number.
    await writeBackCaches(e164, hlrResult).catch(() => {});

    // Log the cache hit (served from L1/L2 on future lookups).
    await logActivity(
      actorContext?.userId || null,
      actorContext?.actorType || 'system',
      actorContext?.username || 'gateway',
      'carrier_cache_hit',
      `Carrier cache populated for ${e164} (rejected: ${lineFilter.reason})`,
      null
    ).catch(() => {});

    return {
      valid: false,
      e164,
      lineType: hlrResult.lineType,
      carrierName: hlrResult.carrierName,
      carrierDomain: hlrResult.carrierDomain,
      mmsAddress: null,
      source: hlrResult.source,
      reason: lineFilter.reason,
    };
  }

  // ── Cache Write-Back ──
  await writeBackCaches(e164, hlrResult).catch(() => {});

  // Log the cache hit (future lookups for this number will hit L1/L2).
  await logActivity(
    actorContext?.userId || null,
    actorContext?.actorType || 'system',
    actorContext?.username || 'gateway',
    'carrier_cache_hit',
    `Carrier resolved for ${e164}: ${hlrResult.carrierDomain} (${hlrResult.lineType})`,
    null
  ).catch(() => {});

  return {
    valid: true,
    e164,
    lineType: hlrResult.lineType,
    carrierName: hlrResult.carrierName,
    carrierDomain: hlrResult.carrierDomain,
    mmsAddress: `${e164.replace(/^\+/, '')}@${hlrResult.carrierDomain}`,
    source: hlrResult.source,
    reason: null,
  };
}

// ---------------------------------------------------------------------------
// Batch validation — validate an array of numbers in parallel (with a
// concurrency cap to avoid overwhelming the HLR API).
// ---------------------------------------------------------------------------
export async function batchValidateAndResolve(numbers, opts = {}) {
  const concurrency = opts.concurrency || 10;
  const results = [];
  let index = 0;

  async function worker() {
    while (index < numbers.length) {
      const i = index++;
      try {
        results[i] = await validateAndResolveCarrier(numbers[i], opts);
      } catch (err) {
        results[i] = {
          valid: false,
          e164: null,
          reason: `Validation error: ${err.message}`,
          source: 'error',
        };
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, numbers.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export default {
  validateAndResolveCarrier,
  batchValidateAndResolve,
  fastFailCheck,
  filterLineType,
  resolveCarrierDomain,
};
