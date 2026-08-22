// ============================================================================
// Email-to-MMS Gateway Engine — Render.com Deploy Hook (Phase 4, Step 3)
// ============================================================================
// POST /api/admin/system/deploy-hook
//
// Triggers a fresh deploy on Render.com. Supports TWO modes:
//
//   1. WEBHOOK mode (legacy)  — POST to a stored/override Render deploy-hook URL.
//      Body: { "url": "https://api.render.com/deploy/xxx" }
//
//   2. DIRECT API mode (auto) — Call the Render REST API directly using the
//      service ID + API token. This is the DEFAULT when no webhook URL is
//      configured, so the admin can deploy with ONE click — no manual URL entry.
//      Body: { "mode": "direct" } or { "clearCache": true }
//      Uses env vars RENDER_SERVICE_ID + RENDER_API_KEY (or stored config).
//
// Body (optional):
//   { "mode": "direct" }     — force direct Render API call
//   { "clearCache": true }   — pass clearCache to Render
//   { "url": "https://..." } — override stored webhook URL (webhook mode)
//
// Response:
//   { success, message, deployed, renderStatus, renderResponse, deployId }
//
// NON-DESTRUCTIVE: preserves all existing webhook logic; adds direct API mode.
// ============================================================================

import {
  connectDB,
  verifyToken,
  jsonResponse,
  SystemConfig,
  logActivity,
} from '@/lib/core';

// ---------------------------------------------------------------------------
// Render service coordinates (fallback defaults so one-click deploy works
// even before the admin configures anything). Can be overridden via env vars
// RENDER_SERVICE_ID / RENDER_API_KEY or via stored SystemConfig fields
// renderServiceId / renderApiKey.
// ---------------------------------------------------------------------------
const DEFAULT_RENDER_SERVICE_ID = process.env.RENDER_SERVICE_ID || 'srv-da4dgirl550s73bssuc0';
const DEFAULT_RENDER_API_KEY = process.env.RENDER_API_KEY || '';

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
// Trigger deploy via Render REST API directly (no webhook URL needed)
// ---------------------------------------------------------------------------
async function triggerRenderDirect(serviceId, apiKey, clearCache) {
  const apiUrl = `https://api.render.com/v1/services/${serviceId}/deploys`;
  const renderRes = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ clearCache: clearCache ? 'clear' : 'do_not_clear' }),
  });
  const status = renderRes.status;
  const text = await renderRes.text().catch(() => '');
  let deployId = null;
  try {
    const parsed = JSON.parse(text);
    deployId = parsed.id || null;
  } catch (_e) { /* not JSON */ }
  return { status, text, deployId, deployed: status >= 200 && status < 300 };
}

// ---------------------------------------------------------------------------
// Trigger deploy via webhook URL (legacy / manual mode)
// ---------------------------------------------------------------------------
async function triggerRenderWebhook(deployUrl, clearCache) {
  const renderRes = await fetch(deployUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ clearCache }),
    redirect: 'manual',
  });
  const status = renderRes.status;
  const text = await renderRes.text().catch(() => '');
  return { status, text, deployId: null, deployed: status >= 200 && status < 300 };
}

