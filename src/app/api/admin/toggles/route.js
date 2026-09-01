// ============================================================================
// V7 P5.1 — GET/POST /api/admin/toggles
// ----------------------------------------------------------------------------
// GET  — returns the full toggle registry + current DB states (admin view)
// POST — admin updates a toggle's visible/enabled/locked state
//        Body: { key, visible?, enabled?, locked? }
// Auth: admin only (requireAdmin).
// ============================================================================
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { sanitizeInput } from '@/lib/validate/sanitize';
import {
  TOGGLE_REGISTRY,
  updateToggle,
  getEffectiveTogglesForUser,
} from '@/lib/toggles/registry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// GET — full admin view of all toggles
// ---------------------------------------------------------------------------
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error || 'Unauthorized' },
      { status: auth.status || 401 },
    );
  }

  // Admin sees everything (role=admin, tier=3)
  const toggles = await getEffectiveTogglesForUser({ role: 'admin', packageTier: 3 });
  return NextResponse.json({ ok: true, toggles, registry: TOGGLE_REGISTRY });
}

// ---------------------------------------------------------------------------
// POST — update a toggle
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

  // Sanitize the input
  const clean = sanitizeInput(body, {
    key: { type: 'string', required: true, max: 100 },
    visible: { type: 'boolean', required: false },
    enabled: { type: 'boolean', required: false },
    locked: { type: 'boolean', required: false },
  });

  if (!clean.ok) {
    return NextResponse.json(
      { ok: false, error: clean.errors?.join(', ') || 'Validation failed.' },
      { status: 400 },
    );
  }

  const { key, visible, enabled, locked } = clean.data;

  try {
    const updated = await updateToggle(key, { visible, enabled, locked });
    return NextResponse.json({ ok: true, toggle: updated });
  } catch (err) {
    const status = err.message.includes('Unknown toggle') ? 404 : 500;
    return NextResponse.json(
      { ok: false, error: err.message || 'Failed to update toggle.' },
      { status },
    );
  }
}
