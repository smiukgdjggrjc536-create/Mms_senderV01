// ============================================================================
// Gateway Constants — Email Sending Module
// ============================================================================
// Centralized configuration for all gateway modules:
//   • Carrier MMS gateway domain map (kept for reference / backward compat —
//     no longer used by the Email Sending Module's primary path)
//   • Fast-Fail regex pre-filters (legacy phone validation — kept for compat)
//   • Circuit Breaker thresholds (Auto-Healing Module 5)
//   • Token Bucket defaults (Round-Robin Module 3)
//   • Queue / BullMQ naming conventions
//   • Gemini AI polymorphism prompt template (Module 4)
//
// The Email Sending Module sends to ANY email address (Gmail, Yahoo, AOL,
// Comcast, Outlook, any domain) with no carrier/MMS restrictions. Carrier
// domains below are retained only for historical reference.
// ============================================================================

// ---------------------------------------------------------------------------
// MODULE 1 — Carrier MMS Gateway Domain Map
// ---------------------------------------------------------------------------
// Maps carrier names (from HLR lookup) to their Email-to-MMS gateway domain.
// To send an MMS via email, you address it as: <number>@<carrierDomain>
//   e.g. 12125551234@mms.att.net
//
// This is the L2 fallback when the HLR API does not return a direct gateway
// domain. The validator checks the lookup carrier name against these keys
// (case-insensitive substring match) and picks the matching domain.
// ---------------------------------------------------------------------------
export const CARRIER_MMS_DOMAINS = {
  // AT&T
  'att': 'mms.att.net',
  'at&t': 'mms.att.net',
  'cingular': 'mms.att.net',
  // Verizon
  'verizon': 'vzwpix.com',
  'vzw': 'vzwpix.com',
  // T-Mobile / Sprint (merged)
  't-mobile': 'tmomail.net',
  'tmobile': 'tmomail.net',
  'sprint': 'pm.sprint.com',
  'boost': 'myboostmobile.com',
  // US Cellular
  'us cellular': 'mms.uscc.net',
  'uscellular': 'mms.uscc.net',
  // Cricket (AT&T subsidiary)
  'cricket': 'mms.cricketwireless.net',
  // MetroPCS / Metro by T-Mobile
  'metro pcs': 'mymetropcs.com',
  'metropcs': 'mymetropcs.com',
  // Google Fi
  'google fi': 'msg.fi.google.com',
  'fi': 'msg.fi.google.com',
  // Mint Mobile
  'mint': 'tmomail.net',
  // Xfinity Mobile
  'xfinity': 'vzwpix.com',
  // Consumer Cellular
  'consumer cellular': 'mailmymobile.net',
  // Ting
  'ting': 'message.ting.com',
  // Republic Wireless
  'republic': 'text.republicwireless.com',
  // Virgin Mobile
  'virgin': 'vmpix.com',
  // Tracfone / Straight Talk
  'tracfone': 'mmst5.tracfone.com',
  'straight talk': 'mms.straighttalk.com',
  // Page Plus
  'page plus': 'vtext.com',

  // ── International (common) ──
  'rogers': 'pcs.rogers.com',
  'bell': 'txt.bell.ca',
  'telus': 'msg.telus.com',
  'fido': 'fido.ca',
  'koodo': 'msg.koodomobile.com',
  'virgin canada': 'vmobile.ca',
  'wind': 'mms.windmobile.ca',
};

// Default fallback domain when carrier is unknown but the number is confirmed
// MOBILE. We attempt the most common US domain; if it bounces, the circuit
// breaker catches it and purges the number.
export const DEFAULT_CARRIER_DOMAIN = 'mms.att.net';

// ---------------------------------------------------------------------------
// MODULE 1 — Fast-Fail Regex Pre-Filter
// ---------------------------------------------------------------------------
// Instantly drops malformed numbers BEFORE any cache lookup or API call.
// These are intentionally strict to save API budget and queue time.
// ---------------------------------------------------------------------------

// Must be 7-15 digits, optional leading +. Strips spaces, dashes, dots, parens.
export const FAST_FAIL_REGEX = /^\+?[0-9]{7,15}$/;

