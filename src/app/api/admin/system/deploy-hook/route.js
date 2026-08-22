// ============================================================================
// Email-to-MMS Gateway Engine — Render.com Deploy Hook (Phase 4, Step 3)
// ============================================================================
// POST /api/admin/system/deploy-hook
//
// Triggers a fresh deploy on Render.com by POSTing to the Deploy Hook URL
// stored in the SystemConfig singleton (renderDeployUrl field, added in
// Phase 4). This lets the Admin Panel re-deploy the service after gateway
// configuration or email-account changes without leaving the dashboard.
//
// Body (optional):
//   { "clearCache": true }   — pass clearCache: true to Render (if supported)
//   { "force": true }        — trigger even if renderDeployUrl looks unset
//                              (requires explicit URL in body via "url")
//   { "url": "https://..." } — override the stored deploy URL for this call
//
// Response:
//   { success, message, deployed, renderStatus, renderResponse }
//
// NON-DESTRUCTIVE: brand-new route file. Reuses shared auth + response
// helpers. Logs the trigger via logActivity for the audit trail.
// ============================================================================

import {
  connectDB,
  verifyToken,
  jsonResponse,
  SystemConfig,
  logActivity,
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
// POST /api/admin/system/deploy-hook
// ---------------------------------------------------------------------------
export async function POST(req) {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
    await connectDB();

    // Parse optional body.
    let body = {};
    try {
      body = await req.json() || {};
    } catch (_e) {
      // Body is optional.
    }

    const clearCache = body.clearCache === true;
    const force = body.force === true;

    // Resolve the deploy URL: body override > stored config.
    let deployUrl = (typeof body.url === 'string' && body.url.trim()) || '';
    if (!deployUrl) {
      const cfg = await SystemConfig.findOne({});
      deployUrl = (cfg && typeof cfg.renderDeployUrl === 'string') ? cfg.renderDeployUrl.trim() : '';
    }

    if (!deployUrl) {
      return jsonResponse({
        error: 'No Render Deploy URL configured. Set renderDeployUrl in the gateway config or pass it via the "url" body field.',
      }, 400);
    }

    // Basic URL validation — must be https.
    try {
      const parsed = new URL(deployUrl);
      if (parsed.protocol !== 'https:') {
        return jsonResponse({ error: 'Render Deploy URL must use HTTPS' }, 400);
      }
    } catch (_e) {
      return jsonResponse({ error: 'Invalid Render Deploy URL format' }, 400);
    }

    // Trigger the deploy on Render. Render deploy hooks accept POST with an
    // optional JSON body { clearCache: true }.
    let renderStatus = null;
    let renderResponseText = '';
    let deployed = false;

    try {
      const fetchOpts = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ clearCache }),
        // Don't follow redirects — Render returns 202 on success.
        redirect: 'manual',
      };

      const renderRes = await fetch(deployUrl, fetchOpts);
      renderStatus = renderRes.status;
      renderResponseText = await renderRes.text().catch(() => '');

      // Render deploy hooks return 202 (Accepted) or 200 on success.
      // Some hooks return 201. Treat any 2xx as success.
      if (renderStatus >= 200 && renderStatus < 300) {
        deployed = true;
      }
    } catch (fetchErr) {
      // Network error reaching Render — report it but don't 500 the API.
      renderStatus = 0;
      renderResponseText = fetchErr.message;
      deployed = false;
    }

    // Audit log.
    await logActivity(
      auth.decoded.userId || auth.decoded.id || null,
      auth.decoded.role || 'admin',
      auth.decoded.email || 'admin',
      'deploy_hook',
      `Render deploy hook triggered. URL set, clearCache=${clearCache}, force=${force}. Render responded ${renderStatus} (${deployed ? 'success' : 'failed'}).`,
      null
    );

    if (!deployed) {
      return jsonResponse({
        success: false,
        message: `Render deploy hook failed (HTTP ${renderStatus})`,
        deployed: false,
        renderStatus,
        renderResponse: renderResponseText.slice(0, 500),
      }, 502);
    }

    return jsonResponse({
      success: true,
      message: 'Render deploy triggered successfully',
      deployed: true,
      renderStatus,
      renderResponse: renderResponseText.slice(0, 500) || 'Accepted',
      triggeredAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[system/deploy-hook POST] error:', err);
    return jsonResponse({ error: 'Internal server error', detail: err.message }, 500);
  }
}
