// ============================================================================
// V7 P5.2 — GET /api/packages (user's package status)
// ----------------------------------------------------------------------------
// Returns the current user's package + quota status (server-authoritative).
// Auth: any authenticated user.
// ============================================================================
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getPackageStatus, getUserPackage } from '@/lib/packages/manager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error || 'Unauthorized' },
      { status: auth.status || 401 },
    );
  }

  // Extract userId from auth payload
  const userId = auth.payload?.userId || auth.payload?.sub || auth.payload?.username || 'default';

  try {
    const status = await getPackageStatus(String(userId));
    return NextResponse.json({ ok: true, ...status });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: 'Failed to get package status.' },
      { status: 500 },
    );
  }
}
