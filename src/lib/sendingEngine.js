// ============================================================================
// REAL Bulk Sending Engine — Provider Integrations + Spam Scoring + AI Routing
// ============================================================================
// This module contains the real HTTP integrations for sending MMS/SMS via
// Twilio, Vonage/Nexmo, MessageBird, and any custom HTTP provider.
// It also includes spam scoring (heuristic + Gemini), AI sender routing,
// rate limiting, retry with backoff, and batching utilities.
// ============================================================================

// ---------------------------------------------------------------------------// Rate limiting — P1.4: now Redis-backed via src/services/rateLimiter.js
// ---------------------------------------------------------------------------
// The in-memory `rateWindows` Map has been replaced by a Redis-atomic
// fixed-window limiter (src/services/rateLimiter.js). When Redis is live
// the state survives process restarts and is shared across all workers.
// When Redis is unavailable it falls back to an in-memory sliding window
// with a LOUD warning. The function signatures are PRESERVED but are now
// async — all call sites in core.js have been updated to `await`.
import { checkRateLimit as _rlCheck, recordRateHit as _rlRecord } from '../services/rateLimiter.js';

export async function checkRateLimit(apiId, perMinute, perHour) {
  return _rlCheck(apiId, perMinute, perHour);
}

export async function recordRateHit(apiId) {
  return _rlRecord(apiId);
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function* batchArray(arr, size) {
  for (let i = 0; i < arr.length; i += size) {
    yield arr.slice(i, i + size);
  }
}

// ---------------------------------------------------------------------------
// Provider: Twilio — POST /Messages.json (form-urlencoded, Basic auth)
// ---------------------------------------------------------------------------
export async function sendViaTwilio(api, toNumber, message, mediaUrl) {
  const endpoint = api.endpoint || `https://api.twilio.com/2010-04-01/Accounts/${api.apiKey}/Messages.json`;
  const auth = Buffer.from(`${api.apiKey}:${api.apiSecret}`).toString('base64');
  const params = new URLSearchParams();
  params.append('To', toNumber);
  params.append('From', api.senderId || api.apiKey);
  params.append('Body', message);
  if (mediaUrl) params.append('MediaUrl', mediaUrl);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.sid) {
      return { success: true, status: data.status || 'queued', providerMsgId: data.sid, errorCode: null, errorMessage: null };
    }
    return {
      success: false,
      status: 'failed',
      providerMsgId: data.sid || null,
      errorCode: data.code || res.status,
      errorMessage: data.message || `Twilio HTTP ${res.status}`,
    };
  } catch (e) {
    return { success: false, status: 'failed', providerMsgId: null, errorCode: 'NETWORK', errorMessage: e.message };
  }
}

// ---------------------------------------------------------------------------
// Provider: Vonage / Nexmo — POST /v0.1/messages (JSON, Basic auth)
// ---------------------------------------------------------------------------
export async function sendViaVonage(api, toNumber, message) {
  const endpoint = api.endpoint || 'https://api.nexmo.com/v0.1/messages';
  const auth = Buffer.from(`${api.apiKey}:${api.apiSecret}`).toString('base64');
  const body = {
    from: { type: 'text', number: api.senderId || api.apiKey },
    to: { type: 'text', number: toNumber },
    message: { content: { type: 'text', text: message } },
  };
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && (data.message_uuid || data.messages)) {
      return { success: true, status: 'queued', providerMsgId: data.message_uuid || (data.messages && data.messages[0] && data.messages[0]['message-id']) || 'unknown', errorCode: null, errorMessage: null };
    }
    return {
      success: false,
      status: 'failed',
      providerMsgId: null,
      errorCode: (data['error-code'] || data.code) || res.status,
      errorMessage: data['error-text'] || data.message || `Vonage HTTP ${res.status}`,
    };
  } catch (e) {
    return { success: false, status: 'failed', providerMsgId: null, errorCode: 'NETWORK', errorMessage: e.message };
  }
}

