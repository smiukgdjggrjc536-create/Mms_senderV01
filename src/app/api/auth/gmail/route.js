// ============================================================================
// Gmail OAuth2 — Initiate consent flow
// ============================================================================
// GET /api/auth/gmail?state=<base64-config>
//
// The admin panel uploads a candidates.json (Google OAuth client credentials)
// and enters a label/name. When "Add" is pressed, the frontend base64-encodes
// the { clientId, clientSecret, label, dailyLimit, redirectOrigin } payload
// into the `state` param and redirects the browser here. We build the Google
// OAuth consent URL and 302-redirect the user to Google's permission screen.
//
// Scopes: gmail.send (send-as) — the minimum needed to send MMS-via-email.
// ============================================================================
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
];

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const stateRaw = url.searchParams.get('state');

    if (!stateRaw) {
      return NextResponse.json(
        { error: 'Missing state parameter. Start the OAuth flow from the admin panel.' },
        { status: 400 }
      );
    }

    // Decode the config payload from the state param
    let cfg;
    try {
      const decoded = Buffer.from(stateRaw, 'base64').toString('utf-8');
      cfg = JSON.parse(decoded);
    } catch {
      return NextResponse.json(
        { error: 'Invalid state payload. Please retry from the admin panel.' },
        { status: 400 }
      );
    }

    if (!cfg.clientId || !cfg.clientSecret) {
      return NextResponse.json(
        { error: 'Missing clientId or clientSecret in the uploaded candidates.json.' },
        { status: 400 }
      );
    }

    // The redirect URI must match exactly what's configured in Google Cloud Console.
    // We use the origin that the admin panel was on (passed in state) so it works
    // on Netlify, Vercel, or localhost.
    const origin = cfg.redirectOrigin || url.origin;
    const redirectUri = `${origin}/api/auth/gmail/callback`;

    const params = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent', // force consent so we always get a refresh_token
      state: stateRaw, // pass-through so the callback has the config
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return NextResponse.redirect(authUrl, { status: 302 });
  } catch (err) {
    console.error('[gmail-oauth-initiate] error:', err);
    return NextResponse.json(
      { error: 'Failed to initiate Gmail OAuth', detail: err.message },
      { status: 500 }
    );
  }
}
