// ============================================================================
// V7 P5.1 — GET /api/toggles
// ----------------------------------------------------------------------------
// Returns the effective toggle set for the current user (server-authoritative).
// The user panel uses this to decide which controls to render.
// Auth: any authenticated user (JWT session or admin API key).
// ============================================================================
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getEffectiveTogglesForUser, isToggleEnabled } from '@/lib/toggles/registry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  // Auth gate — any authenticated user can read their toggles
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error || 'Unauthorized' },
      { status: auth.status || 401 },
    );
  }

  // Resolve user context from the auth payload
  const role = auth.payload?.role || (auth.payload?.admin ? 'admin' : 'user');
  const userContext = {
    role,
    packageTier: auth.payload?.packageTier || 0,
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
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error || 'Unauthorized' },
      { status: auth.status || 401 },
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

  const role = auth.payload?.role || (auth.payload?.admin ? 'admin' : 'user');
  const userContext = { role, packageTier: auth.payload?.packageTier || 0 };

  const enabled = await isToggleEnabled(key, userContext);
  return NextResponse.json({ ok: true, key, enabled });
}
