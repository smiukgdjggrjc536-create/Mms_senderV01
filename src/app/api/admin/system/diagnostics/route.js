// ============================================================================
// Email-to-MMS Gateway Engine — Enterprise System Diagnostics (Phase 5)
// ============================================================================
// GET /api/admin/system/diagnostics
//
// Deep system health check that probes EVERY subsystem and returns:
//   • Database connectivity (MongoDB Atlas ping + collection counts)
//   • Gemini AI API (key presence + live test against generativelanguage API)
//   • Email account pool (active/suspended/cooldown, per-provider breakdown)
//   • Carrier cache (entry count, expiry, hit ratio 24h)
//   • Gateway config (key presence: gemini, carrier-lookup, render-deploy)
//   • User accounts (total users, active, suspended, expired)
//   • Delivery pipeline (24h sent/failed/spam-blocked)
//   • Overall system grade (A–F) with actionable recommendations
//
// This is a READ-ONLY diagnostics endpoint — it does NOT modify any data.
// NON-DESTRUCTIVE: brand-new route file, reuses shared auth + models from core.
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
  User,
  GeminiApi,
  Campaign,
} from '@/lib/core';
import { isRedisLive as _isRedisLiveV7 } from '@/lib/redis/client.js';

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
// Probe: Gemini API (lightweight test — just checks if the key can list models)
// ---------------------------------------------------------------------------
async function probeGemini(apiKey, model) {
  if (!apiKey || apiKey.length < 10) {
    return { status: 'not_configured', message: 'No Gemini API key configured' };
  }
  try {
    const testModel = model || 'gemini-flash-lite-latest';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${testModel}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Reply with: OK' }] }],
        generationConfig: { maxOutputTokens: 5, temperature: 0 },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      return { status: 'healthy', message: `Gemini API responding (model: ${testModel})` };
    }
    const errText = await res.text().catch(() => '');
    if (res.status === 400 && errText.includes('API key not valid')) {
      return { status: 'invalid_key', message: 'Gemini API key is invalid or expired' };
    }
    if (res.status === 404) {
      return { status: 'model_not_found', message: `Model "${testModel}" not available for this key` };
    }
    if (res.status === 429) {
      return { status: 'rate_limited', message: 'Gemini API rate limited (free tier quota exceeded)' };
    }
    return { status: 'error', message: `Gemini API returned HTTP ${res.status}` };
  } catch (err) {
    return { status: 'timeout', message: `Gemini API probe timed out: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// Compute overall system grade from probe results
// ---------------------------------------------------------------------------
function computeGrade(probes) {
  let score = 100;
  const deductions = [];

  // Database is critical
  if (probes.database.status !== 'healthy') {
    score -= 40;
    deductions.push('Database unreachable (-40)');
  }

  // Email accounts — at least 1 active needed to send
  if (probes.emailPool.total === 0) {
    score -= 30;
    deductions.push('No email accounts configured (-30)');
  } else if (probes.emailPool.active === 0) {
    score -= 20;
    deductions.push('No active email accounts (-20)');
  }

  // Gemini API
  if (probes.gemini.status === 'not_configured') {
    score -= 15;
    deductions.push('Gemini API not configured (-15)');
  } else if (probes.gemini.status !== 'healthy') {
    score -= 10;
    deductions.push(`Gemini API issue: ${probes.gemini.status} (-10)`);
  }

  // Carrier lookup key
  if (!probes.config.hasCarrierLookupKey) {
    score -= 10;
    deductions.push('Carrier lookup API key not set (-10)');
  }

  // Render deploy URL
  if (!probes.config.hasRenderDeployUrl) {
    score -= 5;
    deductions.push('Render deploy URL not configured (-5)');
  }

  // Spam blocked > 10% of deliveries
  if (probes.delivery.total24h > 10 && probes.delivery.spamBlocked24h / probes.delivery.total24h > 0.1) {
    score -= 10;
    deductions.push('High spam-block rate >10% (-10)');
  }

  // Redis / BullMQ in-memory fallback (P1.4)
  if (probes.redis && !probes.redis.isRedisLive) {
    score -= 10;
    deductions.push('Redis in-memory fallback — state not crash-safe (-10)');
  }

  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';

  return { grade, score, deductions };
}

// ---------------------------------------------------------------------------
// Generate actionable recommendations based on probe results
// ---------------------------------------------------------------------------
function generateRecommendations(probes) {
  const recs = [];

  if (probes.database.status !== 'healthy') {
    recs.push({ priority: 'critical', text: 'Check MongoDB Atlas connection string and network access (IP whitelist).' });
  }
  if (probes.emailPool.total === 0) {
    recs.push({ priority: 'critical', text: 'Add at least one email account (Gmail App Password is easiest — enable 2FA then generate app password).' });
  } else if (probes.emailPool.active === 0) {
    recs.push({ priority: 'high', text: 'All email accounts are in cooldown/suspended. Reset cooldowns or add fresh accounts.' });
  }
  if (probes.emailPool.total > 0 && probes.emailPool.total < 3) {
    recs.push({ priority: 'medium', text: 'Add more email accounts for higher throughput and redundancy (recommended: 3+).' });
  }
  if (probes.gemini.status === 'not_configured') {
    recs.push({ priority: 'high', text: 'Add a Gemini API key from https://aistudio.google.com/apikey (free tier available).' });
  } else if (probes.gemini.status === 'invalid_key') {
    recs.push({ priority: 'high', text: 'Gemini API key is invalid. Generate a new one at https://aistudio.google.com/apikey.' });
  } else if (probes.gemini.status === 'rate_limited') {
    recs.push({ priority: 'medium', text: 'Gemini free tier quota exceeded. Consider adding a second key or upgrading.' });
  } else if (probes.gemini.status === 'model_not_found') {
    recs.push({ priority: 'medium', text: 'Gemini model not available. Try switching to gemini-flash-lite-latest.' });
  }
  if (!probes.config.hasCarrierLookupKey) {
    recs.push({ priority: 'medium', text: 'Configure a carrier lookup API key for HLR validation (improves delivery accuracy).' });
  }
  if (!probes.config.hasRenderDeployUrl) {
    recs.push({ priority: 'low', text: 'Set the Render deploy URL for one-click deploys from the admin panel.' });
  }
  if (probes.delivery.total24h > 10 && probes.delivery.spamBlocked24h / probes.delivery.total24h > 0.1) {
    recs.push({ priority: 'high', text: 'High spam-block rate. Review message content and adjust AI polymorphism settings.' });
  }
  if (probes.carrierCache.totalEntries > 0 && probes.carrierCache.expiredEntries / probes.carrierCache.totalEntries > 0.5) {
    recs.push({ priority: 'low', text: 'More than 50% of carrier cache entries are expired. Consider refreshing.' });
  }
  if (probes.users.expired > 0) {
    recs.push({ priority: 'low', text: `${probes.users.expired} user(s) have expired accounts. Consider cleaning up or renewing.` });
  }

  // Redis / BullMQ fallback (P1.4)
  if (probes.redis && !probes.redis.isRedisLive) {
    recs.push({ priority: 'high', text: 'Set REDIS_URL in environment variables. Without Redis, BullMQ queue, rate limiter, token bucket, and threshold pause/resume use in-memory fallback — state is lost on restart.' });
  }

  if (recs.length === 0) {
    recs.push({ priority: 'info', text: 'All systems operational. No action needed.' });
  }

  return recs;
}

// ---------------------------------------------------------------------------
// GET /api/admin/system/diagnostics
// ---------------------------------------------------------------------------
export async function GET(req) {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
    await connectDB();

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const startTime = Date.now();

    // ── 1. Database probe ──────────────────────────────────────────────
    let dbProbe;
    try {
      // If we got here, connectDB() succeeded — MongoDB is reachable
      const userCount = await User.countDocuments();
      const emailCount = await EmailAccount.countDocuments();
      const campaignCount = await Campaign.countDocuments();
      const geminiCount = await GeminiApi.countDocuments();
      dbProbe = {
        status: 'healthy',
        message: 'MongoDB Atlas connection OK',
        collections: {
          users: userCount,
          emailAccounts: emailCount,
          campaigns: campaignCount,
          geminiApis: geminiCount,
        },
      };
    } catch (err) {
      dbProbe = { status: 'error', message: `Database error: ${err.message}` };
    }

    // ── 2. Gemini API probe ────────────────────────────────────────────
    const cfg = await SystemConfig.findOne({}) || {};
    const geminiKeys = await GeminiApi.find({ status: 'active' }).lean();
    // Filter out placeholder/demo keys (e.g. "demo_gemini_key") — only test real keys
    const realGeminiKeys = geminiKeys.filter(k => k.apiKey && k.apiKey.length > 20 && !k.apiKey.startsWith('demo_'));
    let geminiProbe;
    if (realGeminiKeys.length > 0) {
      // Test the first real key
      geminiProbe = await probeGemini(realGeminiKeys[0].apiKey, realGeminiKeys[0].model);
      geminiProbe.keyCount = geminiKeys.length;
      geminiProbe.realKeyCount = realGeminiKeys.length;
      geminiProbe.models = geminiKeys.map(k => k.model);
    } else if (cfg.geminiApiKey && cfg.geminiApiKey.length > 20 && !cfg.geminiApiKey.startsWith('demo_')) {
      // Fall back to SystemConfig key if no real GeminiApi keys
      geminiProbe = await probeGemini(cfg.geminiApiKey, 'gemini-flash-lite-latest');
      geminiProbe.keyCount = geminiKeys.length;
      geminiProbe.realKeyCount = 0;
      geminiProbe.note = 'Key in SystemConfig only (not in GeminiApi collection)';
    } else {
      geminiProbe = { status: 'not_configured', message: 'No valid Gemini API key found', keyCount: geminiKeys.length, realKeyCount: 0 };
    }

    // ── 3. Email account pool probe ───────────────────────────────────
    const accounts = await EmailAccount.find({}).lean();
    const liveAccounts = accounts.map((acc) => {
      let liveStatus = acc.status || 'ACTIVE';
      if (liveStatus === 'COOLDOWN' && acc.cooldownUntil && new Date(acc.cooldownUntil) <= now) {
        liveStatus = 'ACTIVE';
      }
      return { ...acc, liveStatus };
    });
    const providerBreakdown = {};
    liveAccounts.forEach((a) => {
      providerBreakdown[a.provider] = (providerBreakdown[a.provider] || 0) + 1;
    });
    const emailPoolProbe = {
      total: liveAccounts.length,
      active: liveAccounts.filter((a) => a.liveStatus === 'ACTIVE').length,
      cooldown: liveAccounts.filter((a) => a.liveStatus === 'COOLDOWN').length,
      suspended: liveAccounts.filter((a) => a.liveStatus === 'SUSPENDED').length,
      usable: liveAccounts.filter((a) => a.liveStatus === 'ACTIVE' && (a.sentToday || 0) < (a.dailyLimit || 400)).length,
      totalSentToday: liveAccounts.reduce((s, a) => s + (a.sentToday || 0), 0),
      totalDailyCapacity: liveAccounts.reduce((s, a) => s + (a.dailyLimit || 400), 0),
      providerBreakdown,
    };

    // ── 4. Carrier cache probe ────────────────────────────────────────
    const cacheTotal = await CarrierCache.countDocuments();
    const cacheExpired = await CarrierCache.countDocuments({ ttlExpiresAt: { $lte: now } });
    const cacheHitCount = await ActivityLog.countDocuments({ action: 'carrier_cache_hit', timestamp: { $gte: twentyFourHoursAgo } });
    const cacheApiCount = await ActivityLog.countDocuments({ action: 'carrier_api_lookup', timestamp: { $gte: twentyFourHoursAgo } });
    const cacheTotalLookups = cacheHitCount + cacheApiCount;
    const carrierCacheProbe = {
      totalEntries: cacheTotal,
      activeEntries: Math.max(0, cacheTotal - cacheExpired),
      expiredEntries: cacheExpired,
      lookups24h: cacheTotalLookups,
      hitRatioPct: cacheTotalLookups > 0 ? Math.round((cacheHitCount / cacheTotalLookups) * 10000) / 100 : 0,
    };

    // ── 5. Config probe ───────────────────────────────────────────────
    const configProbe = {
      hasGeminiKey: Boolean(cfg.geminiApiKey),
      hasCarrierLookupKey: Boolean(cfg.carrierLookupApiKey),
      hasRenderDeployUrl: Boolean(cfg.renderDeployUrl),
      routingDelaySeconds: cfg.routingDelaySeconds ?? 3,
      batchSizePerAccount: cfg.batchSizePerAccount ?? 5,
      enablePhishingFilter: cfg.enablePhishingFilter ?? true,
      blockedKeywordsCount: Array.isArray(cfg.blockedKeywords) ? cfg.blockedKeywords.length : 0,
    };

    // ── 6. Users probe ────────────────────────────────────────────────
    const totalUsers = await User.countDocuments({ role: 'user' });
    const activeUsers = await User.countDocuments({ role: 'user', status: 'active' });
    const suspendedUsers = await User.countDocuments({ role: 'user', status: 'suspended' });
    const expiredUsers = await User.countDocuments({
      role: 'user',
      expiryDate: { $lt: now },
    });
    const usersProbe = { total: totalUsers, active: activeUsers, suspended: suspendedUsers, expired: expiredUsers };

    // ── 7. Delivery pipeline probe (24h) ──────────────────────────────
    const deliveryAgg = await DeliveryReport.aggregate([
      { $match: { sentAt: { $gte: twentyFourHoursAgo } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const deliveryByStatus = {};
    deliveryAgg.forEach((row) => { deliveryByStatus[row._id || 'unknown'] = row.count; });
    const deliveryTotal = Object.values(deliveryByStatus).reduce((s, c) => s + c, 0);
    const spamBlocked24h = await DeliveryReport.countDocuments({
      sentAt: { $gte: twentyFourHoursAgo },
      errorCode: 'BLOCKED_BY_SAFETY_FILTER',
    });
    const deliveryProbe = {
      total24h: deliveryTotal,
      byStatus: deliveryByStatus,
      spamBlocked24h,
      spamRatePct: deliveryTotal > 0 ? Math.round((spamBlocked24h / deliveryTotal) * 10000) / 100 : 0,
    };

    // ── 7b. Redis / BullMQ probe (P1.4) ──────────────────────────────
    // Detect if BullMQ + Redis-atomic ops are running on real Redis or
    // silently falling back to in-memory. A silent fallback is a RISK because
    // rate limits, token buckets, and threshold state become process-local
    // and do NOT survive restarts. We flag this loudly.
    const redisProbe = {
      isRedisLive: _isRedisLiveV7(),
      redisUrlConfigured: Boolean(process.env.REDIS_URL || process.env.REDISCLOUD_URL),
      status: _isRedisLiveV7() ? 'healthy' : 'in_memory_fallback',
      message: _isRedisLiveV7()
        ? 'Redis connected — BullMQ, rate limiter, token bucket, and threshold state are shared + crash-safe.'
        : (process.env.REDIS_URL || process.env.REDISCLOUD_URL)
          ? 'Redis URL set but connection failed — BullMQ + atomic ops using IN-MEMORY fallback. State will NOT survive restart.'
          : 'No REDIS_URL configured — BullMQ + atomic ops using IN-MEMORY fallback. Set REDIS_URL in production for crash-safe state.',
      warning: !_isRedisLiveV7(),
    };

    // ── 8. Assemble probes ────────────────────────────────────────────
    const probes = {
      database: dbProbe,
      gemini: geminiProbe,
      emailPool: emailPoolProbe,
      carrierCache: carrierCacheProbe,
      config: configProbe,
      users: usersProbe,
      delivery: deliveryProbe,
      redis: redisProbe,
    };

    // ── 9. Compute grade + recommendations ───────────────────────────
    const { grade, score, deductions } = computeGrade(probes);
    const recommendations = generateRecommendations(probes);

    const elapsedMs = Date.now() - startTime;

    return jsonResponse({
      success: true,
      timestamp: now.toISOString(),
      elapsedMs,
      grade,
      score,
      deductions,
      probes,
      recommendations,
    });
  } catch (err) {
    console.error('[system/diagnostics GET] error:', err);
    return jsonResponse({ error: 'Internal server error', detail: err.message }, 500);
  }
}
