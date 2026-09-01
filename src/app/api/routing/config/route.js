// ============================================================================
// V7 P3.4 — Routing API: POST/GET /api/routing/config
// ----------------------------------------------------------------------------
// POST /api/routing/config
//   body: { campaignId, mode?, antiRepeatWindow?, jitterMaxMs?, primaryEmail?,
//           senders? }
//   → persists per-campaign routing config (MongoDB "routing_configs"),
//     rebuilds the Redis route pools for that campaign (senders + optional
//     names/subjects feeds), returns the saved config + pool stats.
//
// GET /api/routing/config?campaignId=
//   → current config + pool stats (pool sizes, last 20 audit entries).
//
// Auth: admin session cookie (token=...) via hardened auth (requireAdmin).
// ============================================================================
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import {
  setRoutingConfig,
  getRoutingConfig,
  getPoolStats,
  buildSenderPool,
  refillRoutePool,
  poolCountRoute,
  determineMode,
  computeAntiRepeatK,
} from '@/lib/routing/rotationStrategy';
import { probeSenders } from '@/lib/routing/capabilityProbe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// POST — set routing config + rebuild pools
// ---------------------------------------------------------------------------
export async function POST(request) {
  // Auth gate: every route is protected (S2 security law)
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
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const { campaignId, mode, antiRepeatWindow, jitterMaxMs, primaryEmail, senders } = body || {};

  if (!campaignId || typeof campaignId !== 'string') {
    return NextResponse.json(
      { ok: false, error: 'campaignId is required (string).' },
      { status: 400 },
    );
  }

  // Validate optional fields
  const patch = { campaignId };
  if (mode != null) {
    if (!['auto', 'ROTATE_POOL', 'LOCK_MAIN'].includes(mode)) {
      return NextResponse.json(
        { ok: false, error: 'mode must be one of: auto, ROTATE_POOL, LOCK_MAIN.' },
        { status: 400 },
      );
    }
    patch.mode = mode;
  }
  if (antiRepeatWindow != null) {
    const w = Number(antiRepeatWindow);
    if (!Number.isFinite(w) || w < 0 || w > 20) {
      return NextResponse.json(
        { ok: false, error: 'antiRepeatWindow must be a number in [0, 20].' },
        { status: 400 },
      );
    }
    patch.antiRepeatWindow = Math.floor(w);
  }
  if (jitterMaxMs != null) {
    const j = Number(jitterMaxMs);
    if (!Number.isFinite(j) || j < 0 || j > 5000) {
      return NextResponse.json(
        { ok: false, error: 'jitterMaxMs must be a number in [0, 5000].' },
        { status: 400 },
      );
    }
    patch.jitterMaxMs = Math.floor(j);
  }
  if (primaryEmail != null) {
    if (typeof primaryEmail !== 'string' || primaryEmail.length > 320) {
      return NextResponse.json(
        { ok: false, error: 'primaryEmail must be a string (max 320 chars).' },
        { status: 400 },
      );
    }
    patch.primaryEmail = primaryEmail.toLowerCase().trim();
  }

  // Persist config
  const saved = await setRoutingConfig(String(campaignId), patch);

  // Rebuild the sender pool if senders provided
  let poolResult = { sendersPushed: 0, mode: 'auto', k: 0 };
  if (Array.isArray(senders) && senders.length > 0) {
    // Probe capabilities for any senders missing them (best-effort)
    const probed = await probeSenders(senders);
    const activeSenders = senders.map((s, i) => ({
      ...s,
      capabilities: probed[i]?.capabilities || s.capabilities || {},
    })).filter((s) => s.email && s.status !== 'invalid');

    const pushed = await buildSenderPool(String(campaignId), activeSenders);
    const resolvedMode = determineMode(activeSenders, saved);
    const k = computeAntiRepeatK(activeSenders.length, saved.antiRepeatWindow);
    poolResult = { sendersPushed: pushed, mode: resolvedMode, k };
  }

  // Return saved config + pool stats
  const stats = await getPoolStats(String(campaignId));
  return NextResponse.json({
    ok: true,
    config: saved,
    pool: poolResult,
    stats,
  });
}

// ---------------------------------------------------------------------------
// GET — current config + pool stats
// ---------------------------------------------------------------------------
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error || 'Unauthorized' },
      { status: auth.status || 401 },
    );
  }

  const url = new URL(request.url);
  const campaignId = url.searchParams.get('campaignId');

  if (!campaignId) {
    return NextResponse.json(
      { ok: false, error: 'campaignId query parameter is required.' },
      { status: 400 },
    );
  }

  const config = await getRoutingConfig(String(campaignId));
  const stats = await getPoolStats(String(campaignId));

  return NextResponse.json({
    ok: true,
    config,
    stats,
  });
}
