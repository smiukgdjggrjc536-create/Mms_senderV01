// ============================================================================
// V7 P5.1 — GET /api/toggles
// ----------------------------------------------------------------------------
// Returns the effective toggle set for the current user (server-authoritative).
// The user panel uses this to decide which controls to render.
//
// Auth: ANY authenticated user (JWT session cookie — user OR admin).
// Uses the SAME cookie-based session mechanism as /api/system so the
// regular user panel (logged in as a USER, not admin) can read its toggles.
// ============================================================================
import { NextResponse } from 'next/server';
import { verifyToken, connectDB, User } from '@/lib/core.js';
import { getEffectiveTogglesForUser, isToggleEnabled } from '@/lib/toggles/registry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Helper: extract token from request cookies (same as /api/system)
function getTokenFromReq(req) {
  const cookieHeader = req.headers.get('cookie') || '';
  const tokenMatch = cookieHeader.match(/token=([^;]+)/);
  return tokenMatch ? tokenMatch[1] : null;
}

// Helper: verify any valid token (user or admin) — mirrors /api/system verifyAny
async function verifyAny(req) {
  const token = getTokenFromReq(req);
  if (!token) return { error: 'Unauthorized', code: 401 };
  const decoded = await verifyToken(token);
  if (!decoded) return { error: 'Invalid Token', code: 403 };
  return { decoded };
}

export async function GET(request) {
  // Auth gate — any authenticated user can read their toggles
  const auth = await verifyAny(request);
  if (auth.error) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.code || 401 },
    );
  }

  // Resolve user context from the decoded token payload
  const role = auth.decoded?.role || (auth.decoded?.admin ? 'admin' : 'user');
  let packageTier = auth.decoded?.packageTier;

  // Fallback: if the JWT doesn't carry packageTier (legacy session), look it up from DB.
  // This ensures existing logged-in users get the correct tier after the schema upgrade.
  if (packageTier === undefined && role === 'user' && auth.decoded?.userId) {
    try {
      await connectDB();
      const u = await User.findById(auth.decoded.userId).select('packageTier').lean();
      if (u) packageTier = u.packageTier || 0;
    } catch { /* DB error — fall back to tier 0 */ }
  }
  if (packageTier === undefined) packageTier = 0;

  const userContext = {
    role,
    packageTier,
    userId: auth.decoded?.userId || auth.decoded?.sub || null,
  };

  try {
    const toggles = await getEffectiveTogglesForUser(userContext);
    return NextResponse.json({ ok: true, toggles, userContext });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: 'Failed to resolve toggles.' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/toggles — check if a specific toggle is enabled (for API actions)
// Body: { key } → returns { ok, enabled }
// This lets API routes enforce toggles server-side (devtools bypass protection)
// ---------------------------------------------------------------------------
export async function POST(request) {
  const auth = await verifyAny(request);
  if (auth.error) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.code || 401 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { key } = body || {};
  if (!key || typeof key !== 'string') {
    return NextResponse.json({ ok: false, error: 'key is required.' }, { status: 400 });
  }

  const role = auth.decoded?.role || (auth.decoded?.admin ? 'admin' : 'user');
  const userContext = { role, packageTier: auth.decoded?.packageTier || 0 };

  const enabled = await isToggleEnabled(key, userContext);
  return NextResponse.json({ ok: true, key, enabled });
}
