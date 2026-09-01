// ============================================================================
// V7 P6.2 ACCEPTANCE — 4 Sandbox Isolation test (zero cross-talk)
// Run: node --experimental-loader ./scripts/alias-loader.mjs scripts/run-test.mjs scripts/test-sandbox.js
// ============================================================================
// Verifies:
//   - 4 sandboxes (1-4) have separate state slices
//   - Separate credential sets
//   - Separate Redis key namespaces (sb:{user}:{1-4}:...)
//   - Operations in sandbox A leave B/C/D untouched (state diff empty)
// ============================================================================

import {
  SANDBOX_IDS,
  sandboxKey,
  getSandboxState,
  setSandboxState,
  addRecipients,
  removeRecipient,
  clearRecipients,
  getRecipients,
  setConfig,
  getConfig,
  setCredentials,
  getCredentials,
  setStatus,
  getStatus,
  setProgress,
  getProgress,
  deleteSandbox,
  listSandboxes,
  snapshotSandbox,
  verifyIsolation,
  assertSandboxOwnership,
} from '../src/lib/sandbox/isolation.js';

let pass = 0, fail = 0;
const failures = [];

function ok(name, cond, extra = '') {
  if (cond) { pass++; }
  else { fail++; failures.push(name + (extra ? ` — ${extra}` : '')); console.log(`  ✗ ${name} ${extra}`); }
}

const USER = 'testuser-isolation';

console.log('\n=== V7 P6.2 Sandbox Isolation — Acceptance Test ===\n');

// ===========================================================================
// Test 1: SANDBOX_IDS = [1,2,3,4]
// ===========================================================================
{
  ok('SANDBOX_IDS is [1,2,3,4]', Array.isArray(SANDBOX_IDS) && SANDBOX_IDS.length === 4 && SANDBOX_IDS.join(',') === '1,2,3,4');
}

// ===========================================================================
// Test 2: sandboxKey produces correct namespaced keys
// ===========================================================================
{
  ok('key: sb:user:1:recipients', sandboxKey('user', 1, 'recipients') === 'sb:user:1:recipients');
  ok('key: sb:user:2:recipients', sandboxKey('user', 2, 'recipients') === 'sb:user:2:recipients');
  ok('key: sb:user:4:config', sandboxKey('user', 4, 'config') === 'sb:user:4:config');
}

// ===========================================================================
// Test 3: Invalid sandbox IDs are rejected
// ===========================================================================
{
  let threw = false;
  try { sandboxKey('user', 0, 'recipients'); } catch { threw = true; }
  ok('key: id=0 rejected', threw);

  threw = false;
  try { sandboxKey('user', 5, 'recipients'); } catch { threw = true; }
  ok('key: id=5 rejected', threw);

  threw = false;
  try { sandboxKey('user', 'abc', 'recipients'); } catch { threw = true; }
  ok('key: id="abc" rejected', threw);

  threw = false;
  try { sandboxKey(null, 1, 'recipients'); } catch { threw = true; }
  ok('key: null userId rejected', threw);
}

// ===========================================================================
// Test 4: Fresh sandbox state is empty/idle
// ===========================================================================
{
  // Clean up first
  for (const sid of SANDBOX_IDS) await deleteSandbox(USER, sid);

  for (const sid of SANDBOX_IDS) {
    const state = await getSandboxState(USER, sid);
    ok(`fresh[${sid}]: exists=false`, state.exists === false);
    ok(`fresh[${sid}]: status=idle`, state.status === 'idle');
    ok(`fresh[${sid}]: recipients=[]`, Array.isArray(state.recipients) && state.recipients.length === 0);
    ok(`fresh[${sid}]: credentials=[]`, Array.isArray(state.credentials) && state.credentials.length === 0);
  }
}

