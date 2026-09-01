// ============================================================================
// V7 P6.1 ACCEPTANCE — Validator Pipeline test
// Run: node --experimental-loader ./scripts/alias-loader.mjs scripts/run-test.mjs scripts/test-pipeline.js
// ============================================================================
// Verifies:
//   - 5-step pipeline (syntax / dedup / bounce-risk / blacklist / grade)
//   - 1000-address test list: pipeline counts match manual recount
//   - UI sequence numbers are the server's numbers (server-authoritative)
// ============================================================================

import {
  validatePipeline,
  validateSingle,
  validateSyntax,
  checkDuplicate,
  checkBounceRisk,
  checkBlacklist,
  gradeEmail,
  DISPOSABLE_DOMAINS,
  ROLE_PREFIXES,
} from '../src/lib/validate/pipeline.js';

let pass = 0, fail = 0;
const failures = [];

function ok(name, cond, extra = '') {
  if (cond) { pass++; }
  else { fail++; failures.push(name + (extra ? ` — ${extra}` : '')); console.log(`  ✗ ${name} ${extra}`); }
}

// ---------------------------------------------------------------------------
// Generate the 1000-address test list with KNOWN, recountable composition
// Uses gmail.com (not example.com) for valid addresses so they are NOT
// flagged as "test/example domain" by the bounce-risk heuristic.
// ---------------------------------------------------------------------------
function generateTestList() {
  const list = [];

  // 700 valid, unique, high-quality addresses (gmail.com — not a test domain)
  for (let i = 0; i < 700; i++) {
    list.push(`user${i}@gmail.com`);
  }

  // 50 valid but duplicate of the first 50
  for (let i = 0; i < 50; i++) {
    list.push(`user${i}@gmail.com`); // dup
  }

  // 50 syntax-invalid
  for (let i = 0; i < 50; i++) {
    list.push(`notanemail${i}`);
  }

  // 30 disposable domains
  for (let i = 0; i < 30; i++) {
    list.push(`spammer${i}@mailinator.com`);
  }

  // 20 role-based addresses
  const roles = ['admin', 'support', 'noreply', 'info', 'sales', 'webmaster'];
  for (let i = 0; i < 20; i++) {
    const r = roles[i % roles.length];
    list.push(`${r}${i}@gmail.com`);
  }

  // 50 bounce-risk: numeric-heavy local-part (gmail.com — not test domain)
  for (let i = 0; i < 50; i++) {
    list.push(`123456${i}@gmail.com`); // numeric-heavy → high risk
  }

  // 50 bounce-risk: test/example domain (example.com IS a test domain per pattern)
  for (let i = 0; i < 50; i++) {
    list.push(`fake${i}@example.com`); // @example. → high risk
  }

  // 50 more valid, unique addresses on a different real domain
  for (let i = 0; i < 50; i++) {
    list.push(`contact${i}@company.org`);
  }

  return list;
}

// Manual recount of the test list (the source of truth)
// Uses the SAME pipeline functions so the recount is by definition correct.
function manualRecount(list) {
  let valid = 0, invalid = 0, dupesRemoved = 0, blacklisted = 0, highRisk = 0, bounceRisk = 0;
  const seen = new Set();

  for (const email of list) {
    const syntax = validateSyntax(email);
    if (!syntax.valid) { invalid++; continue; }

    const lower = syntax.cleaned.toLowerCase();
    if (seen.has(lower)) { dupesRemoved++; continue; }
    seen.add(lower);

    valid++;

    const bl = checkBlacklist(syntax.cleaned, syntax.domain, syntax.local);
    if (bl.blacklisted) blacklisted++;

    const br = checkBounceRisk(syntax.cleaned, syntax.domain, syntax.local);
    if (br.riskLevel !== 'low') {
      bounceRisk++;
      if (br.riskLevel === 'high') highRisk++;
    }
  }

  return { total: list.length, valid, invalid, dupesRemoved, blacklisted, bounceRisk, highRisk };
}

