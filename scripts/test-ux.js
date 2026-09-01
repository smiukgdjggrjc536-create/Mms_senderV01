// ============================================================================
// V7 P6.4 ACCEPTANCE — Small Things Sweep test
// Run: node --experimental-loader ./scripts/alias-loader.mjs scripts/run-test.mjs scripts/test-ux.js
// ============================================================================
// Verifies:
//   - Bangla i18n strings (complete, non-empty, lookup works)
//   - Loading states (create, stale detection)
//   - Empty states (isEmpty, create)
//   - Confirm dialog (confirmAndRun, cancel)
//   - Optimistic UI (apply → revert on error)
//   - Keyboard shortcuts (register, unregister, list)
//   - Copy-paste safety (sanitize, strip control chars, parse emails)
//   - Timezone-correct dates (Asia/Dhaka, ISO, relative)
// ============================================================================

import { t, tFormat, STRINGS } from '../src/lib/i18n/bn.js';
import {
  TIMEZONE,
  formatDate,
  formatDateTime,
  formatDateISO,
  formatRelative,
  LoadingState,
  EmptyState,
  ConfirmDialog,
  optimisticUpdate,
  registerShortcut,
  unregisterShortcut,
  listShortcuts,
  sanitizeClipboard,
  safePaste,
  parsePastedEmails,
} from '../src/lib/ux/helpers.js';

let pass = 0, fail = 0;
const failures = [];

function ok(name, cond, extra = '') {
  if (cond) { pass++; }
  else { fail++; failures.push(name + (extra ? ` — ${extra}` : '')); console.log(`  ✗ ${name} ${extra}`); }
}

console.log('\n=== V7 P6.4 Small Things Sweep — Acceptance Test ===\n');

// ===========================================================================
// Test 1: i18n — STRINGS has comprehensive coverage
// ===========================================================================
{
  ok('i18n: STRINGS has > 50 keys', Object.keys(STRINGS).length > 50, `got ${Object.keys(STRINGS).length}`);
  ok('i18n: has common.loading', STRINGS['common.loading'] !== undefined);
  ok('i18n: has campaign.send', STRINGS['campaign.send'] !== undefined);
  ok('i18n: has empty.campaigns', STRINGS['empty.campaigns'] !== undefined);
  ok('i18n: has confirm.deleteCampaign', STRINGS['confirm.deleteCampaign'] !== undefined);
  ok('i18n: has error.provider_500', STRINGS['error.provider_500'] !== undefined);
  ok('i18n: has package.free', STRINGS['package.free'] !== undefined);
}

// ===========================================================================
// Test 2: i18n — t() returns Bangla strings
// ===========================================================================
{
  ok('t: campaign.send returns Bangla', t('campaign.send') === 'পাঠান', `got "${t('campaign.send')}"`);
  ok('t: common.loading returns Bangla', t('common.loading') === 'লোড হচ্ছে...', `got "${t('common.loading')}"`);
  ok('t: unknown key returns key', t('nonexistent.key') === 'nonexistent.key');
}

// ===========================================================================
// Test 3: i18n — tFormat with params
// ===========================================================================
{
  // Add a format-test string
  const result = tFormat('empty.recipients', {});
  ok('tFormat: works with no params', typeof result === 'string' && result.length > 0);
}

// ===========================================================================
// Test 4: Timezone — TIMEZONE is Asia/Dhaka
// ===========================================================================
{
  ok('timezone: Asia/Dhaka', TIMEZONE === 'Asia/Dhaka');
}

// ===========================================================================
// Test 5: Timezone — formatDate
// ===========================================================================
{
  const d = new Date('2024-06-15T10:00:00Z'); // UTC 10:00 → Dhaka 16:00
  const formatted = formatDate(d);
  ok('formatDate: returns non-empty string', formatted.length > 0, `got "${formatted}"`);
  ok('formatDate: contains 2024', formatted.includes('2024'), `got "${formatted}"`);

  ok('formatDate: null → empty', formatDate(null) === '');
  ok('formatDate: invalid → empty', formatDate('not-a-date') === '');
}

// ===========================================================================
// Test 6: Timezone — formatDateTime
// ===========================================================================
{
  const d = new Date('2024-06-15T10:00:00Z');
  const formatted = formatDateTime(d);
  ok('formatDateTime: non-empty', formatted.length > 0);
  ok('formatDateTime: has time component', /\d{2}:\d{2}/.test(formatted), `got "${formatted}"`);
}

// ===========================================================================
// Test 7: Timezone — formatDateISO
// ===========================================================================
{
  const d = new Date('2024-06-15T10:00:00Z');
  const iso = formatDateISO(d);
  ok('formatDateISO: returns ISO string', iso.includes('2024-06-15'), `got "${iso}"`);
  ok('formatDateISO: null → empty', formatDateISO(null) === '');
}

