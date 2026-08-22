// ============================================================================
// KEEP-ALIVE PING ENDPOINT — /api/ping
// ============================================================================
// Ultra-lightweight health-check endpoint designed for Render free-tier
// keep-alive pinging. Returns 200 OK instantly with NO database call, NO auth,
// and minimal payload so it can be hit every few minutes without cost.
//
// External cron services (cron-job.org, UptimeRobot, etc.) should hit:
//   GET https://mms-gateway-engine.onrender.com/api/ping
// every 5-14 minutes to prevent the Render free instance from spinning down.
//
// The self-ping module (src/lib/keepAlive.js, started via instrumentation.ts)
// also pings this endpoint on a timer from inside the server itself.
// ============================================================================

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function GET() {
  const now = Date.now();
  return Response.json(
    {
      ok: true,
      status: 'alive',
      timestamp: new Date().toISOString(),
      epoch: now,
      uptime: typeof process !== 'undefined' && process.uptime ? Math.round(process.uptime()) : null,
      mode: process.env.NEXT_PUBLIC_PANEL_MODE || 'unknown',
    },
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}

// HEAD support — some uptime monitors send HEAD requests
export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