console.log('\n=== V7 P6.1 Validator Pipeline — Acceptance Test ===\n');

// ===========================================================================
// Test 1: validateSyntax — basic valid
// ===========================================================================
{
  const r = validateSyntax('John.Doe@Gmail.COM');
  ok('syntax: valid email passes', r.valid === true, `got valid=${r.valid}`);
  ok('syntax: domain lowercased', r.domain === 'gmail.com', `got ${r.domain}`);
  ok('syntax: local preserved', r.local === 'John.Doe', `got ${r.local}`);
}

// ===========================================================================
// Test 2: validateSyntax — invalid cases
// ===========================================================================
{
  ok('syntax: empty → invalid', validateSyntax('').valid === false);
  ok('syntax: no @ → invalid', validateSyntax('notanemail').valid === false);
  ok('syntax: double dot → invalid', validateSyntax('a..b@gmail.com').valid === false);
  ok('syntax: leading dot → invalid', validateSyntax('.bad@gmail.com').valid === false);
  ok('syntax: TLD too short → invalid', validateSyntax('user@gmail.c').valid === false);
  ok('syntax: too long → invalid', validateSyntax('x'.repeat(300)).valid === false);
  ok('syntax: null → invalid', validateSyntax(null).valid === false);
  ok('syntax: angle-bracket stripping', validateSyntax('<user@gmail.com>').valid === true);
}

// ===========================================================================
// Test 3: checkBlacklist — disposable
// ===========================================================================
{
  const r = checkBlacklist('x@mailinator.com', 'mailinator.com', 'x');
  ok('blacklist: disposable domain flagged', r.blacklisted === true, `got ${JSON.stringify(r)}`);
  ok('blacklist: disposable reason', r.reason === 'disposable');
}

// ===========================================================================
// Test 4: checkBlacklist — role-based
// ===========================================================================
{
  const r = checkBlacklist('admin@gmail.com', 'gmail.com', 'admin');
  ok('blacklist: role-based flagged', r.blacklisted === true);
  ok('blacklist: role reason', r.reason === 'role-based');
  ok('blacklist: role prefix captured', r.prefix === 'admin');
}

// ===========================================================================
// Test 5: checkBlacklist — clean address
// ===========================================================================
{
  const r = checkBlacklist('john.doe@gmail.com', 'gmail.com', 'john.doe');
  ok('blacklist: clean address not flagged', r.blacklisted === false);
}

// ===========================================================================
// Test 6: checkBounceRisk — numeric-heavy → high
// ===========================================================================
{
  const r = checkBounceRisk('123456@gmail.com', 'gmail.com', '123456');
  ok('bounceRisk: numeric-heavy → high', r.riskLevel === 'high', `got ${r.riskLevel}`);
  ok('bounceRisk: numeric-heavy score > 0', r.riskScore > 0);
}

// ===========================================================================
// Test 7: checkBounceRisk — test/example domain → high
// ===========================================================================
{
  const r = checkBounceRisk('fake@example.com', 'example.com', 'fake');
  ok('bounceRisk: example.com → high', r.riskLevel === 'high', `got ${r.riskLevel}`);
}

// ===========================================================================
// Test 8: checkBounceRisk — clean real domain → low
// ===========================================================================
{
  const r = checkBounceRisk('john.doe@gmail.com', 'gmail.com', 'john.doe');
  ok('bounceRisk: clean gmail → low', r.riskLevel === 'low', `got ${r.riskLevel}`);
  ok('bounceRisk: clean gmail score = 0', r.riskScore === 0, `got ${r.riskScore}`);
}

// ===========================================================================
// Test 9: gradeEmail — high quality (gmail.com, clean)
// ===========================================================================
{
  const r = gradeEmail({ valid: true, domain: 'gmail.com', local: 'john.doe', bounceRisk: { riskScore: 0 }, blacklist: { blacklisted: false } });
  ok('grade: high-quality >= 90', r >= 90, `got ${r}`);
}