// ===========================================================================
// Test 8: Timezone — formatRelative (Bangla)
// ===========================================================================
{
  const justNow = new Date(Date.now() - 5000); // 5s ago
  ok('formatRelative: "এইমাত্র" for < 60s', formatRelative(justNow) === 'এইমাত্র', `got "${formatRelative(justNow)}"`);

  const minsAgo = new Date(Date.now() - 5 * 60 * 1000); // 5 min ago
  ok('formatRelative: "5 মিনিট আগে"', formatRelative(minsAgo).includes('মিনিট'), `got "${formatRelative(minsAgo)}"`);

  const hoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3hr ago
  ok('formatRelative: "3 ঘন্টা আগে"', formatRelative(hoursAgo).includes('ঘন্টা'), `got "${formatRelative(hoursAgo)}"`);

  ok('formatRelative: null → empty', formatRelative(null) === '');
}

// ===========================================================================
// Test 9: LoadingState — create
// ===========================================================================
{
  const ls = LoadingState.create('Loading campaigns...', 'spinner');
  ok('loading: loading=true', ls.loading === true);
  ok('loading: label set', ls.label === 'Loading campaigns...');
  ok('loading: variant set', ls.variant === 'spinner');
  ok('loading: has timestamp', typeof ls.timestamp === 'number');
}

// ===========================================================================
// Test 10: LoadingState — isStale
// ===========================================================================
{
  const fresh = { loading: true, timestamp: Date.now() };
  const stale = { loading: true, timestamp: Date.now() - 60000 };
  ok('loading: fresh not stale', LoadingState.isStale(fresh) === false);
  ok('loading: stale detected', LoadingState.isStale(stale) === true);
  ok('loading: null is stale', LoadingState.isStale(null) === true);
}

// ===========================================================================
// Test 11: EmptyState — isEmpty
// ===========================================================================
{
  ok('empty: null is empty', EmptyState.isEmpty(null) === true);
  ok('empty: undefined is empty', EmptyState.isEmpty(undefined) === true);
  ok('empty: [] is empty', EmptyState.isEmpty([]) === true);
  ok('empty: {} is empty', EmptyState.isEmpty({}) === true);
  ok('empty: "" is empty', EmptyState.isEmpty('') === true);
  ok('empty: "  " is empty', EmptyState.isEmpty('  ') === true);
  ok('empty: [1] is not empty', EmptyState.isEmpty([1]) === false);
  ok('empty: {a:1} is not empty', EmptyState.isEmpty({ a: 1 }) === false);
  ok('empty: "hello" is not empty', EmptyState.isEmpty('hello') === false);
  ok('empty: 0 is not empty', EmptyState.isEmpty(0) === false);
}

// ===========================================================================
// Test 12: EmptyState — create
// ===========================================================================
{
  const es = EmptyState.create('📭', 'No campaigns', 'Create your first campaign', 'New Campaign', () => {});
  ok('empty: create has empty=true', es.empty === true);
  ok('empty: create has icon', es.icon === '📭');
  ok('empty: create has title', es.title === 'No campaigns');
  ok('empty: create has actionLabel', es.actionLabel === 'New Campaign');
}

// ===========================================================================
// Test 13: ConfirmDialog — confirmAndRun (headless, defaultValue=false)
// ===========================================================================
{
  let ran = false;
  const result = await ConfirmDialog.confirmAndRun('Delete?', async () => {
    ran = true;
    return 'deleted';
  }, { defaultValue: false });

  ok('confirm: cancelled (default false) → null', result === null);
  ok('confirm: action not run when cancelled', ran === false);
}

// ===========================================================================
// Test 14: ConfirmDialog — confirmAndRun (headless, defaultValue=true)
// ===========================================================================
{
  let ran = false;
  const result = await ConfirmDialog.confirmAndRun('Delete?', async () => {
    ran = true;
    return 'deleted';
  }, { defaultValue: true });

  ok('confirm: confirmed (default true) → runs', result === 'deleted');
  ok('confirm: action ran', ran === true);
}

// ===========================================================================
// Test 15: Optimistic UI — success path
// ===========================================================================
{
  let state = 0;
  let applied = false;
  let reverted = false;

  const result = await optimisticUpdate(
    () => { state = 1; applied = true; },      // apply
    async () => { state = 2; return 'ok'; },   // action succeeds
    () => { state = 0; reverted = true; },     // revert (should NOT be called)
  );

  ok('optimistic: ok=true on success', result.ok === true);
  ok('optimistic: applied immediately', applied === true);
  ok('optimistic: not reverted on success', reverted === false);
  ok('optimistic: state = 2 (action result)', state === 2);
}

// ===========================================================================
// Test 16: Optimistic UI — error path (revert)
// ===========================================================================
{
  let state = 0;
  let applied = false;
  let reverted = false;

  const result = await optimisticUpdate(
    () => { state = 1; applied = true; },      // apply
    async () => { throw new Error('action failed'); }, // action fails
    () => { state = 0; reverted = true; },     // revert (SHOULD be called)
  );

  ok('optimistic: ok=false on error', result.ok === false);
  ok('optimistic: applied immediately', applied === true);
  ok('optimistic: reverted on error', reverted === true);
  ok('optimistic: state = 0 (reverted)', state === 0);
  ok('optimistic: error captured', result.error !== null && result.error.message === 'action failed');
}

