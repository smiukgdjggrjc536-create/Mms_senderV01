// ============================================================================
// Email-to-MMS Gateway Engine — Enterprise Webhook Configuration (Phase 5)
// ============================================================================
// GET  /api/admin/system/webhook        — get current webhook config
// POST /api/admin/system/webhook        — update webhook config (url, secret, enabled, events)
// POST /api/admin/system/webhook?test=1 — send a test webhook to the configured URL
//
// Enterprise feature: when deliveries complete (sent/failed/bounced), the
// gateway engine POSTs a JSON payload to the configured webhook URL with an
// HMAC-SHA256 signature header (X-Webhook-Signature) so external systems can
// verify authenticity and track delivery status in real-time.
//
// NON-DESTRUCTIVE: brand-new route file. Uses SystemConfig.webhook* fields
// (added in Phase 5 schema update). Does NOT modify any existing route.
// ============================================================================

import {
  connectDB,
  verifyToken,
  jsonResponse,
  SystemConfig,
  logActivity,
} from '@/lib/core';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Auth helpers
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
// Compute HMAC-SHA256 signature for a webhook payload
// ---------------------------------------------------------------------------
function signPayload(payload, secret) {
  if (!secret) return '';
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

// ---------------------------------------------------------------------------
// Send a test webhook to the configured URL
// ---------------------------------------------------------------------------
async function sendTestWebhook(url, secret) {
  const testPayload = {
    event: 'webhook.test',
    timestamp: new Date().toISOString(),
    data: {
      message: 'This is a test webhook from the Email-to-MMS Gateway Engine.',
      testMode: true,
    },
  };
  const signature = signPayload(testPayload, secret);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Event': 'webhook.test',
        'X-Webhook-Signature': signature,
        'User-Agent': 'MMS-Gateway-Webhook/1.0',
      },
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(10000),
    });
    const responseText = await res.text().catch(() => '');
    return {
      success: res.ok,
      statusCode: res.status,
      responsePreview: responseText.slice(0, 300),
      signatureSent: signature ? signature.slice(0, 16) + '...' : 'none (no secret set)',
    };
  } catch (err) {
    return { success: false, statusCode: 0, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// GET /api/admin/system/webhook — get current webhook config
// ---------------------------------------------------------------------------
export async function GET(req) {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
    await connectDB();

    const cfg = await SystemConfig.findOne({}) || {};
    return jsonResponse({
      success: true,
      webhook: {
        url: cfg.webhookUrl || '',
        secret: cfg.webhookSecret ? cfg.webhookSecret.slice(0, 4) + '••••' : '',
        enabled: cfg.webhookEnabled || false,
        events: cfg.webhookEvents || ['sent', 'failed', 'bounced'],
        hasSecret: Boolean(cfg.webhookSecret),
      },
    });
  } catch (err) {
    console.error('[system/webhook GET] error:', err);
    return jsonResponse({ error: 'Internal server error', detail: err.message }, 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/system/webhook — update webhook config or send test
// ---------------------------------------------------------------------------
export async function POST(req) {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
    await connectDB();

    let body = {};
    try { body = await req.json() || {}; } catch (_e) { /* empty body OK */ }

    const url = new URL(req.url);
    const isTest = url.searchParams.get('test') === '1' || body.test === true;

    const cfg = await SystemConfig.findOne({}) || new SystemConfig();

    // ── Test mode: send a test webhook to the CURRENTLY STORED config ──
    if (isTest) {
      const testUrl = (typeof body.url === 'string' ? body.url.trim() : '') || cfg.webhookUrl || '';
      const testSecret = (typeof body.secret === 'string' ? body.secret : '') || cfg.webhookSecret || '';

      if (!testUrl) {
        return jsonResponse({ error: 'No webhook URL configured. Set a URL first, or pass it in the body.' }, 400);
      }
      try { new URL(testUrl); } catch (_e) {
        return jsonResponse({ error: 'Invalid webhook URL format' }, 400);
      }

      const result = await sendTestWebhook(testUrl, testSecret);

      await logActivity(
        auth.decoded.userId || auth.decoded.id || null,
        auth.decoded.role || 'admin',
        auth.decoded.email || 'admin',
        'webhook_test',
        `Webhook test sent to ${testUrl.slice(0, 50)}... — ${result.success ? 'SUCCESS' : 'FAILED'} (HTTP ${result.statusCode})`,
        null
      );

      return jsonResponse({
        success: result.success,
        message: result.success ? 'Test webhook delivered successfully' : `Test webhook failed (HTTP ${result.statusCode})`,
        ...result,
        testUrl: testUrl.slice(0, 50) + '...',
      }, result.success ? 200 : 502);
    }

    // ── Update mode: save webhook config ──────────────────────────────
    const updates = {};
    if (typeof body.url === 'string') {
      const trimmed = body.url.trim();
      if (trimmed) {
        try { new URL(trimmed); } catch (_e) {
          return jsonResponse({ error: 'Invalid webhook URL format' }, 400);
        }
      }
      updates.webhookUrl = trimmed;
    }
    if (typeof body.secret === 'string') {
      updates.webhookSecret = body.secret.trim();
    }
    if (typeof body.enabled === 'boolean') {
      updates.webhookEnabled = body.enabled;
    }
    if (Array.isArray(body.events)) {
      const validEvents = body.events.filter(e => ['sent', 'failed', 'bounced', 'delivered', 'spam_blocked'].includes(e));
      updates.webhookEvents = validEvents;
    }

    updates.updatedAt = new Date();

    const updated = await SystemConfig.findOneAndUpdate(
      {},
      { $set: updates },
      { upsert: true, new: true }
    );

    await logActivity(
      auth.decoded.userId || auth.decoded.id || null,
      auth.decoded.role || 'admin',
      auth.decoded.email || 'admin',
      'webhook_config_update',
      `Webhook config updated: url=${(updates.webhookUrl || updated.webhookUrl || '').slice(0,40)}..., enabled=${updates.webhookEnabled ?? updated.webhookEnabled}, events=${(updates.webhookEvents || updated.webhookEvents || []).join(',')}`,
      null
    );

    return jsonResponse({
      success: true,
      message: 'Webhook configuration saved',
      webhook: {
        url: updated.webhookUrl || '',
        secret: updated.webhookSecret ? updated.webhookSecret.slice(0, 4) + '••••' : '',
        enabled: updated.webhookEnabled || false,
        events: updated.webhookEvents || ['sent', 'failed', 'bounced'],
        hasSecret: Boolean(updated.webhookSecret),
      },
    });
  } catch (err) {
    console.error('[system/webhook POST] error:', err);
    return jsonResponse({ error: 'Internal server error', detail: err.message }, 500);
  }
}
