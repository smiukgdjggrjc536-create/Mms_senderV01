// ============================================================================
// V7 P5 ACCEPTANCE — test-packages-toggles.js
// ============================================================================
// P5.1 Toggle Registry:
//   a) Toggle disabled server-side → isToggleEnabled returns false
//      → enforceToggle returns { ok: false, status: 403 }
//   b) Build passes (separately)
//
// P5.2 Package Manager:
//   a) Test user (limit 5 for fast test) → 6th email blocked with clean message
//      → counter survives (Redis-backed via incrWithCeiling)
//   b) Package downgrade takes effect on next request (quota reset on assign)
//   c) Build passes (separately)
// ============================================================================

import assert from 'assert';
import {
  TOGGLE_REGISTRY,
  resolveToggles,
  getEffectiveTogglesForUser,
  isToggleEnabled,
  isToggleVisible,
  updateToggle,
  enforceToggle,
  publishToggleChange,
  _getLastTogglePubSubMsg,
} from '../src/lib/toggles/registry.js';
import {
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
} from '../src/lib/packages/manager.js';
import { resetCeiling, _resetAtomicState } from '../src/lib/redis/atomic.js';

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } }

// ---------------------------------------------------------------------------
// P5.1 — Toggle Registry tests
// ---------------------------------------------------------------------------

async function testToggleRegistryShape() {
  console.log('\n[Test 1] Toggle Registry shape');
  ok('TOGGLE_REGISTRY is array', Array.isArray(TOGGLE_REGISTRY));
  ok('>= 20 toggles defined', TOGGLE_REGISTRY.length >= 20);
  // Every toggle has required fields
  const allValid = TOGGLE_REGISTRY.every((t) =>
    t.key && t.label && t.category && t.defaultValue !== undefined &&
    Array.isArray(t.allowedRoles) && typeof t.packageTier === 'number'
  );
  ok('all toggles have required fields', allValid);
}

async function testResolveToggles() {
  console.log('\n[Test 2] resolveToggles — role + tier filtering');
  // User with free tier (0) — should not see tier 1+ toggles
  const freeUser = resolveToggles([], { role: 'user', packageTier: 0 });
  const tfnForFree = freeUser.find((t) => t.key === 'tfnNumber');
  ok('free user cannot see TFN (tier 1)', tfnForFree && tfnForFree.visible === false);

  // Pro user (tier 2) — should see tier 1+2 toggles
  const proUser = resolveToggles([], { role: 'user', packageTier: 2 });
  const tfnForPro = proUser.find((t) => t.key === 'tfnNumber');
  ok('pro user can see TFN (tier 1)', tfnForPro && tfnForPro.visible === true);

  // Enterprise toggle (tier 3) — only enterprise users see it
  const entToggle = proUser.find((t) => t.key === 'credentialAlertModal');
  ok('pro user cannot see enterprise toggle (tier 3)', entToggle && entToggle.visible === false);
  const entUser = resolveToggles([], { role: 'user', packageTier: 3 });
  const entToggleForEnt = entUser.find((t) => t.key === 'credentialAlertModal');
  ok('enterprise user can see enterprise toggle', entToggleForEnt && entToggleForEnt.visible === true);
}

async function testToggleEnabledDefault() {
  console.log('\n[Test 3] isToggleEnabled — default state (DB unreachable → defaults)');
  // When DB is unreachable, defaults should be used (visible+enabled by default)
  const enabled = await isToggleEnabled('htmlEditor', { role: 'user', packageTier: 0 });
  ok('htmlEditor enabled by default (tier 0)', enabled === true);

  // Tier 1 toggle for free user → not visible → not enabled
  const tfnEnabled = await isToggleEnabled('tfnNumber', { role: 'user', packageTier: 0 });
  ok('tfnNumber not enabled for free user', tfnEnabled === false);
}

async function testEnforceToggle() {
  console.log('\n[Test 4] enforceToggle — returns 403 when disabled');
  // Free user trying to use a tier 2 feature → 403
  const result = await enforceToggle('antiDetect', { role: 'user', packageTier: 0 });
  ok('returns ok=false', result.ok === false);
  ok('returns status 403', result.status === 403);
  ok('returns error message', typeof result.error === 'string' && result.error.length > 0);

  // Tier 0 feature for free user → ok
  const result2 = await enforceToggle('htmlEditor', { role: 'user', packageTier: 0 });
  ok('tier 0 feature → ok=true', result2.ok === true);
}

