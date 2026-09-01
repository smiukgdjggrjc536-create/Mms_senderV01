// ============================================================================
// V7 P2.5 — Tag API Routes: /api/tags
// ============================================================================
// GET    /api/tags          → list built-in + custom tags (auth: session)
// POST   /api/tags          → register custom tag (validates rule shape,
//                             reserves token, duplicate-token rejection)
// DELETE /api/tags?id=      → remove custom tag (owner-only)
//
// Auth: session cookie (token=...). Admin OR user role allowed (custom tags
// are per-user). Uses the project's verifyToken from core.
// ============================================================================

import { connectDB, verifyToken, jsonResponse } from '@/lib/core';
import {
  BUILTIN_TAGS,
  listCustomTags,
  registerCustomTag,
  removeCustomTag,
  validateCustomTagRule,
  _resetRegistry,
} from '@/lib/tagEngine/tagRegistry.js';

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
// GET /api/tags → list built-in + custom tags
// ---------------------------------------------------------------------------
export async function GET(req) {
  try {
    await connectDB();
    const user = await getSessionUser(req);
    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    const userId = user.userId || user.email || user.sub || 'unknown';
    const customs = await listCustomTags(userId);
    return jsonResponse({
      builtin: BUILTIN_TAGS,
      custom: customs,
      total: BUILTIN_TAGS.length + customs.length,
    }, 200);
  } catch (err) {
    console.error('[/api/tags GET] error:', err);
    return jsonResponse({ error: 'Internal server error', detail: err.message }, 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/tags → register custom tag
// Body: { token, rule }
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

    if (!body || !body.token) {
      return jsonResponse({ error: 'token is required' }, 400);
    }
    if (!body.rule) {
      return jsonResponse({ error: 'rule is required' }, 400);
    }

    // Validate rule shape before registering
    const ruleCheck = validateCustomTagRule(body.rule);
    if (!ruleCheck.valid) {
      return jsonResponse({ error: `Invalid rule: ${ruleCheck.error}` }, 400);
    }

    const result = await registerCustomTag({
      token: body.token,
      rule: body.rule,
      userId,
    });

    if (!result.ok) {
      return jsonResponse({ error: result.error }, 409);
    }
    return jsonResponse({ ok: true, tag: result.tag }, 201);
  } catch (err) {
    console.error('[/api/tags POST] error:', err);
    return jsonResponse({ error: 'Internal server error', detail: err.message }, 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/tags?id= → remove custom tag (owner-only)
// ---------------------------------------------------------------------------
export async function DELETE(req) {
  try {
    await connectDB();
    const user = await getSessionUser(req);
    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    const userId = user.userId || user.email || user.sub || 'unknown';

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return jsonResponse({ error: 'id query parameter is required' }, 400);
    }

    const result = await removeCustomTag({ id, userId });
    if (!result.ok) {
      return jsonResponse({ error: result.error }, 404);
    }
    return jsonResponse({ ok: true }, 200);
  } catch (err) {
    console.error('[/api/tags DELETE] error:', err);
    return jsonResponse({ error: 'Internal server error', detail: err.message }, 500);
  }
}
