// ============================================================================
// MODULE 2: SSE Live Stream — Real-Time Data to the Admin Panel
// ============================================================================
// GET /api/admin/gateway/stream
//
// Server-Sent Events (SSE) endpoint that pushes 1000% live data to the
// Admin Panel dashboard:
//   • Active SMTP connections (account pool status)
//   • Queue size (waiting / active / delayed jobs)
//   • Success / Fail metrics (real-time counters)
//   • Live sending logs (recent DeliveryReport + ActivityLog entries)
//
// The client connects with:
//   const es = new EventSource('/api/admin/gateway/stream');
//   es.addEventListener('snapshot', (e) => { ... });
//   es.addEventListener('heartbeat', (e) => { ... });
//
// SSE is preferred over WebSockets for this use case because:
//   1. Next.js App Router has native support for ReadableStream responses.
//   2. SSE is unidirectional (server → client) which matches our push model.
//   3. SSE auto-reconnects on disconnect (built into the browser EventSource API).
//   4. SSE works through proxies / load balancers without upgrade negotiation.
//
// NON-DESTRUCTIVE: brand-new route file. Reuses shared auth helpers.
// ============================================================================

import { connectDB, verifyToken, jsonResponse, EmailAccount, DeliveryReport, ActivityLog, SystemConfig, getQueueStatus } from '@/lib/core';
import { getRedis, getMetric, cacheGet } from '@/lib/redis';
import { SSE_CONFIG } from '@/lib/gateway/constants';

// ---------------------------------------------------------------------------
// Auth helpers (mirrors /api/admin/gateway/route.js)
// ---------------------------------------------------------------------------
function getTokenFromReq(req) {
  const cookieHeader = req.headers.get('cookie') || '';
  const tokenMatch = cookieHeader.match(/token=([^;]+)/);
  return tokenMatch ? tokenMatch[1] : null;
}

async function verifyAdmin(req) {
  const token = getTokenFromReq(req);
  if (!token) return { error: 'Unauthorized', code: 401 };
  const decoded = await verifyToken(token);
  if (!decoded) return { error: 'Invalid Token', code: 403 };
  if (decoded.role !== 'admin' && decoded.role !== 'superadmin') {
    return { error: 'Forbidden: Admin only', code: 403 };
  }
  return { decoded };
}

// ---------------------------------------------------------------------------
// Build a live snapshot of the gateway state
// ---------------------------------------------------------------------------
async function buildSnapshot() {
  await connectDB();
  const now = new Date();
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

  // Account pool status.
  const accounts = await EmailAccount.find({}).select('-credentials').lean();
  const liveAccounts = accounts.map((acc) => {
    let liveStatus = acc.status || 'ACTIVE';
    if (liveStatus === 'COOLDOWN' && acc.cooldownUntil && new Date(acc.cooldownUntil) <= now) {
      liveStatus = 'ACTIVE';
    }
    return {
      _id: acc._id,
      email: acc.email,
      provider: acc.provider,
      label: acc.label,
      status: liveStatus,
      sentToday: acc.sentToday || 0,
      dailyLimit: acc.dailyLimit || 400,
      consecutiveBounces: acc.consecutiveBounces || 0,
      lastUsedAt: acc.lastUsedAt,
      lastError: acc.lastError,
    };
  });

  // Queue status (from BullMQ — best-effort, may not be available on serverless).
  let queueStatus = null;
  try {
    queueStatus = await getQueueStatus();
  } catch (_e) {
    queueStatus = { error: 'Queue engine not available' };
  }

  // Real-time metrics (from Redis counters).
  const metrics = {
    jobsEnqueued: await getMetric('jobs_enqueued'),
    jobsSucceeded: await getMetric('jobs_succeeded'),
    jobsFailed: await getMetric('jobs_failed'),
    jobsNoAccount: await getMetric('jobs_no_account'),
    circuitOpens: await getMetric('circuit_opens'),
    bouncesPurged: await getMetric('bounces_purged'),
    webhookBounces: await getMetric('webhook_bounces'),
  };

  // Recent sending logs (last 5 minutes, max 20).
  const recentDelivery = await DeliveryReport.find({ sentAt: { $gte: fiveMinAgo } })
    .sort({ sentAt: -1 })
    .limit(20)
    .lean();

  const recentActivity = await ActivityLog.find({ timestamp: { $gte: fiveMinAgo } })
    .sort({ timestamp: -1 })
    .limit(20)
    .lean();

  const logs = [
    ...recentDelivery.map((d) => ({
      source: 'delivery',
      timestamp: d.sentAt,
      number: d.number,
      status: d.status,
      provider: d.provider,
      errorCode: d.errorCode,
      errorMessage: d.errorMessage,
    })),
    ...recentActivity.map((a) => ({
      source: 'activity',
      timestamp: a.timestamp,
      action: a.action,
      details: a.details,
      actorEmail: a.actorEmail,
    })),
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 30);

  return {
    timestamp: now.toISOString(),
    accountPool: {
      total: liveAccounts.length,
      active: liveAccounts.filter((a) => a.status === 'ACTIVE').length,
      cooldown: liveAccounts.filter((a) => a.status === 'COOLDOWN').length,
      suspended: liveAccounts.filter((a) => a.status === 'SUSPENDED').length,
      accounts: liveAccounts,
    },
    queue: queueStatus,
    metrics,
    logs,
  };
}

// ---------------------------------------------------------------------------
// GET handler — SSE stream
// ---------------------------------------------------------------------------
export async function GET(req) {
  // Auth check — the token is in the cookie.
  const auth = await verifyAdmin(req);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.code);

  // Build the SSE stream using a ReadableStream (Next.js App Router native).
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      // Helper to send an SSE event.
      const sendEvent = (eventName, data) => {
        if (closed) return;
        try {
          const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch (_e) {
          closed = true;
        }
      };

      // Send an initial snapshot immediately.
      try {
        const snapshot = await buildSnapshot();
        sendEvent('snapshot', snapshot);
      } catch (err) {
        sendEvent('error', { error: err.message });
      }

      // Set up a polling interval (SSE can't use Redis pub/sub on serverless,
      // so we poll every 3 seconds for fresh data). On a persistent server
      // (Render), this could be replaced with Redis pub/sub for true push.
      const snapshotInterval = setInterval(async () => {
        if (closed) return;
        try {
          const snapshot = await buildSnapshot();
          sendEvent('snapshot', snapshot);
        } catch (err) {
          sendEvent('error', { error: err.message });
        }
      }, 3000);

      // Heartbeat to keep the connection alive through proxies.
      const heartbeatInterval = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch (_e) {
          closed = true;
        }
      }, SSE_CONFIG.heartbeatMs);

      // Clean up when the client disconnects.
      req.signal?.addEventListener('abort', () => {
        closed = true;
        clearInterval(snapshotInterval);
        clearInterval(heartbeatInterval);
        try { controller.close(); } catch (_e) {}
      });

      // Safety timeout — close after 5 minutes (client will auto-reconnect).
      setTimeout(() => {
        if (closed) return;
        closed = true;
        clearInterval(snapshotInterval);
        clearInterval(heartbeatInterval);
        try { controller.close(); } catch (_e) {}
      }, 5 * 60 * 1000);
    },

    cancel() {
      // Client disconnected — nothing to clean up here (handled in start).
    },
  });

  // Return the SSE stream with the correct headers.
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering for real-time.
    },
  });
}