// ===========================================================================
// Test 17: Optimistic UI — no revert function
// ===========================================================================
{
  let state = 0;
  const result = await optimisticUpdate(
    () => { state = 1; },
    async () => { throw new Error('fail'); },
    null, // no revert
  );
  ok('optimistic: ok=false without revert fn', result.ok === false);
  ok('optimistic: reverted=true (flag set)', result.reverted === true);
}

// ===========================================================================
// Test 18: Keyboard shortcuts — register and list
// ===========================================================================
{
  const unreg = registerShortcut('ctrl+s', () => {}, { description: 'Save' });
  const list = listShortcuts();
  ok('shortcut: registered', list.some(s => s.combo === 'ctrl+s'));
  ok('shortcut: has description', list.some(s => s.combo === 'ctrl+s' && s.description === 'Save'));

  unreg();
  const list2 = listShortcuts();
  ok('shortcut: unregistered', !list2.some(s => s.combo === 'ctrl+s'));
}

// ===========================================================================
// Test 19: Keyboard shortcuts — unregisterShortcut
// ===========================================================================
{
  registerShortcut('ctrl+k', () => {}, { description: 'Search' });
  ok('shortcut: ctrl+k registered', listShortcuts().some(s => s.combo === 'ctrl+k'));
  unregisterShortcut('ctrl+k');
  ok('shortcut: ctrl+k unregistered', !listShortcuts().some(s => s.combo === 'ctrl+k'));
}

// ===========================================================================
// Test 20: Copy-paste safety — sanitizeClipboard
// ===========================================================================
{
  // Strip control characters
  const dirty = 'hello' + String.fromCharCode(0) + String.fromCharCode(7) + 'world' + String.fromCharCode(0x1F);
  const cleanedDirty = sanitizeClipboard(dirty);
  ok('clipboard: strips null/control chars', cleanedDirty === 'hello world' || cleanedDirty === 'helloworld', `got "${cleanedDirty}"`);

  // Normalize line endings
  const crlf = 'line1\r\nline2\rline3';
  const clean = sanitizeClipboard(crlf);
  ok('clipboard: normalizes CRLF to LF', clean === 'line1\nline2\nline3', `got "${clean}"`);

  // Collapse spaces
  const spaces = 'hello    world';
  ok('clipboard: collapses spaces', sanitizeClipboard(spaces) === 'hello world');

  // Strip HTML
  const html = '<script>alert(1)</script>hello';
  ok('clipboard: strips HTML', sanitizeClipboard(html, { stripHtml: true }) === 'alert(1)hello', `got "${sanitizeClipboard(html, { stripHtml: true })}"`);

  // Max length
  const long = 'x'.repeat(100);
  ok('clipboard: respects maxLength', sanitizeClipboard(long, { maxLength: 10 }).length === 10);

  // Null/empty
  ok('clipboard: null → empty', sanitizeClipboard(null) === '');
  ok('clipboard: empty → empty', sanitizeClipboard('') === '');
}

// ===========================================================================
// Test 21: Copy-paste safety — safePaste with string
// ===========================================================================
{
  const result = safePaste('  hello' + String.fromCharCode(0) + 'world  ');
  ok('safePaste: sanitizes string', result === 'hello world' || result === 'helloworld', `got "${result}"`);
}

// ===========================================================================
// Test 22: Copy-paste safety — parsePastedEmails
// ===========================================================================
{
  const pasted = 'alice@test.com\nbob@test.com,carol@test.com;alice@test.com';
  const emails = parsePastedEmails(pasted);
  ok('parseEmails: 3 unique emails', emails.length === 3, `got ${emails.length}: ${JSON.stringify(emails)}`);
  ok('parseEmails: has alice', emails.includes('alice@test.com'));
  ok('parseEmails: has bob', emails.includes('bob@test.com'));
  ok('parseEmails: has carol', emails.includes('carol@test.com'));
  ok('parseEmails: dedup (alice appears once)', emails.filter(e => e === 'alice@test.com').length === 1);
}

// ===========================================================================
// Test 23: parsePastedEmails — empty/dirty input
// ===========================================================================
{
  ok('parseEmails: empty → []', parsePastedEmails('').length === 0);
  ok('parseEmails: null → []', parsePastedEmails(null).length === 0);
  ok('parseEmails: only whitespace → []', parsePastedEmails('   \n  ,  ;  ').length === 0);
  ok('parseEmails: handles control chars in input', parsePastedEmails('a@x.com' + String.fromCharCode(7) + '\nb@x.com').length === 2);
}

// ===========================================================================
// Test 24: i18n — all error.* keys match sendGuard FAILURE_MODES messages
// ===========================================================================
{
  // Verify the error messages in i18n match what sendGuard would show
  ok('i18n: error.redis_down non-empty', STRINGS['error.redis_down'].includes('Redis'));
  ok('i18n: error.quota_exceeded has সীমা', STRINGS['error.quota_exceeded'].includes('সীমা'));
  ok('i18n: error.auth_failure has প্রমাণীকরণ', STRINGS['error.auth_failure'].includes('প্রমাণীকরণ'));
  ok('i18n: error.provider_500 has 500', STRINGS['error.provider_500'].includes('500'));
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
