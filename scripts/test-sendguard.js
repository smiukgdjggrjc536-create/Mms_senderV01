// ============================================================================
// V7 P6.3 ACCEPTANCE — Zero-Crash Verification test
// Run: node --experimental-loader ./scripts/alias-loader.mjs scripts/run-test.mjs scripts/test-sendguard.js
// ============================================================================
// Verifies:
//   a) Kill Redis mid-send → campaign auto-pauses, state saved, resumes correctly
//   b) Simulated provider 500 → backoff retry, no crash, no lost state
//   c) Quota exceeded → auto-pause + Bangla message
//   d) All failure modes classified correctly
//   e) Backoff is exponential, max 5 retries, capped at 30s
// ============================================================================

import {
  MAX_RETRIES,
  BACKOFF_BASE_MS,
  BACKOFF_MAX_MS,
  FAILURE_MODES,
  BANGLA_ERROR_MESSAGES,
  computeBackoffDelay,
  withRetry,
  withSendGuard,
  pauseCampaign,
  saveCampaignState,
  resumeCampaign,
  isCampaignPaused,
  getCampaignState,
  classifyError,
  getBanglaError,
} from '../src/lib/resilience/sendGuard.js';

let pass = 0, fail = 0;
const failures = [];

function ok(name, cond, extra = '') {
  if (cond) { pass++; }
  else { fail++; failures.push(name + (extra ? ` — ${extra}` : '')); console.log(`  ✗ ${name} ${extra}`); }
}

console.log('\n=== V7 P6.3 Zero-Crash Verification — Acceptance Test ===\n');

// ===========================================================================
// Test 1: Constants are correct
// ===========================================================================
{
  ok('MAX_RETRIES = 5', MAX_RETRIES === 5, `got ${MAX_RETRIES}`);
  ok('BACKOFF_BASE_MS = 1000', BACKOFF_BASE_MS === 1000);
  ok('BACKOFF_MAX_MS = 30000', BACKOFF_MAX_MS === 30000);
}

// ===========================================================================
// Test 2: Backoff is exponential and capped
// ===========================================================================
{
  ok('backoff(0) = 1000', computeBackoffDelay(0) === 1000, `got ${computeBackoffDelay(0)}`);
  ok('backoff(1) = 2000', computeBackoffDelay(1) === 2000, `got ${computeBackoffDelay(1)}`);
  ok('backoff(2) = 4000', computeBackoffDelay(2) === 4000, `got ${computeBackoffDelay(2)}`);
  ok('backoff(3) = 8000', computeBackoffDelay(3) === 8000, `got ${computeBackoffDelay(3)}`);
  ok('backoff(4) = 16000', computeBackoffDelay(4) === 16000, `got ${computeBackoffDelay(4)}`);
  ok('backoff(10) capped at 30000', computeBackoffDelay(10) === 30000, `got ${computeBackoffDelay(10)}`);
}

// ===========================================================================
// Test 3: All failure modes have Bangla messages
// ===========================================================================
{
  for (const mode of Object.values(FAILURE_MODES)) {
    const msg = BANGLA_ERROR_MESSAGES[mode];
    ok(`bangla[${mode}]: has message`, typeof msg === 'string' && msg.length > 10, `got "${msg}"`);
  }
}

// ===========================================================================
// Test 4: Error classification — all modes
// ===========================================================================
{
  ok('classify: 500 → provider_500', classifyError({ status: 500 }) === FAILURE_MODES.PROVIDER_500);
  ok('classify: 502 → provider_500', classifyError({ status: 502 }) === FAILURE_MODES.PROVIDER_500);
  ok('classify: 503 → provider_500', classifyError({ status: 503 }) === FAILURE_MODES.PROVIDER_500);
  ok('classify: 429 → provider_429', classifyError({ status: 429 }) === FAILURE_MODES.PROVIDER_429);
  ok('classify: 401 → auth_failure', classifyError({ status: 401 }) === FAILURE_MODES.AUTH_FAILURE);
  ok('classify: 403 → auth_failure', classifyError({ status: 403 }) === FAILURE_MODES.AUTH_FAILURE);
  ok('classify: ECONNRESET → network_error', classifyError({ code: 'ECONNRESET' }) === FAILURE_MODES.NETWORK_ERROR);
  ok('classify: ETIMEDOUT → network_error', classifyError({ code: 'ETIMEDOUT' }) === FAILURE_MODES.NETWORK_ERROR);
  ok('classify: ENOTFOUND → network_error', classifyError({ code: 'ENOTFOUND' }) === FAILURE_MODES.NETWORK_ERROR);
  ok('classify: redis error → redis_down', classifyError({ message: 'Redis connection refused' }) === FAILURE_MODES.REDIS_DOWN);
  ok('classify: mongo error → mongo_down', classifyError({ message: 'MongoDB connection failed' }) === FAILURE_MODES.MONGO_DOWN);
  ok('classify: quota → quota_exceeded', classifyError({ message: 'quota limit exceeded' }) === FAILURE_MODES.QUOTA_EXCEEDED);
  ok('classify: 400 → api_failure', classifyError({ status: 400 }) === FAILURE_MODES.API_FAILURE);
  ok('classify: null → unknown', classifyError(null) === FAILURE_MODES.UNKNOWN);
}

