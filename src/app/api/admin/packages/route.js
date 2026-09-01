// ============================================================================
// V7 P5.2 — GET/POST /api/admin/packages (admin package CRUD + assignment)
// ----------------------------------------------------------------------------
// GET  — list all packages in the registry + all user assignments
// POST — assign a package to a user
//        Body: { userId, packageName, overrides? }
// Auth: admin only (requireAdmin).
// ============================================================================
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { sanitizeInput } from '@/lib/validate/sanitize';
import {
  PACKAGE_REGISTRY,
  assignPackage,
  getPackageStatus,
  UserPackage,
} from '@/lib/packages/manager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// GET — list packages + assignments
// ---------------------------------------------------------------------------
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error || 'Unauthorized' },
      { status: auth.status || 401 },
    );
  }

  try {
    // List all packages in the registry
    const packages = Object.values(PACKAGE_REGISTRY);

    // List all user assignments (best-effort, may fail if DB not connected)
    let assignments = [];
    try {
      assignments = await UserPackage.find({}).lean().limit(100);
    } catch (err) {
      // DB not connected — return empty assignments
    }

    return NextResponse.json({ ok: true, packages, assignments });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: 'Failed to list packages.' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST — assign package to user
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

  const clean = sanitizeInput(body, {
    userId: { type: 'string', required: true, max: 200 },
    packageName: { type: 'string', required: true, max: 50 },
    overrides: { type: 'object', required: false },
  });

  if (!clean.ok) {
    return NextResponse.json(
      { ok: false, error: clean.errors?.join(', ') || 'Validation failed.' },
      { status: 400 },
    );
  }

  const { userId, packageName, overrides } = clean.data;

  try {
    const doc = await assignPackage(userId, packageName, overrides);
    // Return the effective package status after assignment
    const status = await getPackageStatus(userId);
    return NextResponse.json({ ok: true, assignment: doc, status });
  } catch (err) {
    const status = err.message.includes('Unknown package') ? 404 : 500;
    return NextResponse.json(
      { ok: false, error: err.message || 'Failed to assign package.' },
      { status },
    );
  }
}
