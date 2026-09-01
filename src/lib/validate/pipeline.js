// ============================================================================
// V7 P6.1 — Validator Pipeline (server-authoritative, hardcore)
// ============================================================================
// 5-step email validation pipeline:
//   (1) Syntax/RFC 5322 — regex + structural checks
//   (2) Duplicates — Redis set, case-insensitive deduplication
//   (3) Bounce-risk — heuristics + historical bounce data
//   (4) Blacklist — disposable domains + role-based addresses
//   (5) Grade score — weighted quality score (0-100)
//
// The server's numbers are FINAL — the UI sequence displays these numbers,
// it never invents its own.
//
// Exports:
//   validatePipeline, validateSingle, DISPOSABLE_DOMAINS, ROLE_PREFIXES,
//   BOUNCE_RISK_PATTERNS, gradeEmail, validateSyntax, checkDuplicate,
//   checkBounceRisk, checkBlacklist
// ============================================================================

import { getRedisClient, isRedisLive } from '../redis/client.js';
import { connectDB } from '../core.js';

// ---------------------------------------------------------------------------
// Step 1: Syntax validation (RFC 5322 simplified)
// ---------------------------------------------------------------------------

const EMAIL_REGEX =
  /^(?=.{1,254}$)(?=.{1,64}@)[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;

export function validateSyntax(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, reason: 'Email address is required' };
  }
  let cleaned = email.trim();
  if (cleaned.startsWith('<') && cleaned.endsWith('>')) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  if (cleaned.length === 0) return { valid: false, reason: 'Empty email' };
  if (cleaned.length > 254) return { valid: false, reason: 'Too long (max 254)' };
  if (cleaned.indexOf('@') === -1) return { valid: false, reason: 'Missing @' };

  const atIdx = cleaned.lastIndexOf('@');
  const local = cleaned.slice(0, atIdx);
  const domain = cleaned.slice(atIdx + 1).toLowerCase();
  cleaned = local + '@' + domain;

  if (!EMAIL_REGEX.test(cleaned)) {
    return { valid: false, reason: 'Invalid format' };
  }
  if (local.startsWith('.') || local.endsWith('.') || local.indexOf('..') !== -1) {
    return { valid: false, reason: 'Invalid local-part (dot placement)' };
  }
  const tld = domain.slice(domain.lastIndexOf('.') + 1);
  if (tld.length < 2) {
    return { valid: false, reason: 'TLD too short' };
  }
  return { valid: true, cleaned, domain, local };
}

// ---------------------------------------------------------------------------
// Step 4: Blacklist — disposable domains + role-based prefixes
// ---------------------------------------------------------------------------

export const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'tempmail.org',
  '10minutemail.com', 'throwaway.email', 'getnada.com', 'maildrop.cc',
  'yopmail.com', 'trashmail.com', 'sharklasers.com', 'guerrillamailblock.com',
  'dispostable.com', 'fakeinbox.com', 'mailnesia.com', 'tempr.email',
  'temp-mail.org', 'emailondeck.com', 'mintemail.com', 'mohmal.com',
  'tmpmail.org', 'throwam.com', 'mailcatch.com', 'spambox.us',
  'disposablemail.com', 'mail-temp.com', 'tempinbox.com', 'moakt.com',
  'discard.email', 'mailtrap.io', 'burnermail.io', 'tempmailaddress.com',
]);

export const ROLE_PREFIXES = new Set([
  'admin', 'administrator', 'webmaster', 'hostmaster', 'postmaster',
  'info', 'support', 'help', 'contact', 'sales', 'marketing',
  'noreply', 'no-reply', 'donotreply', 'do-not-reply', 'unsubscribe',
  'abuse', 'security', 'sysadmin', 'root', 'billing', 'accounting',
  'hr', 'it', 'dev', 'developer', 'test', 'testing', 'demo',
  'office', 'reception', 'frontdesk', 'front.desk', 'manager',
  'team', 'all', 'everyone', 'staff', 'mail', 'email', 'feedback',
  'service', 'customer.service', 'customerservice', 'general',
]);

