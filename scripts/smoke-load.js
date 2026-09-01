// ============================================================================
// V7 P7.3 — Load smoke test
// ----------------------------------------------------------------------------
// SPEC: 200 sequential campaign-resolve calls + 50 concurrent tag previews;
//       assert zero 5xx and p95 < 500ms.
//
// Since Accounts 1-3 never deploy (RULE 0), this test exercises the
// underlying logic modules directly (no HTTP server needed):
//   - Campaign-resolve = rotationStrategy.poolCountRoute + buildSenderPool
//   - Tag-preview = mappingEngine.buildRecipientMap + applier.applyTags
//
// Measures per-call latency, computes p95, and asserts:
//   a) Zero errors (no 5xx equivalent — no thrown exceptions)
//   b) p95 < 500ms for both sequential and concurrent phases
//
// Usage: node --experimental-loader ./scripts/alias-loader.mjs scripts/run-test.mjs scripts/smoke-load.js
// ============================================================================
import { poolCountRoute, buildSenderPool, poolPushRoute, poolMembersRoute } from '../src/lib/routing/rotationStrategy.js';
import { buildRecipientMap, generateSendAttemptId, _resetMappingState } from '../src/lib/tagEngine/mappingEngine.js';
import { applyTags } from '../src/lib/tagEngine/applier.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function computeP95(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[Math.max(0, idx)];
}

