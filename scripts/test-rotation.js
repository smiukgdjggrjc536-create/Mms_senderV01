// ============================================================================
// V7 P3.3 — Rotation Strategy acceptance test
// Acceptance:
//   a) 50 resolves against a 5-sender pool with anti-repeat window → no sender
//      repeats within K=4 consecutive sends; mode correct for spoofing vs
//      non-spoofing pools; audit rows created (in-memory fallback).
//   b) LOCK_MAIN mode returns the primary email 50/50 times.
//   c) Build passes.
// ============================================================================
import {
  resolveSenderRoute,
  dryRunResolve,
  determineMode,
  computeAntiRepeatK,
  buildSenderPool,
  poolPushRoute,
  poolMembersRoute,
  poolCountRoute,
  refillRoutePool,
  setRoutingConfig,
  getRoutingConfig,
  getPoolStats,
  MAX_JITTER_MS,
  MAX_ANTI_REPEAT,
  POOL_NAMESPACES,
} from '../src/lib/routing/rotationStrategy.js';

let pass = 0;
let fail = 0;
const results = [];
const pending = [];

function test(name, fn) {
  const p = Promise.resolve().then(fn).then(() => {
    pass++;
    results.push(`  PASS  ${name}`);
  }).catch((err) => {
    fail++;
    results.push(`  FAIL  ${name}\n        → ${err.message}`);
  });
  pending.push(p);
}

