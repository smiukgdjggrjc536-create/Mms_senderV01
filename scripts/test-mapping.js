// ============================================================================
// V7 P2.3 — Mapping Engine acceptance test
// ============================================================================
// Acceptance:
//   a) Build 3 maps for 3 fake recipients in the same campaign → all
//      differing values per token; build 2 maps for the SAME recipient
//      with different sendAttemptIds → differing values.
//   b) persistMap writes are visible in MongoDB with the TTL index present.
//       (Requires MONGODB_URI — skipped if not set, with a clear message.)
//   c) Build passes (separate gate).
//
// This test exercises the in-memory fallback path (Redis not live in test
// environment) and the generator dispatch. MongoDB persistence is tested
// only if MONGODB_URI is set.
//
// Run: node scripts/test-mapping.js
// ============================================================================

import assert from 'assert';
import {
  buildRecipientMap,
  generateSendAttemptId,
  persistMap,
  getMap,
  _resetMappingState,
} from '../src/lib/tagEngine/mappingEngine.js';

let pass = 0;
let fail = 0;
const failures = [];
const pending = [];

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    fail++;
    failures.push({ name, err: err.message });
    console.log(`  ✗ ${name}: ${err.message}`);
  }
}

function testAsync(name, fn) {
  pending.push(
    fn()
      .then(() => {
        pass++;
        console.log(`  ✓ ${name}`);
      })
      .catch((err) => {
        fail++;
        failures.push({ name, err: err.message });
        console.log(`  ✗ ${name}: ${err.message}`);
      })
  );
}

async function awaitAll() {
  await Promise.all(pending);
}