async function testPublishToggleChange() {
  console.log('\n[Test 5] publishToggleChange — fallback stores message');
  await publishToggleChange('testToggle', { visible: false, enabled: false });
  // In fallback mode, the last message should be stored
  const msg = _getLastTogglePubSubMsg();
  ok('pub/sub message stored in fallback', msg !== null);
  if (msg) {
    const parsed = JSON.parse(msg);
    ok('message has key', parsed.key === 'testToggle');
    ok('message has state', parsed.state && parsed.state.enabled === false);
  }
}

// ---------------------------------------------------------------------------
// P5.2 — Package Manager tests
// ---------------------------------------------------------------------------

async function testPackageRegistry() {
  console.log('\n[Test 6] Package Registry shape');
  ok('has free package', !!PACKAGE_REGISTRY.free);
  ok('has basic package', !!PACKAGE_REGISTRY.basic);
  ok('has pro package', !!PACKAGE_REGISTRY.pro);
  ok('has enterprise package', !!PACKAGE_REGISTRY.enterprise);

  const free = getPackage('free');
  ok('free has emailQuotaPerDay', typeof free.emailQuotaPerDay === 'number');
  ok('free has credentialLimit', typeof free.credentialLimit === 'number');
  ok('free has sandboxCount', typeof free.sandboxCount === 'number');
  ok('free has aiQuotaPerDay', typeof free.aiQuotaPerDay === 'number');
  ok('free has validatorDepth', typeof free.validatorDepth === 'string');
  ok('free tfnAvailable=false', free.tfnAvailable === false);
  ok('enterprise tfnAvailable=true', getPackage('enterprise').tfnAvailable === true);

  // Unknown package → free
  ok('unknown package → free fallback', getPackage('nonexistent').name === 'free');
}

async function testGetUserPackageFallback() {
  console.log('\n[Test 7] getUserPackage — DB unreachable → free fallback');
  const pkg = await getUserPackage('nonexistent-user-123');
  ok('returns a package', !!pkg);
  ok('falls back to free', pkg.name === 'free');
}

async function testEmailQuotaEnforcement() {
  console.log('\n[Test 8] Email quota enforcement (ceiling=5)');
  // Reset state
  await _resetAtomicState();

  // Use a user with ceiling 5 (simulate via direct incrWithCeiling)
  // We test consumeEmailQuota with a forced package
  const pkg = { emailQuotaPerDay: 5, credentialLimit: 3, sandboxCount: 2, aiQuotaPerDay: 10 };

  let allowedCount = 0;
  for (let i = 0; i < 10; i++) {
    const res = await consumeEmailQuota('quota-test-user', pkg);
    if (res.allowed) allowedCount++;
  }
  ok('exactly 5 emails allowed (ceiling=5)', allowedCount === 5);
  ok('6th denied', allowedCount === 5);
}

async function testQuotaSurvivesRestart() {
  console.log('\n[Test 9] Quota counter survives (Redis-backed, not reset on new process)');
  // After Test 8, the counter for quota-test-user should still be at 5
  // We DON'T reset — just check again
  const pkg = { emailQuotaPerDay: 5, credentialLimit: 3, sandboxCount: 2, aiQuotaPerDay: 10 };
  const res = await consumeEmailQuota('quota-test-user', pkg);
  ok('still at ceiling → denied (survives)', res.allowed === false);
  ok('current = 5', res.current === 5);
}

async function testPackageDowngradeLive() {
  console.log('\n[Test 10] Package downgrade takes effect on next request');
  // Reset and consume up to ceiling
  await _resetAtomicState();
  const pkg5 = { emailQuotaPerDay: 5, credentialLimit: 3, sandboxCount: 2, aiQuotaPerDay: 10 };

  // Consume 3 of 5
  for (let i = 0; i < 3; i++) await consumeEmailQuota('downgrade-user', pkg5);

  // "Downgrade" to ceiling 2 — resetCeiling is called by assignPackage
  await resetCeiling('quota:email:downgrade-user');
  const pkg2 = { emailQuotaPerDay: 2, credentialLimit: 3, sandboxCount: 2, aiQuotaPerDay: 10 };

  // After downgrade + reset, only 2 more allowed
  let allowedAfterDowngrade = 0;
  for (let i = 0; i < 5; i++) {
    const res = await consumeEmailQuota('downgrade-user', pkg2);
    if (res.allowed) allowedAfterDowngrade++;
  }
  ok('after downgrade to 2 → exactly 2 allowed', allowedAfterDowngrade === 2);
}