// Reject obviously fake / test patterns.
// IMPORTANT: These patterns check the FULL E.164 digits (with country code).
// We must be careful NOT to block real area codes. Patterns like /^1234/ or
// /^555/ would block legitimate numbers whose area code starts with those
// digits. We only reject TRULY impossible patterns:
//   - all identical digits (0000000, 1111111, etc.) — no real number is like this
//   - sequential 0123456789... — clearly a test sequence
//   - numbers shorter than 7 digits are already caught by FAST_FAIL_REGEX
export const FAST_FAIL_REJECT_PATTERNS = [
  /^0+$/,                  // all zeros (e.g. +0000000000)
  /^1+$/,                  // all ones  (e.g. +1111111111)
  /^([0-9])\1{6,}$/,       // 7+ identical digits in a row (e.g. 2222222, 5555555)
  /^0123456789/,           // sequential ascending test
  /^9876543210/,           // sequential descending test
];

// E.164 normalization: strip everything except digits and a leading +.
// Handles common input formats:
//   "12125551234"    → "+12125551234"  (US, 11 digits with leading 1)
//   "2125551234"     → "+12125551234"  (US, 10 digits, prepend +1)
//   "+8801712345678" → "+8801712345678" (Bangladesh, already E.164)
//   "8801712345678"  → "+8801712345678" (Bangladesh, prepend +)
//   "01712345678"    → "+8801712345678" (BD local, strip leading 0, prepend +880)
//   "07912345678"    → "+447912345678"  (UK local, strip leading 0, prepend +44)
export function normalizeE164(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let cleaned = raw.replace(/[^\d+]/g, '');
  // If there's a + not at the start, remove all + signs.
  if (cleaned.indexOf('+') > 0) {
    cleaned = cleaned.replace(/\+/g, '');
  }

  // Already has leading + → just clean it up.
  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1);
    if (digits.length < 7 || digits.length > 15) return null;
    return '+' + digits;
  }

  // No leading + → we need to add the country code.
  // Case 1: US/Canada — 10 digits → prepend +1, 11 digits starting with 1 → prepend +
  if (cleaned.length === 10) {
    // US/Canada 10-digit number (area code + 7 digits)
    return '+1' + cleaned;
  }
  if (cleaned.length === 11 && cleaned[0] === '1') {
    // US/Canada with leading 1
    return '+' + cleaned;
  }

  // Case 2: Local number with leading 0 (UK, BD, many European/Asian countries)
  //   "07912345678" (UK) → strip 0 → "7912345678" → prepend +44 → "+447912345678"
  //   "01712345678" (BD) → strip 0 → "1712345678" → prepend +880 → "+8801712345678"
  // We can't reliably auto-detect the country from a local number, so we try
  // the most common pattern: strip leading 0 and prepend +. This works for
  // most international numbers. If the admin enters a number without a country
  // code and without a leading 0, we prepend + as a best-effort.
  if (cleaned.length >= 7 && cleaned.length <= 15) {
    // Best effort: if it starts with 0, strip it and prepend +
    if (cleaned[0] === '0') {
      return '+' + cleaned.slice(1);
    }
    // Otherwise just prepend +
    return '+' + cleaned;
  }

  return null;
}

// ---------------------------------------------------------------------------
// MODULE 5 — Circuit Breaker Configuration
// ---------------------------------------------------------------------------
export const CIRCUIT_BREAKER_CONFIG = {
  // Number of consecutive failures before the circuit opens (suspends account).
  failureThreshold: 3,
  // How long the circuit stays OPEN (cooldown) before trying HALF_OPEN.
  cooldownMs: 2 * 60 * 60 * 1000, // 2 hours (per spec)
  // How many successful calls in HALF_OPEN to close the circuit again.
  successThreshold: 2,
  // Max timeout for a single send attempt before it's counted as a failure.
  requestTimeoutMs: 30000,
  // Reset consecutive bounce counter after this many successful sends.
  bounceResetAfterSuccess: 1,
};

// Circuit breaker states.
export const CIRCUIT_STATES = {
  CLOSED: 'CLOSED',     // normal operation — account is usable
  OPEN: 'OPEN',         // tripped — account suspended for cooldown
  HALF_OPEN: 'HALF_OPEN', // testing — limited requests allowed
};

