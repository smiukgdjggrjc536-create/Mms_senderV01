// ============================================================================
// V7 P3.4 — Routing API: POST /api/routing/test
// ----------------------------------------------------------------------------
// POST /api/routing/test
//   body: { campaignId, senders?, names?, subjects?, count?, mode?, primaryEmail? }
//   → dry-run: resolves `count` (default 10) routes for a campaign WITHOUT
//     sending. Returns the (email, name, subjectRouteId, jitter) combos for
//     human inspection in the UI (Account 3 renders this).
//
// If senders/names/subjects are provided in the body, the route pools are
// populated from them before resolving (so the operator can test a candidate
// pool without persisting a config first). Otherwise existing pools are used.
//
// Auth: admin session cookie (token=...) via hardened auth (requireAdmin).
// ============================================================================
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import {
  dryRunResolve,
  buildSenderPool,
  refillRoutePool,
  poolCountRoute,
  determineMode,
} from '@/lib/routing/rotationStrategy';
import { probeSenders } from '@/lib/routing/capabilityProbe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  // Auth gate
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

  const {
    campaignId,
    senders,
    names,
    subjects,
    count,
    mode,
    primaryEmail,
  } = body || {};

  if (!campaignId || typeof campaignId !== 'string') {
    return NextResponse.json(
      { ok: false, error: 'campaignId is required (string).' },
      { status: 400 },
    );
  }

  // Validate count
  let resolveCount = 10;
  if (count != null) {
    const c = Number(count);
    if (!Number.isFinite(c) || c < 1 || c > 100) {
      return NextResponse.json(
        { ok: false, error: 'count must be a number in [1, 100].' },
        { status: 400 },
      );
    }
    resolveCount = Math.floor(c);
  }

  const cid = String(campaignId);

  // Populate pools from body if provided (does not persist config)
  let poolInfo = { senders: 0, names: 0, subjects: 0 };
  let activeSenders = [];

  if (Array.isArray(senders) && senders.length > 0) {
    // Probe capabilities (best-effort) so mode determination is accurate
    const probed = await probeSenders(senders);
    activeSenders = senders
      .map((s, i) => ({
        ...s,
        capabilities: probed[i]?.capabilities || s.capabilities || {},
      }))
      .filter((s) => s.email && s.status !== 'invalid');
    const pushed = await buildSenderPool(cid, activeSenders);
    poolInfo.senders = pushed;
  } else {
    poolInfo.senders = await poolCountRoute('senders', cid);
  }

  if (Array.isArray(names) && names.length > 0) {
    const pushed = await refillRoutePool('names', cid, async () => names);
    poolInfo.names = pushed;
  } else {
    poolInfo.names = await poolCountRoute('names', cid);
  }

  if (Array.isArray(subjects) && subjects.length > 0) {
    const pushed = await refillRoutePool('subjects', cid, async () => subjects);
    poolInfo.subjects = pushed;
  } else {
    poolInfo.subjects = await poolCountRoute('subjects', cid);
  }

  // Determine the effective mode for reporting
  const effectiveMode = mode
    ? (['ROTATE_POOL', 'LOCK_MAIN'].includes(mode) ? mode : 'auto')
    : 'auto';

  // Build the campaign object for dryRunResolve
  const campaign = {
    id: cid,
    senders: activeSenders.length > 0 ? activeSenders : undefined,
    primaryEmail: primaryEmail || '',
  };

  // If an explicit mode is requested, we pass it through the config so
  // dryRunResolve's determineMode honors it.
  const dryRunConfig = { mode: effectiveMode, jitterMaxMs: 1500 };
  if (primaryEmail) dryRunConfig.primaryEmail = primaryEmail;

  const combos = await dryRunResolve(
    { ...campaign, _dryRunConfig: dryRunConfig },
    resolveCount,
  );

  // Compute the resolved mode for reporting
  const resolvedMode = combos.length > 0 ? combos[0].mode : 'LOCK_MAIN';

  // Uniqueness analysis for the operator
  const emailSet = new Set(combos.map((c) => c.fromEmail));
  const nameSet = new Set(combos.map((c) => c.fromName).filter(Boolean));
  const subjSet = new Set(combos.map((c) => c.subjectRouteId).filter(Boolean));

  return NextResponse.json({
    ok: true,
    campaignId: cid,
    mode: resolvedMode,
    count: combos.length,
    combos,
    poolSizes: poolInfo,
    uniqueness: {
      uniqueEmails: emailSet.size,
      uniqueNames: nameSet.size,
      uniqueSubjects: subjSet.size,
    },
  });
}
