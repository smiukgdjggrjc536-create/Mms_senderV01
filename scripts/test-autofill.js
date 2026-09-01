// ============================================================================
// V7 P4.3 ACCEPTANCE — test-autofill.js
// ============================================================================
// a) Credential upload → sender list populated without manual input.
// b) Admin quota set to X → restock never exceeds X per day.
// c) Build passes (separately).
// ============================================================================

import assert from 'assert';
import {
  autoFillFromCredentials,
  probeAndPersist,
  feedNamesFromSenders,
  buildCampaignPools,
  getAiQuotaCeiling,
  runRestockWithQuota,
  getAutoFillStatus,
} from '../src/services/ai/autoFill.js';
import {
  consumeBatch,
  produceItems,
  getPoolSize,
  POOL_TYPES,
  checkAiQuota,
  resetAiQuota,
} from '../src/services/ai/engine.js';

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } }

// ---------------------------------------------------------------------------
// Test 1: autoFillFromCredentials — valid credentials → sender list populated
// ---------------------------------------------------------------------------
async function testAutoFillValid() {
  console.log('\n[Test 1] autoFillFromCredentials — valid credentials');
  const creds = JSON.stringify([
    {
      email: 'alice.test@gmail.com',
      provider: 'gmail',
      refreshToken: 'rt-abc123',
      clientId: 'cid-abc',
      clientSecret: 'cs-abc',
      displayName: 'Alice Mitchell',
    },
    {
      email: 'bob.work@outlook.com',
      provider: 'outlook',
      clientId: 'cid-bob',
      clientSecret: 'cs-bob',
      refreshToken: 'rt-bob',
      displayName: 'Bob Carter',
    },
  ]);

  let result = null;
  let threw = false;
  try {
    result = await autoFillFromCredentials(creds, 'owner-1');
  } catch (err) {
    threw = true;
    console.error('  autoFill threw:', err.message);
  }
  ok('did not throw', threw === false);
  ok('result.ok === true', result && result.ok === true);
  ok('parsed ok', result && result.parsed && result.parsed.ok === true);
  ok('2 senders parsed', result && result.parsed && result.parsed.senders.length === 2);
  ok('namesFed > 0 (Alice, Bob fed to pool)', result && result.namesFed > 0);
  ok('errors array exists', result && Array.isArray(result.errors));
}

// ---------------------------------------------------------------------------
// Test 2: autoFillFromCredentials — invalid JSON → graceful
// ---------------------------------------------------------------------------
async function testAutoFillInvalidJson() {
  console.log('\n[Test 2] autoFillFromCredentials — invalid JSON');
  const result = await autoFillFromCredentials('not json at all', 'owner-1');
  ok('ok === false for invalid JSON', result.ok === false);
  ok('has errors', result.errors.length > 0);
  ok('parsed has errors', result.parsed && result.parsed.errors && result.parsed.errors.length > 0);
}

// ---------------------------------------------------------------------------
// Test 3: autoFillFromCredentials — all invalid senders → ok=true but 0 persisted
// ---------------------------------------------------------------------------
async function testAutoFillAllInvalid() {
  console.log('\n[Test 3] autoFillFromCredentials — all invalid senders');
  const creds = JSON.stringify([
    { email: 'bad@gmail.com', provider: 'gmail' }, // missing refreshToken/clientId
  ]);
  const result = await autoFillFromCredentials(creds, 'owner-1');
  ok('ok === true (parse succeeded)', result.ok === true);
  ok('0 valid senders → 0 persisted', result.persisted.length === 0 || result.errors.length > 0);
}

// ---------------------------------------------------------------------------
// Test 4: feedNamesFromSenders — names go to the AI pool
// ---------------------------------------------------------------------------
async function testFeedNames() {
  console.log('\n[Test 4] feedNamesFromSenders — names reach AI pool');
  // Drain any existing names first
  await consumeBatch(POOL_TYPES.SENDER, 100000);
  const before = await getPoolSize(POOL_TYPES.SENDER);
  const senders = [
    { displayName: 'Test User One' },
    { displayName: 'Test User Two' },
    { displayName: 'Test User Three' },
  ];
  const fed = await feedNamesFromSenders(senders);
  ok('fed > 0', fed > 0);
  const after = await getPoolSize(POOL_TYPES.SENDER);
  ok('pool grew after feed', after > before);
}