// ---------------------------------------------------------------------------
// MODULE 3 — Token Bucket & Round-Robin Configuration
// ---------------------------------------------------------------------------
export const TOKEN_BUCKET_CONFIG = {
  // Default daily sending cap per account (overridden by admin dynamic config).
  defaultDailyLimit: 400,
  // Token refill rate: how many tokens are added per second (capacity/day).
  // This is a soft limiter — the hard limit is the daily counter.
  refillPerSecond: 0.0046, // ~400/day
  // Bucket capacity (burst size) — max tokens held at once.
  capacity: 10,
};

export const ROUND_ROBIN_CONFIG = {
  // Queue name for BullMQ.
  queueName: 'mms-dispatch',
  // Default micro-delay between dispatches (ms) — overridden by admin dynamic config.
  defaultDelayMs: 3000,
  // Max concurrent jobs per worker.
  maxConcurrency: 1,
  // How long a job can run before it's considered stalled.
  stalledIntervalMs: 30000,
  // Max retries for a job before it's moved to the dead-letter queue.
  maxRetries: 3,
  // Dead-letter queue name for permanently failed jobs.
  dlqName: 'mms-dispatch-dlq',
};

// Provider type weights for weighted round-robin. Higher weight = more traffic.
// Gmail OAuth2 tends to have the best deliverability, so it gets the most weight.
export const PROVIDER_WEIGHTS = {
  GMAIL_OAUTH: 5,
  OUTLOOK_GRAPH: 4,
  CUSTOM_SMTP: 3,
  YAHOO: 2,
  AOL: 2,
};

// ---------------------------------------------------------------------------
// MODULE 4 — AI Polymorphism (Gemini) Configuration
// ---------------------------------------------------------------------------
// The prompt instructs the model to rewrite the message body for structural
// uniqueness while keeping the core intent intact. This evades carrier spam
// filters that fingerprint identical payloads.
// ---------------------------------------------------------------------------
export const AI_POLYMORPH_PROMPT = `You are an email message rewriter. Rewrite the following message so that it is structurally unique (different word choice, sentence structure, phrasing) while keeping the EXACT same core intent, meaning, and any URLs, email addresses, or codes unchanged. Do not add or remove information. Do not add greetings or sign-offs unless they exist in the original. Output ONLY the rewritten message, nothing else.

Original message:
"""
{MESSAGE}
"""

Rewritten message:`;

// If the Gemini call fails or times out, this local synonym spinner runs.
// Maps common words to synonyms so the message gets minor variation without
// an API call. This is the FALLBACK that ensures the queue NEVER halts.
export const LOCAL_SYNONYMS = {
  'hello': ['hi', 'hey', 'greetings'],
  'hi': ['hello', 'hey', 'greetings'],
  'please': ['kindly', 'please'],
  'thank you': ['thanks', 'appreciate it', 'thank you'],
  'thanks': ['thank you', 'appreciate it'],
  'now': ['right now', 'currently', 'now'],
  'today': ['this day', 'today'],
  'free': ['complimentary', 'no-cost', 'free'],
  'offer': ['deal', 'promotion', 'offer'],
  'deal': ['offer', 'promotion', 'deal'],
  'click': ['tap', 'select', 'click'],
  'buy': ['purchase', 'get', 'buy'],
  'new': ['latest', 'fresh', 'new'],
  'best': ['top', 'premium', 'best'],
  'quick': ['fast', 'swift', 'quick'],
  'easy': ['simple', 'effortless', 'easy'],
  'guaranteed': ['assured', 'certain', 'guaranteed'],
  'limited': ['restricted', 'scarce', 'limited'],
  'exclusive': ['private', 'select', 'exclusive'],
};

// Gemini call timeout for the pre-flight rewrite (ms).
export const AI_REWRITE_TIMEOUT_MS = 8000;

// ---------------------------------------------------------------------------
// MODULE 2 — SSE Live Stream Configuration
// ---------------------------------------------------------------------------
export const SSE_CONFIG = {
  // How often the SSE endpoint pushes a heartbeat (ms) to keep the connection
  // alive through proxies / load balancers.
  heartbeatMs: 15000,
  // Max number of events buffered in Redis list per channel.
  maxBufferedEvents: 200,
  // SSE event channel names.
  channels: {
    logs: 'gateway:logs',
    metrics: 'gateway:metrics',
    accounts: 'gateway:accounts',
    queue: 'gateway:queue',
  },
};

