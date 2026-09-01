// scripts/test-pools.js — P1.3 acceptance test for pools.js
// Run: node scripts/test-pools.js
import { poolPush, poolPopFresh, poolPopFreshBatch, poolCount, poolDrainRefill, poolRemove } from '../src/lib/redis/pools.js';

let pass = 0, fail = 0;
function ok(c, n) { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.error(`  ✗ ${n}`); } }

console.log('=== P1.3 Redis Pools — Acceptance Test ===\n');

// 1) push 100 items, pop with maxAge returns items, count reflects remaining
console.log('[1] push 100, pop fresh, count');
const POOL = 'testpool_' + Date.now();
const base = Date.now();
for (let i = 0; i < 100; i++) {
  await poolPush(POOL, `item_${i}`, base + i); // increasing score
}
const countAfterPush = await poolCount(POOL);
ok(countAfterPush === 100, `poolCount after push = 100 (got ${countAfterPush})`);

// pop 5 fresh (lowest scores first, all fresh since base+0..4 ~ now)
const popped = await poolPopFreshBatch(POOL, 5);
ok(Array.isArray(popped) && popped.length === 5, `popBatch returns 5 items (got ${popped ? popped.length : 0})`);
ok(popped[0] === 'item_0', `first popped is lowest-scored item_0 (got ${popped[0]})`);

const countAfterPop = await poolCount(POOL);
ok(countAfterPop === 95, `poolCount after 5 pops = 95 (got ${countAfterPop})`);

// 2) maxAge filters stale items: push an old item, ensure it's skipped
console.log('[2] maxAge freshness filter');
const POOL2 = 'testpool2_' + Date.now();
const now = Date.now();
await poolPush(POOL2, 'old_item', now - 60000); // 60s old
await poolPush(POOL2, 'fresh_item', now);
const freshPop = await poolPopFresh(POOL2, 30000); // maxAge 30s
ok(freshPop === 'fresh_item', `popFresh(maxAge=30s) skips old, returns fresh_item (got ${freshPop})`);
const count2 = await poolCount(POOL2);
ok(count2 === 0, `after popping fresh, old was dropped too -> count 0 (got ${count2})`);

// 3) poolPopFresh on empty pool returns null
console.log('[3] empty pool -> null');
const empty = await poolPopFresh('emptypool_' + Date.now(), 5000);
ok(empty === null, 'empty pool returns null');

// 4) poolDrainRefill from a source generator
console.log('[4] poolDrainRefill');
const POOL3 = 'testpool3_' + Date.now();
async function source(batchSize) {
  const out = [];
  for (let i = 0; i < batchSize; i++) out.push({ item: `gen_${i}`, score: Date.now() + i });
  return out;
}
const pushed = await poolDrainRefill(POOL3, source, 10);
ok(pushed === 10, `poolDrainRefill pushed 10 (got ${pushed})`);
const count3 = await poolCount(POOL3);
ok(count3 === 10, `poolCount after refill = 10 (got ${count3})`);

// 5) poolRemove removes a specific item
console.log('[5] poolRemove');
const POOL4 = 'testpool4_' + Date.now();
await poolPush(POOL4, 'keep', Date.now());
await poolPush(POOL4, 'drop', Date.now());
const removed = await poolRemove(POOL4, 'drop');
ok(removed === 1, `poolRemove returns 1 (got ${removed})`);
const count4 = await poolCount(POOL4);
ok(count4 === 1, `count after remove = 1 (got ${count4})`);

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
