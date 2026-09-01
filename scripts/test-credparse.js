// ============================================================================
// V7 P3.1 — Credential Parser acceptance test
// Acceptance: 3 shape variants all parse to identical normalized output;
//             invalid entry flagged with reason (not silently dropped).
// Runs in plain Node (ESM). Uses relative import (not @/ alias).
// ============================================================================
import {
  parseCredentialsJson,
  normalizeEntry,
  validateSender,
  SENDER_PROVIDERS,
} from '../src/lib/routing/credentialParser.js';

let pass = 0;
let fail = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    pass++;
    results.push(`  PASS  ${name}`);
  } catch (err) {
    fail++;
    results.push(`  FAIL  ${name}\n        → ${err.message}`);
  }
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
// Shared credential payload (valid gmail + valid smtp) reused across 3 shapes.
// ---------------------------------------------------------------------------
const gmailAcct = {
  email: 'team.alpha@gmail.com',
  displayName: 'Team Alpha',
  client_id: 'google-client-id-123',
  client_secret: 'google-secret-456',
  refresh_token: '1//refresh-token-abc',
  project_id: 'my-project',
};
const smtpAcct = {
  email: 'noreply@corp.example.com',
  displayName: 'Corp No-Reply',
  smtp_host: 'smtp.corp.example.com',
  smtp_port: 587,
  smtp_user: 'noreply@corp.example.com',
  smtp_pass: 'p@ssw0rd',
};

// ---------------------------------------------------------------------------
// Shape 1 — array of accounts
// ---------------------------------------------------------------------------
const shape1 = JSON.stringify([gmailAcct, smtpAcct]);

// Shape 2 — { accounts: [...] }
const shape2 = JSON.stringify({ accounts: [gmailAcct, smtpAcct] });

// Shape 3 — single object (only gmail)
const shape3 = JSON.stringify(gmailAcct);

console.log('\n=== V7 P3.1 Credential Parser — Acceptance Test ===\n');

// --- Test 1: shape variants parse to identical normalized output ---
test('Shape 1 (array) parses 2 senders with correct providers', () => {
  const r = parseCredentialsJson(shape1);
  ok(r.ok, 'parse should succeed');
  eq(r.senders.length, 2, 'sender count');
  eq(r.senders[0].provider, 'gmail', 'sender0 provider');
  eq(r.senders[1].provider, 'smtp', 'sender1 provider');
});

test('Shape 2 ({accounts}) parses identically to Shape 1', () => {
  const r1 = parseCredentialsJson(shape1);
  const r2 = parseCredentialsJson(shape2);
  // Compare only the normalized fields (authFields + meta), ignoring order refs
  const strip = (s) => ({
    email: s.email,
    provider: s.provider,
    displayName: s.displayName,
    status: s.status,
  });
  eq(r1.senders.map(strip), r2.senders.map(strip), 'shape1 vs shape2 normalized');
});

test('Shape 3 (single object) parses the gmail account identically', () => {
  const r3 = parseCredentialsJson(shape3);
  const r1 = parseCredentialsJson(shape1);
  ok(r3.ok, 'parse should succeed');
  eq(r3.senders.length, 1, 'single object → 1 sender');
  eq(
    { email: r3.senders[0].email, provider: r3.senders[0].provider, displayName: r3.senders[0].displayName, status: r3.senders[0].status },
    { email: r1.senders[0].email, provider: r1.senders[0].provider, displayName: r1.senders[0].displayName, status: r1.senders[0].status },
    'shape3 vs shape1[0]',
  );
});

// --- Test 2: invalid entries flagged with reason, never dropped ---
test('Invalid gmail (missing refresh_token) flagged with reason, not dropped', () => {
  const r = parseCredentialsJson(JSON.stringify([
    { email: 'bad@gmail.com', client_id: 'x', client_secret: 'y' }, // no refresh_token
  ]));
  ok(r.ok, 'parse ok=true even with invalid entries');
  eq(r.senders.length, 1, 'invalid entry kept in array');
  eq(r.senders[0].status, 'invalid', 'status=invalid');
  ok(r.senders[0].invalidReason && r.senders[0].invalidReason.length > 0, 'invalidReason present');
  ok(r.errors.length >= 1, 'errors array populated');
});