function computeStats(arr) {
  if (arr.length === 0) return { count: 0, min: 0, max: 0, avg: 0, p95: 0 };
  const sorted = [...arr].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: Math.round(sum / sorted.length),
    p95: computeP95(sorted),
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Phase 1: 200 sequential campaign-resolve calls
// ---------------------------------------------------------------------------
async function phase1_sequentialResolve() {
  console.log('\n── Phase 1: 200 sequential campaign-resolve calls ──\n');

  const latencies = [];
  let errors = 0;
  const CAMPAIGN_COUNT = 200;
  const senderPool = [
    { id: 'sender-1', provider: 'gmail', email: 'acc1@gmail.com', weight: 3 },
    { id: 'sender-2', provider: 'gmail', email: 'acc2@gmail.com', weight: 2 },
    { id: 'sender-3', provider: 'smtp', email: 'acc3@corp.com', weight: 1 },
  ];

  for (let i = 0; i < CAMPAIGN_COUNT; i++) {
    const campaignId = `smoke-campaign-${i}`;
    const t0 = Date.now();
    try {
      // Simulate a campaign-resolve: push senders to pool, then count
      for (const s of senderPool) {
        await poolPushRoute('sender', campaignId, JSON.stringify(s));
      }
      const count = await poolCountRoute('sender', campaignId);
      const members = await poolMembersRoute('sender', campaignId);

      if (typeof count !== 'number' || count < 0) {
        throw new Error(`unexpected pool count: ${count}`);
      }
      if (!Array.isArray(members)) {
        throw new Error('poolMembersRoute did not return array');
      }
      latencies.push(Date.now() - t0);
    } catch (err) {
      errors++;
      console.error(`  ✗ campaign ${i} failed: ${err.message}`);
    }
  }

  const stats = computeStats(latencies);
  console.log(`  Calls:     ${CAMPAIGN_COUNT}`);
  console.log(`  Successes: ${latencies.length}`);
  console.log(`  Errors:    ${errors}`);
  console.log(`  Latency:   min=${stats.min}ms  avg=${stats.avg}ms  max=${stats.max}ms  p95=${stats.p95}ms`);
  console.log(`  p95 < 500ms: ${stats.p95 < 500 ? 'PASS ✓' : 'FAIL ✗'}`);

  return { stats, errors, count: CAMPAIGN_COUNT };
}

// ---------------------------------------------------------------------------
// Phase 2: 50 concurrent tag-preview calls
// ---------------------------------------------------------------------------
async function phase2_concurrentTagPreview() {
  console.log('\n── Phase 2: 50 concurrent tag previews ──\n');

  _resetMappingState();

  const CONCURRENT_COUNT = 50;
  const sampleHtml = `
    <html><body>
      <h1>Hello {{#NAME#}}</h1>
      <p>Your invoice #{{#INVOICE#}} is ready.</p>
      <p>Reply to: {{#HELPDESK#}}</p>
      <p>City: {{#CITY#}} | Zip: {{#ZIP#}}</p>
      <p>Phone: {{#PHONE#}} | Company: {{#COMPANY#}}</p>
      <p>Token: {{#TOKEN#}}</p>
    </body></html>
  `;

  const fakeCampaign = {
    _id: 'smoke-preview',
    body: sampleHtml,
    subject: 'Invoice {{#INVOICE#}} for {{#NAME#}}',
    userId: '',  // empty userId → getMergedRegistry skips DB lookup, uses BUILTIN_LOOKUP only
  };

  const fakeRecipient = {
    email: 'recipient@example.com',
    name: 'John Doe',
    city: 'New York',
    zip: '10001',
    phone: '555-1234',
    company: 'Acme Corp',
  };

  // Launch all 50 concurrently
  const promises = [];
  for (let i = 0; i < CONCURRENT_COUNT; i++) {
    const t0 = Date.now();
    const p = (async () => {
      try {
        const sendAttemptId = await generateSendAttemptId('smoke-preview');
        const map = await buildRecipientMap(fakeRecipient, fakeCampaign, sendAttemptId);
        const renderedHtml = applyTags(sampleHtml, map);
        const renderedSubject = applyTags(fakeCampaign.subject, map);

        // Validate rendering produced non-empty output
        if (!renderedHtml || renderedHtml.length < 50) {
          throw new Error('rendered HTML too short');
        }
        if (!renderedSubject || renderedSubject.length === 0) {
          throw new Error('rendered subject empty');
        }
        return Date.now() - t0;
      } catch (err) {
        throw err;
      }
    })();
    promises.push(p);
  }

  const latencies = [];
  let errors = 0;

  const results = await Promise.allSettled(promises);
  for (const r of results) {
    if (r.status === 'fulfilled') {
      latencies.push(r.value);
    } else {
      errors++;
      console.error(`  ✗ concurrent preview failed: ${r.reason?.message || r.reason}`);
    }
  }

  const stats = computeStats(latencies);
  console.log(`  Calls:     ${CONCURRENT_COUNT} (concurrent)`);
  console.log(`  Successes: ${latencies.length}`);
  console.log(`  Errors:    ${errors}`);
  console.log(`  Latency:   min=${stats.min}ms  avg=${stats.avg}ms  max=${stats.max}ms  p95=${stats.p95}ms`);
  console.log(`  p95 < 500ms: ${stats.p95 < 500 ? 'PASS ✓' : 'FAIL ✗'}`);

  return { stats, errors, count: CONCURRENT_COUNT };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  V7 P7.3 — Load Smoke Test');
  console.log('  200 sequential campaign-resolve + 50 concurrent tag previews');
  console.log('  Assert: zero errors, p95 < 500ms');
  console.log('═══════════════════════════════════════════════════════════════');

  const phase1 = await phase1_sequentialResolve();
  const phase2 = await phase2_concurrentTagPreview();

  // --- Final verdict ---
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  FINAL VERDICT');
  console.log('═══════════════════════════════════════════════════════════════');

  const totalErrors = phase1.errors + phase2.errors;
  const p1Pass = phase1.errors === 0 && phase1.stats.p95 < 500;
  const p2Pass = phase2.errors === 0 && phase2.stats.p95 < 500;
  const allPass = p1Pass && p2Pass;

  console.log(`  Phase 1 (sequential resolve):  ${p1Pass ? 'PASS ✓' : 'FAIL ✗'}  — ${phase1.count} calls, ${phase1.errors} errors, p95=${phase1.stats.p95}ms`);
  console.log(`  Phase 2 (concurrent preview):   ${p2Pass ? 'PASS ✓' : 'FAIL ✗'}  — ${phase2.count} calls, ${phase2.errors} errors, p95=${phase2.stats.p95}ms`);
  console.log(`  Total errors:                   ${totalErrors}`);
  console.log(`  Overall:                        ${allPass ? 'PASS ✓ — exit 0' : 'FAIL ✗ — exit 1'}`);
  console.log('');

  if (allPass) {
    console.log('SMOKE_LOAD_EXIT=0');
    process.exit(0);
  } else {
    console.log('SMOKE_LOAD_EXIT=1');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(2);
});
