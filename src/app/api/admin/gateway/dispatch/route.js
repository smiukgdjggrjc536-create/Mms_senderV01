// ============================================================================
// MODULE 2: Dispatch Endpoint — Enqueue Real Send Jobs
// ============================================================================
// POST /api/admin/gateway/dispatch
//
// Enqueues real MMS send jobs into the BullMQ queue. The queue worker
// processes each job through the full pipeline:
//   1. Weighted round-robin account selection (Module 3)
//   2. Token bucket rate limiting (Module 3)
//   3. Micro-delay enforcement (Module 3)
//   4. AI polymorphism pre-flight (Module 4)
//   5. Nodemailer / Graph API dispatch
//   6. Circuit breaker failure recording (Module 5)
//
// Body:
//   { phoneNumber: string, text: string }                    → single send
//   { recipients: [string], text: string }                   → batch send
//   { recipients: [{phoneNumber, name}], text, personalise }  → personalised batch
//
// Response:
//   { success, enqueued, jobId / jobIds, errors }
//
// NON-DESTRUCTIVE: brand-new route file. Reuses shared auth helpers + the
// prepareMms orchestration service.
// ============================================================================

import { connectDB, verifyToken, jsonResponse, logActivity, prepareAndEnqueue, prepareAndEnqueueBatch, getQueueStatus } from '@/lib/core';

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
// POST handler — enqueue send job(s)
// ---------------------------------------------------------------------------
export async function POST(req) {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return jsonResponse({ error: auth.error }, auth.code);
    await connectDB();

    const body = await req.json();
    const ctx = {
      userId: auth.decoded.userId || auth.decoded.id || null,
      actorType: 'admin',
      username: auth.decoded.username || auth.decoded.email || 'admin',
      campaignId: body.campaignId || null,
    };

    // ── Single send ──
    if (body.phoneNumber && body.text) {
      try {
        const result = await prepareAndEnqueue(body.phoneNumber, body.text, ctx, {
          delayMs: body.delayMs || 0,
        });

        await logActivity(
          ctx.userId,
          ctx.actorType,
          ctx.username,
          'dispatch_single',
          `Dispatched MMS to ${body.phoneNumber} (job ${result.jobId})`,
          null
        ).catch(() => {});

        return jsonResponse({
          success: true,
          message: 'MMS dispatch enqueued',
          enqueued: 1,
          jobId: result.jobId,
          mmsAddress: result.mmsAddress,
          aiSource: result.aiSource,
        });
      } catch (err) {
        // Controlled abort (safety block / landline / VOIP).
        if (err.code === 'BLOCKED_BY_SAFETY_FILTER' || /Landline|VOIP|Invalid/.test(err.message)) {
          return jsonResponse({
            success: false,
            aborted: true,
            code: err.code || 'ABORTED',
            error: err.message,
          }, 422);
        }
        throw err;
      }
    }

    // ── Batch send ──
    if (Array.isArray(body.recipients) && body.text) {
      const recipients = body.recipients;
      if (recipients.length === 0) {
        return jsonResponse({ error: 'recipients array is empty' }, 400);
      }
      if (recipients.length > 10000) {
        return jsonResponse({ error: 'Maximum 10,000 recipients per batch' }, 400);
      }

      try {
        const result = await prepareAndEnqueueBatch(recipients, body.text, ctx, {
          delayMs: body.delayMs || 0,
        });

        await logActivity(
          ctx.userId,
          ctx.actorType,
          ctx.username,
          'dispatch_batch',
          `Dispatched batch: ${result.valid} valid, ${result.rejected} rejected, ${result.enqueued} enqueued`,
          null
        ).catch(() => {});

        return jsonResponse({
          success: true,
          message: `Batch dispatched: ${result.enqueued} enqueued, ${result.rejected} rejected`,
          total: result.total,
          valid: result.valid,
          rejected: result.rejected,
          enqueued: result.enqueued,
          results: result.results,
          errors: result.errors.length > 0 ? result.errors.slice(0, 50) : undefined,
        });
      } catch (err) {
        throw err;
      }
    }

    return jsonResponse({
      error: 'Provide either { phoneNumber, text } for a single send or { recipients: [...], text } for a batch',
    }, 400);
  } catch (err) {
    console.error('[gateway/dispatch POST] error:', err);
    return jsonResponse({ error: 'Internal server error', detail: err.message }, 500);
  }
}

// ---------------------------------------------------------------------------
// GET handler — dispatch queue status
// ---------------------------------------------------------------------------
export async function GET(req) {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return jsonResponse({ error: auth.error }, auth.code);

    const status = await getQueueStatus();

    return jsonResponse({
      success: true,
      queue: status,
    });
  } catch (err) {
    console.error('[gateway/dispatch GET] error:', err);
    return jsonResponse({ error: 'Internal server error', detail: err.message }, 500);
  }
}
