// scripts/test-auth.js — P1.2 acceptance test (lockout + rate limit + JWT)
// Run: node scripts/test-auth.js
import bcrypt from 'bcryptjs';
import {
  hardenedLogin,
  isLockedOut,
  recordFailedLogin,
  clearFailedLogins,
  checkLoginRateLimit,
  createHardenedToken,
  verifyHardenedToken,
  AUTH_CONFIG,
} from '../src/lib/auth.js';

let pass = 0;
let fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}`); }
}

// Fake admin store
const HASH = await bcrypt.hash('CorrectPass123!', 12);
const adminStore = {
  'admin_test': { username: 'admin_test', passwordHash: HASH, apiKey: 'sk_test_key', role: 'superadmin' },
};
function lookup(username) {
  return Promise.resolve(adminStore[String(username).toLowerCase()] || null);
}

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

console.log('=== P1.2 Auth Hardening — Acceptance Test ===\n');

// 1) Successful login issues a hardened JWT
console.log('[1] Successful login -> hardened JWT');
const good = await hardenedLogin('admin_test', 'CorrectPass123!', 'sk_test_key', lookup, '127.0.0.1');
ok(good.success === true, 'login succeeds with correct credentials');
ok(typeof good.token === 'string' && good.token.split('.').length === 3, 'returns a 3-part JWT');

// 2) JWT has issuer + audience + verifies
console.log('[2] JWT issuer/audience verification');
const payload = await verifyHardenedToken(good.token);
ok(payload !== null, 'JWT verifies with correct issuer/audience');
ok(payload.username === 'admin_test', 'JWT payload contains username');
ok(payload.admin === true, 'JWT payload marks admin=true');

// Tampered token rejected
const bad = await verifyHardenedToken(good.token + 'x');
ok(bad === null, 'tampered JWT is rejected');

// 3) 6 wrong passwords -> lockout active
console.log('[3] 6 wrong passwords -> lockout');
clearFailedLogins('admin_test');
for (let i = 1; i <= 5; i++) {
  await hardenedLogin('admin_test', 'WRONG', 'sk_test_key', lookup, '10.0.0.1');
}
let locked = await isLockedOut('admin_test');
ok(locked === true, 'after 5 failures, account is locked');

// 6th attempt with CORRECT password during lockout is rejected
const duringLock = await hardenedLogin('admin_test', 'CorrectPass123!', 'sk_test_key', lookup, '10.0.0.2');
ok(duringLock.success === false, 'correct password during lockout is rejected');
ok(duringLock.status === 423, 'locked response status is 423');

// 4) Wrong apiKey fails but does not bypass lockout check ordering
console.log('[4] Wrong apiKey rejected');
clearFailedLogins('admin_test2');
adminStore['admin_test2'] = { username: 'admin_test2', passwordHash: HASH, apiKey: 'sk_correct', role: 'superadmin' };
const wrongKey = await hardenedLogin('admin_test2', 'CorrectPass123!', 'sk_WRONG', lookup, '10.0.0.3');
ok(wrongKey.success === false, 'wrong apiKey is rejected');
ok(wrongKey.error.includes('API key') || wrongKey.error.includes('credentials'), 'wrong apiKey error message');

// 5) Rate limit: 10 req/min per IP -> 11th blocked
console.log('[5] IP rate limit (10/min)');
let blocked = false;
let lastStatus = 0;
for (let i = 0; i < 12; i++) {
  const r = await hardenedLogin('admin_test2', 'CorrectPass123!', 'sk_correct', lookup, '11.0.0.' + (i % 3 === 0 ? '99' : '99'));
  // use a single IP by overriding check directly:
}
// Direct rate-limit test on a fresh IP
const rlIp = '203.0.113.7';
let rlAllowedCount = 0;
let rlBlocked = false;
for (let i = 0; i < 12; i++) {
  const rl = await checkLoginRateLimit(rlIp);
  if (rl.allowed) rlAllowedCount++;
  else rlBlocked = true;
}
ok(rlAllowedCount <= AUTH_CONFIG.LOGIN_RATE_LIMIT, `at most ${AUTH_CONFIG.LOGIN_RATE_LIMIT} allowed in window (got ${rlAllowedCount})`);
ok(rlBlocked === true, '11th+ request on same IP is blocked');

// 6) Lockout TTL expiry -> login works again (simulated by clearing)
console.log('[6] After lockout clears, login works');
clearFailedLogins('admin_test');
const afterClear = await hardenedLogin('admin_test', 'CorrectPass123!', 'sk_test_key', lookup, '127.0.0.2');
ok(afterClear.success === true, 'login works after lockout is cleared');

// 7) requireAdmin rejects without auth
console.log('[7] requireAdmin without auth -> 401');
const req = new Request('https://x/api/admin/test', { method: 'GET' });
const { requireAdmin } = await import('../src/lib/auth.js');
const guard = await requireAdmin(req);
ok(guard.ok === false, 'no-auth request is rejected');
ok(guard.status === 401, 'status is 401');

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
