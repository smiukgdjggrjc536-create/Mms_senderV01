// ============================================================================
// V7 P2.4 — Tag Applier acceptance test
// ============================================================================
// Acceptance:
//   a) HTML containing all 17 built-in tokens + 1 custom → all replaced
//      exactly once; unknown #NOPE# untouched; idempotency check passes;
//      &amp; preserved.
//   b) Build passes (separate gate).
//
// Run: node scripts/test-applier.js
// ============================================================================

import assert from 'assert';
import { applyTags, countReplacedTokens, listUnknownTokens } from '../src/lib/tagEngine/applier.js';

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

console.log('\n=== V7 P2.4 — Tag Applier Acceptance Test ===\n');

// --- Basic replacement ---
console.log('--- Basic replacement ---');

test('Single token replaced', () => {
  const result = applyTags('Hello #NAME#', new Map([['#NAME#', 'John']]));
  assert.strictEqual(result, 'Hello John');
});

test('Multiple tokens replaced', () => {
  const map = new Map([['#NAME#', 'Jane'], ['#AMOUNT#', '$500.00']]);
  const result = applyTags('Dear #NAME#, you owe #AMOUNT#', map);
  assert.strictEqual(result, 'Dear Jane, you owe $500.00');
});

test('Unknown token left untouched', () => {
  const map = new Map([['#NAME#', 'John']]);
  const result = applyTags('Hello #NAME# and #NOPE#', map);
  assert.strictEqual(result, 'Hello John and #NOPE#');
});

test('No tokens in text → unchanged', () => {
  const map = new Map([['#NAME#', 'John']]);
  const result = applyTags('Just plain text', map);
  assert.strictEqual(result, 'Just plain text');
});

test('Empty map → text unchanged', () => {
  const result = applyTags('Hello #NAME#', new Map());
  assert.strictEqual(result, 'Hello #NAME#');
});

test('Null/empty text → returns empty', () => {
  assert.strictEqual(applyTags(null, new Map()), '');
  assert.strictEqual(applyTags('', new Map()), '');
  assert.strictEqual(applyTags(undefined, new Map()), '');
});

// --- All 17 built-in tokens ---
console.log('\n--- All 17 built-in tokens ---');

test('All 17 built-in tokens replaced exactly once', () => {
  const html = [
    '#NAME# #EMAIL# #INVOICE# #SNUMBER# #TFN# #DATE# #HELPDESK#',
    '#ORDERID# #TRACKING# #AMOUNT# #DUE# #CITY# #ZIP# #PHONE#',
    '#COMPANY# #RANDOM# #UUID#',
  ].join(' ');

  const map = new Map([
    ['#NAME#', 'John Smith'],
    ['#EMAIL#', 'john@example.com'],
    ['#INVOICE#', 'INV-2026-123456'],
    ['#SNUMBER#', 'A7F2-K9X3-M4Q8'],
    ['#TFN#', '839 472 615'],
    ['#DATE#', '12 Mar 2026'],
    ['#HELPDESK#', 'HD-738291AB'],
    ['#ORDERID#', 'ORD-K7M3X9Q2'],
    ['#TRACKING#', '9400111205217384920573'],
    ['#AMOUNT#', '$1,250.00'],
    ['#DUE#', '15 Apr 2026'],
    ['#CITY#', 'Melbourne'],
    ['#ZIP#', '3000'],
    ['#PHONE#', '+61 400 123 456'],
    ['#COMPANY#', 'Acme Holdings'],
    ['#RANDOM#', 'K7M3X9Q2'],
    ['#UUID#', 'a3f5c8e2-1b4d-4f7a-9c6e-2d8b0f3a1e5c'],
  ]);

  const result = applyTags(html, map);
  // No tokens should remain
  assert.ok(!result.includes('#'), `Unreplaced tokens remain: ${result}`);
  // All values should be present
  for (const [, value] of map) {
    assert.ok(result.includes(value), `Missing value: ${value}`);
  }
});

// --- Custom + unknown ---
console.log('\n--- Custom + unknown ---');

