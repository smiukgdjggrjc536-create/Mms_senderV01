// ============================================================================
// Gmail OAuth2 (Desktop credentials.json) — USER PANEL connect flow
// ============================================================================
// POST /api/user/gmail/connect
//   Body: { credentialsJson: <string — raw contents of credentials.json>, label?: string }
//
// The user uploads a Google Cloud Console "Desktop app" credentials.json from
// the user panel (BM2 Ultra "succeded" blue-line section). We:
//   1. Parse the JSON → extract installed.client_id / installed.client_secret
//      (Desktop apps use the "installed" key; web apps use "web").
//   2. Build the Google OAuth consent URL (gmail.send + gmail.readonly).
//   3. Return the auth URL so the frontend can open it in a popup/redirect.
//
// The redirect_uri is always `${origin}/api/user/gmail/connect/callback` so
// the user must register THAT exact URI in their Google Cloud Console under
// "Authorized redirect URIs" for the Desktop OAuth client.
//
// The ownerId (user._id) is embedded in the OAuth `state` param (base64) so
// the callback can tag the resulting EmailAccount with the owning user.
// ============================================================================
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/core';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
];

export async function POST(req) {
  try {
    // ---- Auth: only logged-in users can connect their own Gmail ----
    const cookieHeader = req.headers.get('cookie') || '';
    const tokenMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
    const token = tokenMatch ? tokenMatch[1] : null;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized — please log in first.' }, { status: 401 });
    }
    const decoded = await verifyToken(token);
    if (!decoded || decoded.role !== 'user') {
      return NextResponse.json({ error: 'Only user-panel accounts can connect Gmail here.' }, { status: 403 });
    }

    const body = await req.json();
    const { credentialsJson, label } = body || {};
    if (!credentialsJson || typeof credentialsJson !== 'string') {
      return NextResponse.json({ error: 'Missing credentials.json contents.' }, { status: 400 });
    }

    // ---- Parse the Google Cloud credentials.json ----
    let creds;
    try {
      creds = JSON.parse(credentialsJson);
    } catch {
      return NextResponse.json({ error: 'credentials.json is not valid JSON. Please re-download it from Google Cloud Console.' }, { status: 400 });
    }

    // Desktop apps → "installed"; Web apps → "web". We support both but prefer installed.
    const client = creds.installed || creds.web;
    if (!client || !client.client_id || !client.client_secret) {
      return NextResponse.json({ error: 'credentials.json missing client_id/client_secret. Make sure you downloaded a Desktop or Web OAuth client.' }, { status: 400 });
    }

    const clientId = client.client_id;
    const clientSecret = client.client_secret;
    const redirectUris = Array.isArray(client.redirect_uris) ? client.redirect_uris : [];

    const url = new URL(req.url);
    const origin = url.origin.replace(/\/$/, '');
    const callbackUri = `${origin}/api/user/gmail/connect/callback`;

    // Build state payload (base64) — passed through Google and back to callback.
    // Contains everything the callback needs to save the account + tag the owner.
    const statePayload = {
      clientId,
      clientSecret,
      redirectUris,
      label: label || '',
      ownerId: decoded.userId,
      redirectOrigin: origin,
    };
    const stateB64 = Buffer.from(JSON.stringify(statePayload), 'utf-8').toString('base64');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent', // force consent so we always get a refresh_token
      state: stateB64,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return NextResponse.json({
      success: true,
      authUrl,
      callbackUri, // returned so the UI can tell the user what to register in Google Cloud
    });
  } catch (err) {
    console.error('[user-gmail-connect] error:', err);
    return NextResponse.json({ error: 'Failed to start Gmail OAuth flow', detail: err.message }, { status: 500 });
  }
}
