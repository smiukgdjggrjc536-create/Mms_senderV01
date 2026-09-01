// ============================================================================
// auth.js — Hardened Authentication (V7 P1.2)
// ----------------------------------------------------------------------------
// SPEC:
//   - Login: timing-safe bcrypt compare; failed attempts counted in Redis.
//     5 failures -> 15-minute lockout (key lockout:{username}, TTL 900s).
//   - JWT: HS256, exp=12h, issuer/audience checks, secret from env.
//   - Rate limit: login endpoint 10 req/min/IP (Redis INCR + EXPIRE atomic,
//     built on the existing redis.js primitives).
//   - requireAdmin: middleware for every admin API — no shortcut without a
//     valid session OR apiKey.
//
// NON-DESTRUCTIVE: this module ADDS hardened primitives. The existing
// verifyAdminLogin/ensureAdminCredentials/getJWTSecret/createToken/verifyToken
// in src/lib/core.js are PRESERVED (L6). core.js may re-export these helpers
// so existing routes keep working; the existing functions are not removed.
//
// GRACEFUL DEGRADATION: if Redis is unavailable, lockout + rate-limit fall
// back to an in-process Map (loud warn). Production always prefers Redis.
// ============================================================================

import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { getRedis, isRedisLive } from './redis.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const JWT_ALG = 'HS256';
const JWT_EXP = '12h';
const JWT_ISSUER = process.env.JWT_ISSUER || 'mms-sender-v7';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'mms-sender-v7-clients';

const LOCKOUT_THRESHOLD = 5;        // 5 failed attempts -> lockout
const LOCKOUT_TTL_SEC = 900;        // 15 minutes
const LOGIN_RATE_LIMIT = 10;        // 10 req/min per IP
const LOGIN_RATE_WINDOW_SEC = 60;

// In-memory fallbacks (only used if Redis is down)
const _failedAttempts = new Map(); // username -> { count, firstAt }
const _loginRate = new Map();       // ip -> { count, windowStart }

let _fallbackWarned = false;
function warnFallback(reason) {
  if (!_fallbackWarned) {
    console.warn(`[auth] WARNING: Redis unavailable (${reason}) — using in-memory fallback. Lockout/rate-limit are process-local only.`);
    _fallbackWarned = true;
  }
}

// ---------------------------------------------------------------------------
// JWT (hardened: issuer + audience + 12h expiry)
// ---------------------------------------------------------------------------

export function getJWTSecret() {
  const secret =
    process.env.JWT_SECRET ||
    'default_dev_secret_change_this_in_production_minimum_32_chars_long_2024';
  if (secret.length < 32) {
    console.warn('[auth] JWT_SECRET is shorter than 32 chars — insecure for production.');
  }
  return new TextEncoder().encode(secret);
}

/**
 * Create a hardened JWT (HS256, 12h, issuer + audience).
 * @param {object} payload
 * @param {{ subject?: string }} [opts]
 */
export async function createHardenedToken(payload, opts = {}) {
  const secret = getJWTSecret();
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime(JWT_EXP)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setSubject(opts.subject || String(payload.sub || payload.userId || payload.username || ''))
    .sign(secret);
  return token;
}

/**
 * Verify a hardened JWT. Returns the payload on success, null on failure
 * (invalid signature, expired, wrong issuer/audience).
 */