// ---------------------------------------------------------------------------
// MODULE 2 — Dynamic Config Keys (Redis)
// ---------------------------------------------------------------------------
// These keys store runtime-configurable values in Redis so admins can change
// them WITHOUT restarting the process. Each falls back to SystemConfig (Mongo)
// or a hardcoded default if not set in Redis.
// ---------------------------------------------------------------------------
export const DYNAMIC_CONFIG_KEYS = {
  routingDelayMs: 'routingDelayMs',
  batchSizePerAccount: 'batchSizePerAccount',
  maxConcurrency: 'maxConcurrency',
  queuePaused: 'queuePaused',
  aiPolymorphEnabled: 'aiPolymorphEnabled',
  safetyFilterEnabled: 'safetyFilterEnabled',
};

// ---------------------------------------------------------------------------
// Queue / job status enums
// ---------------------------------------------------------------------------
export const JOB_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DELAYED: 'delayed',
  RETRY: 'retry',
};

export const SEND_RESULT = {
  SENT: 'sent',
  FAILED: 'failed',
  BLOCKED_SAFETY: 'blocked_safety',
  // Legacy MMS-specific results (kept for backward compatibility with
  // existing delivery reports / UI):
  BLOCKED_LANDLINE: 'blocked_landline',
  BLOCKED_VOIP: 'blocked_voip',
  BLOCKED_INVALID: 'blocked_invalid',
  // Email-specific results (Email Sending Module):
  BLOCKED_INVALID_EMAIL: 'blocked_invalid_email',
  BOUNCED: 'bounced',
  CIRCUIT_OPEN: 'circuit_open',
  QUEUED: 'queued',
};

// ============================================================================
// MODULE 6: Origin IP Masking & Proxy Routing — Constants
// ============================================================================

// Proxy types supported by the ProxyConfig model.
export const PROXY_TYPES = {
  CLOUDFLARE_WORKER: 'cloudflare_worker',
  ROTATING_PROXY: 'rotating_proxy',
  STATIC_PROXY: 'static_proxy',
};

// Redis key for the global IP-masking toggle (on/off without restart).
// Value is 'true' or 'false'. Default is 'true' (masking ON = route through
// proxies). When 'false', the gateway dispatches directly from the origin.
export const IP_MASKING_TOGGLE_KEY = 'ip_masking_enabled';

// Redis key for the currently selected active proxy cache (5-minute TTL).
// This avoids a Mongo round-trip on every dispatch.
export const ACTIVE_PROXY_CACHE_KEY = 'active_proxy';
export const ACTIVE_PROXY_CACHE_TTL = 300; // 5 minutes

// Strict header-stripping list. These headers are REMOVED from every outbound
// proxied request so the telecom A2P filter can NEVER trace the origin server.
// X-Forwarded-For / Via / X-Real-IP etc. would reveal the Render/VPS IP.
export const STRIP_HEADERS = [
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-real-ip',
  'via',
  'forwarded',
  'forwarded-for',
  'x-originating-ip',
  'x-remote-ip',
  'x-remote-addr',
  'x-client-ip',
  'x-cluster-client-ip',
  'cf-connecting-ip',
  'cf-ipcountry',
  'true-client-ip',
  'x-original-forwarded-for',
];

// Headers to INJECT so the request looks like a genuine direct browser/client
// request (no proxy signatures).
export const INJECT_HEADERS = {
  'X-Request-ID': '', // filled dynamically with a random UUID per request
};

// Default per-proxy timeout (ms) for the fetch through the proxy.
export const PROXY_TIMEOUT_MS = 15000;

// Per-proxy mini circuit-breaker: 5 consecutive failures → mark 'down'.
export const PROXY_FAILURE_THRESHOLD = 5;

// Dynamic config key for IP masking (also exposed via /api/admin/gateway/dynamic)
export const PROXY_DYNAMIC_CONFIG_KEYS = [
  IP_MASKING_TOGGLE_KEY, // global on/off
  'proxyStrategy', // 'weighted' | 'round_robin' | 'least_latency' | 'random'
  'proxyTimeoutMs', // per-request timeout
  'proxyStripHeaders', // toggle header stripping on/off (default true)
];