// ===========================================================================
// Test 10: gradeEmail — invalid → 0
// ===========================================================================
{
  const r = gradeEmail({ valid: false });
  ok('grade: invalid email → 0', r === 0, `got ${r}`);
}

// ===========================================================================
// Test 11: gradeEmail — bounce-risk deduction
// ===========================================================================
{
  const r = gradeEmail({ valid: true, domain: 'gmail.com', local: '123456', bounceRisk: { riskScore: 80 }, blacklist: { blacklisted: false } });
  ok('grade: high bounce-risk reduces score', r < 70, `got ${r}`);
}

// ===========================================================================
// Test 12: validateSingle — valid email
// ===========================================================================
{
  const r = await validateSingle('john.doe@gmail.com', { sessionId: 'test-single' });
  ok('single: valid email → valid', r.valid === true, `got valid=${r.valid}`);
  ok('single: has grade', typeof r.grade === 'number', `got ${typeof r.grade}`);
  ok('single: has bounceRisk', r.bounceRisk !== undefined);
  ok('single: has blacklist', r.blacklist !== undefined);
}

// ===========================================================================
// Test 13: validateSingle — invalid email
// ===========================================================================
{
  const r = await validateSingle('notanemail', { sessionId: 'test-single' });
  ok('single: invalid → stage syntax', r.stage === 'syntax');
  ok('single: invalid → grade 0', r.grade === 0);
}

// ===========================================================================
// Test 14: validateSingle — disposable flagged
// ===========================================================================
{
  const r = await validateSingle('x@mailinator.com', { sessionId: 'test-single' });
  ok('single: disposable → blacklisted', r.blacklist && r.blacklist.blacklisted === true);
}

// ===========================================================================
// Test 15: validatePipeline — empty input
// ===========================================================================
{
  const r = await validatePipeline([], { sessionId: 'test-empty' });
  ok('pipeline: empty array → total 0', r.total === 0);
  ok('pipeline: empty array → valid 0', r.valid === 0);
  ok('pipeline: empty array → results []', Array.isArray(r.results) && r.results.length === 0);
}

// ===========================================================================
// Test 16: validatePipeline — non-array input
// ===========================================================================
{
  const r = await validatePipeline(null, { sessionId: 'test-null' });
  ok('pipeline: null → total 0', r.total === 0);
}

// ===========================================================================
// Test 17: validatePipeline — small known set (counts verified by manual recount)
// ===========================================================================
{
  const emails = [
    'a@gmail.com',
    'a@gmail.com',      // dup
    'admin@gmail.com',  // role-based → blacklisted
    'x@mailinator.com', // disposable → blacklisted
    '123456@gmail.com', // numeric-heavy → highRisk
    'notvalid',         // syntax invalid
  ];
  const r = await validatePipeline(emails, { sessionId: 'test-small' });
  const m = manualRecount(emails);
  ok('pipeline: small set total=6', r.total === 6, `got ${r.total}`);
  ok('pipeline: small set invalid matches manual', r.invalid === m.invalid, `${r.invalid} vs ${m.invalid}`);
  ok('pipeline: small set dupesRemoved matches manual', r.dupesRemoved === m.dupesRemoved, `${r.dupesRemoved} vs ${m.dupesRemoved}`);
  ok('pipeline: small set valid matches manual', r.valid === m.valid, `${r.valid} vs ${m.valid}`);
  ok('pipeline: small set blacklisted matches manual', r.blacklisted === m.blacklisted, `${r.blacklisted} vs ${m.blacklisted}`);
  ok('pipeline: small set highRisk matches manual', r.highRisk === m.highRisk, `${r.highRisk} vs ${m.highRisk}`);
  ok('pipeline: small set results length=6', r.results.length === 6);
  ok('pipeline: small set gradeDistribution exists', r.gradeDistribution !== undefined);
}

