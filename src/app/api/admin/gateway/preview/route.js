// ============================================================================
// Email-to-MMS Gateway Engine — Admin MMS Preview Endpoint (Phase 2)
// ============================================================================
// POST /api/admin/gateway/preview
//   Body: { phoneNumber: string, text: string }
//
// Runs the full Phase 2 pipeline as a DRY RUN (no email is actually sent):
//   1. Safety filter  -> aborts with BLOCKED_BY_SAFETY_FILTER on a keyword hit
//   2. AI rewriter    -> returns the unique variant (or original if no key)
//   3. Carrier lookup -> resolves the MMS gateway address (cache-first)
//
// Returns the prepared payload so the admin can preview exactly what would be
// sent, which carrier was resolved, and whether the text was rewritten.
//
// NON-DESTRUCTIVE: brand-new route. Reuses the existing admin auth helpers
// (verifyToken from @/lib/core) so security is consistent with /api/system and
// the Phase 1 gateway config/accounts endpoints. No existing route is touched.
// ============================================================================

import { connectDB, verifyToken, jsonResponse, prepareMMSPayload } from '@/lib/core';

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
// POST handler — dry-run preview of the MMS payload
// ---------------------------------------------------------------------------
export async function POST(req) {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
    await connectDB();

    const body = await req.json();
    const { phoneNumber, text } = body;

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return jsonResponse({ error: 'phoneNumber is required' }, 400);
    }
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return jsonResponse({ error: 'text is required and must be non-empty' }, 400);
    }

    // Run the Phase 2 pipeline as a dry run. The admin context is forwarded so
    // any BLOCKED_BY_SAFETY_FILTER event is attributed correctly in the logs.
    const payload = await prepareMMSPayload(phoneNumber, text, {
      userId: auth.decoded.userId,
      actorType: 'admin',
      username: auth.decoded.username,
      phoneNumber,
    });

    return jsonResponse({
      success: true,
      message: 'MMS payload prepared (dry run — no message was sent)',
      payload,
    });
  } catch (err) {
    // Distinguish a controlled abort (safety block / landline) from a real 500.
    if (err && (err.code === 'BLOCKED_BY_SAFETY_FILTER' || err.code === 'INVALID_NUMBER' || err.code === 'LANDLINE' || err.code === 'VOIP' || /Landline cannot receive MMS/.test(err.message) || /Invalid phone number/.test(err.message) || /rejected pattern/.test(err.message) || /Could not normalize/.test(err.message))) {
      return jsonResponse({
        success: false,
        aborted: true,
        code: err.code || 'ABORTED',
        error: err.message,
      }, 422);
    }
    console.error('[gateway preview POST] error:', err);
    return jsonResponse({ error: 'Internal server error', detail: err.message }, 500);
  }
}

// GET handler — convenience: same dry run via query params (so it can be
// opened directly in a browser by an authenticated admin for quick checks).
export async function GET(req) {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
    await connectDB();

    const url = new URL(req.url);
    const phoneNumber = url.searchParams.get('phoneNumber');
    const text = url.searchParams.get('text');

    if (!phoneNumber) {
      return jsonResponse({ error: 'phoneNumber query param is required' }, 400);
    }
    if (!text) {
      return jsonResponse({ error: 'text query param is required' }, 400);
    }

    const payload = await prepareMMSPayload(phoneNumber, text, {
      userId: auth.decoded.userId,
      actorType: 'admin',
      username: auth.decoded.username,
      phoneNumber,
    });

    return jsonResponse({
      success: true,
      message: 'MMS payload prepared (dry run — no message was sent)',
      payload,
    });
  } catch (err) {
    if (err && (err.code === 'BLOCKED_BY_SAFETY_FILTER' || err.code === 'INVALID_NUMBER' || err.code === 'LANDLINE' || err.code === 'VOIP' || /Landline cannot receive MMS/.test(err.message) || /Invalid phone number/.test(err.message) || /rejected pattern/.test(err.message) || /Could not normalize/.test(err.message))) {
      return jsonResponse({
        success: false,
        aborted: true,
        code: err.code || 'ABORTED',
        error: err.message,
      }, 422);
    }
    console.error('[gateway preview GET] error:', err);
    return jsonResponse({ error: 'Internal server error', detail: err.message }, 500);
  }
}
