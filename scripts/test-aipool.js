// ============================================================================
// V7 P4.1 ACCEPTANCE — test-aipool.js
// ============================================================================
// a) Seed 1000 items, consume 1000 → pool empty, ZPOPMIN order correct,
//    no race duplicates under 20 concurrent consumers.
// b) Build passes (run separately).
// ============================================================================

import assert from 'assert';
import crypto from 'crypto';
import {
  POOL_TYPES,
  getPoolSize,
  getStats,
  consumeOne,
  consumeBatch,
  produceItems,
  feedNamesPool,
} from '../src/services/ai/engine.js';
import { poolCountRoute } from '../src/lib/routing/rotationStrategy.js';

const SENDER = POOL_TYPES.SENDER;
const SUBJECT = POOL_TYPES.SUBJECT;
let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } }

// ---------------------------------------------------------------------------
// Test 1: seed 1000, consume 1000, pool empty
// ---------------------------------------------------------------------------
async function testSeedConsumeEmpty() {
  console.log('\n[Test 1] Seed 1000 → consume 1000 → pool empty');
  // Use a dedicated pool suffix to avoid cross-test interference — we test
  // the generic poolPush/poolPopFresh path with a custom pool name.
  const { poolPush, poolPopFresh, poolCount } = await import('../src/lib/redis/pools.js');
  const testName = `test-aipool-${crypto.randomBytes(4).toString('hex')}`;

  const items = [];
  for (let i = 0; i < 1000; i++) items.push(`sender_${i}`);
  for (let i = 0; i < 1000; i++) await poolPush(testName, items[i], Date.now() + i);

  const countBefore = await poolCount(testName);
  ok('pool has 1000 after seed', countBefore === 1000);

  // consume all
  const consumed = [];
  for (let i = 0; i < 1000; i++) {
    const v = await poolPopFresh(testName, Infinity);
    if (v !== null) consumed.push(v);
  }
  ok('consumed 1000 items', consumed.length === 1000);
  ok('pool empty after consume', (await poolCount(testName)) === 0);
  ok('no duplicates consumed', new Set(consumed).size === 1000);
}

// ---------------------------------------------------------------------------
// Test 2: ZPOPMIN order correct (lowest score first)
// ---------------------------------------------------------------------------
async function testZpopminOrder() {
  console.log('\n[Test 2] ZPOPMIN order (lowest score first)');
  const { poolPush, poolPopFresh, poolCount } = await import('../src/lib/redis/pools.js');
  const testName = `test-order-${crypto.randomBytes(4).toString('hex')}`;
  // push with explicit ascending scores
  await poolPush(testName, 'C', 300);
  await poolPush(testName, 'A', 100);
  await poolPush(testName, 'B', 200);

  const first = await poolPopFresh(testName, Infinity);
  const second = await poolPopFresh(testName, Infinity);
  const third = await poolPopFresh(testName, Infinity);
  ok('first popped = A (lowest score)', first === 'A');
  ok('second popped = B', second === 'B');
  ok('third popped = C', third === 'C');
}

// ---------------------------------------------------------------------------
// Test 3: 20 concurrent consumers → no race duplicates
// ---------------------------------------------------------------------------
async function testConcurrentNoRace() {
  console.log('\n[Test 3] 20 concurrent consumers → no race duplicates');
  const { poolPush, poolPopFresh, poolCount } = await import('../src/lib/redis/pools.js');
  const testName = `test-race-${crypto.randomBytes(4).toString('hex')}`;
  const N = 200;
  for (let i = 0; i < N; i++) await poolPush(testName, `item_${i}`, Date.now() + i);

  // 20 concurrent consumers each pop 10
  const consumers = [];
  for (let c = 0; c < 20; c++) {
    consumers.push((async () => {
      const got = [];
      for (let i = 0; i < 10; i++) {
        const v = await poolPopFresh(testName, Infinity);
        if (v !== null) got.push(v);
      }
      return got;
    })());
  }
  const results = await Promise.all(consumers);
  const all = results.flat();
  ok('20 consumers collected 200 total', all.length === N);
  ok('zero duplicates across consumers', new Set(all).size === all.length);
  ok('pool empty after concurrent consume', (await poolCount(testName)) === 0);
}

// ---------------------------------------------------------------------------
// Test 4: produceItems dedup + watermark respect
// ---------------------------------------------------------------------------
async function testProduceDedup() {
  console.log('\n[Test 4] produceItems dedup + empty skip');
  // produceItems writes to the real ai:pool:sender — we drain it after
  const items = ['Alice', 'Alice', '', 'Bob', '  ', 'Carol'];
  const pushed = await produceItems(SENDER, items);
  ok('pushed 3 unique non-empty (Alice, Bob, Carol)', pushed === 3);

  // drain what we pushed so we don't pollute the pool
  const drained = await consumeBatch(SENDER, 3);
  ok('drained 3 to clean up', drained.length <= 3);
}

// ---------------------------------------------------------------------------
// Test 5: feedNamesPool feeds route:names:<campaignId>
// ---------------------------------------------------------------------------
async function testFeedNames() {
  console.log('\n[Test 5] feedNamesPool → route:names populated');
  // seed the sender AI pool first
  const seed = [];
  for (let i = 0; i < 50; i++) seed.push(`feedName_${i}`);
  await produceItems(SENDER, seed);

  const campaignId = `test-feed-${crypto.randomBytes(4).toString('hex')}`;
  const fed = await feedNamesPool(campaignId, 50);
  ok('feedNamesPool returned > 0', fed > 0);

  const routeCount = await poolCountRoute('names', campaignId);
  ok('route:names pool has items', routeCount > 0);
}

// ---------------------------------------------------------------------------
// Test 6: getStats shape
// ---------------------------------------------------------------------------
async function testStats() {
  console.log('\n[Test 6] getStats shape');
  const s = await getStats();
  ok('stats has sender number', typeof s.sender === 'number');
  ok('stats has subject number', typeof s.subject === 'number');
  ok('stats has target', s.target === 50000);
  ok('stats has low watermark', s.low === 20000);
  ok('stats has high watermark', s.high === 45000);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  console.log('=== V7 P4.1 test-aipool ===');
  try {
    await testSeedConsumeEmpty();
    await testZpopminOrder();
    await testConcurrentNoRace();
    await testProduceDedup();
    await testFeedNames();
    await testStats();
  } catch (err) {
    fail++;
    console.error('FATAL:', err);
  }
  console.log(`\n=== P4.1 RESULT: ${pass} pass, ${fail} fail ===`);
  process.exit(fail > 0 ? 1 : 0);
})();
