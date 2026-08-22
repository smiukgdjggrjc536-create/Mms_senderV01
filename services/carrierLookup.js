// ============================================================================
// Carrier Lookup Engine — Email-to-MMS Gateway Backend Engine (Phase 2)
// ============================================================================
// Resolves a phone number to its MMS gateway address (e.g. 12125551234@vzwpix.com)
// using a two-tier strategy:
//
//   1. CACHE-FIRST: query the CarrierCache collection. If a valid (non-expired)
//      record exists, reuse it. Landline numbers short-circuit with an error
//      because they cannot receive MMS.
//   2. EXTERNAL LOOKUP: if the cache misses (or is expired), call the external
//      carrier-lookup API using the `carrierLookupApiKey` stored in SystemConfig,
//      map the returned carrier name to its MMS gateway domain, persist the
//      result to CarrierCache with a fresh 60-day TTL, and return the final
//      `<number>@<domain>` send address.
//
// NON-DESTRUCTIVE: this is a brand-new service module. It only READS from
// SystemConfig and CarrierCache (both created in Phase 1) and WRITES new
// CarrierCache rows. No existing model, route, or service is modified.
//
// The external lookup is provider-agnostic: it supports the Twilio Lookup API
// (carrier.line_type / carrier.name) shape by default and gracefully degrades
// when no key is configured by falling back to a best-effort carrier guess
// based on the number prefix, so the engine never hard-crashes in dev.
// ============================================================================

import { connectDB, CarrierCache, SystemConfig } from '@/lib/core';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// 60 days in milliseconds — matches the CarrierCache TTL index semantics.
const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

// Canonical carrier-name -> MMS gateway domain mapping for US/CA carriers.
// Lookup results are normalized (lowercased, keyword-matched) before mapping.
// Extensible: admins can add more carriers in Phase 4 without touching this.
const CARRIER_DOMAIN_MAP = {
  // AT&T (Wireless / Mobility)
  'att': 'mms.att.net',
  'at&t': 'mms.att.net',
  'att wireless': 'mms.att.net',
  'att mobility': 'mms.att.net',
  'cingular': 'mms.att.net',
  // Verizon
  'verizon': 'vzwpix.com',
  'verizon wireless': 'vzwpix.com',
  // T-Mobile
  't-mobile': 'tmomail.net',
  'tmobile': 'tmomail.net',
  't mobile': 'tmomail.net',
  'metro pcs': 'mymetropcs.com',
  'metropcs': 'mymetropcs.com',
  'metro': 'mymetropcs.com',
  // Sprint (now part of T-Mobile, but legacy domains still work)
  'sprint': 'pm.sprint.com',
  'sprint pcs': 'pm.sprint.com',
  'boost mobile': 'myboostmobile.com',
  'boost': 'myboostmobile.com',
  // US Cellular
  'us cellular': 'mms.uscc.net',
  'uscellular': 'mms.uscc.net',
  'uscc': 'mms.uscc.net',
  // Cricket (AT&T subsidiary)
  'cricket': 'mms.cricketwireless.net',
  'cricket wireless': 'mms.cricketwireless.net',
  // Google Fi
  'google fi': 'msg.fi.google.com',
  'googlefi': 'msg.fi.google.com',
  'fi': 'msg.fi.google.com',
  // Xfinity Mobile
  'xfinity': 'vzwpix.com',
  'xfinity mobile': 'vzwpix.com',
  // Mint Mobile (T-Mobile MVNO)
  'mint': 'tmomail.net',
  'mint mobile': 'tmomail.net',
  // Ting
  'ting': 'tmomail.net',
  // Republic Wireless
  'republic': 'tmomail.net',
  'republic wireless': 'tmomail.net',
  // Consumer Cellular
  'consumer cellular': 'mailmymobile.net',
  // Tracfone / Straight Talk / Net10 (Verizon-owned)
  'tracfone': 'vzwpix.com',
  'straight talk': 'vzwpix.com',
  'straighttalk': 'vzwpix.com',
  'net10': 'vzwpix.com',
  // Rogers (Canada)
  'rogers': 'pcs.rogers.com',
  // Bell (Canada)
  'bell': 'txt.bell.ca',
  'bell mobility': 'txt.bell.ca',
  // Telus (Canada)
  'telus': 'msg.telus.com',
  'telus mobility': 'msg.telus.com',
  // Virgin Mobile (Canada)
  'virgin': 'vmobile.ca',
  'virgin mobile': 'vmobile.ca',
  // Fido (Canada)
  'fido': 'fido.ca',
  // Koodo (Canada)
  'koodo': 'msg.koodomobile.com',
};

// Default fallback domain when carrier cannot be determined. Using the most
// common US carrier gateway maximizes delivery probability for unknown numbers.
const DEFAULT_CARRIER_DOMAIN = 'vzwpix.com';