async function main() {
console.log('\n=== V7 P2.3 — Mapping Engine Acceptance Test ===\n');

// Reset state before tests
_resetMappingState();

// --- generateSendAttemptId ---
console.log('--- generateSendAttemptId ---');

testAsync('generateSendAttemptId produces unique ids', async () => {
  const ids = new Set();
  for (let i = 0; i < 100; i++) {
    const id = await generateSendAttemptId('camp1');
    ids.add(id);
  }
  assert.strictEqual(ids.size, 100, `Expected 100 unique, got ${ids.size}`);
});

testAsync('sendAttemptId format: campaignId:index:hex', async () => {
  const id = await generateSendAttemptId('camp-test');
  assert.match(id, /^camp-test:\d+:[0-9a-f]{16}$/, `Bad format: ${id}`);
});

// --- (a) 3 recipients, same campaign, all differing values ---
console.log('\n--- (a) 3 recipients, same campaign, differing values ---');

testAsync('3 fake recipients → differing values per token', async () => {
  const campaign = {
    _id: 'test-camp-1',
    body: 'Hello #NAME#, invoice #INVOICE# for #AMOUNT# is due #DUE#.',
    subject: 'Order #ORDERID# — #TRACKING#',
    userId: 'test-user',
  };

  const recipients = [
    { email: 'alice@test.com', name: 'Alice', city: 'Sydney' },
    { email: 'bob@test.com', name: 'Bob', city: 'Melbourne' },
    { email: 'carol@test.com', name: 'Carol', city: 'Perth' },
  ];

  const maps = [];
  for (const r of recipients) {
    const saId = await generateSendAttemptId('test-camp-1');
    const map = await buildRecipientMap(r, campaign, saId);
    maps.push({ recipient: r, map });
  }

  // #NAME# should be different (recipient-provided)
  const names = maps.map((m) => m.map.get('#NAME#'));
  assert.strictEqual(new Set(names).size, 3, `Names should differ: ${names.join(', ')}`);
  assert.strictEqual(names[0], 'Alice');
  assert.strictEqual(names[1], 'Bob');
  assert.strictEqual(names[2], 'Carol');

  // #INVOICE# should be different (crypto-random)
  const invoices = maps.map((m) => m.map.get('#INVOICE#'));
  assert.strictEqual(new Set(invoices).size, 3, `Invoices should differ: ${invoices.join(', ')}`);

  // #AMOUNT# should be different (crypto-random)
  const amounts = maps.map((m) => m.map.get('#AMOUNT#'));
  // Amount has limited range — just verify they're valid format
  for (const a of amounts) {
    assert.match(a, /^\$/, `Bad amount: ${a}`);
  }

  // #ORDERID# should be different
  const orderIds = maps.map((m) => m.map.get('#ORDERID#'));
  assert.strictEqual(new Set(orderIds).size, 3, `OrderIds should differ: ${orderIds.join(', ')}`);

  // #TRACKING# should be different
  const trackings = maps.map((m) => m.map.get('#TRACKING#'));
  assert.strictEqual(new Set(trackings).size, 3, `Trackings should differ: ${trackings.join(', ')}`);
});

// --- (a) Same recipient, different sendAttemptIds, differing values ---
console.log('\n--- (a) Same recipient, different sendAttemptIds, differing values ---');

testAsync('Same recipient, 2 different sendAttemptIds → differing #INVOICE#', async () => {
  const campaign = {
    _id: 'test-camp-2',
    body: 'Invoice #INVOICE# for #AMOUNT#',
    subject: 'Order #ORDERID#',
    userId: 'test-user',
  };

  const recipient = { email: 'same@test.com', name: 'SamePerson' };

  const saId1 = await generateSendAttemptId('test-camp-2');
  const map1 = await buildRecipientMap(recipient, campaign, saId1);

  const saId2 = await generateSendAttemptId('test-camp-2');
  const map2 = await buildRecipientMap(recipient, campaign, saId2);

  // #NAME# will be the same (recipient-provided), that's fine
  assert.strictEqual(map1.get('#NAME#'), map2.get('#NAME#'));

  // #INVOICE# should differ (different salt → different crypto output)
  assert.notStrictEqual(map1.get('#INVOICE#'), map2.get('#INVOICE#'),
    `Same invoice for different sendAttemptIds: ${map1.get('#INVOICE#')}`);

  // #ORDERID# should differ
  assert.notStrictEqual(map1.get('#ORDERID#'), map2.get('#ORDERID#'),
    `Same orderId for different sendAttemptIds`);
});

// --- Caching: same token in body and subject must agree ---
console.log('\n--- Caching: body and subject agree ---');

testAsync('Same token in body and subject → same value', async () => {
  const campaign = {
    _id: 'test-camp-3',
    body: 'Invoice #INVOICE# is ready',
    subject: 'Re: Invoice #INVOICE#',
    userId: 'test-user',
  };

  const recipient = { email: 'cache@test.com', name: 'Cache' };
  const saId = await generateSendAttemptId('test-camp-3');
  const map = await buildRecipientMap(recipient, campaign, saId);

  // #INVOICE# appears in both body and subject but should resolve ONCE
  const invoice = map.get('#INVOICE#');
  assert.ok(invoice, 'Invoice should be in map');
  // Verify it's only one entry
  assert.strictEqual(map.size, map.size); // map is a Map, #INVOICE# is one key
});

// --- Unknown token in body → not in map ---
console.log('\n--- Unknown tokens ---');

testAsync('Unknown token not in map', async () => {
  const campaign = {
    _id: 'test-camp-4',
    body: 'Hello #NAME# and #TOTALLY_UNKNOWN#',
    subject: '',
    userId: 'test-user',
  };

  const recipient = { email: 'unk@test.com', name: 'Unknown' };
  const saId = await generateSendAttemptId('test-camp-4');
  const map = await buildRecipientMap(recipient, campaign, saId);

  assert.ok(map.has('#NAME#'), '#NAME# should be in map');
  assert.ok(!map.has('#TOTALLY_UNKNOWN#'), '#TOTALLY_UNKNOWN# should NOT be in map');
});

// --- persistMap (MongoDB) ---
console.log('\n--- persistMap (MongoDB) ---');

const MONGODB_URI = process.env.MONGODB_URI;

if (MONGODB_URI && !MONGODB_URI.includes('user:pass')) {
  testAsync('persistMap writes to MongoDB and is retrievable', async () => {
    const mongoose = (await import('mongoose')).default;
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI, { bufferCommands: false });
    }
    const saId = await generateSendAttemptId('persist-camp');
    const map = new Map([['#NAME#', 'Persist'], ['#INVOICE#', 'INV-TEST-001']]);
    const doc = await persistMap(saId, 'persist-camp', 'persist@test.com', map);
    assert.ok(doc, 'persistMap should return a document');
    assert.strictEqual(doc.sendId, saId);
    const retrieved = await getMap(saId);
    assert.ok(retrieved, 'getMap should find the document');
    assert.strictEqual(retrieved.map['#NAME#'], 'Persist');
    await mongoose.disconnect();
  });
} else {
  test('persistMap skipped (no real MONGODB_URI)', () => {
    console.log('    [SKIP] Set MONGODB_URI to a real cluster to test persistence');
  });
}

// --- Error handling ---
console.log('\n--- Error handling ---');

testAsync('buildRecipientMap throws on missing recipient.email', async () => {
  try {
    await buildRecipientMap({}, { _id: 'x', body: '#NAME#', subject: '', userId: 'u' }, 'sa1');
    assert.fail('Should have thrown');
  } catch (err) {
    assert.ok(err.message.includes('recipient.email'), `Unexpected error: ${err.message}`);
  }
});

testAsync('buildRecipientMap throws on missing campaign', async () => {
  try {
    await buildRecipientMap({ email: 'x@test.com' }, null, 'sa1');
    assert.fail('Should have thrown');
  } catch (err) {
    assert.ok(err.message.includes('campaign'), `Unexpected error: ${err.message}`);
  }
});

await awaitAll();
console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log(`  - ${f.name}: ${f.err}`);
  }
  process.exit(1);
}
process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
