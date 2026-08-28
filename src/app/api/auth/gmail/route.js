// ============================================================================
// Gmail OAuth2 — Initiate consent flow
// ============================================================================
// GET /api/auth/gmail?state=<base64-config>
//
// The admin panel uploads a candidates.json (Google OAuth client credentials)
// and enters a label/name. When "Add" is pressed, the frontend base64-encodes
// the { clientId, clientSecret, label, dailyLimit, redirectOrigin, redirectUris }
// payload into the `state` param and redirects the browser here. We build the
// Google OAuth consent URL and 302-redirect the user to Google's permission
// screen.
//
// Scopes: gmail.send + gmail.readonly — needed to send MMS-via-email.
//
// FIX (redirect_uri_mismatch): The candidates.json downloaded from Google
// Cloud Console contains `redirect_uris[]` (the list of Authorized redirect
// URIs). We now try to match the current deployment origin against that list
// and use the EXACT registered URI as redirect_uri. If the admin panel also
// passes an explicit redirectUri in state, that wins. This makes the flow
// robust across Netlify/Vercel/Render/localhost without forcing the admin to
// guess which URI Google will accept.
// ============================================================================
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
];

/**
 * Pick the best registered redirect URI for the current origin.
 * Strategy:
 *   1. If the admin passed an explicit cfg.redirectUri → use it (highest priority).
 *   2. If candidates.json had redirect_uris[], find one that ends with our
 *      `/api/auth/gmail/callback` AND whose host matches the current origin.
 *   3. Otherwise, fall back to `${origin}/api/auth/gmail/callback` (legacy
 *      behavior — requires the URI to be registered in Google Cloud).
 *
 * Returns { redirectUri, origin }.
 */
function resolveRedirectUri(cfg, url) {
  // Prefer NEXT_PUBLIC_SITE_URL (set per-environment) for a guaranteed-correct
  // origin, then the explicit redirectOrigin, then the request origin.
  const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
    ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
    : null;
  const origin = (envSiteUrl || cfg.redirectOrigin || url.origin).replace(/\/$/, '');
  const defaultUri = `${origin}/api/auth/gmail/callback`;

  // (1) explicit override from the admin panel
  if (cfg.redirectUri && typeof cfg.redirectUri === 'string') {
    return { redirectUri: cfg.redirectUri, origin };
  }

  // (2) match against registered URIs from candidates.json
  const registered = Array.isArray(cfg.redirectUris) ? cfg.redirectUris : [];
  // Filter out loopback / localhost URIs (Desktop app defaults).
  const realRegistered = registered.filter(
    (u) => typeof u === 'string' && !/^https?:\/\/localhost(:\d+)?\/?$/i.test(u) && !/^https?:\/\/127\.0\.0\.1(:\d+)?\/?$/i.test(u)
  );
  if (realRegistered.length > 0) {
    // Prefer an exact host match first
    const hostMatch = realRegistered.find(
      (u) => typeof u === 'string' && u.includes(`/api/auth/gmail/callback`) && new URL(u).host === new URL(defaultUri).host
    );
    if (hostMatch) return { redirectUri: hostMatch, origin };

    // Otherwise prefer the FIRST registered callback URI (admin picked one)
    const anyCallback = realRegistered.find(
      (u) => typeof u === 'string' && u.includes(`/api/auth/gmail/callback`)
    );
    if (anyCallback) return { redirectUri: anyCallback, origin: new URL(anyCallback).origin };
  }

  // (3) legacy fallback
  return { redirectUri: defaultUri, origin };
}

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

    const { redirectUri } = resolveRedirectUri(cfg, url);

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
