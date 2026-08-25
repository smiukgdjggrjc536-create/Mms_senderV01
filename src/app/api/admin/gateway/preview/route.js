// ============================================================================
// Email Sending Module — Admin Email Preview Endpoint
// ============================================================================
// POST /api/admin/gateway/preview
//   Body: { email: string, text: string }  (phoneNumber accepted as alias)
//
// Runs the full preparation pipeline as a DRY RUN (no email is actually sent):
//   1. Safety filter  -> aborts with BLOCKED_BY_SAFETY_FILTER on a keyword hit
//   2. AI rewriter    -> returns the unique variant (or original if no key)
//   (No carrier lookup — the recipient IS an email address.)
//
// Returns the prepared payload so the admin can preview exactly what would be
// sent, the recipient email/domain, and whether the text was rewritten.
//
// SECURITY: Reuses the existing admin auth helpers (verifyToken from
// @/lib/core) so security is consistent with /api/system and the gateway
// config/accounts endpoints.
// ============================================================================

import { connectDB, verifyToken, jsonResponse, validateEmailAddress } from '@/lib/core';
import { prepareEmailPayload } from '@/services/prepareEmail.js';

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
// POST handler — dry-run preview of the email payload
// ---------------------------------------------------------------------------
export async function POST(req) {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
    await connectDB();

    const body = await req.json();
    // Accept `email` (primary) or `phoneNumber` (backward-compat alias).
    const rawEmail = body.email || body.phoneNumber;
    const { text } = body;

    if (!rawEmail || typeof rawEmail !== 'string') {
      return jsonResponse({ error: 'email is required' }, 400);
    }
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return jsonResponse({ error: 'text is required and must be non-empty' }, 400);
    }

    // Validate the email first so we can return a clean 422 for bad addresses.
    const check = validateEmailAddress(rawEmail);
    if (!check.valid) {
      return jsonResponse({
        success: false,
        aborted: true,
        code: 'INVALID_EMAIL',
        error: check.reason,
      }, 422);
    }

    // Run the preparation pipeline as a dry run. The admin context is
    // forwarded so any BLOCKED_BY_SAFETY_FILTER event is attributed correctly.
    const payload = await prepareEmailPayload(rawEmail, text, {
      userId: auth.decoded.userId,
      actorType: 'admin',
      username: auth.decoded.username,
      email: rawEmail,
    });

    return jsonResponse({
      success: true,
      message: 'Email payload prepared (dry run — no message was sent)',
      payload,
    });
  } catch (err) {
    if (err && (err.code === 'BLOCKED_BY_SAFETY_FILTER' || err.code === 'INVALID_EMAIL')) {
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
    const rawEmail = url.searchParams.get('email') || url.searchParams.get('phoneNumber');
    const text = url.searchParams.get('text');

    if (!rawEmail) {
      return jsonResponse({ error: 'email query param is required' }, 400);
    }
    if (!text) {
      return jsonResponse({ error: 'text query param is required' }, 400);
    }

    const check = validateEmailAddress(rawEmail);
    if (!check.valid) {
      return jsonResponse({
        success: false,
        aborted: true,
        code: 'INVALID_EMAIL',
        error: check.reason,
      }, 422);
    }

    const payload = await prepareEmailPayload(rawEmail, text, {
      userId: auth.decoded.userId,
      actorType: 'admin',
      username: auth.decoded.username,
      email: rawEmail,
    });

    return jsonResponse({
      success: true,
      message: 'Email payload prepared (dry run — no message was sent)',
      payload,
    });
  } catch (err) {
    if (err && (err.code === 'BLOCKED_BY_SAFETY_FILTER' || err.code === 'INVALID_EMAIL')) {
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