// ===========================================================================
// Test 5: getBanglaError returns correct message
// ===========================================================================
{
  ok('bangla: provider_500 has message', getBanglaError(FAILURE_MODES.PROVIDER_500).includes('500'));
  ok('bangla: redis_down has message', getBanglaError(FAILURE_MODES.REDIS_DOWN).includes('Redis'));
  ok('bangla: quota has message', getBanglaError(FAILURE_MODES.QUOTA_EXCEEDED).includes('সীমা'));
  ok('bangla: unknown mode → fallback', getBanglaError('nonexistent').includes('অজানা'));
}

// ===========================================================================
// Test 6: withRetry — succeeds on first attempt
// ===========================================================================
{
  let calls = 0;
  const result = await withRetry(async () => {
    calls++;
    return 'success';
  }, { maxRetries: 3 });
  ok('withRetry: success first try', result === 'success');
  ok('withRetry: called once', calls === 1, `got ${calls}`);
}

// ===========================================================================
// Test 7: withRetry — succeeds on retry (fails twice then succeeds)
// ===========================================================================
{
  let calls = 0;
  const result = await withRetry(async (attempt) => {
    calls++;
    if (calls < 3) throw { status: 500, message: 'server error' };
    return 'success-on-retry';
  }, { maxRetries: 5, onRetry: () => {} });
  ok('withRetry: succeeds on 3rd try', result === 'success-on-retry');
  ok('withRetry: called 3 times', calls === 3, `got ${calls}`);
}

// ===========================================================================
// Test 8: withRetry — exhausts retries and throws
// ===========================================================================
{
  let calls = 0;
  let threw = false;
  try {
    await withRetry(async () => {
      calls++;
      throw { status: 500, message: 'always fails' };
    }, { maxRetries: 2 });
  } catch (err) {
    threw = true;
  }
  ok('withRetry: throws after exhausting', threw);
  ok('withRetry: called 3 times (0+1+2)', calls === 3, `got ${calls}`);
}

// ===========================================================================
// Test 9: withRetry — terminal errors (quota) don't retry
// ===========================================================================
{
  let calls = 0;
  let threw = false;
  try {
    await withRetry(async () => {
      calls++;
      throw { message: 'quota limit exceeded' };
    }, { maxRetries: 5 });
  } catch {
    threw = true;
  }
  ok('withRetry: terminal error no retry', calls === 1, `got ${calls}`);
  ok('withRetry: terminal error throws', threw);
}

// ===========================================================================
// Test 10: withSendGuard — success path
// ===========================================================================
{
  const result = await withSendGuard('camp-test-success', async () => {
    return { sent: 1, status: 'ok' };
  });
  ok('sendGuard: ok=true on success', result.ok === true);
  ok('sendGuard: no error on success', result.error === null);
  ok('sendGuard: not paused on success', result.paused === false);
  ok('sendGuard: attempts=1 on success', result.attempts === 1);
}

