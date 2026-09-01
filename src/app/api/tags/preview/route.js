// ============================================================================
// V7 P2.5 — Tag API Routes: /api/tags/preview
// ============================================================================
// POST /api/tags/preview
//   Body: { html, sampleCount }
//   Renders html with sampleCount independently generated maps → returns
//   array of rendered bodies.
//
// Used by the UI preview and by Account 3's Body Lab.
// Auth: session cookie (token=...).
// ============================================================================

import { connectDB, verifyToken, jsonResponse } from '@/lib/core';
import { buildRecipientMap, generateSendAttemptId } from '@/lib/tagEngine/mappingEngine.js';
import { applyTags } from '@/lib/tagEngine/applier.js';

// ---------------------------------------------------------------------------
// Auth helper — mirrors /api/admin/system/diagnostics/route.js
// ---------------------------------------------------------------------------
function getTokenFromReq(req) {
  const cookieHeader = req.headers.get('cookie') || '';
  const tokenMatch = cookieHeader.match(/token=([^;]+)/);
  return tokenMatch ? tokenMatch[1] : null;
}

async function getSessionUser(req) {
  const token = getTokenFromReq(req);
  if (!token) return null;
  const decoded = await verifyToken(token);
  if (!decoded) return null;
  return decoded;
}

// ---------------------------------------------------------------------------
// POST /api/tags/preview
// Body: { html, sampleCount, campaignId?, recipient? }
// ---------------------------------------------------------------------------
export async function POST(req) {
  try {
    await connectDB();
    const user = await getSessionUser(req);
    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    const userId = user.userId || user.email || user.sub || 'unknown';

    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    if (!body || !body.html) {
      return jsonResponse({ error: 'html is required' }, 400);
    }

    const sampleCount = Math.min(Math.max(Number(body.sampleCount) || 3, 1), 50);
    const campaignId = body.campaignId || 'preview';
    const recipientEmail = body.recipient || 'preview@example.com';

    // Build a fake campaign object for the mapping engine
    const fakeCampaign = {
      _id: campaignId,
      body: body.html,
      subject: body.subject || '',
      userId,
    };

    const rendered = [];
    for (let i = 0; i < sampleCount; i++) {
      // Each sample gets a unique sendAttemptId → unique salt → unique values
      const sendAttemptId = await generateSendAttemptId(campaignId);
      const fakeRecipient = {
        email: recipientEmail,
        name: '',
        city: '',
        zip: '',
        phone: '',
        company: '',
      };
      const map = await buildRecipientMap(fakeRecipient, fakeCampaign, sendAttemptId);
      const renderedHtml = applyTags(body.html, map);
      const renderedSubject = body.subject ? applyTags(body.subject, map) : '';
      rendered.push({
        index: i,
        sendAttemptId,
        body: renderedHtml,
        subject: renderedSubject,
        map: Object.fromEntries(map),
      });
    }

    return jsonResponse({ ok: true, samples: rendered, count: rendered.length }, 200);
  } catch (err) {
    console.error('[/api/tags/preview POST] error:', err);
    return jsonResponse({ error: 'Internal server error', detail: err.message }, 500);
  }
}
