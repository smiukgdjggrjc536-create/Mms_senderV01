// ============================================================================
// Email-to-MMS Gateway Engine — Admin Manual Override: Clear Cache (Phase 4, Step 2)
// ============================================================================
// POST /api/admin/gateway/cache/clear
//
// Clears CarrierCache entries. By default, only EXPIRED entries (where
// ttlExpiresAt <= now) are removed — this is the safe, non-destructive
// operation that prunes stale carrier data without invalidating still-valid
// lookups.
//
// If the admin passes { "all": true } in the body, ALL entries are purged.
// This is useful when carrier gateway domains have changed globally and the
// cache needs a full refresh on the next send cycle.
//
// Body (optional):
//   { "all": false }  — default: clear only expired entries
//   { "all": true }   — clear every entry (full purge)
//
// Response:
//   { success, message, cleared, remaining, mode }
//
// NON-DESTRUCTIVE: brand-new route file. Reuses shared auth + response
// helpers. Logs the override via logActivity for the audit trail.
// ============================================================================

import {
  connectDB,
  verifyToken,
  jsonResponse,
  CarrierCache,
  logActivity,
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
// POST /api/admin/gateway/cache/clear
// ---------------------------------------------------------------------------
export async function POST(req) {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
    await connectDB();

    // Parse body for the optional "all" flag.
    let clearAll = false;
    try {
      const body = await req.json();
      if (body && typeof body.all === 'boolean') {
        clearAll = body.all;
      }
    } catch (_e) {
      // Body is optional — default to expired-only mode.
    }

    const now = new Date();
    let result;

    if (clearAll) {
      // Full purge — delete every entry.
      result = await CarrierCache.deleteMany({});
    } else {
      // Safe mode — delete only entries whose TTL has expired.
      result = await CarrierCache.deleteMany({ ttlExpiresAt: { $lte: now } });
    }

    const cleared = result.deletedCount || 0;
    const remaining = await CarrierCache.countDocuments();
    const mode = clearAll ? 'all' : 'expired';

    // Audit log.
    await logActivity(
      auth.decoded.userId || auth.decoded.id || null,
      auth.decoded.role || 'admin',
      auth.decoded.email || 'admin',
      'cache_clear',
      `Cleared ${cleared} carrier cache entries (mode=${mode}). Remaining: ${remaining}.`,
      null
    );

    return jsonResponse({
      success: true,
      message: clearAll
        ? `Cleared all ${cleared} carrier cache entries`
        : `Cleared ${cleared} expired carrier cache entries`,
      cleared,
      remaining,
      mode,
    });
  } catch (err) {
    console.error('[gateway/cache/clear POST] error:', err);
    return jsonResponse({ error: 'Internal server error', detail: err.message }, 500);
  }
}
