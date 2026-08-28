// ============================================================================
// Gmail OAuth2 (credentials.json) — USER PANEL connect flow (FIXED)
// ============================================================================
// POST /api/user/gmail/connect
//   Body: { credentialsJson: <string — raw contents of credentials.json>, label?: string }
//
// The user uploads a Google Cloud Console credentials.json from the user panel.
// We:
//   1. Parse the JSON → extract client_id / client_secret (supports "installed" + "web")
//   2. Build the Google OAuth consent URL (gmail.send + gmail.readonly)
//   3. Return the auth URL + the EXACT redirect_uri the user must register in Google Cloud
//
// FIX for redirect_uri_mismatch:
//   - If the credentials.json has redirect_uris registered, use the FIRST one that
//     ends with /api/user/gmail/connect/callback (matches our callback path).
//   - If none match, use the FIRST registered redirect_uri (user must register our callback).
//   - The callbackUri we send to Google MUST be one that's registered in Google Cloud Console.
//   - We return the exact URI the user needs to add to Google Cloud if it's not there.
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
    const redirectUris = Array.isArray(client.redirect_uris) ? client.redirect_uris : [];

    const url = new URL(req.url);
    // Prefer NEXT_PUBLIC_SITE_URL (set per-environment) so the callback URI is
    // always correct even when the request origin is an internal/proxy host.
    // Falls back to the request origin if the env var is not set.
    const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
      ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
      : null;
    const origin = (envSiteUrl || url.origin).replace(/\/$/, '');
    const ourCallbackUri = `${origin}/api/user/gmail/connect/callback`;

    // ── FIX: Choose the redirect_uri to send to Google ──
    // Priority:
    //   1. A registered URI that EXACTLY matches our callback (host + path)
    //   2. A registered URI that ends with our callback path (different host — will fail
    //      at token exchange, but at least the consent screen opens)
    //   3. Our own callback URI (may trigger redirect_uri_mismatch if not registered)
    //
    // We also detect Desktop "installed" clients that only have loopback URIs
    // (http://localhost:PORT) — those can't work with a server callback, so we
    // instruct the user to add our callback URI to Google Cloud Console.
    let callbackUri = ourCallbackUri;
    let needsRegistration = false;

    if (redirectUris.length > 0) {
      // Filter out loopback / localhost URIs (Desktop app defaults) — they can't
      // work with a server-side callback. Keep only real https/http host URIs.
      const realUris = redirectUris.filter(
        (u) => typeof u === 'string' && !/^https?:\/\/localhost(:\d+)?\/?$/i.test(u) && !/^https?:\/\/127\.0\.0\.1(:\d+)?\/?$/i.test(u)
      );

      if (realUris.length > 0) {
        // Check for exact match first
        const exactMatch = realUris.find(
          (u) => typeof u === 'string' && u.replace(/\/$/, '') === ourCallbackUri.replace(/\/$/, '')
        );
        if (exactMatch) {
          callbackUri = exactMatch;
        } else {
          // Check for path match (same path, different host)
          const pathMatch = realUris.find(
            (u) => typeof u === 'string' && u.includes('/api/user/gmail/connect/callback')
          );
          if (pathMatch) {
            // Use the registered one — it will work for consent, and we handle
            // the token exchange redirect_uri to match this in the callback.
            callbackUri = pathMatch;
          } else {
            // No matching path — use our callback and tell user to register it
            callbackUri = ourCallbackUri;
            needsRegistration = true;
          }
        }
      } else {
        // All registered URIs are loopback (Desktop app) — use our server callback
        // and instruct the user to register it in Google Cloud Console.
        callbackUri = ourCallbackUri;
        needsRegistration = true;
      }
    } else {
      // No redirect_uris in credentials.json — use ours, user needs to register it
      needsRegistration = true;
    }

    // Build state payload (base64) — passed through Google and back to callback.
    const statePayload = {
      clientId,
      clientSecret,
      redirectUris,
      label: label || '',
      ownerId: decoded.userId,
      redirectOrigin: origin,
      // Store the exact callbackUri we sent to Google so the callback uses the same
      callbackUriUsed: callbackUri,
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
      callbackUri,           // the URI we sent to Google
      ourCallbackUri,        // the URI that SHOULD be registered
      needsRegistration,     // true if user needs to add ourCallbackUri to Google Cloud
      registeredUris: redirectUris,  // show user what's currently registered
      clientType: creds.installed ? 'installed' : (creds.web ? 'web' : 'unknown'),
      // Helpful guidance for the user panel UI
      guidance: needsRegistration
        ? `Your credentials.json does not have our callback URI registered. Open Google Cloud Console → APIs & Services → Credentials → click your OAuth 2.0 Client ID → "Authorized redirect URIs" → Add this exact URI: ${ourCallbackUri} → Save. Then re-upload your credentials.json.`
        : 'Your credentials.json is correctly configured. The Google consent screen will open now.',
    });
  } catch (err) {
    console.error('[user-gmail-connect] error:', err);
    return NextResponse.json({ error: 'Failed to start Gmail OAuth flow', detail: err.message }, { status: 500 });
  }
}