// ===========================================================================
// Test 11: withSendGuard — ACCEPTANCE (b): provider 500 → backoff retry, no crash, no lost state
// ===========================================================================
{
  console.log('\n  [Acceptance (b): provider 500 → backoff retry, no crash, no lost state]');
  let calls = 0;
  const retries = [];

  const result = await withSendGuard('camp-500', async (attempt) => {
    calls++;
    if (calls < 3) throw { status: 500, message: 'Internal Server Error' };
    return { sent: calls, status: 'recovered' };
  }, {
    maxRetries: 5,
    onRetry: (info) => { retries.push({ attempt: info.attempt, delay: info.delay, mode: info.mode }); },
    progress: { sent: 0, total: 100 },
  });

  ok('500: eventually succeeds (ok=true)', result.ok === true);
  ok('500: no crash (result has status)', result.result && result.result.status === 'recovered');
  ok('500: called 3 times', calls === 3, `got ${calls}`);
  ok('500: retried twice', retries.length === 2, `got ${retries.length}`);
  ok('500: retry mode = provider_500', retries[0] && retries[0].mode === FAILURE_MODES.PROVIDER_500);
  ok('500: backoff is exponential (1s, 2s)', retries[0] && retries[1] && retries[0].delay === 1000 && retries[1].delay === 2000, JSON.stringify(retries));
  ok('500: not paused (recovered)', result.paused === false);
}

// ===========================================================================
// Test 12: withSendGuard — ACCEPTANCE (b2): persistent 500 → auto-pause + state saved
// ===========================================================================
{
  console.log('\n  [Acceptance (b2): persistent 500 → auto-pause + state saved]');
  let calls = 0;

  const result = await withSendGuard('camp-persistent-500', async () => {
    calls++;
    throw { status: 500, message: 'Internal Server Error' };
  }, {
    maxRetries: 3,
    onRetry: () => {},
    progress: { sent: 42, total: 100 },
  });

  ok('persistent-500: ok=false', result.ok === false);
  ok('persistent-500: paused=true', result.paused === true);
  ok('persistent-500: no crash', result.error !== null && result.failureMode === FAILURE_MODES.PROVIDER_500);
  ok('persistent-500: has Bangla message', typeof result.banglaMessage === 'string' && result.banglaMessage.includes('500'));
  ok('persistent-500: called 4 times (0+1+2+3)', calls === 4, `got ${calls}`);

  // Verify state was saved
  const state = await getCampaignState('camp-persistent-500');
  ok('persistent-500: state saved', state !== null);
  ok('persistent-500: state status=paused', state && state.status === 'paused');
  ok('persistent-500: state has failureMode', state && state.failureMode === FAILURE_MODES.PROVIDER_500);
}

// ===========================================================================
// Test 13: withSendGuard — ACCEPTANCE (c): quota exceeded → auto-pause + Bangla
// ===========================================================================
{
  console.log('\n  [Acceptance (c): quota exceeded → auto-pause + Bangla message]');
  let calls = 0;
  let pausedInfo = null;

  const result = await withSendGuard('camp-quota', async () => {
    calls++;
    throw { message: 'quota limit exceeded' };
  }, {
    maxRetries: 5,
    onPause: (info) => { pausedInfo = info; },
    progress: { sent: 100, total: 100 },
  });

  ok('quota: ok=false', result.ok === false);
  ok('quota: paused=true', result.paused === true);
  ok('quota: failureMode=quota_exceeded', result.failureMode === FAILURE_MODES.QUOTA_EXCEEDED);
  ok('quota: Bangla message has সীমা', result.banglaMessage.includes('সীমা'));
  ok('quota: no retry (terminal)', calls === 1, `got ${calls}`);
  ok('quota: onPause called', pausedInfo !== null);
  ok('quota: onPause terminal=true', pausedInfo && pausedInfo.terminal === true);

  // Verify state
  const state = await getCampaignState('camp-quota');
  ok('quota: state saved with reason', state && state.reason.includes('quota'));
}

// ===========================================================================
// Test 14: ACCEPTANCE (a): Kill Redis mid-send → auto-pause + state saved + resumes
// ===========================================================================
{
  console.log('\n  [Acceptance (a): Kill Redis mid-send → auto-pause, state saved, resumes]');

  // Simulate: send fails with Redis-down error on every call
  let calls = 0;
  const result = await withSendGuard('camp-redis-down', async () => {
    calls++;
    throw { message: 'Redis connection refused on port 6379' };
  }, {
    maxRetries: 2,
    onRetry: () => {},
    progress: { sent: 5, total: 100 },
  });

  // Redis-down is retryable, so it retries (max 2), then pauses
  ok('redis-down: paused=true', result.paused === true);
  ok('redis-down: failureMode=redis_down', result.failureMode === FAILURE_MODES.REDIS_DOWN, `got ${result.failureMode}`);
  ok('redis-down: Bangla has Redis', result.banglaMessage.includes('Redis'));

  // Verify state saved
  const state = await getCampaignState('camp-redis-down');
  ok('redis-down: state saved', state !== null);
  ok('redis-down: state status=paused', state && state.status === 'paused');

  // Now simulate Redis comes back — resume
  const resumeResult = await resumeCampaign('camp-redis-down');
  ok('redis-down: resume returns state', resumeResult.state !== null);
  ok('redis-down: resume status=resumed', resumeResult.state && resumeResult.state.status === 'resumed');
  ok('redis-down: not paused after resume', await isCampaignPaused('camp-redis-down') === false);
}