test('Invalid smtp (missing pass) flagged with reason', () => {
  const r = parseCredentialsJson(JSON.stringify([
    { email: 'x@corp.com', smtp_host: 'smtp.corp.com', smtp_port: 587, smtp_user: 'x@corp.com' },
  ]));
  eq(r.senders[0].status, 'invalid', 'smtp invalid status');
  ok(r.senders[0].invalidReason.includes('SMTP'), 'reason mentions SMTP');
});

test('Invalid email format flagged', () => {
  const r = parseCredentialsJson(JSON.stringify([
    { email: 'not-an-email', refresh_token: 'r', client_id: 'c', client_secret: 's' },
  ]));
  eq(r.senders[0].status, 'invalid', 'bad email → invalid');
  ok(r.senders[0].invalidReason.includes('Invalid email'), 'reason mentions format');
});

test('Invalid JSON string returns ok=false with error', () => {
  const r = parseCredentialsJson('{ not valid json');
  eq(r.ok, false, 'ok=false');
  eq(r.senders.length, 0, 'no senders');
  ok(r.errors.length >= 1, 'errors present');
});

test('Undetectable shape returns ok=false', () => {
  const r = parseCredentialsJson(JSON.stringify({ random: 'object' }));
  eq(r.ok, false, 'ok=false');
  ok(r.errors[0].includes('shape'), 'error mentions shape');
});

// --- Test 3: normalizeEntry + validateSender direct ---
test('normalizeEntry extracts email + displayName + provider', () => {
  const n = normalizeEntry(gmailAcct);
  eq(n.email, 'team.alpha@gmail.com', 'email');
  eq(n.displayName, 'Team Alpha', 'displayName');
  eq(n.provider, 'gmail', 'provider');
  eq(n.status, 'active', 'status');
});

test('normalizeEntry lowercases + trims email', () => {
  const n = normalizeEntry({ email: '  MixedCase@Gmail.COM  ', client_id: 'c', client_secret: 's', refresh_token: 'r' });
  eq(n.email, 'mixedcase@gmail.com', 'lowercased+trimmed');
});

test('validateSender accepts valid gmail with installed config block', () => {
  const n = normalizeEntry({
    email: 'g@gmail.com',
    installed: { client_id: 'installed-id', client_secret: 'sec', project_id: 'p' },
    refresh_token: 'rtok',
  });
  const v = validateSender(n);
  ok(v.valid, 'installed config block should be accepted');
});

test('validateSender accepts valid outlook', () => {
  const n = normalizeEntry({
    email: 'o@outlook.com',
    client_id: 'cid',
    client_secret: 'csec',
    refresh_token: 'rt',
  });
  eq(n.provider, 'outlook', 'provider outlook');
  const v = validateSender(n);
  ok(v.valid, 'valid outlook');
});

test('validateSender rejects outlook missing client_secret', () => {
  const n = normalizeEntry({
    email: 'o@outlook.com',
    client_id: 'cid',
    refresh_token: 'rt',
  });
  const v = validateSender(n);
  ok(!v.valid, 'invalid outlook');
  ok(v.reason.includes('Outlook'), 'reason mentions Outlook');
});

test('validateSender rejects smtp port out of range', () => {
  const n = normalizeEntry({
    email: 's@corp.com',
    smtp_host: 'h', smtp_port: 99999, smtp_user: 's', smtp_pass: 'p',
  });
  const v = validateSender(n);
  ok(!v.valid, 'invalid smtp port');
  ok(v.reason.includes('port'), 'reason mentions port');
});

test('SENDER_PROVIDERS contains gmail/outlook/smtp', () => {
  eq(SENDER_PROVIDERS, ['gmail', 'outlook', 'smtp'], 'providers list');
});

test('Mixed valid+invalid batch: valid stays active, invalid flagged', () => {
  const r = parseCredentialsJson(JSON.stringify([
    gmailAcct,
    { email: 'bad@gmail.com', client_id: 'x' }, // invalid
    smtpAcct,
  ]));
  eq(r.senders.length, 3, 'all 3 kept');
  eq(r.senders[0].status, 'active', 'sender0 active');
  eq(r.senders[1].status, 'invalid', 'sender1 invalid');
  eq(r.senders[2].status, 'active', 'sender2 active');
});

// ---------------------------------------------------------------------------
console.log(results.join('\n'));
console.log(`\n  Total: ${pass + fail} | PASS: ${pass} | FAIL: ${fail}`);
console.log(`\n=== P3.1 RESULT: ${fail === 0 ? 'ALL PASS ✓' : 'HAS FAILURES ✗'} ===\n`);
process.exit(fail === 0 ? 0 : 1);
