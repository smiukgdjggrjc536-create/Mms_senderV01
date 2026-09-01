// scripts/test-atomic.js — P1.3 acceptance test for atomic.js
// Run: node scripts/test-atomic.js
import { withLock, incrWithCeiling, redisRateLimit, redisTokenBucket, _resetAtomicState } from '../src/lib/redis/atomic.js';

let pass = 0, fail = 0;
function ok(c, n) { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.error(`  ✗ ${n}`); } }

console.log('=== P1.3 Redis-Atomic Core — Acceptance Test ===\n');

// 1) 5 concurrent withLock on the same key -> exactly 1 acquires, 4 reject/queue
console.log('[1] withLock mutual exclusion (5 concurrent)');
await _resetAtomicState();
const results = await Promise.all(
  Array.from({ length: 5 }, (_, i) =>
    withLock(`mutex_A`, 5000, async () => {
      await new Promise((r) => setTimeout(r, 50));
      return `winner_${i}`;
    })
  )
);
const acquired = results.filter((r) => r.acquired);
const rejected = results.filter((r) => !r.acquired);
ok(acquired.length === 1, `exactly 1 acquires (got ${acquired.length})`);
ok(rejected.length === 4, `4 reject/queue with LOCK_BUSY (got ${rejected.length})`);
ok(acquired[0].result.startsWith('winner_'), 'the acquirer ran its fn and returned a result');
ok(acquired[0].error === null || acquired[0].error === undefined, 'no fn error on the acquirer');

// 2) Lock released after fn completes / auto-expires after ttl
console.log('[2] Lock released after fn; auto-expires after ttl');
await _resetAtomicState();
// Use a gate so we can probe the lock WHILE fn is still running.
let fnDone = false;
const a1 = withLock('mutex_B', 5000, async () => {
  await new Promise((r) => setTimeout(r, 120));
  fnDone = true;
  return 'first';
});
// while fn is still running, a second acquire must be busy
await new Promise((r) => setTimeout(r, 30)); // fn still running (~30ms < 120ms)
const a2 = await withLock('mutex_B', 5000, async () => 'second');
ok(a2.acquired === false, 'second acquire is busy while first fn still running');
const r1 = await a1;
ok(r1.acquired === true && r1.result === 'first', 'first acquire ran its fn and returned');
ok(fnDone === true, 'first fn completed');
// now fn done -> lock released -> third acquire succeeds immediately
const a3 = await withLock('mutex_B', 5000, async () => 'third');
ok(a3.acquired === true, 'third acquire succeeds immediately after first fn released the lock');

// 2b) Lock auto-expires after ttl when holder crashes (never releases)
console.log('[2b] Lock auto-expires after ttl (crash recovery)');
await _resetAtomicState();
// Acquire with a very short ttl and DON'T run fn to completion path that releases —
// simulate by acquiring then abandoning: use a tiny ttl and a long fn, but we only
// care that after ttl a fresh acquire works even if the holder is stuck.
const stuck = await withLock('mutex_C', 150, async () => {
  await new Promise((r) => setTimeout(r, 400)); // holds longer than ttl
  return 'stuck';
});
ok(stuck.acquired === true, 'stuck acquire succeeds');
// After ttl (150ms) the lock should be reclaimable even though fn is still running.
await new Promise((r) => setTimeout(r, 180));
const reclaim = await withLock('mutex_C', 1000, async () => 'reclaimed');
ok(reclaim.acquired === true, 'lock reclaimed after ttl even though previous holder still running (crash-recovery semantics)');

// 3) incrWithCeiling: allowed up to ceiling, then false
console.log('[3] incrWithCeiling (ceiling=5)');
await _resetAtomicState();
let allowedCount = 0;
let deniedAt = -1;
for (let i = 1; i <= 7; i++) {
  const r = await incrWithCeiling('quota_X', 5);
  if (r.allowed) allowedCount++;
  else if (deniedAt === -1) deniedAt = i;
}
ok(allowedCount === 5, `exactly 5 allowed before ceiling (got ${allowedCount})`);
ok(deniedAt === 6, `6th request denied (denied at ${deniedAt})`);

// 4) redisRateLimit: fixed window, limit=10
console.log('[4] redisRateLimit (limit=10, window=60s)');
await _resetAtomicState();
let rlAllowed = 0;
for (let i = 0; i < 12; i++) {
  const r = await redisRateLimit('rltest', 10, 60);
  if (r.allowed) rlAllowed++;
}
ok(rlAllowed === 10, `exactly 10 allowed in window (got ${rlAllowed})`);
const rlDeny = await redisRateLimit('rltest', 10, 60);
ok(rlDeny.allowed === false, '11th is denied');
ok(rlDeny.retryAfterSec > 0, `retryAfterSec > 0 (got ${rlDeny.retryAfterSec})`);

// 5) redisTokenBucket: capacity=5, refill=1/sec
console.log('[5] redisTokenBucket (capacity=5, refill=1/s)');
await _resetAtomicState();
let tbAllowed = 0;
for (let i = 0; i < 7; i++) {
  const r = await redisTokenBucket('tbtest', 5, 1);
  if (r.allowed) tbAllowed++;
}
ok(tbAllowed === 5, `exactly 5 allowed initially (capacity) (got ${tbAllowed})`);
// wait for ~1.2s -> ~1 token refilled
await new Promise((r) => setTimeout(r, 1200));
const tbAfter = await redisTokenBucket('tbtest', 5, 1);
ok(tbAfter.allowed === true, 'after 1.2s a token refilled and the next request is allowed');
ok(tbAfter.tokensRemaining < 5, `tokensRemaining < capacity after partial refill (got ${tbAfter.tokensRemaining})`);

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