export function checkBlacklist(cleaned, domain, local) {
  // Disposable domain check
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { blacklisted: true, reason: 'disposable', domain };
  }
  // Role-based prefix check (case-insensitive)
  const localLower = local.toLowerCase();
  const baseLocal = localLower.split('@')[0].split('+')[0]; // strip plus-addressing
  if (ROLE_PREFIXES.has(baseLocal)) {
    return { blacklisted: true, reason: 'role-based', prefix: baseLocal };
  }
  return { blacklisted: false };
}

// ---------------------------------------------------------------------------
// Step 3: Bounce-risk — heuristics + historical data
// ---------------------------------------------------------------------------

export const BOUNCE_RISK_PATTERNS = [
  { pattern: /[0-9]{6,}@/, risk: 'high', reason: 'numeric-heavy local-part (likely fake)' },
  { pattern: /\.(con|cmn|co|comm|net\.com)$/, risk: 'high', reason: 'likely typosquatted TLD' },
  { pattern: /^[a-z]{1,2}[0-9]{2,}@/, risk: 'medium', reason: 'short local-part + numbers (suspicious)' },
  { pattern: /(.)\1{4,}/, risk: 'medium', reason: 'repeated characters (likely fake)' },
  { pattern: /@(test|example|invalid|localhost)\./, risk: 'high', reason: 'test/example domain' },
];

export function checkBounceRisk(cleaned, domain, local, historicalBounces = null) {
  let riskLevel = 'low';
  let riskScore = 0;
  const reasons = [];

  // Heuristic pattern matching
  for (const { pattern, risk, reason } of BOUNCE_RISK_PATTERNS) {
    if (pattern.test(cleaned)) {
      reasons.push(reason);
      if (risk === 'high') { riskScore += 40; riskLevel = 'high'; }
      else if (risk === 'medium') { riskScore += 20; if (riskLevel !== 'high') riskLevel = 'medium'; }
    }
  }

  // Domain has no MX-like structure (no dot in domain beyond TLD)
  const domainParts = domain.split('.');
  if (domainParts.length < 2) {
    riskScore += 30;
    riskLevel = 'high';
    reasons.push('domain has no subdomain structure');
  }

  // Historical bounce data (if provided)
  if (historicalBounces && typeof historicalBounces === 'object') {
    const domainHistory = historicalBounces[domain];
    if (domainHistory && domainHistory.bounceRate > 0.3) {
      riskScore += 30;
      riskLevel = 'high';
      reasons.push(`domain ${domain} has ${(domainHistory.bounceRate * 100).toFixed(0)}% historical bounce rate`);
    }
  }

  riskScore = Math.min(riskScore, 100);
  return { riskLevel, riskScore, reasons };
}

// ---------------------------------------------------------------------------
// Step 5: Grade score — weighted quality score (0-100)
// ---------------------------------------------------------------------------