// ===========================================================================
// Test 5: CORE ISOLATION TEST — add recipients to sandbox 1, verify 2/3/4 untouched
// ===========================================================================
{
  console.log('\n  [Core isolation: sandbox A operations leave B/C/D untouched]');

  // Clean all
  for (const sid of SANDBOX_IDS) await deleteSandbox(USER, sid);

  // Snapshot B/C/D before A operations
  const before = {};
  for (const sid of [2, 3, 4]) {
    before[sid] = JSON.stringify(await snapshotSandbox(USER, sid));
  }

  // Perform operations on sandbox 1 (A)
  await addRecipients(USER, 1, ['alice@example.com', 'bob@example.com', 'carol@example.com']);
  await setCredentials(USER, 1, ['sender1@gmail.com', 'sender2@gmail.com']);
  await setConfig(USER, 1, { subject: 'Test Campaign A', from: 'sender1@gmail.com' });
  await setStatus(USER, 1, 'running');
  await setProgress(USER, 1, { sent: 10, total: 100, failed: 0, lastUpdated: Date.now() });
  await removeRecipient(USER, 1, 'bob@example.com');

  // Snapshot B/C/D after A operations
  const after = {};
  for (const sid of [2, 3, 4]) {
    after[sid] = JSON.stringify(await snapshotSandbox(USER, sid));
  }

  // State diff must be EMPTY — B/C/D unchanged
  for (const sid of [2, 3, 4]) {
    ok(`isolation: sandbox ${sid} untouched after A ops`, before[sid] === after[sid],
      `${before[sid]} vs ${after[sid]}`);
  }

  // Verify sandbox 1 has the correct state
  const s1Recipients = await getRecipients(USER, 1);
  ok('sandbox 1: recipients has alice+carol (bob removed)', s1Recipients.includes('alice@example.com') && s1Recipients.includes('carol@example.com') && !s1Recipients.includes('bob@example.com'), JSON.stringify(s1Recipients));
  ok('sandbox 1: recipient count = 2', s1Recipients.length === 2, `got ${s1Recipients.length}`);

  const s1Creds = await getCredentials(USER, 1);
  ok('sandbox 1: credentials count = 2', s1Creds.length === 2, `got ${s1Creds.length}`);

  const s1Config = await getConfig(USER, 1);
  ok('sandbox 1: config subject preserved', s1Config && s1Config.subject === 'Test Campaign A');

  const s1Status = await getStatus(USER, 1);
  ok('sandbox 1: status = running', s1Status === 'running', `got ${s1Status}`);

  const s1Progress = await getProgress(USER, 1);
  ok('sandbox 1: progress sent = 10', s1Progress.sent === 10, `got ${JSON.stringify(s1Progress)}`);
}

// ===========================================================================
// Test 6: Cross-sandbox independence — each sandbox gets different data
// ===========================================================================
{
  // Clean all
  for (const sid of SANDBOX_IDS) await deleteSandbox(USER, sid);

  // Give each sandbox different recipients
  await addRecipients(USER, 1, ['a1@test.com']);
  await addRecipients(USER, 2, ['b1@test.com', 'b2@test.com']);
  await addRecipients(USER, 3, ['c1@test.com', 'c2@test.com', 'c3@test.com']);
  await addRecipients(USER, 4, ['d1@test.com', 'd2@test.com', 'd3@test.com', 'd4@test.com']);

  const r1 = await getRecipients(USER, 1);
  const r2 = await getRecipients(USER, 2);
  const r3 = await getRecipients(USER, 3);
  const r4 = await getRecipients(USER, 4);

  ok('independent: sandbox 1 has 1 recipient', r1.length === 1);
  ok('independent: sandbox 2 has 2 recipients', r2.length === 2);
  ok('independent: sandbox 3 has 3 recipients', r3.length === 3);
  ok('independent: sandbox 4 has 4 recipients', r4.length === 4);

  // Verify no overlap between sandboxes
  ok('independent: s1∩s2 empty', r1.filter(e => r2.includes(e)).length === 0);
  ok('independent: s1∩s3 empty', r1.filter(e => r3.includes(e)).length === 0);
  ok('independent: s1∩s4 empty', r1.filter(e => r4.includes(e)).length === 0);
  ok('independent: s2∩s3 empty', r2.filter(e => r3.includes(e)).length === 0);
  ok('independent: s3∩s4 empty', r3.filter(e => r4.includes(e)).length === 0);
}

// ===========================================================================
// Test 7: Clear recipients in one sandbox doesn't affect others
// ===========================================================================
{
  // State from test 6 should still be there
  await clearRecipients(USER, 2);

  const r2 = await getRecipients(USER, 2);
  const r1 = await getRecipients(USER, 1);
  const r3 = await getRecipients(USER, 3);
  const r4 = await getRecipients(USER, 4);

  ok('clear: sandbox 2 recipients emptied', r2.length === 0, `got ${r2.length}`);
  ok('clear: sandbox 1 still has 1', r1.length === 1, `got ${r1.length}`);
  ok('clear: sandbox 3 still has 3', r3.length === 3, `got ${r3.length}`);
  ok('clear: sandbox 4 still has 4', r4.length === 4, `got ${r4.length}`);
}

// ===========================================================================
// Test 8: Delete sandbox doesn't affect others
// ===========================================================================
{
  await deleteSandbox(USER, 3);

  const r3 = await getRecipients(USER, 3);
  const r1 = await getRecipients(USER, 1);
  const r4 = await getRecipients(USER, 4);

  ok('delete: sandbox 3 recipients gone', r3.length === 0);
  ok('delete: sandbox 1 still has 1', r1.length === 1, `got ${r1.length}`);
  ok('delete: sandbox 4 still has 4', r4.length === 4, `got ${r4.length}`);
}

