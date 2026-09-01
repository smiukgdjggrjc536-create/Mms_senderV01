// ============================================================================
// P1.5 — sanitize.js Acceptance Test
// ============================================================================
// Acceptance criterion (b): Malicious payload with $-keys is rejected by
// sanitize.js. Also validates basic type checking and email list validation.
// ============================================================================

import {
  stripDollarKeys,
  sanitizeInput,
  validateEmailList,
  validateCampaignConfig,
  validateAdminToggle,
  _testNoSqlInjection,
} from '../src/lib/validate/sanitize.js';

let passed = 0;
let failed = 0;

function assert(cond, name, detail) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} — ${detail || 'assertion false'}`);
  }
}

console.log('\n=== P1.5 — sanitize.js Acceptance Test ===\n');

// ── 1. stripDollarKeys removes $-prefixed keys ──
console.log('--- stripDollarKeys ---');
try {
  const input = { name: 'test', $where: 'malicious', $gt: '', normal: { $ne: '', x: 1 } };
  const result = stripDollarKeys(input);
  assert(!('$where' in result), 'strips top-level $-keys', JSON.stringify(result));
  assert(!('$gt' in result), 'strips $gt key', JSON.stringify(result));
  assert(!('$ne' in result.normal), 'strips nested $-keys', JSON.stringify(result.normal));
  assert(result.normal.x === 1, 'preserves non-$ nested keys', String(result.normal.x));
  assert(result.name === 'test', 'preserves normal keys', result.name);
} catch (e) { failed++; console.log(`  ✗ stripDollarKeys — ${e.message}`); }

// ── 2. stripDollarKeys removes dot-notation keys ──
try {
  const input = { 'user.name': 'injected', normal: 'ok' };
  const result = stripDollarKeys(input);
  assert(!('user.name' in result), 'strips dot-notation keys (path injection)', JSON.stringify(result));
  assert(result.normal === 'ok', 'preserves normal keys', result.normal);
} catch (e) { failed++; console.log(`  ✗ dot-notation strip — ${e.message}`); }

// ── 3. stripDollarKeys handles arrays ──
try {
  const input = [{ $where: 'x', a: 1 }, { b: 2, $gt: '' }];
  const result = stripDollarKeys(input);
  assert(Array.isArray(result), 'returns array for array input', typeof result);
  assert(result[0].a === 1, 'array[0].a preserved', String(result[0]?.a));
  assert(!('$where' in result[0]), 'array[0] $-key stripped', JSON.stringify(result[0]));
  assert(result[1].b === 2, 'array[1].b preserved', String(result[1]?.b));
} catch (e) { failed++; console.log(`  ✗ array strip — ${e.message}`); }

// ── 4. sanitizeInput rejects $-key NoSQL injection ──
console.log('\n--- sanitizeInput NoSQL injection rejection ---');
try {
  const malicious = {
    email: 'test@example.com',
    password: 'validPass123',
    $where: 'this.password == "admin"',
    $gt: '',
    'user.name': 'injected',
  };
  const result = sanitizeInput(malicious, {
    email: { type: 'email', required: true },
    password: { type: 'string', required: true, min: 6 },
  });
  assert(result.strippedDollarKeys.length > 0, 'flags stripped $-keys', JSON.stringify(result.strippedDollarKeys));
  assert(!result.valid, 'rejects payload containing $-keys', JSON.stringify(result.errors));
  assert(result.errors.some((e) => e.includes('NoSQL injection')), 'error message mentions NoSQL injection', JSON.stringify(result.errors));
  assert(result.data.email === 'test@example.com', 'valid fields still extracted', result.data.email);
} catch (e) { failed++; console.log(`  ✗ NoSQL injection rejection — ${e.message}`); }

// ── 5. sanitizeInput validates types ──
console.log('\n--- sanitizeInput type validation ---');
try {
  const result = sanitizeInput(
    { name: 'Test Campaign', batchSize: 5, delayMs: 1000 },
    {
      name: { type: 'string', required: true, min: 1, max: 200 },
      batchSize: { type: 'number', required: false, min: 1, max: 1000 },
      delayMs: { type: 'number', required: false, min: 0, max: 3600000 },
    }
  );
  assert(result.valid, 'valid input passes', JSON.stringify(result.errors));
  assert(result.data.name === 'Test Campaign', 'name extracted', result.data.name);
  assert(result.data.batchSize === 5, 'batchSize extracted', String(result.data.batchSize));
} catch (e) { failed++; console.log(`  ✗ type validation — ${e.message}`); }

// ── 6. sanitizeInput rejects missing required field ──
try {
  const result = sanitizeInput(
    { batchSize: 5 },
    { name: { type: 'string', required: true } }
  );
  assert(!result.valid, 'missing required field fails', JSON.stringify(result.errors));
  assert(result.errors.some((e) => e.includes('required')), 'error mentions required', JSON.stringify(result.errors));
} catch (e) { failed++; console.log(`  ✗ required field — ${e.message}`); }

// ── 7. sanitizeInput rejects invalid email ──
try {
  const result = sanitizeInput(
    { email: 'not-an-email' },
    { email: { type: 'email', required: true } }
  );
  assert(!result.valid, 'invalid email fails', JSON.stringify(result.errors));
} catch (e) { failed++; console.log(`  ✗ invalid email — ${e.message}`); }

// ── 8. sanitizeInput coerces string→number ──
try {
  const result = sanitizeInput(
    { count: '42' },
    { count: { type: 'number', required: true } }
  );
  assert(result.valid, 'string "42" coerced to number', JSON.stringify(result.errors));
  assert(result.data.count === 42, 'count is 42 (number)', String(result.data.count));
} catch (e) { failed++; console.log(`  ✗ number coercion — ${e.message}`); }

// ── 9. sanitizeInput validates enum ──
try {
  const result = sanitizeInput(
    { provider: 'twilio' },
    { provider: { type: 'enum', values: ['twilio', 'vonage', 'messagebird'] } }
  );
  assert(result.valid, 'valid enum value passes', JSON.stringify(result.errors));
  const bad = sanitizeInput(
    { provider: 'unknown' },
    { provider: { type: 'enum', values: ['twilio', 'vonage', 'messagebird'] } }
  );
  assert(!bad.valid, 'invalid enum value fails', JSON.stringify(bad.errors));
} catch (e) { failed++; console.log(`  ✗ enum validation — ${e.message}`); }

// ── 10. validateEmailList parses string input ──
console.log('\n--- validateEmailList ---');
try {
  const result = validateEmailList('a@test.com\nb@test.com, c@test.com');
  assert(result.valid, 'valid email list from string', JSON.stringify(result.errors));
  assert(result.data.length === 3, '3 emails parsed', String(result.data.length));
  assert(result.data[0] === 'a@test.com', 'first email correct', result.data[0]);
} catch (e) { failed++; console.log(`  ✗ email list string — ${e.message}`); }

// ── 11. validateEmailList parses array input ──
try {
  const result = validateEmailList(['x@test.com', 'y@test.com']);
  assert(result.valid, 'valid email list from array', JSON.stringify(result.errors));
  assert(result.data.length === 2, '2 emails from array', String(result.data.length));
} catch (e) { failed++; console.log(`  ✗ email list array — ${e.message}`); }

// ── 12. validateEmailList rejects invalid emails ──
try {
  const result = validateEmailList(['good@test.com', 'not-an-email', 'also@test.com']);
  assert(result.data.length === 2, '2 valid emails (1 invalid skipped)', String(result.data.length));
  assert(result.errors.length > 0, 'error for invalid email', JSON.stringify(result.errors));
} catch (e) { failed++; console.log(`  ✗ email list invalid — ${e.message}`); }

// ── 13. validateEmailList blocks $-key injection ──
try {
  const result = validateEmailList(['$where:test', 'good@test.com']);
  assert(result.data.length === 1, 'injection entry blocked', String(result.data.length));
  assert(result.errors.length > 0, 'error for injection entry', JSON.stringify(result.errors));
} catch (e) { failed++; console.log(`  ✗ email list injection — ${e.message}`); }

// ── 14. validateCampaignConfig ──
console.log('\n--- validateCampaignConfig ---');
try {
  const result = validateCampaignConfig({
    name: 'Test Campaign',
    message: 'Hello world',
    batchSize: 10,
    provider: 'twilio',
  });
  assert(result.valid, 'valid campaign config passes', JSON.stringify(result.errors));
  assert(result.data.name === 'Test Campaign', 'name extracted', result.data.name);
} catch (e) { failed++; console.log(`  ✗ campaign config — ${e.message}`); }

// ── 15. validateCampaignConfig rejects bad provider ──
try {
  const result = validateCampaignConfig({
    name: 'Test',
    provider: 'unknown_provider',
  });
  assert(!result.valid, 'invalid provider fails', JSON.stringify(result.errors));
} catch (e) { failed++; console.log(`  ✗ campaign bad provider — ${e.message}`); }

// ── 16. validateAdminToggle ──
console.log('\n--- validateAdminToggle ---');
try {
  const result = validateAdminToggle({ enabled: true, feature: 'spamProtection' });
  assert(result.valid, 'valid admin toggle passes', JSON.stringify(result.errors));
  const bad = validateAdminToggle({ enabled: 'yes', feature: 'test' });
  assert(!bad.valid, 'non-boolean enabled fails', JSON.stringify(bad.errors));
} catch (e) { failed++; console.log(`  ✗ admin toggle — ${e.message}`); }

// ── 17. _testNoSqlInjection helper ──
console.log('\n--- _testNoSqlInjection ---');
try {
  const result = _testNoSqlInjection();
  assert(result.blocked === true, 'NoSQL injection blocked', JSON.stringify(result));
  assert(result.noDollarKeysInData === true, 'no $-keys in sanitized data', JSON.stringify(result));
} catch (e) { failed++; console.log(`  ✗ NoSQL injection test helper — ${e.message}`); }

// ── 18. sanitizeInput handles null/undefined ──
try {
  const result = sanitizeInput(null, { name: { type: 'string' } });
  assert(!result.valid, 'null input rejected', JSON.stringify(result.errors));
  const result2 = sanitizeInput(undefined, { name: { type: 'string' } });
  assert(!result2.valid, 'undefined input rejected', JSON.stringify(result2.errors));
} catch (e) { failed++; console.log(`  ✗ null/undefined — ${e.message}`); }

// ── Summary ──
console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
if (failed === 0) {
  console.log('SANITIZE_EXIT=0');
  process.exit(0);
} else {
  console.log('SANITIZE_EXIT=1');
  process.exit(1);
}
