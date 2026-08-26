// ============================================================================
// Gmail OAuth2 (Desktop credentials.json) — USER PANEL callback handler
// ============================================================================
// GET /api/user/gmail/connect/callback?code=<auth_code>&state=<base64-config>
//
// Google redirects back here after the user grants permission. We:
//   1. Exchange the auth code for { access_token, refresh_token }.
//   2. Fetch the Gmail address from userinfo.
//   3. Save EmailAccount with ownerId = the user who initiated the flow
//      (from the state payload) so multi-tenant isolation works.
//   4. Render a result page that posts a message to the opener (user panel)
//      and auto-closes the popup.
// ============================================================================
import { NextResponse } from 'next/server';
import { connectDB, EmailAccount } from '@/lib/core';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req) {
  const render = (msg, isError = false) =>
    new NextResponse(renderResultPage(msg, isError), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const stateRaw = url.searchParams.get('state');
    const oauthError = url.searchParams.get('error');

    if (oauthError) {
      return render(`Google returned an error: ${oauthError}. You may have denied permission.`, true);
    }
    if (!code || !stateRaw) {
      return render('Missing authorization code. Please retry the connection from the user panel.', true);
    }

    // Decode the state payload (contains clientId/clientSecret/ownerId/redirectUris)
    let cfg;
    try {
      cfg = JSON.parse(Buffer.from(stateRaw, 'base64').toString('utf-8'));
    } catch {
      return render('Invalid state payload. Please retry from the user panel.', true);
    }

    if (!cfg.clientId || !cfg.clientSecret) {
      return render('Missing OAuth client credentials. Please re-upload your credentials.json.', true);
    }

    // Resolve redirect_uri — must EXACTLY match the one used in the initiate step.
    // We now store the exact URI used in the state payload (callbackUriUsed).
    const origin = (cfg.redirectOrigin || url.origin).replace(/\/$/, '');
    const defaultUri = `${origin}/api/user/gmail/connect/callback`;

    // Use the exact URI that was sent to Google in the initiate step (stored in state).
    // This prevents redirect_uri_mismatch at the token exchange step.
    let redirectUri;
    if (cfg.callbackUriUsed) {
      // The initiate step stored the exact URI it sent to Google — use it.
      redirectUri = cfg.callbackUriUsed;
    } else if (cfg.redirectUris && Array.isArray(cfg.redirectUris) && cfg.redirectUris.length > 0) {
      const hostMatch = cfg.redirectUris.find(
        (u) => typeof u === 'string' && u.includes('/api/user/gmail/connect/callback') &&
              new URL(u).host === new URL(defaultUri).host
      );
      const anyCallback = cfg.redirectUris.find(
        (u) => typeof u === 'string' && u.includes('/api/user/gmail/connect/callback')
      );
      redirectUri = hostMatch || anyCallback || defaultUri;
    } else {
      redirectUri = defaultUri;
    }

    // ---- Step 1: Exchange code for tokens ----
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.refresh_token) {
      const detail = tokenData.error_description || tokenData.error || 'Unknown error';
      return render(`Failed to exchange authorization code for tokens: ${detail}`, true);
    }

    const { refresh_token, access_token, expires_in, scope: grantedScope } = tokenData;

    // ---- Step 2: Fetch the Gmail address ----
    let gmailAddress = '';
    try {
      const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (userinfoRes.ok) {
        const userinfo = await userinfoRes.json();
        if (userinfo.email) gmailAddress = userinfo.email;
      }
    } catch {
      // non-fatal
    }

    if (!gmailAddress) {
      return render('Could not determine the Gmail address from the OAuth response. Please ensure you granted permission.', true);
    }

    // ---- Step 3: Save EmailAccount (tagged with the owning user) ----
    await connectDB();

    const credentials = {
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      refreshToken: refresh_token,
      accessToken: access_token,
      tokenExpiry: new Date(Date.now() + (expires_in || 3600) * 1000),
      scope: grantedScope || '',
    };

    // ownerId tags this account as belonging to the user who connected it.
    // listSenders filters by ownerId so each user only sees their own accounts
    // (+ the shared admin pool with ownerId = null).
    const ownerId = cfg.ownerId || null;

    await EmailAccount.findOneAndUpdate(
      { email: gmailAddress.toLowerCase().trim() },
      {
        $set: {
          provider: 'GMAIL_OAUTH',
          email: gmailAddress.toLowerCase().trim(),
          label: cfg.label || gmailAddress,
          dailyLimit: 400,
          credentials,
          status: 'ACTIVE',
          lastError: null,
          ownerId: ownerId || null,
          updatedAt: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return render(`Gmail account <strong>${gmailAddress}</strong> connected successfully! You can close this window.`, false);
  } catch (err) {
    console.error('[user-gmail-connect-callback] error:', err);
    return render(`Internal error: ${err.message}`, true);
  }
}

// ----------------------------------------------------------------------------
// HTML result page — posts result to opener (user panel) + auto-closes popup
// ----------------------------------------------------------------------------
function renderResultPage(msg, isError) {
  const color = isError ? '#ef4444' : '#22c55e';
  const icon = isError ? '✕' : '✓';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Gmail Connect — ${isError ? 'Error' : 'Success'}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:2rem;}
  .card{background:#1e293b;border:1px solid #334155;border-radius:16px;padding:2.5rem;max-width:480px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.4);}
  .icon{width:64px;height:64px;border-radius:50%;background:${color}22;display:flex;align-items:center;justify-content:center;margin:0 auto 1.2rem;font-size:32px;color:${color};font-weight:bold;border:2px solid ${color}66;}
  h1{font-size:1.3rem;margin-bottom:0.8rem;font-weight:700;}
  p{color:#94a3b8;line-height:1.6;font-size:0.95rem;}
  .countdown{color:#64748b;font-size:0.8rem;margin-top:1.5rem;}
  strong{color:#fff;}
</style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1 style="color:${color}">${isError ? 'Connection Failed' : 'Gmail Connected!'}</h1>
    <p>${msg}</p>
    <p class="countdown">This window will close automatically in 3 seconds…</p>
  </div>
  <script>
    try {
      // Notify the user panel (opener) that OAuth completed
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'user-gmail-oauth-result', success: ${!isError}, message: ${JSON.stringify(msg)} }, '*');
      }
    } catch(e) {}
    setTimeout(function(){ try { window.close(); } catch(e){} }, 3000);
  </script>
</body>
</html>`;
}