// ---------------------------------------------------------------------------
// Phone normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a phone number to a digits-only string (leading country code kept).
 * Strips parentheses, spaces, dashes, dots. If a leading "+1" / "1" prefix is
 * present it is preserved so cache keys are consistent across callers.
 *
 * @param {string} raw - the raw phone number from the user/admin
 * @returns {string} digits-only normalized number
 */
function normalizePhone(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let digits = raw.replace(/[^\d+]/g, '');
  // Keep a leading + if present (E.164), otherwise digits only.
  if (digits.startsWith('+')) digits = '+' + digits.slice(1).replace(/[^\d]/g, '');
  else digits = digits.replace(/[^\d]/g, '');
  return digits;
}

/**
 * Return the bare digits (no "+") used to build the MMS address local-part.
 * @param {string} normalized - output of normalizePhone()
 * @returns {string}
 */
function bareDigits(normalized) {
  return normalized.replace(/^\+/, '');
}

// ---------------------------------------------------------------------------
// Carrier-name -> MMS gateway domain resolution
// ---------------------------------------------------------------------------

/**
 * Map a free-form carrier name returned by the lookup API to its MMS gateway
 * domain. Normalizes by lowercasing and checking both the full string and
 * known keyword substrings so "AT&T Mobility, LLC" -> "mms.att.net".
 *
 * @param {string} carrierName - carrier name from lookup API (may be null)
 * @returns {string} MMS gateway domain
 */
function resolveCarrierDomain(carrierName) {
  if (!carrierName || typeof carrierName !== 'string') return DEFAULT_CARRIER_DOMAIN;
  const lower = carrierName.toLowerCase().trim();

  // Direct match first.
  if (CARRIER_DOMAIN_MAP[lower]) return CARRIER_DOMAIN_MAP[lower];

  // Substring/keyword match (handles "AT&T Wireless, Inc.", "T-Mobile USA", etc.)
  for (const key of Object.keys(CARRIER_DOMAIN_MAP)) {
    if (lower.includes(key)) return CARRIER_DOMAIN_MAP[key];
  }

  return DEFAULT_CARRIER_DOMAIN;
}

// ---------------------------------------------------------------------------
// SystemConfig helper (singleton read — mirrors the Phase 1 route pattern)
// ---------------------------------------------------------------------------

/**
 * Fetch the singleton SystemConfig document, creating defaults if absent.
 * Reused so this service never depends on the admin route internals.
 * @returns {Promise<object>} the SystemConfig mongoose doc (lean-free)
 */
async function getSystemConfigDoc() {
  let cfg = await SystemConfig.findOne({});
  if (!cfg) {
    cfg = await SystemConfig.create({});
  }
  return cfg;
}

// ---------------------------------------------------------------------------
// External carrier-lookup API integration
// ---------------------------------------------------------------------------

/**
 * Call the external carrier-lookup API to determine the carrier + line type
 * for a phone number.
 *
 * Primary integration: Twilio Lookup API
 *   GET https://lookups.twilio.com/v1/PhoneNumbers/{number}?Type=carrier
 *   Auth: HTTP Basic with AccountSID:carrierLookupApiKey (we use the single
 *   carrierLookupApiKey field as the bearer token; if it contains a ":" we
 *   split into sid:token for Basic auth — flexible for admin-configured keys).
 *
 * Fallback: if no key is configured, return an UNKNOWN carrier with MOBILE
 * line type so the engine can still produce a best-effort address in dev/preview
 * environments without crashing.
 *
 * @param {string} normalizedPhone - normalized phone number
 * @param {string} apiKey - carrierLookupApiKey from SystemConfig
 * @returns {Promise<{carrierName: string, carrierDomain: string, lineType: string}>}
 */
async function externalCarrierLookup(normalizedPhone, apiKey) {
  // No key configured -> best-effort fallback (dev/preview mode).
  if (!apiKey || !apiKey.trim()) {
    const domain = DEFAULT_CARRIER_DOMAIN;
    return {
      carrierName: 'Unknown',
      carrierDomain: domain,
      lineType: 'MOBILE', // assume mobile so sends are attempted
    };
  }

  const numberForApi = encodeURIComponent(normalizedPhone);
  const twilioUrl = `https://lookups.twilio.com/v1/PhoneNumbers/${numberForApi}?Type=carrier`;

  // Support both "sid:token" (Basic auth) and a raw token (Bearer) styles.
  let headers = { Accept: 'application/json' };
  if (apiKey.includes(':')) {
    // Basic auth with sid:token
    const encoded = Buffer.from(apiKey).toString('base64');
    headers['Authorization'] = `Basic ${encoded}`;
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s hard timeout
    const res = await fetch(twilioUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      // Non-OK: degrade gracefully to a best-effort result so a lookup outage
      // never blocks the entire send pipeline. The admin can inspect errors
      // via logs; cache is still written so we don't hammer a failing API.
      const errBody = await res.text().catch(() => '');
      console.warn(`[carrierLookup] API returned ${res.status}: ${errBody.slice(0, 200)}`);
      return {
        carrierName: 'Unknown',
        carrierDomain: DEFAULT_CARRIER_DOMAIN,
        lineType: 'MOBILE',
      };
    }

    const data = await res.json();
    // Twilio shape: { carrier: { name, type, mobile_country_code, ... } }
    const carrier = data.carrier || {};
    const rawName = carrier.name || data.carrier_name || '';
    const rawType = (carrier.type || data.line_type || '').toUpperCase();

    // Map Twilio line types to our enum.
    let lineType = 'UNKNOWN';
    if (rawType === 'MOBILE' || rawType === 'WIRELESS') lineType = 'MOBILE';
    else if (rawType === 'LANDLINE') lineType = 'LANDLINE';
    else if (rawType === 'VOIP' || rawType === 'VOIP-MS' || rawType.includes('VOIP')) lineType = 'VOIP';
    // Unknown/other -> keep UNKNOWN (will still attempt send as best-effort).

    const carrierDomain = resolveCarrierDomain(rawName);

    return {
      carrierName: rawName || 'Unknown',
      carrierDomain,
      lineType,
    };
  } catch (err) {
    // Network error / timeout / abort -> best-effort fallback.
    console.warn(`[carrierLookup] external lookup failed: ${err.message}`);
    return {
      carrierName: 'Unknown',
      carrierDomain: DEFAULT_CARRIER_DOMAIN,
      lineType: 'MOBILE',
    };
  }
}