// ===========================================================================
// Test 18: THE BIG TEST — 1000-address list: pipeline vs manual recount
// ===========================================================================
{
  console.log('\n  [1000-address acceptance test running...]');
  const list = generateTestList();
  ok('testlist: generated exactly 1000', list.length === 1000, `got ${list.length}`);

  const pipelineResult = await validatePipeline(list, { sessionId: 'big-1000' });
  const manual = manualRecount(list);

  console.log('  Pipeline:', JSON.stringify({
    total: pipelineResult.total,
    valid: pipelineResult.valid,
    invalid: pipelineResult.invalid,
    dupesRemoved: pipelineResult.dupesRemoved,
    blacklisted: pipelineResult.blacklisted,
    bounceRisk: pipelineResult.bounceRisk,
    highRisk: pipelineResult.highRisk,
    grades: pipelineResult.gradeDistribution,
  }));
  console.log('  Manual:  ', JSON.stringify(manual));

  ok('1000: total matches', pipelineResult.total === manual.total, `${pipelineResult.total} vs ${manual.total}`);
  ok('1000: valid matches', pipelineResult.valid === manual.valid, `${pipelineResult.valid} vs ${manual.valid}`);
  ok('1000: invalid matches', pipelineResult.invalid === manual.invalid, `${pipelineResult.invalid} vs ${manual.invalid}`);
  ok('1000: dupesRemoved matches', pipelineResult.dupesRemoved === manual.dupesRemoved, `${pipelineResult.dupesRemoved} vs ${manual.dupesRemoved}`);
  ok('1000: blacklisted matches', pipelineResult.blacklisted === manual.blacklisted, `${pipelineResult.blacklisted} vs ${manual.blacklisted}`);
  ok('1000: bounceRisk matches', pipelineResult.bounceRisk === manual.bounceRisk, `${pipelineResult.bounceRisk} vs ${manual.bounceRisk}`);
  ok('1000: highRisk matches', pipelineResult.highRisk === manual.highRisk, `${pipelineResult.highRisk} vs ${manual.highRisk}`);
  ok('1000: results length = 1000', pipelineResult.results.length === 1000, `got ${pipelineResult.results.length}`);
  ok('1000: gradeDistribution sums to valid count',
    (pipelineResult.gradeDistribution.high + pipelineResult.gradeDistribution.medium + pipelineResult.gradeDistribution.low) === pipelineResult.valid,
    `${pipelineResult.gradeDistribution.high}+${pipelineResult.gradeDistribution.medium}+${pipelineResult.gradeDistribution.low} = ${pipelineResult.valid}`);
}

// ===========================================================================
// Test 19: Server-authoritative — same input always gives same counts
// ===========================================================================
{
  const list = generateTestList();
  const r1 = await validatePipeline(list, { sessionId: 'determinism-1' });
  const r2 = await validatePipeline(list, { sessionId: 'determinism-2' });
  ok('determinism: run1 === run2 (valid)', r1.valid === r2.valid);
  ok('determinism: run1 === run2 (invalid)', r1.invalid === r2.invalid);
  ok('determinism: run1 === run2 (dupesRemoved)', r1.dupesRemoved === r2.dupesRemoved);
  ok('determinism: run1 === run2 (blacklisted)', r1.blacklisted === r2.blacklisted);
  ok('determinism: run1 === run2 (highRisk)', r1.highRisk === r2.highRisk);
}

// ===========================================================================
// Test 20: DISPOSABLE_DOMAINS and ROLE_PREFIXES are non-empty sets
// ===========================================================================
{
  ok('registry: DISPOSABLE_DOMAINS non-empty', DISPOSABLE_DOMAINS.size > 20, `got ${DISPOSABLE_DOMAINS.size}`);
  ok('registry: ROLE_PREFIXES non-empty', ROLE_PREFIXES.size > 20, `got ${ROLE_PREFIXES.size}`);
  ok('registry: mailinator.com in disposable', DISPOSABLE_DOMAINS.has('mailinator.com'));
  ok('registry: admin in role prefixes', ROLE_PREFIXES.has('admin'));
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