// ---------------------------------------------------------------------------
// POST /api/admin/system/deploy-hook
// ---------------------------------------------------------------------------
export async function POST(req) {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
    await connectDB();

    let body = {};
    try { body = await req.json() || {}; } catch (_e) { /* body optional */ }

    const clearCache = body.clearCache === true;
    const forceDirect = body.mode === 'direct' || body.direct === true;

    // Resolve stored config (may contain renderDeployUrl, renderServiceId, renderApiKey)
    const cfg = await SystemConfig.findOne({});
    const storedWebhookUrl = (cfg && typeof cfg.renderDeployUrl === 'string') ? cfg.renderDeployUrl.trim() : '';
    const storedServiceId = (cfg && typeof cfg.renderServiceId === 'string') ? cfg.renderServiceId.trim() : '';
    const storedApiKey = (cfg && typeof cfg.renderApiKey === 'string') ? cfg.renderApiKey.trim() : '';

    // Override webhook URL from body if provided
    const webhookUrl = (typeof body.url === 'string' && body.url.trim()) || storedWebhookUrl;

    // Resolve Render API credentials for direct mode
    const serviceId = storedServiceId || DEFAULT_RENDER_SERVICE_ID;
    const apiKey = storedApiKey || DEFAULT_RENDER_API_KEY;

    // Decide mode: direct if forced, or if we have API key+serviceId and no webhook URL
    let useDirect = forceDirect;
    if (!webhookUrl && apiKey) useDirect = true;
    if (webhookUrl && !forceDirect) useDirect = false; // prefer webhook if configured

    let result;

    if (useDirect) {
      if (!apiKey) {
        return jsonResponse({
          error: 'No Render API key available. Set RENDER_API_KEY env var or renderApiKey in gateway config, or configure a Render Deploy Webhook URL.',
        }, 400);
      }
      try {
        result = await triggerRenderDirect(serviceId, apiKey, clearCache);
      } catch (fetchErr) {
        result = { status: 0, text: fetchErr.message, deployId: null, deployed: false };
      }
    } else {
      // Webhook mode
      if (!webhookUrl) {
        return jsonResponse({
          error: 'No Render deploy URL configured and no Render API key set. Configure either a Render Deploy Webhook URL (in Gateway Settings) or set RENDER_API_KEY + RENDER_SERVICE_ID.',
        }, 400);
      }
      try {
        new URL(webhookUrl); // validate
      } catch (_e) {
        return jsonResponse({ error: 'Invalid Render Deploy URL format' }, 400);
      }
      try {
        result = await triggerRenderWebhook(webhookUrl, clearCache);
      } catch (fetchErr) {
        result = { status: 0, text: fetchErr.message, deployId: null, deployed: false };
      }
    }

    const { status: renderStatus, text: renderResponseText, deployId, deployed } = result;

    // Audit log
    await logActivity(
      auth.decoded.userId || auth.decoded.id || null,
      auth.decoded.role || 'admin',
      auth.decoded.email || 'admin',
      'deploy_hook',
      `Render deploy triggered via ${useDirect ? 'DIRECT API' : 'WEBHOOK'} mode. Service: ${serviceId ? serviceId.slice(0,12)+'...' : 'n/a'}, clearCache=${clearCache}. Render responded ${renderStatus} (${deployed ? 'success' : 'failed'}).${deployId ? ' Deploy ID: '+deployId : ''}`,
      null
    );

    if (!deployed) {
      return jsonResponse({
        success: false,
        message: `Render deploy failed (HTTP ${renderStatus})`,
        deployed: false,
        mode: useDirect ? 'direct' : 'webhook',
        renderStatus,
        renderResponse: renderResponseText.slice(0, 500),
      }, 502);
    }

    return jsonResponse({
      success: true,
      message: 'Render deploy triggered successfully',
      deployed: true,
      mode: useDirect ? 'direct' : 'webhook',
      renderStatus,
      deployId,
      renderResponse: renderResponseText.slice(0, 500) || 'Accepted',
      triggeredAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[system/deploy-hook POST] error:', err);
    return jsonResponse({ error: 'Internal server error', detail: err.message }, 500);
  }
}

// ---------------------------------------------------------------------------
// GET /api/admin/system/deploy-hook — check Render deploy status
// ---------------------------------------------------------------------------
export async function GET(req) {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
    await connectDB();

    const cfg = await SystemConfig.findOne({});
    const storedServiceId = (cfg && typeof cfg.renderServiceId === 'string') ? cfg.renderServiceId.trim() : '';
    const storedApiKey = (cfg && typeof cfg.renderApiKey === 'string') ? cfg.renderApiKey.trim() : '';
    const serviceId = storedServiceId || DEFAULT_RENDER_SERVICE_ID;
    const apiKey = storedApiKey || DEFAULT_RENDER_API_KEY;

    if (!apiKey) {
      return jsonResponse({ success: false, error: 'No Render API key configured' }, 400);
    }

    // Get recent deploys
    const res = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys?limit=3`, {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
    });
    const data = await res.json().catch(() => []);
    const deploys = (Array.isArray(data) ? data : []).map(d => ({
      id: d.id,
      status: d.status,
      createdAt: d.createdAt,
      commit: d.commit ? { id: d.commit.id?.slice(0,8), message: d.commit.message?.slice(0,80) } : null,
    }));

    return jsonResponse({ success: true, serviceId: serviceId.slice(0,12)+'...', deploys });
  } catch (err) {
    console.error('[system/deploy-hook GET] error:', err);
    return jsonResponse({ error: 'Internal server error', detail: err.message }, 500);
  }
}