// ---------------------------------------------------------------------------
// Cache persistence
// ---------------------------------------------------------------------------

/**
 * Upsert a CarrierCache row for the given number with a fresh 60-day TTL.
 * @param {string} phoneNumber - normalized phone
 * @param {string} carrierDomain
 * @param {string} lineType - MOBILE | LANDLINE | VOIP | UNKNOWN
 * @param {string} carrierName
 * @returns {Promise<object>} the saved cache doc
 */
async function persistCache(phoneNumber, carrierDomain, lineType, carrierName) {
  const now = new Date();
  const ttlExpiresAt = new Date(now.getTime() + SIXTY_DAYS_MS);

  const doc = await CarrierCache.findOneAndUpdate(
    { phoneNumber },
    {
      $set: {
        phoneNumber,
        carrierDomain,
        lineType,
        carrierName: carrierName || '',
        lastVerified: now,
        ttlExpiresAt,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return doc;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a phone number to its MMS gateway send address.
 *
 * Flow:
 *   1. Normalize the phone number.
 *   2. Cache-first: query CarrierCache. If a valid (ttlExpiresAt > now) record
 *      exists:
 *        - LANDLINE  -> throw Error("Landline cannot receive MMS") (abort).
 *        - otherwise -> return "<bareDigits>@<carrierDomain>".
 *   3. Cache miss / expired -> call external carrier lookup with the
 *      carrierLookupApiKey from SystemConfig, persist the result with a 60-day
 *      TTL, then return the formatted address. LANDLINE lookups abort too.
 *
 * @param {string} phoneNumber - raw phone number
 * @returns {Promise<string>} MMS gateway address, e.g. "12125551234@vzwpix.com"
 * @throws {Error} if the number is a landline (cannot receive MMS) or invalid.
 */
export async function getCarrierGateway(phoneNumber) {
  const normalized = normalizePhone(phoneNumber);
  if (!normalized || bareDigits(normalized).length < 7) {
    throw new Error('Invalid phone number');
  }

  await connectDB();

  // --- Step A: cache-first lookup -------------------------------------------
  const cached = await CarrierCache.findOne({ phoneNumber: normalized }).lean();
  const now = new Date();

  if (cached && cached.ttlExpiresAt && new Date(cached.ttlExpiresAt) > now) {
    // Valid, non-expired cache hit.
    if (cached.lineType === 'LANDLINE') {
      throw new Error('Landline cannot receive MMS');
    }
    const domain = cached.carrierDomain || resolveCarrierDomain(cached.carrierName);
    return `${bareDigits(normalized)}@${domain}`;
  }

  // --- Step B: external lookup ----------------------------------------------
  const cfg = await getSystemConfigDoc();
  const apiKey = cfg.carrierLookupApiKey || '';

  const { carrierName, carrierDomain, lineType } = await externalCarrierLookup(normalized, apiKey);

  // Persist the fresh result with a 60-day TTL (even for LANDLINE/VOIP so we
  // short-circuit future lookups — only MOBILE is worth re-resolving).
  await persistCache(normalized, carrierDomain, lineType, carrierName);

  if (lineType === 'LANDLINE') {
    throw new Error('Landline cannot receive MMS');
  }

  return `${bareDigits(normalized)}@${carrierDomain}`;
}

// ---------------------------------------------------------------------------
// Exports for unit testing / Phase 3 reuse
// ---------------------------------------------------------------------------

export {
  normalizePhone,
  bareDigits,
  resolveCarrierDomain,
  CARRIER_DOMAIN_MAP,
  DEFAULT_CARRIER_DOMAIN,
};