// ---------------------------------------------------------------------------
// Provider: MessageBird — POST /messages (JSON, AccessKey header)
// ---------------------------------------------------------------------------
export async function sendViaMessageBird(api, toNumber, message) {
  const endpoint = api.endpoint || 'https://rest.messagebird.com/messages';
  const body = {
    originator: api.senderId || api.apiKey,
    recipients: [toNumber],
    body: message,
  };
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `AccessKey ${api.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.id) {
      return { success: true, status: data.status || 'sent', providerMsgId: data.id, errorCode: null, errorMessage: null };
    }
    return {
      success: false,
      status: 'failed',
      providerMsgId: null,
      errorCode: (data.errors && data.errors[0] && data.errors[0].code) || res.status,
      errorMessage: (data.errors && data.errors[0] && data.errors[0].description) || `MessageBird HTTP ${res.status}`,
    };
  } catch (e) {
    return { success: false, status: 'failed', providerMsgId: null, errorCode: 'NETWORK', errorMessage: e.message };
  }
}

// ---------------------------------------------------------------------------
// Provider: Custom HTTP — Bearer auth, JSON body {to, from, message, apiKey}
// ---------------------------------------------------------------------------
export async function sendViaCustom(api, toNumber, message) {
  const endpoint = api.endpoint;
  if (!endpoint) {
    return { success: false, status: 'failed', providerMsgId: null, errorCode: 'NO_ENDPOINT', errorMessage: 'No endpoint configured for custom provider' };
  }
  const body = {
    to: toNumber,
    from: api.senderId || '',
    message,
    apiKey: api.apiKey,
    sender: api.senderId || '',
  };
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${api.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && (data.success || data.id || data.messageId || res.status < 300)) {
      return { success: true, status: data.status || 'sent', providerMsgId: data.id || data.messageId || 'custom-' + Date.now(), errorCode: null, errorMessage: null };
    }
    return {
      success: false,
      status: 'failed',
      providerMsgId: data.id || null,
      errorCode: data.errorCode || data.code || res.status,
      errorMessage: data.error || data.message || `Custom HTTP ${res.status}`,
    };
  } catch (e) {
    return { success: false, status: 'failed', providerMsgId: null, errorCode: 'NETWORK', errorMessage: e.message };
  }
}

// ---------------------------------------------------------------------------
// Dispatcher — routes to the correct provider sender
// ---------------------------------------------------------------------------
export async function executeRealSend(api, toNumber, message, mediaUrl) {
  const provider = (api.provider || 'custom').toLowerCase();
  switch (provider) {
    case 'twilio':
      return sendViaTwilio(api, toNumber, message, mediaUrl);
    case 'vonage':
    case 'nexmo':
      return sendViaVonage(api, toNumber, message);
    case 'messagebird':
    case 'message_bird':
      return sendViaMessageBird(api, toNumber, message);
    case 'custom':
    case 'http':
    default:
      return sendViaCustom(api, toNumber, message);
  }
}

// ---------------------------------------------------------------------------
// Retry with exponential backoff — terminal errors are NOT retried
// ---------------------------------------------------------------------------
const TERMINAL_ERRORS = ['21211', '21612', '21614', '30004', '30007', 'NO_ENDPOINT', 'NETWORK'];

export async function sendWithRetry(api, toNumber, message, mediaUrl, maxRetries = 2) {
  let lastResult = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await executeRealSend(api, toNumber, message, mediaUrl);
    lastResult = result;
    if (result.success) return result;
    // Don't retry terminal errors (invalid number, blocked, no endpoint, network)
    const isTerminal = TERMINAL_ERRORS.some((e) => String(result.errorCode).includes(e));
    const is4xx = result.errorCode && Number(result.errorCode) >= 400 && Number(result.errorCode) < 500;
    if (isTerminal || is4xx) return result;
    if (attempt < maxRetries) {
      await sleep(Math.pow(2, attempt) * 1000); // 1s, 2s, 4s
    }
  }
  return lastResult;
}

// ---------------------------------------------------------------------------
// Spam scoring — heuristic detector (0-100)
// ---------------------------------------------------------------------------
const SPAM_KEYWORDS = [
  'free', 'winner', 'win', 'prize', 'cash', 'loan', 'credit', 'urgent', 'limited time',
  'act now', 'click here', 'buy now', 'discount', 'offer', 'deal', 'guarantee', 'risk free',
  'no obligation', 'exclusive', 'secret', 'amazing', 'incredible', 'congratulations',
  'selected', 'qualified', 'special promotion', '100% free', 'earn money', 'work from home',
  'weight loss', 'viagra', 'casino', 'lottery', 'sweepstakes', 'bitcoin', 'crypto giveaway',
];

const URL_SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'rebrand.ly'];

export function scoreSpamHeuristic(message) {
  if (!message) return { score: 0, level: 'clean', reasons: [] };
  const lower = message.toLowerCase();
  const reasons = [];
  let score = 0;

  // Keyword matches (up to 30 points)
  let keywordHits = 0;
  for (const kw of SPAM_KEYWORDS) {
    if (lower.includes(kw)) keywordHits++;
  }
  if (keywordHits > 0) {
    score += Math.min(keywordHits * 6, 30);
    reasons.push(`${keywordHits} spam keyword(s) detected`);
  }

  // ALL CAPS ratio (up to 15 points)
  const letters = message.replace(/[^a-zA-Z]/g, '');
  if (letters.length > 10) {
    const capsRatio = (message.replace(/[^A-Z]/g, '').length) / letters.length;
    if (capsRatio > 0.6) {
      score += 15;
      reasons.push('Excessive ALL CAPS');
    } else if (capsRatio > 0.3) {
      score += 8;
      reasons.push('High ALL CAPS ratio');
    }
  }

  // URL count (up to 15 points)
  const urls = message.match(/https?:\/\/[^\s]+/gi) || [];
  if (urls.length > 0) {
    score += Math.min(urls.length * 5, 15);
    reasons.push(`${urls.length} URL(s) in message`);
  }

  // URL shorteners (up to 10 points)
  let shortenerHits = 0;
  for (const s of URL_SHORTENERS) {
    if (lower.includes(s)) shortenerHits++;
  }
  if (shortenerHits > 0) {
    score += Math.min(shortenerHits * 5, 10);
    reasons.push('URL shortener detected (often used in spam)');
  }

  // Exclamation marks (up to 10 points)
  const exclaimCount = (message.match(/!/g) || []).length;
  if (exclaimCount > 3) {
    score += Math.min(exclaimCount * 2, 10);
    reasons.push(`${exclaimCount} exclamation marks`);
  }

  // Urgency words (up to 10 points)
  const urgencyWords = ['urgent', 'now', 'today', 'hurry', 'expires', 'last chance', 'deadline'];
  let urgencyHits = 0;
  for (const w of urgencyWords) {
    if (lower.includes(w)) urgencyHits++;
  }
  if (urgencyHits > 0) {
    score += Math.min(urgencyHits * 3, 10);
    reasons.push('Urgency language detected');
  }

  // Money references (up to 10 points)
  if (/\$|€|£|৳|rs\.?|dollar|money|cash|payment|pay/i.test(message)) {
    score += 8;
    reasons.push('Money/financial reference');
  }

  // Message length — very short or very long can be spammy (up to 5 points)
  if (message.length < 20) {
    score += 5;
    reasons.push('Very short message');
  } else if (message.length > 300) {
    score += 5;
    reasons.push('Very long message');
  }

  // Opt-out presence reduces score (legitimate messages include opt-out)
  if (/stop|opt.?out|unsubscribe|reply stop/i.test(lower)) {
    score = Math.max(0, score - 10);
    reasons.push('Opt-out present (legitimate indicator, -10)');
  }

  score = Math.min(score, 100);
  const level = score >= 60 ? 'high' : score >= 30 ? 'moderate' : 'clean';
  return { score, level, reasons };
}

// ---------------------------------------------------------------------------
// Gemini AI spam review
// ---------------------------------------------------------------------------
const GEMINI_FB_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest'];

export async function geminiSpamReview(message, geminiApi) {
  if (!geminiApi) return null;
  // Accept ANY key format (AIzaSy..., AQ., custom gateway keys, partner keys).
  // We no longer hard-reject non-"AIza" keys — the real upstream API call is
  // the source of truth. Only skip if the key is empty or an obvious placeholder.
  if (!geminiApi.apiKey || geminiApi.apiKey.length < 8 || geminiApi.apiKey.startsWith('demo_')) return null;
  const endpoint = geminiApi.endpoint || 'https://generativelanguage.googleapis.com/v1beta/models';
  const prompt = `You are a spam detection expert for SMS/MMS marketing messages. Analyze this message and respond with ONLY a JSON object (no markdown): {"spam_score": 0-100, "is_spam": true/false, "inbox_likelihood": 0-100, "suggestion": "brief improvement tip"}. Message: "${message.substring(0, 800)}"`;
  // Build candidate model list (configured model first, then fallbacks)
  const models = [];
  if (geminiApi.model) models.push(geminiApi.model);
  for (const m of GEMINI_FB_MODELS) { if (!models.includes(m)) models.push(m); }
  for (const model of models) {
    try {
      const geminiUrl = `${endpoint}/${model}:generateContent?key=${geminiApi.apiKey}`;
      const res = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
        }),
      });
      if (!res.ok) {
        if (res.status === 404) continue; // model not found → try next
        if (res.status === 400 || res.status === 403 || res.status === 429) break; // key/quota issue → stop
        continue;
      }
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleaned = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        spam_score: typeof parsed.spam_score === 'number' ? parsed.spam_score : (parsed.is_spam ? 80 : 20),
        is_spam: parsed.is_spam,
        inbox_likelihood: parsed.inbox_likelihood,
        suggestion: parsed.suggestion || '',
      };
    } catch {
      continue;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// AI sender routing — Gemini ranks APIs best-first; deterministic fallback
// ---------------------------------------------------------------------------
export async function aiRankSenderApis(senderApis, message, geminiApi) {
  if (!geminiApi || senderApis.length <= 1) {
    // Deterministic fallback: healthScore desc, inboxRate desc, priority desc, remaining desc
    return senderApis
      .slice()
      .sort((a, b) => (b.healthScore || 0) - (a.healthScore || 0) || (b.inboxRate || 0) - (a.inboxRate || 0) || (b.priority || 0) - (a.priority || 0) || (b.remaining || 0) - (a.remaining || 0))
      .map((a) => a._id.toString());
  }
  // Accept ANY key format (AIzaSy..., AQ., custom/partner keys). Only fall
  // back to deterministic sort if the key is empty or a placeholder.
  if (!geminiApi.apiKey || geminiApi.apiKey.length < 8 || geminiApi.apiKey.startsWith('demo_')) {
    return senderApis
      .slice()
      .sort((a, b) => (b.healthScore || 0) - (a.healthScore || 0) || (b.inboxRate || 0) - (a.inboxRate || 0) || (b.priority || 0) - (a.priority || 0) || (b.remaining || 0) - (a.remaining || 0))
      .map((a) => a._id.toString());
  }
  const endpoint = geminiApi.endpoint || 'https://generativelanguage.googleapis.com/v1beta/models';
  const apiList = senderApis.map((a, i) => `${i + 1}. ${a.name} (health:${a.healthScore}, inbox:${a.inboxRate}%, provider:${a.provider})`).join('\n');
  const prompt = `You are an SMS delivery expert. Given this marketing message and a list of sender APIs, rank them best-first for inbox delivery quality. Respond with ONLY a JSON array of API indices (1-based) in priority order. Message: "${message.substring(0, 300)}". APIs:\n${apiList}`;
  const models = [];
  if (geminiApi.model) models.push(geminiApi.model);
  for (const m of GEMINI_FB_MODELS) { if (!models.includes(m)) models.push(m); }
  for (const model of models) {
    try {
      const geminiUrl = `${endpoint}/${model}:generateContent?key=${geminiApi.apiKey}`;
      const res = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 256 },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleaned = text.replace(/```json|```/g, '').trim();
        const order = JSON.parse(cleaned);
        if (Array.isArray(order)) {
          const result = [];
          for (const idx of order) {
            const api = senderApis[idx - 1];
            if (api) result.push(api._id.toString());
          }
          // Append any not included
          for (const api of senderApis) {
            if (!result.includes(api._id.toString())) result.push(api._id.toString());
          }
          return result;
        }
      } else {
        if (res.status === 404) continue;
        if (res.status === 400 || res.status === 403 || res.status === 429) break;
        continue;
      }
    } catch {}
  }
  // Fallback
  return senderApis
    .slice()
    .sort((a, b) => (b.healthScore || 0) - (a.healthScore || 0) || (b.inboxRate || 0) - (a.inboxRate || 0) || (b.priority || 0) - (a.priority || 0) || (b.remaining || 0) - (a.remaining || 0))
    .map((a) => a._id.toString());
}

// ---------------------------------------------------------------------------
// Country rule enforcement — parse JSON {allowed:[], blocked:[], requireOptOut:[]}
// ---------------------------------------------------------------------------
export function enforceCountryRules(number, countryRulesStr) {
  if (!countryRulesStr) return true;
  try {
    const rules = JSON.parse(countryRulesStr);
    // Blocked prefixes
    if (rules.blocked && Array.isArray(rules.blocked)) {
      for (const prefix of rules.blocked) {
        if (number.startsWith(prefix)) return false;
      }
    }
    // Allowed prefixes (if specified, only these are allowed)
    if (rules.allowed && Array.isArray(rules.allowed) && rules.allowed.length > 0) {
      let allowed = false;
      for (const prefix of rules.allowed) {
        if (number.startsWith(prefix)) { allowed = true; break; }
      }
      if (!allowed) return false;
    }
    return true;
  } catch {
    return true; // If rules can't be parsed, allow
  }
}