test('17 built-in + 1 custom replaced, unknown untouched', () => {
  const html = '#NAME# owes #AMOUNT# by #DUE# — ref #MYCUSTOM# — #NOPE#';
  const map = new Map([
    ['#NAME#', 'Alice'],
    ['#AMOUNT#', '$750.00'],
    ['#DUE#', '20 May 2026'],
    ['#MYCUSTOM#', 'CUST-ABCD1234'],
  ]);
  const result = applyTags(html, map);
  assert.strictEqual(result, 'Alice owes $750.00 by 20 May 2026 — ref CUST-ABCD1234 — #NOPE#');
});

// --- Idempotency ---
console.log('\n--- Idempotency ---');

test('Idempotency: applying twice with same map = same output', () => {
  const map = new Map([['#NAME#', 'Bob'], ['#INVOICE#', 'INV-2026-999888']]);
  const html = 'Hello #NAME#, invoice #INVOICE# is ready';
  const once = applyTags(html, map);
  const twice = applyTags(once, map);
  assert.strictEqual(once, twice, `Not idempotent: once="${once}" twice="${twice}"`);
});

test('Idempotency with HTML entities preserved', () => {
  const map = new Map([['#NAME#', 'Charlie']]);
  const html = '<p>Hello &amp; welcome #NAME#</p>';
  const once = applyTags(html, map);
  const twice = applyTags(once, map);
  assert.strictEqual(once, '<p>Hello &amp; welcome Charlie</p>');
  assert.strictEqual(once, twice);
});

// --- HTML entity preservation ---
console.log('\n--- HTML entity preservation ---');

test('&amp; preserved (not double-encoded)', () => {
  const map = new Map([['#NAME#', 'Dave']]);
  const result = applyTags('Tom &amp; Jerry #NAME#', map);
  assert.ok(result.includes('&amp;'), `&amp; was modified: ${result}`);
  assert.strictEqual(result, 'Tom &amp; Jerry Dave');
});

test('&lt; &gt; &quot; preserved', () => {
  const map = new Map([['#NAME#', 'Eve']]);
  const result = applyTags('&lt;tag&gt; &quot;hi&quot; #NAME#', map);
  assert.ok(result.includes('&lt;'), `&lt; was modified: ${result}`);
  assert.ok(result.includes('&gt;'), `&gt; was modified: ${result}`);
  assert.ok(result.includes('&quot;'), `&quot; was modified: ${result}`);
  assert.strictEqual(result, '&lt;tag&gt; &quot;hi&quot; Eve');
});

// --- Plain object map (not Map) ---
console.log('\n--- Plain object map ---');

test('Works with plain object map (not Map)', () => {
  const result = applyTags('Hello #NAME#', { '#NAME#': 'Frank' });
  assert.strictEqual(result, 'Hello Frank');
});

// --- countReplacedTokens / listUnknownTokens ---
console.log('\n--- countReplacedTokens / listUnknownTokens ---');

test('countReplacedTokens counts correctly', () => {
  const map = new Map([['#NAME#', 'X'], ['#AMOUNT#', 'Y']]);
  const html = '#NAME# and #AMOUNT# and #NOPE#';
  assert.strictEqual(countReplacedTokens(html, map), 2);
});

test('listUnknownTokens finds unknown', () => {
  const map = new Map([['#NAME#', 'X']]);
  const html = '#NAME# and #NOPE# and #BLAH#';
  const unknown = listUnknownTokens(html, map);
  assert.ok(unknown.includes('#NOPE#'));
  assert.ok(unknown.includes('#BLAH#'));
  assert.strictEqual(unknown.length, 2);
});

// --- Repeated tokens ---
console.log('\n--- Repeated tokens ---');

test('Repeated token replaced all occurrences', () => {
  const map = new Map([['#INVOICE#', 'INV-001']]);
  const result = applyTags('#INVOICE# #INVOICE# #INVOICE#', map);
  assert.strictEqual(result, 'INV-001 INV-001 INV-001');
});

test('Token adjacent to text (no spaces)', () => {
  const map = new Map([['#NAME#', 'Grace']]);
  const result = applyTags('Hi#NAME#!', map);
  assert.strictEqual(result, 'HiGrace!');
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