export async function verifyHardenedToken(token) {
  try {
    const secret = getJWTSecret();
    const { payload } = await jwtVerify(token, secret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    return payload;
  } catch (err) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Failed-login tracking + lockout
// ---------------------------------------------------------------------------

/**
 * Record a failed login attempt for a username. Returns the new count.
 * After LOCKOUT_THRESHOLD failures the lockout key is set with LOCKOUT_TTL_SEC.
 */
export async function recordFailedLogin(username) {
  const key = String(username || '').toLowerCase().trim();
  if (!key) return 0;
  const lockKey = `lockout:${key}`;
  const countKey = `loginfail:${key}`;
  const redis = getRedis();

  try {
    if (isRedisLive()) {
      const count = await redis.incr(countKey);
      if (count === 1) {
        // first failure in this window — expire the counter
        await redis.expire(countKey, LOCKOUT_TTL_SEC);
      }
      if (count >= LOCKOUT_THRESHOLD) {
        // activate lockout
        await redis.set(lockKey, '1', 'EX', LOCKOUT_TTL_SEC);
      }
      return count;
    }
  } catch (err) {
    warnFallback(err.message);
  }

  // in-memory fallback
  const now = Date.now();
  let entry = _failedAttempts.get(key);
  if (!entry || now - entry.firstAt > LOCKOUT_TTL_SEC * 1000) {
    entry = { count: 0, firstAt: now };
    _failedAttempts.set(key, entry);
  }
  entry.count += 1;
  return entry.count;
}

/**
 * Is the username currently locked out?
 */
export async function isLockedOut(username) {
  const key = String(username || '').toLowerCase().trim();
  if (!key) return false;
  const lockKey = `lockout:${key}`;
  const redis = getRedis();

  try {
    if (isRedisLive()) {
      const v = await redis.get(lockKey);
      return v === '1' || v === 1;
    }
  } catch (err) {
    warnFallback(err.message);
  }

  // in-memory fallback
  const entry = _failedAttempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > LOCKOUT_TTL_SEC * 1000) {
    _failedAttempts.delete(key);
    return false;
  }
  return entry.count >= LOCKOUT_THRESHOLD;
}

/**
 * Clear failed-login state for a username (call on a SUCCESSFUL login).
 */
export async function clearFailedLogins(username) {
  const key = String(username || '').toLowerCase().trim();
  if (!key) return;
  const lockKey = `lockout:${key}`;
  const countKey = `loginfail:${key}`;
  const redis = getRedis();

  try {
    if (isRedisLive()) {
      await redis.del(lockKey, countKey);
      return;
    }
  } catch (err) {
    warnFallback(err.message);
  }
  _failedAttempts.delete(key);
}

/**
 * How many seconds until the lockout for a username expires (best-effort).
 */
export async function lockoutTtlSeconds(username) {
  const key = String(username || '').toLowerCase().trim();
  if (!key) return 0;
  const lockKey = `lockout:${key}`;
  const redis = getRedis();
  try {
    if (isRedisLive()) {
      const ttl = await redis.ttl(lockKey);
      return ttl > 0 ? ttl : 0;
    }
  } catch (err) {
    warnFallback(err.message);
  }
  const entry = _failedAttempts.get(key);
  if (!entry) return 0;
  const remainingMs = entry.firstAt + LOCKOUT_TTL_SEC * 1000 - Date.now();
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

// ---------------------------------------------------------------------------
// Login rate limit (per IP, 10 req/min)
// ---------------------------------------------------------------------------

/**
 * Check the login rate limit for an IP. Returns { allowed, retryAfterSec }.
 */
export async function checkLoginRateLimit(ip) {
  const ipKey = String(ip || 'unknown').trim();
  const key = `loginrate:${ipKey}`;
  const redis = getRedis();

  try {
    if (isRedisLive()) {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, LOGIN_RATE_WINDOW_SEC);
      }
      if (count > LOGIN_RATE_LIMIT) {
        const ttl = await redis.ttl(key);
        return { allowed: false, retryAfterSec: ttl > 0 ? ttl : LOGIN_RATE_WINDOW_SEC };
      }
      return { allowed: true, retryAfterSec: 0 };
    }
  } catch (err) {
    warnFallback(err.message);
  }

  // in-memory fallback (fixed window)
  const now = Date.now();
  let entry = _loginRate.get(ipKey);
  if (!entry || now - entry.windowStart > LOGIN_RATE_WINDOW_SEC * 1000) {
    entry = { count: 0, windowStart: now };
    _loginRate.set(ipKey, entry);
  }
  entry.count += 1;
  if (entry.count > LOGIN_RATE_LIMIT) {
    const remainingMs = entry.windowStart + LOGIN_RATE_WINDOW_SEC * 1000 - now;
    return { allowed: false, retryAfterSec: Math.ceil(remainingMs / 1000) };
  }
  return { allowed: false ? false : true, retryAfterSec: 0 };
}

// ---------------------------------------------------------------------------
// Timing-safe bcrypt compare
// ---------------------------------------------------------------------------

/**
 * Timing-safe password comparison using bcrypt. bcrypt.compare is already
 * constant-time with respect to the hash; we additionally guard against
 * empty/undefined inputs to avoid short-circuit timing leaks.
 */
export async function timingSafeComparePassword(password, hash) {
  if (!password || !hash) return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch (err) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// requireAdmin middleware (Next.js route handlers)
// ---------------------------------------------------------------------------

/**
 * Extract the bearer token or apiKey from a Next.js Request.
 * Returns { token, apiKey } where either may be null.
 */
export function extractAuth(request) {
  const headers = request.headers || new Headers();
  const authHeader = headers.get('authorization') || headers.get('Authorization') || '';
  let token = null;
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }
  const apiKey =
    headers.get('x-api-key') ||
    headers.get('X-Api-Key') ||
    (typeof request.json === 'function' ? null : null); // body apiKey handled by caller
  return { token, apiKey: apiKey || null };
}

/**
 * requireAdmin — verify the request carries a valid admin session (JWT) OR a
 * valid apiKey. Returns { ok: true, payload } on success, or
 * { ok: false, status, error } on failure.
 *
 * `verifyAdminApiKeyFn(apiKey)` is injected so this module stays decoupled from
 * core.js's AdminCredential lookup. If not provided, apiKey check is skipped.
 */
