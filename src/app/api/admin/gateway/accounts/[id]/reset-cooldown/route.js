// ============================================================================
// Email-to-MMS Gateway Engine — Admin Manual Override: Reset Cooldown (Phase 4, Step 2)
// ============================================================================
// POST /api/admin/gateway/accounts/:id/reset-cooldown
//
// Manually resets an email account back to ACTIVE status, clearing its
// cooldown timer and consecutive-bounce counter. This lets an admin recover
// an account that was automatically placed in COOLDOWN by the bounce handler
// (Phase 3) without waiting for the timer to expire naturally.
//
// Body (optional):
//   { "reason": "manual admin reset" }
//
// Response:
//   { success, message, account: { _id, email, provider, status, ... } }
//
// NON-DESTRUCTIVE: brand-new route file. Reuses shared auth + response
// helpers. Logs the override via logActivity for the audit trail.
// ============================================================================

import {
  connectDB,
  verifyToken,
  jsonResponse,
  EmailAccount,
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
// POST /api/admin/gateway/accounts/:id/reset-cooldown
// ---------------------------------------------------------------------------
export async function POST(req, { params }) {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
    await connectDB();

    const { id } = await params;
    if (!id) {
      return jsonResponse({ error: 'Account ID is required in the URL path' }, 400);
    }

    // Validate the ObjectId format to avoid a raw CastError leak.
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return jsonResponse({ error: 'Invalid account ID format' }, 400);
    }

    // Parse optional reason from the body.
    let reason = 'Manual admin reset';
    try {
      const body = await req.json();
      if (body && typeof body.reason === 'string' && body.reason.trim()) {
        reason = body.reason.trim().slice(0, 200);
      }
    } catch (_e) {
      // Body is optional — ignore parse errors.
    }

    // Atomically reset the account to ACTIVE. Use $unset for cooldownUntil
    // (removing the field entirely) and $set for the other fields. We cannot
    // both $set and $unset the same path in one update — using $unset here
    // so the cooldown timer is fully removed, not just nulled.
    const account = await EmailAccount.findByIdAndUpdate(
      id,
      {
        $set: {
          status: 'ACTIVE',
          lastError: null,
          consecutiveBounces: 0,
          updatedAt: new Date(),
        },
        $unset: { cooldownUntil: '' },
      },
      { new: true }
    );

    if (!account) {
      return jsonResponse({ error: 'Email account not found' }, 404);
    }

    // Strip credentials from the response.
    const safe = account.toObject();
    delete safe.credentials;

    // Audit log.
    await logActivity(
      auth.decoded.userId || auth.decoded.id || null,
      auth.decoded.role || 'admin',
      auth.decoded.email || 'admin',
      'reset_cooldown',
      `Reset account ${account.email} (${account.provider}) to ACTIVE. Reason: ${reason}`,
      null
    );

    return jsonResponse({
      success: true,
      message: `Account ${account.email} reset to ACTIVE`,
      account: safe,
    });
  } catch (err) {
    console.error('[gateway/reset-cooldown POST] error:', err);
    return jsonResponse({ error: 'Internal server error', detail: err.message }, 500);
  }
}