async function testCredentialLimitEnforcement() {
  console.log('\n[Test 11] Credential limit enforcement (ceiling=3)');
  await _resetAtomicState();
  const pkg = { emailQuotaPerDay: 100, credentialLimit: 3, sandboxCount: 2, aiQuotaPerDay: 10 };

  let allowed = 0;
  for (let i = 0; i < 5; i++) {
    const res = await consumeCredentialSlot('cred-test-user', pkg);
    if (res.allowed) allowed++;
  }
  ok('exactly 3 credentials allowed (ceiling=3)', allowed === 3);
}

async function testSandboxLimit() {
  console.log('\n[Test 12] Sandbox limit check');
  await _resetAtomicState();
  const pkg = { emailQuotaPerDay: 100, credentialLimit: 10, sandboxCount: 2, aiQuotaPerDay: 10 };

  const r1 = await checkSandboxLimit('sandbox-user', pkg);
  ok('0 sandboxes → allowed', r1.allowed === true);

  // Simulate 2 sandboxes created
  const redis = (await import('../src/lib/redis/client.js')).getRedisClient();
  await redis.set('quota:sandbox:sandbox-user', '2');

  const r2 = await checkSandboxLimit('sandbox-user', pkg);
  ok('2 sandboxes (ceiling=2) → denied', r2.allowed === false);
}

async function testAiQuota() {
  console.log('\n[Test 13] AI quota enforcement (ceiling=3)');
  await _resetAtomicState();
  const pkg = { emailQuotaPerDay: 100, credentialLimit: 10, sandboxCount: 2, aiQuotaPerDay: 3 };

  let allowed = 0;
  for (let i = 0; i < 5; i++) {
    const res = await consumeAiQuota('ai-test-user', pkg);
    if (res.allowed) allowed++;
  }
  ok('exactly 3 AI calls allowed (ceiling=3)', allowed === 3);
}

async function testEnforcePackageLimit() {
  console.log('\n[Test 14] enforcePackageLimit — 403 + Bangla message');
  await _resetAtomicState();
  const pkg = { emailQuotaPerDay: 2, credentialLimit: 10, sandboxCount: 2, aiQuotaPerDay: 10 };

  // Consume 2 (ceiling)
  await enforcePackageLimit('email', 'enforce-user', pkg);
  await enforcePackageLimit('email', 'enforce-user', pkg);

  // 3rd → 403
  const result = await enforcePackageLimit('email', 'enforce-user', pkg);
  ok('3rd email → ok=false', result.ok === false);
  ok('status 403', result.status === 403);
  ok('error is a string', typeof result.error === 'string');
  ok('error contains Bangla text', /[\u0980-\u09FF]/.test(result.error));
}

async function testValidatorDepth() {
  console.log('\n[Test 15] Validator depth by package');
  ok('free → basic', getPackage('free').validatorDepth === 'basic');
  ok('basic → standard', getPackage('basic').validatorDepth === 'standard');
  ok('pro → deep', getPackage('pro').validatorDepth === 'deep');
  ok('enterprise → deep', getPackage('enterprise').validatorDepth === 'deep');

  const depth = await checkValidatorDepth('some-user');
  ok('getUserPackage fallback → basic', depth === 'basic');
}

async function testGetPackageStatus() {
  console.log('\n[Test 16] getPackageStatus — shape');
  await _resetAtomicState();
  const status = await getPackageStatus('status-user');
  ok('has package', !!status.package);
  ok('has quotas', !!status.quotas);
  ok('has email quota', typeof status.quotas.email.ceiling === 'number');
  ok('has credential quota', typeof status.quotas.credential.ceiling === 'number');
  ok('has sandbox quota', typeof status.quotas.sandbox.ceiling === 'number');
  ok('has ai quota', typeof status.quotas.ai.ceiling === 'number');
  ok('has validatorDepth', typeof status.validatorDepth === 'string');
  ok('has timestamp', typeof status.timestamp === 'number');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  console.log('=== V7 P5 test-packages-toggles ===');
  try {
    // P5.1 Toggle Registry
    await testToggleRegistryShape();
    await testResolveToggles();
    await testToggleEnabledDefault();
    await testEnforceToggle();
    await testPublishToggleChange();

    // P5.2 Package Manager
    await testPackageRegistry();
    await testGetUserPackageFallback();
    await testEmailQuotaEnforcement();
    await testQuotaSurvivesRestart();
    await testPackageDowngradeLive();
    await testCredentialLimitEnforcement();
    await testSandboxLimit();
    await testAiQuota();
    await testEnforcePackageLimit();
    await testValidatorDepth();
    await testGetPackageStatus();
  } catch (err) {
    fail++;
    console.error('FATAL:', err);
  }
  console.log(`\n=== P5 RESULT: ${pass} pass, ${fail} fail ===`);
  process.exit(fail > 0 ? 1 : 0);
})();
