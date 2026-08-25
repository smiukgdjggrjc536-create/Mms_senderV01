// ============================================================================
// Open Tracking Pixel — /api/track/open?c=<campaignId>&r=<recipientEmail>&t=<ts>
// ============================================================================
// Returns a 1x1 transparent GIF and logs the email open event.
// This endpoint is public (no auth) — the tracking pixel is embedded in
// outgoing emails and loaded by the recipient's mail client.
// ============================================================================
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 1x1 transparent GIF (43 bytes)
const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const campaignId = url.searchParams.get('c') || 'unknown';
    const recipient = url.searchParams.get('r') || 'unknown';

    // Best-effort: log the open event to the database
    try {
      const { connectDB, OpenEvent } = await import('@/lib/core');
      if (connectDB && OpenEvent) {
        await connectDB();
        await OpenEvent.create({
          campaignId,
          recipientEmail: recipient,
          openedAt: new Date(),
          userAgent: req.headers.get('user-agent') || '',
          ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '',
        });
      }
    } catch (_e) {
      // Non-fatal — tracking is best-effort
    }

    return new NextResponse(PIXEL_GIF, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Content-Length': PIXEL_GIF.length.toString(),
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (_err) {
    // Even on error, return the pixel so the email doesn't show a broken image
    return new NextResponse(PIXEL_GIF, {
      status: 200,
      headers: { 'Content-Type': 'image/gif' },
    });
  }
}
