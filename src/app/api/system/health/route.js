// ============================================================================
// V7 P7.1 — GET /api/system/health
// ----------------------------------------------------------------------------
// Public health endpoint. Returns live status of all critical subsystems:
//   - DB reachable (MongoDB readyState)
//   - Redis reachable (ping)
//   - Queue depth (waiting/active/failed/delayed/completed)
//   - AI pool levels (sender + subject)
//   - Restock last-run
//   - Circuit breaker states (all gateway accounts)
//
// No authentication required (health checks must be monitorable externally).
// Uses force-dynamic so Next.js never caches a stale health snapshot.
// ============================================================================
import { NextResponse } from 'next/server';
import { getHealth } from '@/lib/observability/health';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const health = await getHealth();
    // HTTP status reflects health: 200 healthy/degraded, 503 unhealthy
    const httpStatus = health.status === 'unhealthy' ? 503 : 200;
    return NextResponse.json({ ok: true, ...health }, { status: httpStatus });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        status: 'unhealthy',
        error: err.message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
