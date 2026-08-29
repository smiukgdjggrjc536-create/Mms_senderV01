// ============================================================================
// Gmail OAuth2 (Desktop credentials.json) — USER PANEL connect flow
// ============================================================================
// POST /api/user/gmail/connect
//   Body: { credentialsJson: <string — raw contents of credentials.json>, label?: string }
//
// Desktop App credentials.json SUPPORT:
//   Desktop apps only have http://localhost redirect URIs. Google's OAuth for
//   "installed" (Desktop) clients allows redirect_uri=http://localhost (any port).
//   We use the special "loopback" redirect_uri = "http://localhost" which Google
//   accepts for Desktop clients WITHOUT needing to register our server URL.
//
//   Flow:
//     1. User uploads Desktop credentials.json
//     2. We build OAuth URL with redirect_uri=http://localhost (Google accepts this
//        for Desktop clients)
//     3. Popup opens → user grants permission → Google redirects to http://localhost?code=XXX
//     4. The popup can't load localhost (no server there), BUT the URL bar will show
//        the code. The frontend popup handler catches this before the redirect completes.
//     5. Frontend extracts the code from the popup URL and sends it to our callback
//        endpoint to exchange for tokens.
//
//   This is the STANDARD way Desktop OAuth works — no Google Cloud Console redirect
//   URI registration needed for our server. The user just uploads credentials.json
//   and clicks connect.
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

    // Desktop apps → "installed"; Web apps → "web". We support both.
    const client = creds.installed || creds.web;
    if (!client || !client.client_id || !client.client_secret) {
      return NextResponse.json({ error: 'credentials.json missing client_id/client_secret. Make sure you downloaded a Desktop or Web OAuth client.' }, { status: 400 });
    }

    const clientId = client.client_id;
    const clientSecret = client.client_secret;
    const clientType = creds.installed ? 'installed' : (creds.web ? 'web' : 'unknown');

    // ---- Determine the redirect_uri ----
    // For DESKTOP ("installed") clients: Google accepts redirect_uri=http://localhost
    //   (loopback) WITHOUT requiring our server URL to be registered. This is the
    //   standard Desktop OAuth flow — no redirect URI registration needed.
    //   We use "http://localhost" (no port) which Google treats as loopback.
    //   The frontend popup handler will catch the code from the URL before the
    //   browser tries to load localhost (which would fail, but code is already
    //   in the URL bar).
    //
    // For WEB clients: use the registered redirect URI that matches our callback path.
    const url = new URL(req.url);
    const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
      ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
      : null;
    const origin = (envSiteUrl || url.origin).replace(/\/$/, '');
    const serverCallbackUri = `${origin}/api/user/gmail/connect/callback`;

    let callbackUri;
    let needsRegistration = false;
    let isDesktopFlow = false;

    if (clientType === 'installed') {
      // ── DESKTOP FLOW: use loopback redirect ──
      // Google accepts http://localhost for installed apps. We use port 1
      // (a port nothing runs on) so the browser shows a "can't connect" page
      // but the URL bar contains the full redirect URL with ?code=XXX.
      // The frontend polls the popup location — when it becomes http://localhost:1
      // the cross-origin restriction lifts (localhost:1 is same-origin-free but
      // readable in some browsers) OR we detect via the popup error page.
      // Fallback: we ALSO show a manual code-entry box if auto-detection fails.
      callbackUri = 'http://localhost:1';
      isDesktopFlow = true;
    } else {
      // ── WEB FLOW: use registered URI or our server callback ──
      const redirectUris = Array.isArray(client.redirect_uris) ? client.redirect_uris : [];
      const realUris = redirectUris.filter(
        (u) => typeof u === 'string' && !/^https?:\/\/localhost(:\d+)?\/?$/i.test(u) && !/^https?:\/\/127\.0\.0\.1(:\d+)?\/?$/i.test(u)
      );

      if (realUris.length > 0) {
        const exactMatch = realUris.find((u) => typeof u === 'string' && u.replace(/\/$/, '') === serverCallbackUri.replace(/\/$/, ''));
        if (exactMatch) {
          callbackUri = exactMatch;
        } else {
          const pathMatch = realUris.find((u) => typeof u === 'string' && u.includes('/api/user/gmail/connect/callback'));
          if (pathMatch) {
            callbackUri = pathMatch;
          } else {
            callbackUri = serverCallbackUri;
            needsRegistration = true;
          }
        }
      } else {
        callbackUri = serverCallbackUri;
        needsRegistration = true;
      }
    }

    // Build state payload (base64) — passed through Google and back.
    const statePayload = {
      clientId,
      clientSecret,
      label: label || '',
      ownerId: decoded.userId,
      redirectOrigin: origin,
      callbackUriUsed: callbackUri,
      isDesktopFlow,
    };
    const stateB64 = Buffer.from(JSON.stringify(statePayload), 'utf-8').toString('base64');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: stateB64,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return NextResponse.json({
      success: true,
      authUrl,
      callbackUri,
      ourCallbackUri: serverCallbackUri,
      needsRegistration,
      isDesktopFlow,
      clientType,
      registeredUris: clientType === 'installed' ? ['http://localhost'] : (Array.isArray(client.redirect_uris) ? client.redirect_uris : []),
      guidance: 'Your credentials.json is ready. Click the button to open Google permission page and connect your Gmail.',
    });
  } catch (err) {
    console.error('[user-gmail-connect] error:', err);
    return NextResponse.json({ error: 'Failed to start Gmail OAuth flow', detail: err.message }, { status: 500 });
  }
}