export function gradeEmail(result) {
  if (!result || !result.valid) return 0;
  let score = 100;

  // Deduct for bounce risk
  if (result.bounceRisk) {
    score -= result.bounceRisk.riskScore * 0.5;
  }

  // Deduct for role-based (not blacklisted but low quality)
  if (result.blacklist && result.blacklist.reason === 'role-based') {
    score -= 10;
  }

  // Deduct for very short local parts
  if (result.local && result.local.length < 3) {
    score -= 10;
  }

  // Deduct for numeric-heavy local parts
  if (result.local && /[0-9]{4,}/.test(result.local)) {
    score -= 5;
  }

  // Bonus for recognized TLD
  if (result.domain && /\.(com|org|net|edu|gov|io|co|ai)$/i.test(result.domain)) {
    score = Math.min(score + 2, 100);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ---------------------------------------------------------------------------
// Step 2: Duplicate check — Redis set, case-insensitive
// ---------------------------------------------------------------------------

export async function checkDuplicate(cleaned, dedupSetKey) {
  try {
    const redis = getRedisClient();
    // SADD returns 1 if added (new), 0 if already exists (dup)
    const added = await redis.sadd(dedupSetKey, cleaned.toLowerCase());
    return { isDuplicate: added === 0 };
  } catch (err) {
    console.error(`[pipeline] checkDuplicate failed: ${err.message}`);
    // Fallback: assume not duplicate (fail-open, don't block sends)
    return { isDuplicate: false };
  }
}

// ---------------------------------------------------------------------------
// validateSingle(email, opts) — validate one email through all 5 steps
// ---------------------------------------------------------------------------

export async function validateSingle(email, opts = {}) {
  const dedupKey = opts.dedupSetKey || `pipeline:dedup:${opts.sessionId || 'default'}`;
  const historicalBounces = opts.historicalBounces || null;

  // Step 1: Syntax
  const syntax = validateSyntax(email);
  if (!syntax.valid) {
    return { email, valid: false, stage: 'syntax', reason: syntax.reason, grade: 0 };
  }

  // Step 2: Duplicate
  const dup = await checkDuplicate(syntax.cleaned, dedupKey);

  // Step 3: Bounce-risk
  const bounceRisk = checkBounceRisk(syntax.cleaned, syntax.domain, syntax.local, historicalBounces);

  // Step 4: Blacklist
  const blacklist = checkBlacklist(syntax.cleaned, syntax.domain, syntax.local);

  // Step 5: Grade
  const baseResult = {
    email: syntax.cleaned,
    valid: true,
    cleaned: syntax.cleaned,
    domain: syntax.domain,
    local: syntax.local,
    isDuplicate: dup.isDuplicate,
    bounceRisk,
    blacklist,
  };
  const grade = gradeEmail(baseResult);

  return { ...baseResult, grade };
}

// ---------------------------------------------------------------------------
// validatePipeline(emails, opts) — the main entry point
// Processes an array of emails through all 5 steps.
// Returns: { total, valid, invalid, dupesRemoved, bounceRisk, blacklisted,
//            highRisk, results, gradeDistribution }
// ---------------------------------------------------------------------------

export async function validatePipeline(emails, opts = {}) {
  if (!Array.isArray(emails)) {
    return {
      total: 0, valid: 0, invalid: 0, dupesRemoved: 0,
      bounceRisk: 0, blacklisted: 0, highRisk: 0,
      results: [], gradeDistribution: { high: 0, medium: 0, low: 0 },
    };
  }

  const dedupKey = opts.dedupSetKey || `pipeline:dedup:${opts.sessionId || 'default'}`;

  // Clear the dedup set at the start of a new pipeline run
  try {
    const redis = getRedisClient();
    await redis.del(dedupKey);
  } catch (err) {
    // best-effort
  }

  const results = [];
  let valid = 0;
  let invalid = 0;
  let dupesRemoved = 0;
  let bounceRiskCount = 0;
  let blacklistedCount = 0;
  let highRiskCount = 0;
  const gradeBuckets = { high: 0, medium: 0, low: 0 };

  for (const email of emails) {
    const result = await validateSingle(email, { ...opts, dedupSetKey: dedupKey });
    results.push(result);

    if (!result.valid) {
      invalid++;
      continue;
    }

    if (result.isDuplicate) {
      dupesRemoved++;
      continue;
    }

    valid++;

    if (result.blacklist && result.blacklist.blacklisted) {
      blacklistedCount++;
    }

    if (result.bounceRisk && result.bounceRisk.riskLevel !== 'low') {
      bounceRiskCount++;
      if (result.bounceRisk.riskLevel === 'high') {
        highRiskCount++;
      }
    }

    if (result.grade >= 80) gradeBuckets.high++;
    else if (result.grade >= 50) gradeBuckets.medium++;
    else gradeBuckets.low++;
  }

  return {
    total: emails.length,
    valid,
    invalid,
    dupesRemoved,
    bounceRisk: bounceRiskCount,
    blacklisted: blacklistedCount,
    highRisk: highRiskCount,
    gradeDistribution: gradeBuckets,
    results,
  };
}

// ---------------------------------------------------------------------------
// Helper: clear the dedup set for a session (called when pipeline is reset)
// ---------------------------------------------------------------------------

export async function clearDedupSet(sessionId) {
  const dedupKey = `pipeline:dedup:${sessionId || 'default'}`;
  try {
    const redis = getRedisClient();
    await redis.del(dedupKey);
  } catch (err) {
    // best-effort
  }
}

export default {
  validatePipeline,
  validateSingle,
  validateSyntax,
  checkDuplicate,
  checkBounceRisk,
  checkBlacklist,
  gradeEmail,
  DISPOSABLE_DOMAINS,
  ROLE_PREFIXES,
  BOUNCE_RISK_PATTERNS,
  clearDedupSet,
};