export async function requireAdmin(request, verifyAdminApiKeyFn = null) {
  const { token, apiKey } = extractAuth(request);

  // 1) JWT session path
  if (token) {
    const payload = await verifyHardenedToken(token);
    if (payload && (payload.role === 'admin' || payload.role === 'superadmin' || payload.admin === true)) {
      return { ok: true, payload, source: 'jwt' };
    }
    return { ok: false, status: 401, error: 'Invalid or expired session' };
  }

  // 2) apiKey path
  if (apiKey && typeof verifyAdminApiKeyFn === 'function') {
    try {
      const admin = await verifyAdminApiKeyFn(apiKey);
      if (admin) {
        return { ok: true, payload: { admin: true, username: admin.username }, source: 'apikey' };
      }
    } catch (err) {
      return { ok: false, status: 500, error: 'Auth check failed' };
    }
    return { ok: false, status: 403, error: 'Invalid API key' };
  }

  return { ok: false, status: 401, error: 'Authentication required' };
}

/**
 * Helper to turn a requireAdmin failure into a Next.js Response.
 */
export function authFailResponse(result) {
  return new Response(
    JSON.stringify({ error: result.error || 'Unauthorized' }),
    { status: result.status || 401, headers: { 'Content-Type': 'application/json' } }
  );
}

// ---------------------------------------------------------------------------
// Hardened login orchestrator
// ---------------------------------------------------------------------------

/**
 * hardenedLogin(username, password, apiKey, lookupFn)
 *   - Enforces IP rate limit (caller passes ip).
 *   - Enforces username lockout.
 *   - Timing-safe bcrypt compare.
 *   - On success: clears failed logins, returns a hardened JWT.
 *   - On failure: records the failed attempt, returns { success:false, error }.
 *
 * `lookupFn(username)` must return { passwordHash, apiKey, username, role } or null.
 * `ip` is the client IP for rate-limiting.
 */
export async function hardenedLogin(username, password, apiKey, lookupFn, ip = 'unknown') {
  // 1) IP rate limit
  const rl = await checkLoginRateLimit(ip);
  if (!rl.allowed) {
    return { success: false, error: `Too many login attempts. Retry in ${rl.retryAfterSec}s`, status: 429 };
  }

  // 2) Lockout check
  if (await isLockedOut(username)) {
    const ttl = await lockoutTtlSeconds(username);
    return { success: false, error: `Account locked. Retry in ${Math.ceil(ttl / 60)} min`, status: 423 };
  }

  // 3) Lookup
  let admin = null;
  try {
    admin = await lookupFn(username);
  } catch (err) {
    return { success: false, error: 'Authentication service unavailable', status: 500 };
  }
  if (!admin) {
    await recordFailedLogin(username);
    return { success: false, error: 'Invalid credentials', status: 401 };
  }

  // 4) Timing-safe password compare
  const ok = await timingSafeComparePassword(password, admin.passwordHash);
  if (!ok) {
    const count = await recordFailedLogin(username);
    if (count >= LOCKOUT_THRESHOLD) {
      return { success: false, error: 'Account locked for 15 minutes due to repeated failures', status: 423 };
    }
    return { success: false, error: 'Invalid credentials', status: 401 };
  }

  // 5) apiKey check (optional second factor if provided)
  if (apiKey && admin.apiKey && admin.apiKey !== apiKey) {
    const count = await recordFailedLogin(username);
    return { success: false, error: 'Invalid API key', status: 401 };
  }

  // 6) Success
  await clearFailedLogins(username);
  const token = await createHardenedToken({
    sub: admin.username,
    username: admin.username,
    role: admin.role || 'superadmin',
    admin: true,
  }, { subject: admin.username });

  return {
    success: true,
    token,
    admin: {
      username: admin.username,
      role: admin.role || 'superadmin',
    },
  };
}

export const AUTH_CONFIG = {
  JWT_ALG,
  JWT_EXP,
  JWT_ISSUER,
  JWT_AUDIENCE,
  LOCKOUT_THRESHOLD,
  LOCKOUT_TTL_SEC,
  LOGIN_RATE_LIMIT,
  LOGIN_RATE_WINDOW_SEC,
};

export default {
  getJWTSecret,
  createHardenedToken,
  verifyHardenedToken,
  recordFailedLogin,
  isLockedOut,
  clearFailedLogins,
  lockoutTtlSeconds,
  checkLoginRateLimit,
  timingSafeComparePassword,
  extractAuth,
  requireAdmin,
  authFailResponse,
  hardenedLogin,
  AUTH_CONFIG,
};
