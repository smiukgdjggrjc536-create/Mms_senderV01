// ============================================================================
// V7 P7.1 — GET /api/system/metrics
// ----------------------------------------------------------------------------
// Admin-only metrics endpoint. Returns operational metrics for the last 24h:
//   - Send throughput (sent/failed counts, failure rate)
//   - Failure breakdown by failure mode
//   - p95 API latency (overall + per-route)
//
// Auth: admin only (requireAdmin). Returns 401 if not authenticated.
// Uses force-dynamic so metrics are always live.
// ============================================================================
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getThroughput24h, getP95Latency24h } from '@/lib/observability/metrics';
import { getAllCircuitStates } from '@/services/circuitBreaker.js';
import { getMetric } from '@/lib/redis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  // --- Admin auth enforcement ---
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error || 'Unauthorized' },
      { status: auth.status || 401 },
    );
  }

  try {
    // Collect all metrics in parallel
    const [throughput, latency, circuitStates] = await Promise.all([
      getThroughput24h(),
      getP95Latency24h(),
      getAllCircuitStates().catch(() => ({ error: 'circuit-breaker-unavailable' })),
    ]);

    // Lifetime counters from incrMetric (best-effort)
    const [
      jobsEnqueued,
      jobsSucceeded,
      jobsFailed,
      circuitOpens,
      bouncesPurged,
      webhookBounces,
    ] = await Promise.all([
      getMetric('jobs_enqueued').catch(() => 0),
      getMetric('jobs_succeeded').catch(() => 0),
      getMetric('jobs_failed').catch(() => 0),
      getMetric('circuit_opens').catch(() => 0),
      getMetric('bounces_purged').catch(() => 0),
      getMetric('webhook_bounces').catch(() => 0),
    ]);

    const lifetime = {
      jobsEnqueued,
      jobsSucceeded,
      jobsFailed,
      circuitOpens,
      bouncesPurged,
      webhookBounces,
    };

    // Circuit breaker summary
    let circuitSummary = { total: 0, closed: 0, open: 0, halfOpen: 0 };
    if (Array.isArray(circuitStates)) {
      circuitSummary = {
        total: circuitStates.length,
        closed: circuitStates.filter((s) => s.circuitState === 'CLOSED').length,
        open: circuitStates.filter((s) => s.circuitState === 'OPEN').length,
        halfOpen: circuitStates.filter((s) => s.circuitState === 'HALF_OPEN').length,
      };
    }

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      window: '24h',
      throughput,
      latency,
      circuitBreakers: circuitSummary,
      lifetime,
      authSource: auth.source || 'jwt',
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: 'Metrics collection failed: ' + err.message },
      { status: 500 },
    );
  }
}