// ===========================================================================
// Test 15: Network error → retry + backoff
// ===========================================================================
{
  let calls = 0;
  const result = await withSendGuard('camp-network', async (attempt) => {
    calls++;
    if (attempt < 1) throw { code: 'ECONNRESET', message: 'connection reset' };
    return { sent: 1, status: 'ok' };
  }, { maxRetries: 3, onRetry: () => {} });

  ok('network: recovers after retry', result.ok === true);
  ok('network: called 2 times', calls === 2, `got ${calls}`);
}

// ===========================================================================
// Test 16: Auth failure → terminal, no retry, pause
// ===========================================================================
{
  let calls = 0;
  const result = await withSendGuard('camp-auth', async () => {
    calls++;
    throw { status: 401, message: 'Unauthorized' };
  }, { maxRetries: 5, onRetry: () => {} });

  ok('auth: paused=true', result.paused === true);
  ok('auth: failureMode=auth_failure', result.failureMode === FAILURE_MODES.AUTH_FAILURE);
  ok('auth: no retry (terminal)', calls === 1, `got ${calls}`);
  ok('auth: Bangla has প্রমাণীকরণ', result.banglaMessage.includes('প্রমাণীকরণ'));
}

// ===========================================================================
// Test 17: pauseCampaign / resumeCampaign round-trip
// ===========================================================================
{
  await pauseCampaign('camp-rt', 'manual test', {
    failureMode: FAILURE_MODES.NETWORK_ERROR,
    error: new Error('test'),
    progress: { sent: 50, total: 200 },
  });

  ok('rt: isPaused=true after pause', await isCampaignPaused('camp-rt') === true);

  const state = await getCampaignState('camp-rt');
  ok('rt: state has reason', state && state.reason === 'manual test');
  ok('rt: state has progress', state && state.progress && state.progress.sent === 50);

  const resumeResult = await resumeCampaign('camp-rt');
  ok('rt: resumed', resumeResult.state && resumeResult.state.status === 'resumed');
  ok('rt: not paused after resume', await isCampaignPaused('camp-rt') === false);
}

// ===========================================================================
// Test 18: saveCampaignState checkpoint
// ===========================================================================
{
  const saved = await saveCampaignState('camp-checkpoint', { sent: 75, total: 100 });
  ok('checkpoint: saved=true', saved === true);

  const resumeResult = await resumeCampaign('camp-checkpoint');
  ok('checkpoint: resume has checkpoint', resumeResult.checkpoint !== null);
  ok('checkpoint: progress preserved', resumeResult.checkpoint && resumeResult.checkpoint.progress.sent === 75);
}

// ===========================================================================
// Test 19: withSendGuard returns attempts count
// ===========================================================================
{
  let calls = 0;
  const result = await withSendGuard('camp-attempts', async () => {
    calls++;
    if (calls < 3) throw { status: 500, message: 'fail' };
    return 'ok';
  }, { maxRetries: 5, onRetry: () => {} });

  ok('attempts: count=3 on success-after-retry', result.attempts === 3, `got ${result.attempts}`);
}

// ===========================================================================
// Test 20: No crash path — unknown error still handled gracefully
// ===========================================================================
{
  const result = await withSendGuard('camp-unknown', async () => {
    throw new Error('something completely unexpected');
  }, { maxRetries: 1, onRetry: () => {} });

  ok('unknown: ok=false', result.ok === false);
  ok('unknown: paused=true', result.paused === true);
  ok('unknown: has banglaMessage', typeof result.banglaMessage === 'string' && result.banglaMessage.length > 10);
  ok('unknown: failureMode=unknown', result.failureMode === FAILURE_MODES.UNKNOWN);
  ok('unknown: no crash (returned result)', result !== null && typeof result === 'object');
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