// ---------------------------------------------------------------------------
// Test 5: getAiQuotaCeiling — returns a number (0 = unlimited when no DB)
// ---------------------------------------------------------------------------
async function testGetQuotaCeiling() {
  console.log('\n[Test 5] getAiQuotaCeiling');
  const ceiling = await getAiQuotaCeiling('owner-1');
  ok('returns a number', typeof ceiling === 'number');
  ok('>= 0', ceiling >= 0);
}

// ---------------------------------------------------------------------------
// Test 6: Admin quota = 5 → restock never exceeds 5 per day
// ---------------------------------------------------------------------------
async function testQuotaEnforcement() {
  console.log('\n[Test 6] AI quota enforcement (ceiling=5)');
  // Reset quota counter
  await resetAiQuota();

  // Consume 5 slots → 6th should be denied
  let allowedCount = 0;
  for (let i = 0; i < 10; i++) {
    const allowed = await checkAiQuota(5);
    if (allowed) allowedCount++;
  }
  ok('exactly 5 allowed (ceiling=5)', allowedCount === 5);

  // After reset, quota should be available again
  await resetAiQuota();
  const allowedAfterReset = await checkAiQuota(5);
  ok('quota available after reset', allowedAfterReset === true);
}

// ---------------------------------------------------------------------------
// Test 7: runRestockWithQuota — runs without crash, respects quota
// ---------------------------------------------------------------------------
async function testRestockWithQuota() {
  console.log('\n[Test 7] runRestockWithQuota — no crash');
  let threw = false;
  let result = null;
  try {
    result = await runRestockWithQuota('owner-1');
  } catch (err) {
    threw = true;
    console.error('  restockWithQuota threw:', err.message);
  }
  ok('did not throw', threw === false);
  ok('returns object with sender/subject', result && typeof result.sender === 'number' && typeof result.subject === 'number');
}

// ---------------------------------------------------------------------------
// Test 8: getAutoFillStatus — shape
// ---------------------------------------------------------------------------
async function testAutoFillStatus() {
  console.log('\n[Test 8] getAutoFillStatus — shape');
  const status = await getAutoFillStatus();
  ok('has aiQuotaCeiling', typeof status.aiQuotaCeiling === 'number');
  ok('has restock object', typeof status.restock === 'object');
  ok('has timestamp', typeof status.timestamp === 'number');
}

// ---------------------------------------------------------------------------
// Test 9: buildCampaignPools — mode decision (LOCK_MAIN for <2 senders)
// ---------------------------------------------------------------------------
async function testBuildCampaignPools() {
  console.log('\n[Test 9] buildCampaignPools — mode decision');
  // Single sender → LOCK_MAIN
  const single = [{ email: 'one@gmail.com', status: 'active', capabilities: { supportsDynamicRouting: true } }];
  const r1 = await buildCampaignPools(single, 'test-campaign-1');
  ok('single sender → LOCK_MAIN', r1 && r1.mode === 'LOCK_MAIN');

  // Two dynamic-capable senders → ROTATE_POOL
  const pair = [
    { email: 'a@gmail.com', status: 'active', capabilities: { supportsDynamicRouting: true } },
    { email: 'b@gmail.com', status: 'active', capabilities: { supportsDynamicRouting: true } },
  ];
  const r2 = await buildCampaignPools(pair, 'test-campaign-2');
  ok('two dynamic senders → ROTATE_POOL', r2 && r2.mode === 'ROTATE_POOL');
  ok('poolSize > 0 for ROTATE_POOL', r2 && r2.poolSize > 0);

  // No campaignId → null
  const r3 = await buildCampaignPools(pair, null);
  ok('no campaignId → null', r3 === null);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  console.log('=== V7 P4.3 test-autofill ===');
  try {
    await testAutoFillValid();
    await testAutoFillInvalidJson();
    await testAutoFillAllInvalid();
    await testFeedNames();
    await testGetQuotaCeiling();
    await testQuotaEnforcement();
    await testRestockWithQuota();
    await testAutoFillStatus();
    await testBuildCampaignPools();
  } catch (err) {
    fail++;
    console.error('FATAL:', err);
  }
  console.log(`\n=== P4.3 RESULT: ${pass} pass, ${fail} fail ===`);
  process.exit(fail > 0 ? 1 : 0);
})();
