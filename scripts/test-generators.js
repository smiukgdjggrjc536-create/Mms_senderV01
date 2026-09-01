// ============================================================================
// V7 P2.2 — Generator Library acceptance test
// ============================================================================
// Acceptance criteria:
//   a) Generate 10,000 #INVOICE# values → 0 duplicates.
//      Same for #SNUMBER#, #HELPDESK#, #ORDERID#.
//   b) #DATE#/#DUE# outputs always parse back to valid dates in the
//      requested format.
//   c) No Math.random used anywhere (static check).
//
// Run: node scripts/test-generators.js
// ============================================================================

import assert from 'assert';
import crypto from 'crypto';
import { generateInvoice } from '../src/lib/tagEngine/generators/invoice.js';
import { generateSerial } from '../src/lib/tagEngine/generators/serial.js';
import { generateTfn } from '../src/lib/tagEngine/generators/tfn.js';
import { generateHelpdesk } from '../src/lib/tagEngine/generators/helpdesk.js';
import { smartDate, formatDate, parseDate } from '../src/lib/tagEngine/generators/date.js';
import { generateOrderId } from '../src/lib/tagEngine/generators/orderid.js';
import { generateTracking } from '../src/lib/tagEngine/generators/tracking.js';
import { generateAmount, formatMoney } from '../src/lib/tagEngine/generators/amount.js';
import { generateRandom } from '../src/lib/tagEngine/generators/random.js';
import { generateUuid } from '../src/lib/tagEngine/generators/uuid.js';
import fs from 'fs';
import path from 'path';

let pass = 0;
let fail = 0;
const failures = [];

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

async function testAsync(name, fn) {
  try {
    await fn();
    pass++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    fail++;
    failures.push({ name, err: err.message });
    console.log(`  ✗ ${name}: ${err.message}`);
  }
}

console.log('\n=== V7 P2.2 — Generator Library Acceptance Test ===\n');

// --- (a) Uniqueness: 10,000 values, 0 duplicates ---
console.log('--- (a) Uniqueness (10,000 values each) ---');

test('INVOICE: 10,000 values → 0 duplicates', () => {
  const set = new Set();
  for (let i = 0; i < 10000; i++) {
    const v = generateInvoice({ salt: crypto.randomBytes(8).toString('hex') });
    set.add(v);
  }
  assert.strictEqual(set.size, 10000, `Expected 10000 unique, got ${set.size}`);
});

test('SNUMBER: 10,000 values → 0 duplicates', () => {
  const set = new Set();
  for (let i = 0; i < 10000; i++) {
    const v = generateSerial({ salt: crypto.randomBytes(8).toString('hex') });
    set.add(v);
  }
  assert.strictEqual(set.size, 10000, `Expected 10000 unique, got ${set.size}`);
});

test('HELPDESK: 10,000 values → 0 duplicates', () => {
  const set = new Set();
  for (let i = 0; i < 10000; i++) {
    const v = generateHelpdesk({ salt: crypto.randomBytes(8).toString('hex') });
    set.add(v);
  }
  assert.strictEqual(set.size, 10000, `Expected 10000 unique, got ${set.size}`);
});

test('ORDERID: 10,000 values → 0 duplicates', () => {
  const set = new Set();
  for (let i = 0; i < 10000; i++) {
    const v = generateOrderId({ salt: crypto.randomBytes(8).toString('hex') });
    set.add(v);
  }
  assert.strictEqual(set.size, 10000, `Expected 10000 unique, got ${set.size}`);
});

test('TRACKING: 10,000 values → 0 duplicates', () => {
  const set = new Set();
  for (let i = 0; i < 10000; i++) {
    const v = generateTracking({ salt: crypto.randomBytes(8).toString('hex') });
    set.add(v);
  }
  assert.strictEqual(set.size, 10000, `Expected 10000 unique, got ${set.size}`);
});

test('RANDOM: 10,000 values → 0 duplicates', () => {
  const set = new Set();
  for (let i = 0; i < 10000; i++) {
    const v = generateRandom({ salt: crypto.randomBytes(8).toString('hex') }, { minLength: 10, maxLength: 10 });
    set.add(v);
  }
  assert.strictEqual(set.size, 10000, `Expected 10000 unique, got ${set.size}`);
});

test('UUID: 10,000 values → 0 duplicates', () => {
  const set = new Set();
  for (let i = 0; i < 10000; i++) {
    const v = generateUuid({ salt: crypto.randomBytes(8).toString('hex') });
    set.add(v);
  }
  assert.strictEqual(set.size, 10000, `Expected 10000 unique, got ${set.size}`);
});