// ===========================================================================
// Test 9: addRecipients dedup within a sandbox
// ===========================================================================
{
  await deleteSandbox(USER, 1);
  const added1 = await addRecipients(USER, 1, ['x@test.com', 'y@test.com']);
  const added2 = await addRecipients(USER, 1, ['x@test.com', 'z@test.com']); // x is dup

  ok('dedup: first batch added 2', added1 === 2, `got ${added1}`);
  ok('dedup: second batch added 1 (x was dup)', added2 === 1, `got ${added2}`);

  const r = await getRecipients(USER, 1);
  ok('dedup: total 3 unique', r.length === 3, `got ${r.length}`);
}

// ===========================================================================
// Test 10: verifyIsolation reports isolated=true
// ===========================================================================
{
  const result = await verifyIsolation(USER);
  ok('verifyIsolation: isolated=true', result.isolated === true, JSON.stringify(result.details.message));
  ok('verifyIsolation: 4 key checks', result.details.keyChecks.length === 4);
  ok('verifyIsolation: keys are all distinct',
    new Set(result.details.keyChecks.map(k => k.key)).size === 4);
}

// ===========================================================================
// Test 11: listSandboxes returns all 4
// ===========================================================================
{
  // Clean and set up known state
  for (const sid of SANDBOX_IDS) await deleteSandbox(USER, sid);
  await addRecipients(USER, 1, ['a@x.com', 'b@x.com']);
  await setStatus(USER, 1, 'running');

  const list = await listSandboxes(USER);
  ok('list: returns 4 sandboxes', list.length === 4);
  ok('list[0].sandboxId=1', list[0].sandboxId === 1);
  ok('list[0].recipientCount=2', list[0].recipientCount === 2);
  ok('list[0].status=running', list[0].status === 'running');
  ok('list[1].recipientCount=0', list[1].recipientCount === 0);
  ok('list[2].recipientCount=0', list[2].recipientCount === 0);
  ok('list[3].recipientCount=0', list[3].recipientCount === 0);
}

// ===========================================================================
// Test 12: assertSandboxOwnership works
// ===========================================================================
{
  ok('ownership: valid user+id passes', assertSandboxOwnership('user', 1) === true);

  let threw = false;
  try { assertSandboxOwnership('user', 0); } catch { threw = true; }
  ok('ownership: id=0 rejected', threw);

  threw = false;
  try { assertSandboxOwnership(null, 1); } catch { threw = true; }
  ok('ownership: null user rejected', threw);
}

// ===========================================================================
// Test 13: Different users have isolated sandboxes
// ===========================================================================
{
  const USER_A = 'user-alpha';
  const USER_B = 'user-beta';
  for (const sid of SANDBOX_IDS) {
    await deleteSandbox(USER_A, sid);
    await deleteSandbox(USER_B, sid);
  }

  await addRecipients(USER_A, 1, ['alpha@x.com']);
  await addRecipients(USER_B, 1, ['beta@x.com']);

  const ra = await getRecipients(USER_A, 1);
  const rb = await getRecipients(USER_B, 1);

  ok('multi-user: user-alpha sandbox 1 has alpha', ra.includes('alpha@x.com') && ra.length === 1);
  ok('multi-user: user-beta sandbox 1 has beta', rb.includes('beta@x.com') && rb.length === 1);
  ok('multi-user: keys differ by user', sandboxKey(USER_A, 1, 'recipients') !== sandboxKey(USER_B, 1, 'recipients'));

  // Cleanup
  for (const sid of SANDBOX_IDS) {
    await deleteSandbox(USER_A, sid);
    await deleteSandbox(USER_B, sid);
  }
}

// ===========================================================================
// Test 14: setStatus validates values
// ===========================================================================
{
  let threw = false;
  try { await setStatus(USER, 1, 'invalid-status'); } catch { threw = true; }
  ok('status: invalid value rejected', threw);

  await setStatus(USER, 1, 'paused');
  ok('status: "paused" accepted', await getStatus(USER, 1) === 'paused');
}

// ===========================================================================
// Final cleanup
// ===========================================================================
{
  for (const sid of SANDBOX_IDS) await deleteSandbox(USER, sid);
}

// ===========================================================================
// Summary
// ===========================================================================
console.log(`\n=== Results: ${pass} pass, ${fail} fail ===`);
if (failures.length > 0) {
  console.log('\nFAILURES:');
  failures.forEach(f => console.log(`  ✗ ${f}`));
}
if (fail > 0) process.exit(1);
process.exit(0);
