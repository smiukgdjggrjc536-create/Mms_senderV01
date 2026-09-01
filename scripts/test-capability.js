// ============================================================================
// V7 P3.2 — Capability Probe acceptance test
// Acceptance:
//   a) Unit test with mocked provider responses → capability object correct
//      per provider type; cache path exercised (second call reads cache).
//   b) Build passes.
// ============================================================================
import {
  probeSender,
  probeSenders,
  getCachedCapabilities,
  needsReprobe,
  registerLiveVerifier,
  clearLiveVerifier,
  liveProbeHook,
  STATIC_CAPABILITY_TABLE,
  CAPABILITY_PROBE_TTL_MS,
} from '../src/lib/routing/capabilityProbe.js';

let pass = 0;
let fail = 0;
const results = [];
const pending = [];

function test(name, fn) {
  const p = Promise.resolve().then(fn).then(() => {
    pass++;
    results.push(`  PASS  ${name}`);
  }).catch((err) => {
    fail++;
    results.push(`  FAIL  ${name}\n        → ${err.message}`);
  });
  pending.push(p);
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

async function main() {
  console.log('\n=== V7 P3.2 Capability Probe — Acceptance Test ===\n');

  // Ensure live mode is OFF for static-table tests
  delete process.env.CAPABILITY_PROBE_LIVE;
  clearLiveVerifier();

  // --- Static capability table correctness per provider ---
  await test('gmail static caps: no spoofing, dynamic routing, 20 aliases, 500/day', async () => {
    const caps = await probeSender({ email: 'g@gmail.com', provider: 'gmail' });
    eq(caps.supportsSpoofing, false, 'gmail spoofing');
    eq(caps.supportsDynamicRouting, true, 'gmail dynamic routing');
    eq(caps.maxFromAddresses, 20, 'gmail maxFrom');
    eq(caps.dailyLimitEstimate, 500, 'gmail dailyLimit');
    eq(caps.provider, 'gmail', 'provider');
    eq(caps.fromCache, false, 'first probe not from cache');
  });

  await test('outlook static caps: no spoofing, no dynamic routing, 1 alias, 300/day', async () => {
    const caps = await probeSender({ email: 'o@outlook.com', provider: 'outlook' });
    eq(caps.supportsSpoofing, false, 'outlook spoofing');
    eq(caps.supportsDynamicRouting, false, 'outlook dynamic routing');
    eq(caps.maxFromAddresses, 1, 'outlook maxFrom');
    eq(caps.dailyLimitEstimate, 300, 'outlook dailyLimit');
  });

  await test('smtp static caps: spoofing yes, dynamic routing yes, 50 aliases, 1000/day', async () => {
    const caps = await probeSender({ email: 's@corp.com', provider: 'smtp' });
    eq(caps.supportsSpoofing, true, 'smtp spoofing');
    eq(caps.supportsDynamicRouting, true, 'smtp dynamic routing');
    eq(caps.maxFromAddresses, 50, 'smtp maxFrom');
    eq(caps.dailyLimitEstimate, 1000, 'smtp dailyLimit');
  });

  // --- Cache path: second call reads cache ---
  await test('Cache path: sender with fresh probedAt returns fromCache=true', async () => {
    const freshSender = {
      email: 'cached@gmail.com',
      provider: 'gmail',
      capabilities: { supportsSpoofing: false, supportsDynamicRouting: true, maxFromAddresses: 15, dailyLimitEstimate: 450 },
      probedAt: new Date(), // fresh
    };
    const caps = await probeSender(freshSender);
    eq(caps.fromCache, true, 'from cache');
    eq(caps.maxFromAddresses, 15, 'cached maxFrom preserved');
    eq(caps.dailyLimitEstimate, 450, 'cached dailyLimit preserved');
  });

  await test('needsReprobe: fresh probedAt → false', () => {
    const s = { capabilities: {}, probedAt: new Date() };
    eq(needsReprobe(s), false, 'fresh → no reprobe');
  });

  await test('needsReprobe: 8-day-old probedAt → true', () => {
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const s = { capabilities: {}, probedAt: old };
    eq(needsReprobe(s), true, '8 days → reprobe');
  });

  await test('needsReprobe: null sender → true', () => {
    eq(needsReprobe(null), true, 'null → reprobe');
  });

  await test('needsReprobe: no capabilities → true', () => {
    eq(needsReprobe({ email: 'x@x.com' }), true, 'no caps → reprobe');
  });

  // --- getCachedCapabilities ---
  await test('getCachedCapabilities returns cached or null', () => {
    const cached = getCachedCapabilities({
      email: 'c@x.com',
      provider: 'smtp',
      capabilities: { supportsSpoofing: true, supportsDynamicRouting: false, maxFromAddresses: 3, dailyLimitEstimate: 200 },
      probedAt: new Date(),
    });
    eq(cached.fromCache, true, 'fromCache flag');
    eq(cached.maxFromAddresses, 3, 'cached value');

    const none = getCachedCapabilities({ email: 'y@x.com' });
    eq(none, null, 'no cache → null');
  });

  // --- Live probe hook: mocked provider response overrides static table ---
  await test('Live probe hook with mocked verifier overrides static caps', async () => {
    process.env.CAPABILITY_PROBE_LIVE = 'true';
    registerLiveVerifier(async (sender) => {
      // Mock: a relay that does NOT support spoofing and has a lower daily limit
      return {
        supportsSpoofing: false,
        supportsDynamicRouting: false,
        maxFromAddresses: 2,
        dailyLimitEstimate: 100,
      };
    });
    const caps = await probeSender({ email: 'relay@corp.com', provider: 'smtp' });
    eq(caps.supportsSpoofing, false, 'live override spoofing');
    eq(caps.maxFromAddresses, 2, 'live override maxFrom');
    eq(caps.dailyLimitEstimate, 100, 'live override dailyLimit');
    eq(caps.fromCache, false, 'live probe not cached');
    clearLiveVerifier();
    delete process.env.CAPABILITY_PROBE_LIVE;
  });

  await test('Live probe hook returns null when live mode OFF → static table stands', async () => {
    delete process.env.CAPABILITY_PROBE_LIVE;
    registerLiveVerifier(async () => ({ maxFromAddresses: 999 }));
    const r = await liveProbeHook({ email: 'x@x.com', provider: 'gmail' });
    eq(r, null, 'live off → null overrides');
    clearLiveVerifier();
  });

  await test('Live probe hook: verifier throws → graceful null (S5 reliability)', async () => {
    process.env.CAPABILITY_PROBE_LIVE = 'true';
    registerLiveVerifier(async () => { throw new Error('network down'); });
    const r = await liveProbeHook({ email: 'x@x.com', provider: 'gmail' });
    eq(r, null, 'verifier error → null override');
    clearLiveVerifier();
    delete process.env.CAPABILITY_PROBE_LIVE;
  });

  await test('probeSender with throwing verifier still returns static caps', async () => {
    process.env.CAPABILITY_PROBE_LIVE = 'true';
    registerLiveVerifier(async () => { throw new Error('boom'); });
    const caps = await probeSender({ email: 'safe@gmail.com', provider: 'gmail' });
    // Static table values preserved (graceful degradation)
    eq(caps.supportsSpoofing, false, 'static spoofing');
    eq(caps.maxFromAddresses, 20, 'static maxFrom');
    clearLiveVerifier();
    delete process.env.CAPABILITY_PROBE_LIVE;
  });

  // --- Batch probe ---
  await test('probeSenders batch resolves all senders', async () => {
    const senders = [
      { email: 'a@gmail.com', provider: 'gmail' },
      { email: 'b@outlook.com', provider: 'outlook' },
      { email: 'c@corp.com', provider: 'smtp' },
    ];
    const resultsBatch = await probeSenders(senders);
    eq(resultsBatch.length, 3, '3 results');
    eq(resultsBatch[0].provider, 'gmail', 'batch[0] gmail');
    eq(resultsBatch[1].provider, 'outlook', 'batch[1] outlook');
    eq(resultsBatch[2].provider, 'smtp', 'batch[2] smtp');
  });

  // --- STATIC_CAPABILITY_TABLE sanity ---
  await test('STATIC_CAPABILITY_TABLE has all 3 providers', () => {
    ok(STATIC_CAPABILITY_TABLE.gmail, 'gmail entry');
    ok(STATIC_CAPABILITY_TABLE.outlook, 'outlook entry');
    ok(STATIC_CAPABILITY_TABLE.smtp, 'smtp entry');
  });

  await test('CAPABILITY_PROBE_TTL_MS is 7 days', () => {
    eq(CAPABILITY_PROBE_TTL_MS, 7 * 24 * 60 * 60 * 1000, '7-day TTL');
  });

  await test('registerLiveVerifier rejects non-function', () => {
    let threw = false;
    try { registerLiveVerifier('notafn'); } catch { threw = true; }
    ok(threw, 'should throw on non-function');
  });

  await test('probeSender null sender throws', async () => {
    let threw = false;
    try { await probeSender(null); } catch { threw = true; }
    ok(threw, 'null sender throws');
  });

  // wait for all tests
  await Promise.all(pending);
}

main().then(() => {
  console.log(results.join('\n'));
  console.log(`\n  Total: ${pass + fail} | PASS: ${pass} | FAIL: ${fail}`);
  console.log(`\n=== P3.2 RESULT: ${fail === 0 ? 'ALL PASS ✓' : 'HAS FAILURES ✗'} ===\n`);
  process.exit(fail === 0 ? 0 : 1);
}).catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
