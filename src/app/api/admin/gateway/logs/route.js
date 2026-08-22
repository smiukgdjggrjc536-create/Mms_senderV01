// ============================================================================
// Email-to-MMS Gateway Engine — Live Log Feed (Phase 4, Step 1)
// ============================================================================
// GET /api/admin/gateway/logs
//
// Returns a unified, paginated, time-ordered log feed that the Admin Panel
// can render as a live dashboard table. The feed merges two data sources:
//
//   • ActivityLog — platform-level events (logins, campaign sends, carrier
//     cache hits, AI rewrites, blocked-spam decisions, cooldown transitions,
//     admin overrides, deploy hooks).
//   • DeliveryReport — per-message delivery details (provider, routing
//     account, carrier gateway, status, error codes, timestamps).
//
// Query params:
//   ?limit=50   — max records to return (1-200, default 50)
//   ?cursor=... — ISO timestamp of the oldest record from the previous page
//                 for cursor-based pagination (older records)
//   ?type=activity|delivery|all — filter source (default all)
//   ?filter=... — case-insensitive substring filter on the message/details
//                 /action / errorMessage / number fields
//
// NON-DESTRUCTIVE: brand-new route file. Reuses shared auth + response
// helpers. Does NOT modify any existing route or model.
// ============================================================================

import {
  connectDB,
  verifyToken,
  jsonResponse,
  ActivityLog,
  DeliveryReport,
} from '@/lib/core';

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
// Classify a log entry for the UI badge / icon system.
// ---------------------------------------------------------------------------
function classifyEntry(entry) {
  const text = (
    (entry.action || '') + ' ' +
    (entry.details || '') + ' ' +
    (entry.errorMessage || '') + ' ' +
    (entry.errorCode || '')
  ).toLowerCase();

  if (text.includes('blocked_by_safety') || text.includes('spam')) return 'spam_blocked';
  if (text.includes('ai_rewrite') || text.includes('gemini') || text.includes('rewritten')) return 'ai_rewrite';
  if (text.includes('carrier_cache_hit')) return 'cache_hit';
  if (text.includes('carrier_api_lookup')) return 'cache_miss';
  if (text.includes('cooldown') || text.includes('rate_limit')) return 'cooldown';
  if (text.includes('hard_bounce') || text.includes('550')) return 'bounce';
  if (text.includes('suspended') || text.includes('auth_fail')) return 'suspended';
  if (text.includes('reset_cooldown') || text.includes('cache_clear') || text.includes('deploy_hook')) return 'admin_action';
  if (text.includes('send_campaign') || text.includes('email_mms') || text.includes('routing')) return 'routing';
  if (text.includes('login')) return 'auth';
  if (entry.status === 'sent' || entry.status === 'delivered') return 'delivery_success';
  if (entry.status === 'failed' || entry.status === 'undelivered') return 'delivery_failed';
  return 'info';
}

// ---------------------------------------------------------------------------
// GET /api/admin/gateway/logs
// ---------------------------------------------------------------------------
export async function GET(req) {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
    await connectDB();

    const url = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1), 200);
    const cursor = url.searchParams.get('cursor');
    const type = (url.searchParams.get('type') || 'all').toLowerCase();
    const filter = (url.searchParams.get('filter') || '').trim();

    // Cursor: fetch records older than this ISO timestamp.
    const cursorDate = cursor ? new Date(cursor) : null;
    const tsQuery = cursorDate && !isNaN(cursorDate.getTime())
      ? { $lt: cursorDate }
      : null;

    // Build the substring filter regex once.
    const filterRegex = filter ? { $regex: filter, $options: 'i' } : null;

    // ── Fetch ActivityLog entries ────────────────────────────────────────
    let activityLogs = [];
    if (type === 'all' || type === 'activity') {
      const actQuery = {};
      if (tsQuery) actQuery.timestamp = tsQuery;
      if (filterRegex) {
        actQuery.$or = [
          { action: filterRegex },
          { details: filterRegex },
          { actorEmail: filterRegex },
        ];
      }
      activityLogs = await ActivityLog
        .find(actQuery)
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();

      activityLogs = activityLogs.map((a) => ({
        source: 'activity',
        id: a._id.toString(),
        timestamp: a.timestamp,
        actorType: a.actorType,
        actorEmail: a.actorEmail,
        action: a.action,
        details: a.details,
        status: null,
        category: classifyEntry({ action: a.action, details: a.details }),
      }));
    }

    // ── Fetch DeliveryReport entries ─────────────────────────────────────
    let deliveryLogs = [];
    if (type === 'all' || type === 'delivery') {
      const drQuery = {};
      if (tsQuery) drQuery.sentAt = tsQuery;
      if (filterRegex) {
        drQuery.$or = [
          { number: filterRegex },
          { errorMessage: filterRegex },
          { errorCode: filterRegex },
          { provider: filterRegex },
          { senderApiName: filterRegex },
        ];
      }
      deliveryLogs = await DeliveryReport
        .find(drQuery)
        .sort({ sentAt: -1 })
        .limit(limit)
        .lean();

      deliveryLogs = deliveryLogs.map((d) => ({
        source: 'delivery',
        id: d._id.toString(),
        timestamp: d.sentAt,
        actorType: 'delivery',
        actorEmail: d.userEmail || '',
        action: 'delivery_report',
        details: `To ${d.number} via ${d.provider || 'unknown'} — ${d.status}`,
        number: d.number,
        status: d.status,
        provider: d.provider,
        senderApiName: d.senderApiName,
        errorCode: d.errorCode,
        errorMessage: d.errorMessage,
        category: classifyEntry({
          action: 'delivery_report',
          status: d.status,
          errorMessage: d.errorMessage,
          errorCode: d.errorCode,
        }),
      }));
    }

    // ── Merge + sort + truncate ──────────────────────────────────────────
    const merged = [...activityLogs, ...deliveryLogs];
    merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const page = merged.slice(0, limit);

    // Next cursor = oldest timestamp in this page (for "load more").
    const nextCursor = page.length > 0
      ? new Date(page[page.length - 1].timestamp).toISOString()
      : null;

    return jsonResponse({
      success: true,
      timestamp: new Date().toISOString(),
      count: page.length,
      nextCursor,
      logs: page,
    });
  } catch (err) {
    console.error('[gateway/logs GET] error:', err);
    return jsonResponse({ error: 'Internal server error', detail: err.message }, 500);
  }
}