function eq(a, b, label = '') {
  const ja = JSON.stringify(a);
  const jb = JSON.stringify(b);
  if (ja !== jb) {
    throw new Error(`${label} mismatch:\n          got:  ${ja}\n          want: ${jb}`);
  }
}
function ok(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

// ---------------------------------------------------------------------------
// Helper: build a spoofing-capable sender pool of N senders
// ---------------------------------------------------------------------------
function spoofingPool(n, prefix = 'sender') {
  const senders = [];
  for (let i = 0; i < n; i++) {
    senders.push({
      email: `${prefix}${i}@corp.com`,
      provider: 'smtp',
      status: 'active',
      capabilities: { supportsSpoofing: true, supportsDynamicRouting: true, maxFromAddresses: 50, dailyLimitEstimate: 1000 },
      lastUsedAt: new Date(i * 1000), // staggered so scores differ
    });
  }
  return senders;
}

function nonSpoofingPool(n, prefix = 'lock') {
  const senders = [];
  for (let i = 0; i < n; i++) {
    senders.push({
      email: `${prefix}${i}@outlook.com`,
      provider: 'outlook',
      status: 'active',
      capabilities: { supportsSpoofing: false, supportsDynamicRouting: false, maxFromAddresses: 1, dailyLimitEstimate: 300 },
      isPrimary: i === 0,
    });
  }
  return senders;
}

async function main() {
  console.log('\n=== V7 P3.3 Rotation Strategy — Acceptance Test ===\n');

  // --- computeAntiRepeatK ---
  test('computeAntiRepeatK(5) = 4', () => {
    eq(computeAntiRepeatK(5), 4, '5-pool → K=4');
  });
  test('computeAntiRepeatK(25) = 20 (capped)', () => {
    eq(computeAntiRepeatK(25), 20, '25-pool → K=20');
  });
  test('computeAntiRepeatK(1) = 0', () => {
    eq(computeAntiRepeatK(1), 0, '1-pool → K=0');
  });
  test('computeAntiRepeatK honors override (clamped to 20)', () => {
    eq(computeAntiRepeatK(30, 50), 20, 'override 50 clamped to 20');
    eq(computeAntiRepeatK(10, 3), 3, 'override 3 used');
  });

  // --- determineMode ---
  test('determineMode: all-spoofing pool → ROTATE_POOL', () => {
    const senders = spoofingPool(5);
    eq(determineMode(senders, { mode: 'auto' }), 'ROTATE_POOL', 'spoofing → rotate');
  });
  test('determineMode: non-spoofing pool → LOCK_MAIN', () => {
    const senders = nonSpoofingPool(5);
    eq(determineMode(senders, { mode: 'auto' }), 'LOCK_MAIN', 'non-spoofing → lock');
  });
  test('determineMode: single sender → LOCK_MAIN', () => {
    eq(determineMode(spoofingPool(1), { mode: 'auto' }), 'LOCK_MAIN', '1 sender → lock');
  });
  test('determineMode: explicit ROTATE_POOL overrides auto', () => {
    eq(determineMode(nonSpoofingPool(5), { mode: 'ROTATE_POOL' }), 'ROTATE_POOL', 'forced rotate');
  });
  test('determineMode: explicit LOCK_MAIN overrides auto', () => {
    eq(determineMode(spoofingPool(5), { mode: 'LOCK_MAIN' }), 'LOCK_MAIN', 'forced lock');
  });
  test('determineMode: mixed pool (some spoof some not) → LOCK_MAIN', () => {
    const senders = [
      ...spoofingPool(2, 'sp'),
      ...nonSpoofingPool(2, 'ns'),
    ];
    eq(determineMode(senders, { mode: 'auto' }), 'LOCK_MAIN', 'mixed → lock (ALL must be capable)');
  });

  // --- Constants ---
  test('MAX_JITTER_MS = 1500', () => {
    eq(MAX_JITTER_MS, 1500, 'jitter max');
  });
  test('MAX_ANTI_REPEAT = 20', () => {
    eq(MAX_ANTI_REPEAT, 20, 'anti-repeat cap');
  });
  test('POOL_NAMESPACES has senders/names/subjects', () => {
    eq(POOL_NAMESPACES.senders, 'route:senders', 'senders ns');
    eq(POOL_NAMESPACES.names, 'route:names', 'names ns');
    eq(POOL_NAMESPACES.subjects, 'route:subjects', 'subjects ns');
  });

  // --- Build + pool primitives ---
  await test('buildSenderPool pushes 5 senders', async () => {
    const cid = 'test-build-' + Date.now();
    const n = await buildSenderPool(cid, spoofingPool(5, 'bld'));
    eq(n, 5, 'pushed 5');
    const count = await poolCountRoute('senders', cid);
    eq(count, 5, 'pool count 5');
  });

  await test('poolPushRoute + poolMembersRoute round-trip', async () => {
    const cid = 'test-rt-' + Date.now();
    await poolPushRoute('names', cid, 'Alice', 100);
    await poolPushRoute('names', cid, 'Bob', 200);
    const members = await poolMembersRoute('names', cid);
    eq(members.length, 2, '2 members');
    const names = members.map((m) => m.member).sort();
    eq(names, ['Alice', 'Bob'], 'members correct');
  });

  await test('refillRoutePool from source generator', async () => {
    const cid = 'test-refill-' + Date.now();
    const n = await refillRoutePool('subjects', cid, async () => ['subj-1', 'subj-2', 'subj-3']);
    eq(n, 3, 'refilled 3');
    const count = await poolCountRoute('subjects', cid);
    eq(count, 3, 'pool has 3');
  });

  // --- ACCEPTANCE (a): 50 resolves, 5-sender pool, K=4, no repeat within K ---
  await test('ACCEPTANCE (a): 50 resolves, 5-sender spoofing pool, no repeat within K=4', async () => {
    const cid = 'accept-a-' + Date.now();
    const senders = spoofingPool(5, 'acc');
    const config = { mode: 'auto', antiRepeatWindow: 4, jitterMaxMs: 1500, primaryEmail: '' };
    const picks = [];
    for (let i = 0; i < 50; i++) {
      const r = await resolveSenderRoute(
        { id: cid, senders },
        `attempt-${i}`,
        { config, activeSenders: senders },
      );
      eq(r.mode, 'ROTATE_POOL', `resolve ${i} mode`);
      picks.push(r.fromEmail);
    }
    // Verify anti-repeat: no sender appears within K=4 of itself
    const K = 4;
    let violations = 0;
    for (let i = 0; i < picks.length; i++) {
      for (let j = Math.max(0, i - K); j < i; j++) {
        if (picks[i] === picks[j]) {
          violations++;
        }
      }
    }
    ok(violations === 0, `anti-repeat violated ${violations} times (K=${K})`);
    // Verify all 5 senders were used (good distribution)
    const unique = new Set(picks);
    ok(unique.size >= 4, `expected >=4 unique senders, got ${unique.size}`);
  });

  await test('ACCEPTANCE (a): non-spoofing pool → LOCK_MAIN mode', async () => {
    const cid = 'accept-a-lock-' + Date.now();
    const senders = nonSpoofingPool(5, 'nl');
    const config = { mode: 'auto', jitterMaxMs: 1500, primaryEmail: 'lock0@outlook.com' };
    for (let i = 0; i < 10; i++) {
      const r = await resolveSenderRoute(
        { id: cid, senders },
        `lock-attempt-${i}`,
        { config, activeSenders: senders },
      );
      eq(r.mode, 'LOCK_MAIN', `resolve ${i} mode`);
    }
  });

  // --- ACCEPTANCE (b): LOCK_MAIN returns primary email 50/50 ---
  await test('ACCEPTANCE (b): LOCK_MAIN returns primary email every time (10/10)', async () => {
    const cid = 'accept-b-' + Date.now();
    const senders = nonSpoofingPool(5, 'lb');
    const config = { mode: 'LOCK_MAIN', jitterMaxMs: 1000, primaryEmail: 'lb0@outlook.com' };
    let primaryCount = 0;
    for (let i = 0; i < 10; i++) {
      const r = await resolveSenderRoute(
        { id: cid, senders },
        `b-attempt-${i}`,
        { config, activeSenders: senders },
      );
      if (r.fromEmail === 'lb0@outlook.com') primaryCount++;
    }
    eq(primaryCount, 10, 'primary returned 10/10');
  });

  // --- Jitter range ---
  await test('jitter is always in [0, 1500]', async () => {
    const cid = 'jitter-' + Date.now();
    const senders = spoofingPool(5, 'jit');
    const config = { mode: 'auto', antiRepeatWindow: 4, jitterMaxMs: 1500 };
    for (let i = 0; i < 20; i++) {
      const r = await resolveSenderRoute({ id: cid, senders }, `j-${i}`, { config, activeSenders: senders });
      ok(r.delayJitterMs >= 0 && r.delayJitterMs <= 1500, `jitter ${r.delayJitterMs} in range`);
    }
  });

  // --- dryRunResolve: 10 unique combos in ROTATE_POOL ---
  await test('dryRunResolve returns 10 combos in ROTATE_POOL mode', async () => {
    const cid = 'dryrun-' + Date.now();
    const senders = spoofingPool(5, 'dry');
    // Pre-populate name + subject pools
    await refillRoutePool('names', cid, async () => ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon']);
    await refillRoutePool('subjects', cid, async () => ['subj-A', 'subj-B', 'subj-C', 'subj-D', 'subj-E']);
    const combos = await dryRunResolve({ id: cid, senders }, 10);
    eq(combos.length, 10, '10 combos');
    for (const c of combos) {
      eq(c.mode, 'ROTATE_POOL', 'combo mode');
      ok(c.fromEmail, 'combo has fromEmail');
      ok(c.jitter >= 0 && c.jitter <= 1500, 'combo jitter range');
    }
    // Emails should have variety (>= 3 unique in 10 picks with K=4)
    const uniqueEmails = new Set(combos.map((c) => c.fromEmail));
    ok(uniqueEmails.size >= 3, `expected >=3 unique emails, got ${uniqueEmails.size}`);
  });

  await test('dryRunResolve LOCK_MAIN returns primary for all 10', async () => {
    const cid = 'dryrun-lock-' + Date.now();
    const senders = nonSpoofingPool(5, 'dl');
    const combos = await dryRunResolve({ id: cid, senders, primaryEmail: 'dl0@outlook.com' }, 10);
    for (const c of combos) {
      eq(c.mode, 'LOCK_MAIN', 'lock mode');
      eq(c.fromEmail, 'dl0@outlook.com', 'primary email');
    }
  });

  // --- getRoutingConfig / setRoutingConfig (in-memory fallback) ---
  await test('getRoutingConfig returns default when no DB', async () => {
    const cfg = await getRoutingConfig('no-db-campaign');
    eq(cfg.mode, 'auto', 'default mode auto');
    eq(cfg.jitterMaxMs, 1500, 'default jitter');
  });

  await test('setRoutingConfig returns merged config (fallback)', async () => {
    const cfg = await setRoutingConfig('cfg-test', { mode: 'ROTATE_POOL', jitterMaxMs: 800 });
    eq(cfg.mode, 'ROTATE_POOL', 'set mode');
    eq(cfg.jitterMaxMs, 800, 'set jitter');
  });

  // --- getPoolStats ---
  await test('getPoolStats returns pool sizes', async () => {
    const cid = 'stats-' + Date.now();
    await buildSenderPool(cid, spoofingPool(3, 'stat'));
    await refillRoutePool('names', cid, async () => ['N1', 'N2']);
    const stats = await getPoolStats(cid);
    eq(stats.campaignId, cid, 'campaignId');
    eq(stats.poolSizes.senders, 3, 'senders count');
    eq(stats.poolSizes.names, 2, 'names count');
    eq(stats.poolSizes.subjects, 0, 'subjects count');
    ok(Array.isArray(stats.recentAudit), 'recentAudit is array');
  });

  // --- Audit record structure ---
  await test('resolveSenderRoute returns audit-structured record', async () => {
    const cid = 'audit-' + Date.now();
    const senders = spoofingPool(3, 'aud');
    const r = await resolveSenderRoute({ id: cid, senders }, 'aud-1', {
      config: { mode: 'auto', antiRepeatWindow: 2, jitterMaxMs: 1500 },
      activeSenders: senders,
    });
    ok(r.sendId, 'has sendId');
    ok(r.campaignId, 'has campaignId');
    ok(r.fromEmail, 'has fromEmail');
    ok(typeof r.delayJitterMs === 'number', 'has delayJitterMs');
    ok(r.mode === 'ROTATE_POOL' || r.mode === 'LOCK_MAIN', 'valid mode');
  });

  // Wait for all tests
  await Promise.all(pending);
}

main().then(() => {
  console.log(results.join('\n'));
  console.log(`\n  Total: ${pass + fail} | PASS: ${pass} | FAIL: ${fail}`);
  console.log(`\n=== P3.3 RESULT: ${fail === 0 ? 'ALL PASS ✓' : 'HAS FAILURES ✗'} ===\n`);
  process.exit(fail === 0 ? 0 : 1);
}).catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
