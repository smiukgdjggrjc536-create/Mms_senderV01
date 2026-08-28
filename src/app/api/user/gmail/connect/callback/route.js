// ============================================================================
// Gmail OAuth2 (Desktop credentials.json) — USER PANEL callback + token exchange
// ============================================================================
// Two modes:
//
// 1. WEB FLOW (GET /api/user/gmail/connect/callback?code=...&state=...)
//    Google redirects the browser here directly. We exchange the code and save.
//
// 2. DESKTOP FLOW (POST /api/user/gmail/connect/callback)
//    Body: { code, state }  — the frontend popup handler extracts the code from
//    the http://localhost redirect URL and POSTs it here. We exchange the code
//    using redirect_uri=http://localhost (same as the initiate step) and save.
//
// In both cases we:
//   1. Exchange the auth code for { access_token, refresh_token }.
//   2. Fetch the Gmail address from userinfo.
//   3. Save EmailAccount with ownerId = the user who initiated the flow.
// ============================================================================
import { NextResponse } from 'next/server';
import { connectDB, EmailAccount } from '@/lib/core';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const render = (msg, isError = false) =>
  new NextResponse(renderResultPage(msg, isError), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });

// ── GET: Web flow callback (Google redirects here) ──
export async function GET(req) {
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

    let cfg;
    try {
      cfg = JSON.parse(Buffer.from(stateRaw, 'base64').toString('utf-8'));
    } catch {
      return render('Invalid state payload. Please retry from the user panel.', true);
    }

    if (!cfg.clientId || !cfg.clientSecret) {
      return render('Missing OAuth client credentials. Please re-upload your credentials.json.', true);
    }

    // redirect_uri must match what was used in the initiate step
    const redirectUri = cfg.callbackUriUsed || `${(process.env.NEXT_PUBLIC_SITE_URL || url.origin).replace(/\/$/, '')}/api/user/gmail/connect/callback`;

    const result = await exchangeAndSave(code, redirectUri, cfg);
    return render(result.message, !result.success);
  } catch (err) {
    console.error('[user-gmail-connect-callback GET] error:', err);
    return render(`Internal error: ${err.message}`, true);
  }
}

// ── POST: Desktop flow (frontend sends code extracted from localhost popup) ──
export async function POST(req) {
  try {
    const body = await req.json();
    const { code, state } = body || {};

    if (!code || !state) {
      return NextResponse.json({ error: 'Missing code or state.' }, { status: 400 });
    }

    let cfg;
    try {
      cfg = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
    } catch {
      return NextResponse.json({ error: 'Invalid state payload.' }, { status: 400 });
    }

    if (!cfg.clientId || !cfg.clientSecret) {
      return NextResponse.json({ error: 'Missing OAuth client credentials.' }, { status: 400 });
    }

    // For Desktop flow, redirect_uri must be http://localhost (matching initiate)
    const redirectUri = cfg.callbackUriUsed || 'http://localhost';

    const result = await exchangeAndSave(code, redirectUri, cfg);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[user-gmail-connect-callback POST] error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ── Shared: exchange code → tokens → save EmailAccount ──
async function exchangeAndSave(code, redirectUri, cfg) {
  try {
    // Step 1: Exchange code for tokens
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
      return { success: false, message: `Failed to exchange authorization code for tokens: ${detail}` };
    }

    const { refresh_token, access_token, expires_in, scope: grantedScope } = tokenData;

    // Step 2: Fetch the Gmail address
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
      return { success: false, message: 'Could not determine the Gmail address from the OAuth response. Please ensure you granted permission.' };
    }

    // Step 3: Save EmailAccount (tagged with the owning user)
    await connectDB();

    const credentials = {
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      refreshToken: refresh_token,
      accessToken: access_token,
      tokenExpiry: new Date(Date.now() + (expires_in || 3600) * 1000),
      scope: grantedScope || '',
    };

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

    return { success: true, email: gmailAddress, message: `Gmail account ${gmailAddress} connected successfully!` };
  } catch (err) {
    return { success: false, message: `Internal error: ${err.message}` };
  }
}

// ── HTML result page (for GET/web flow) ──
function renderResultPage(msg, isError) {
  const color = isError ? '#ef4444' : '#22c55e';
  const icon = isError ? '\u2715' : '\u2713';
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
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'user-gmail-oauth-result', success: ${!isError}, message: ${JSON.stringify(msg)} }, '*');
      }
    } catch(e) {}
    setTimeout(function(){ try { window.close(); } catch(e){} }, 3000);
  </script>
</body>
</html>`;
}