test('TFN: 10,000 values → 0 duplicates', () => {
  const set = new Set();
  for (let i = 0; i < 10000; i++) {
    const v = generateTfn({ salt: crypto.randomBytes(8).toString('hex') });
    set.add(v);
  }
  assert.strictEqual(set.size, 10000, `Expected 10000 unique, got ${set.size}`);
});

// --- (b) Date round-trip ---
console.log('\n--- (b) Date round-trip ---');

test('DATE (DD MMM YYYY) parses back to valid date', () => {
  for (let i = 0; i < 100; i++) {
    const v = smartDate({}, { offsetDaysMin: 7, offsetDaysMax: 30, format: 'DD MMM YYYY' });
    const parsed = parseDate(v, 'DD MMM YYYY');
    assert.ok(parsed instanceof Date && !isNaN(parsed), `Failed to parse: ${v}`);
  }
});

test('DATE (ISO) parses back to valid date', () => {
  for (let i = 0; i < 100; i++) {
    const v = smartDate({}, { offsetDaysMin: 1, offsetDaysMax: 60, format: 'ISO' });
    const parsed = parseDate(v, 'ISO');
    assert.ok(parsed instanceof Date && !isNaN(parsed), `Failed to parse: ${v}`);
  }
});

test('DATE (DD/MM/YYYY) parses back to valid date', () => {
  for (let i = 0; i < 100; i++) {
    const v = smartDate({}, { offsetDaysMin: 1, offsetDaysMax: 60, format: 'DD/MM/YYYY' });
    const parsed = parseDate(v, 'DD/MM/YYYY');
    assert.ok(parsed instanceof Date && !isNaN(parsed), `Failed to parse: ${v}`);
  }
});

test('DUE (DD MMM YYYY) parses back to valid date', () => {
  for (let i = 0; i < 100; i++) {
    const v = smartDate({}, { offsetDaysMin: 14, offsetDaysMax: 60, format: 'DD MMM YYYY' });
    const parsed = parseDate(v, 'DD MMM YYYY');
    assert.ok(parsed instanceof Date && !isNaN(parsed), `Failed to parse: ${v}`);
  }
});

// --- (c) No Math.random ---
console.log('\n--- (c) No Math.random (static check) ---');

test('No Math.random in any generator file', () => {
  const genDir = path.resolve('src/lib/tagEngine/generators');
  const files = fs.readdirSync(genDir).filter((f) => f.endsWith('.js'));
  for (const f of files) {
    const content = fs.readFileSync(path.join(genDir, f), 'utf8');
    // Allow Math.random only in comments, not in actual code
    const stripped = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(
      !stripped.includes('Math.random'),
      `${f} uses Math.random — forbidden in generators`
    );
  }
});

// --- Extra: format checks ---
console.log('\n--- Extra: format checks ---');

test('INVOICE format: INV-YYYY-XXXXXXXXX', () => {
  const v = generateInvoice({});
  assert.match(v, /^INV-\d{4}-\d{9}$/, `Bad invoice format: ${v}`);
});

test('SNUMBER format: 3 groups of 4', () => {
  const v = generateSerial({});
  assert.match(v, /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/, `Bad serial format: ${v}`);
});

test('HELPDESK format: HD-XXXXXXXX (alphanumeric)', () => {
  const v = generateHelpdesk({});
  assert.match(v, /^HD-[A-Z0-9]{8}$/, `Bad helpdesk format: ${v}`);
});

test('ORDERID format: ORD-XXXXXXXX', () => {
  const v = generateOrderId({});
  assert.match(v, /^ORD-[A-Z0-9]{8}$/, `Bad orderid format: ${v}`);
});

test('TRACKING format: 9400 + 11 digits', () => {
  const v = generateTracking({});
  assert.match(v, /^9400\d{11}$/, `Bad tracking format: ${v}`);
});

test('UUID format: v4', () => {
  const v = generateUuid({});
  assert.match(v, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, `Bad uuid: ${v}`);
});

test('AMOUNT format: $X,XXX.XX', () => {
  const v = generateAmount({});
  assert.match(v, /^\$\d{1,3}(,\d{3})*\.\d{2}$/, `Bad amount format: ${v}`);
});

test('TFN format: XXX XXX XXX', () => {
  const v = generateTfn({});
  assert.match(v, /^\d{3} \d{3} \d{3}$/, `Bad tfn format: ${v}`);
});

console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log(`  - ${f.name}: ${f.err}`);
  }
  process.exit(1);
}
process.exit(0);
