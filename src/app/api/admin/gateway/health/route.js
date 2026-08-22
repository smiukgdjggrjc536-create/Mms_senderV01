// ============================================================================
// Email-to-MMS Gateway Engine — Real-Time Health Metrics (Phase 4, Step 1)
// ============================================================================
// GET /api/admin/gateway/health
//
// Returns a live snapshot of the entire Email-to-MMS Gateway engine so the
// Admin Panel dashboard can render:
//   • Account pool health — Active / Cooldown / Suspended counts + per-account
//     detail (sent today, daily limit, last error, cooldown expiry).
//   • Throughput — total messages sent today across all accounts vs. the
//     combined daily capacity of the pool.
//   • Carrier Cache hit ratio — how many carrier lookups were served from
//     the MongoDB cache vs. how many required an external API call.
//   • Delivery pipeline — recent DeliveryReport counts grouped by status
//     (sent / failed / spam-blocked) for the last 24h.
//
// NON-DESTRUCTIVE: brand-new route file. Reuses the project's shared auth
// + response helpers from @/lib/core. Does NOT modify any existing route.
// ============================================================================

import {
  connectDB,
  verifyToken,
  jsonResponse,
  EmailAccount,
  CarrierCache,
  SystemConfig,
  ActivityLog,
  DeliveryReport,
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
// GET /api/admin/gateway/health
// ---------------------------------------------------------------------------
export async function GET(req) {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
    await connectDB();

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // ── 1. Account pool aggregation ──────────────────────────────────────
    const accounts = await EmailAccount.find({}).sort({ createdAt: 1 }).lean();

    // Compute live status (cooldown may have expired since last write).
    const liveAccounts = accounts.map((acc) => {
      let liveStatus = acc.status || 'ACTIVE';
      if (liveStatus === 'COOLDOWN' && acc.cooldownUntil && new Date(acc.cooldownUntil) <= now) {
        liveStatus = 'ACTIVE';
      }
      return {
        _id: acc._id,
        email: acc.email,
        provider: acc.provider,
        label: acc.label || '',
        status: liveStatus,
        storedStatus: acc.status,
        sentToday: acc.sentToday || 0,
        dailyLimit: acc.dailyLimit || 400,
        consecutiveBounces: acc.consecutiveBounces || 0,
        cooldownUntil: acc.cooldownUntil,
        lastUsedAt: acc.lastUsedAt,
        lastError: acc.lastError || null,
        usable: liveStatus === 'ACTIVE' && (acc.sentToday || 0) < (acc.dailyLimit || 400),
      };
    });

    const statusCounts = {
      active: liveAccounts.filter((a) => a.status === 'ACTIVE').length,
      cooldown: liveAccounts.filter((a) => a.status === 'COOLDOWN').length,
      suspended: liveAccounts.filter((a) => a.status === 'SUSPENDED').length,
    };

    // ── 2. Throughput: sent today vs daily capacity ──────────────────────
    const totalSentToday = liveAccounts.reduce((sum, a) => sum + (a.sentToday || 0), 0);
    const totalDailyCapacity = liveAccounts.reduce((sum, a) => sum + (a.dailyLimit || 400), 0);
    const totalRemainingToday = Math.max(0, totalDailyCapacity - totalSentToday);
    const utilizationPct = totalDailyCapacity > 0
      ? Math.round((totalSentToday / totalDailyCapacity) * 10000) / 100
      : 0;

    // ── 3. Carrier cache hit ratio ───────────────────────────────────────
    // The carrier lookup engine (Phase 2) records an ActivityLog entry every
    // time it resolves a carrier: "carrier_cache_hit" (served from MongoDB)
    // or "carrier_api_lookup" (called the external lookup API). We count
    // these over the last 24h to compute a real hit ratio. If no activity
    // logs exist yet, we report the raw cache size and a 0% ratio.
    const cacheHitCount = await ActivityLog.countDocuments({
      action: 'carrier_cache_hit',
      timestamp: { $gte: twentyFourHoursAgo },
    });
    const cacheApiCount = await ActivityLog.countDocuments({
      action: 'carrier_api_lookup',
      timestamp: { $gte: twentyFourHoursAgo },
    });
    const cacheTotalLookups = cacheHitCount + cacheApiCount;
    const cacheHitRatio = cacheTotalLookups > 0
      ? Math.round((cacheHitCount / cacheTotalLookups) * 10000) / 100
      : 0;

    const cacheEntries = await CarrierCache.countDocuments();
    const cacheExpired = await CarrierCache.countDocuments({
      ttlExpiresAt: { $lte: now },
    });
    const cacheActive = Math.max(0, cacheEntries - cacheExpired);

    // ── 4. Delivery pipeline (last 24h) ──────────────────────────────────
    const deliveryAgg = await DeliveryReport.aggregate([
      { $match: { sentAt: { $gte: twentyFourHoursAgo } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const deliveryByStatus = {};
    deliveryAgg.forEach((row) => { deliveryByStatus[row._id || 'unknown'] = row.count; });

    // Count spam-blocked sends in the last 24h (errorCode carries the
    // BLOCKED_BY_SAFETY_FILTER marker written by the safety filter).
    const spamBlocked24h = await DeliveryReport.countDocuments({
      sentAt: { $gte: twentyFourHoursAgo },
      errorCode: 'BLOCKED_BY_SAFETY_FILTER',
    });

    // ── 5. System config summary ─────────────────────────────────────────
    const cfg = await SystemConfig.findOne({}) || {};
    const configSummary = {
      routingDelaySeconds: cfg.routingDelaySeconds ?? 3,
      batchSizePerAccount: cfg.batchSizePerAccount ?? 5,
      enablePhishingFilter: cfg.enablePhishingFilter ?? true,
      hasGeminiKey: Boolean(cfg.geminiApiKey),
      hasCarrierLookupKey: Boolean(cfg.carrierLookupApiKey),
      hasRenderDeployUrl: Boolean(cfg.renderDeployUrl),
      blockedKeywordsCount: Array.isArray(cfg.blockedKeywords) ? cfg.blockedKeywords.length : 4,
    };

    // ── 6. Assemble response ─────────────────────────────────────────────
    return jsonResponse({
      success: true,
      timestamp: now.toISOString(),
      accountPool: {
        total: liveAccounts.length,
        ...statusCounts,
        usable: liveAccounts.filter((a) => a.usable).length,
        accounts: liveAccounts,
      },
      throughput: {
        sentToday: totalSentToday,
        dailyCapacity: totalDailyCapacity,
        remainingToday: totalRemainingToday,
        utilizationPct,
      },
      carrierCache: {
        totalEntries: cacheEntries,
        activeEntries: cacheActive,
        expiredEntries: cacheExpired,
        lookups24h: cacheTotalLookups,
        cacheHits24h: cacheHitCount,
        apiCalls24h: cacheApiCount,
        hitRatioPct: cacheHitRatio,
      },
      delivery24h: {
        byStatus: deliveryByStatus,
        spamBlocked: spamBlocked24h,
        total: Object.values(deliveryByStatus).reduce((s, c) => s + c, 0),
      },
      config: configSummary,
    });
  } catch (err) {
    console.error('[gateway/health GET] error:', err);
    return jsonResponse({ error: 'Internal server error', detail: err.message }, 500);
  }
}
