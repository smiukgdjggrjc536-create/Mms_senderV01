// ============================================================================
// Gmail OAuth2 — Callback handler (auto-setup)
// ============================================================================
// GET /api/auth/gmail/callback?code=<auth_code>&state=<base64-config>
//
// After the user grants permission on Google's consent screen, Google
// redirects back here with an authorization `code`. We:
//   1. Exchange the code for { access_token, refresh_token } via Google's
//      token endpoint (POST to https://oauth2.googleapis.com/token).
//   2. Fetch the user's Gmail address from the userinfo endpoint.
//   3. Save the EmailAccount with provider=GMAIL_OAUTH + the refresh_token +
//      clientId/clientSecret (so we can refresh the access token later).
//   4. Render a success page that auto-closes the popup and notifies the
//      parent (admin panel) window.
// ============================================================================
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Minimal EmailAccount schema (matches the one in gateway models)
const emailAccountSchema = new mongoose.Schema(
  {
    provider: { type: String, default: 'GMAIL_OAUTH' },
    email: { type: String, required: true, unique: true },
    label: { type: String, default: '' },
    dailyLimit: { type: Number, default: 400 },
    sentToday: { type: Number, default: 0 },
    sentTotal: { type: Number, default: 0 },
    status: { type: String, default: 'ACTIVE' },
    credentials: { type: mongoose.Schema.Types.Mixed, default: {} },
    lastUsedAt: { type: Date, default: null },
    lastError: { type: String, default: null },
  },
  { timestamps: true }
);

function getEmailAccountModel() {
  return (
    mongoose.models.EmailAccount ||
    mongoose.model('EmailAccount', emailAccountSchema)
  );
}

export async function GET(req) {
  let successPage = (msg, isError = false) =>
    new NextResponse(renderResultPage(msg, isError), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const stateRaw = url.searchParams.get('state');
    const oauthError = url.searchParams.get('error');

    if (oauthError) {
      return successPage(`Google returned an error: ${oauthError}. You may have denied permission.`, true);
    }
    if (!code || !stateRaw) {
      return successPage('Missing authorization code. Please retry from the admin panel.', true);
    }

    // Decode config from state
    let cfg;
    try {
      cfg = JSON.parse(Buffer.from(stateRaw, 'base64').toString('utf-8'));
    } catch {
      return successPage('Invalid state payload. Please retry from the admin panel.', true);
    }

    if (!cfg.clientId || !cfg.clientSecret) {
      return successPage('Missing OAuth client credentials in the uploaded candidates.json.', true);
    }

    // FIX (redirect_uri_mismatch): The redirect_uri sent to the token endpoint
    // MUST EXACTLY match the one used in the initial /api/auth/gmail redirect.
    // We mirror the same resolution logic as the initiate route so the token
    // exchange never fails with "redirect_uri_mismatch".
    const origin = (cfg.redirectOrigin || url.origin).replace(/\/$/, '');
    let redirectUri;
    if (cfg.redirectUri && typeof cfg.redirectUri === 'string') {
      redirectUri = cfg.redirectUri;
    } else {
      const registered = Array.isArray(cfg.redirectUris) ? cfg.redirectUris : [];
      const defaultUri = `${origin}/api/auth/gmail/callback`;
      const hostMatch = registered.find(
        (u) => typeof u === 'string' && u.includes('/api/auth/gmail/callback') &&
              new URL(u).host === new URL(defaultUri).host
      );
      const anyCallback = registered.find(
        (u) => typeof u === 'string' && u.includes('/api/auth/gmail/callback')
      );
      redirectUri = hostMatch || anyCallback || defaultUri;
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
      return successPage(`Failed to exchange authorization code for tokens: ${detail}`, true);
    }

    const { refresh_token, access_token, expires_in, scope: grantedScope } = tokenData;

    // ---- Step 2: Fetch the Gmail address ----
    let gmailAddress = cfg.email || '';
    try {
      const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (userinfoRes.ok) {
        const userinfo = await userinfoRes.json();
        if (userinfo.email) gmailAddress = userinfo.email;
      }
    } catch {
      // non-fatal — we fall back to whatever email was in the config
    }

    if (!gmailAddress) {
      return successPage('Could not determine the Gmail address from the OAuth response. Please ensure you granted permission.', true);
    }

    // ---- Step 3: Save the EmailAccount ----
    // We need a DB connection. Try to connect using the standard connectDB.
    // The callback runs without an admin cookie (it's a redirect from Google),
    // so we connect directly using MONGODB_URI env var.
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      return successPage('Server is not configured with MONGODB_URI. Contact the administrator.', true);
    }

    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(mongoUri);
    }

    const EmailAccount = getEmailAccountModel();
    const credentials = {
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      refreshToken: refresh_token,
      accessToken: access_token,
      tokenExpiry: new Date(Date.now() + (expires_in || 3600) * 1000),
      scope: grantedScope || '',
    };

    const account = await EmailAccount.findOneAndUpdate(
      { email: gmailAddress.toLowerCase().trim() },
      {
        $set: {
          provider: 'GMAIL_OAUTH',
          email: gmailAddress.toLowerCase().trim(),
          label: cfg.label || '',
          dailyLimit: cfg.dailyLimit || 400,
          credentials,
          status: 'ACTIVE',
          lastError: null,
          updatedAt: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // ---- Step 4: Success page ----
    return successPage(`Gmail account <strong>${gmailAddress}</strong> (${cfg.label || 'no label'}) was connected successfully! You can close this window.`, false);
  } catch (err) {
    console.error('[gmail-oauth-callback] error:', err);
    return successPage(`Internal error: ${err.message}`, true);
  }
}

// ----------------------------------------------------------------------------
// HTML result page — auto-closes popup, notifies parent window
// ----------------------------------------------------------------------------
function renderResultPage(msg, isError) {
  const color = isError ? '#ef4444' : '#22c55e';
  const icon = isError ? '✕' : '✓';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Gmail OAuth — ${isError ? 'Error' : 'Success'}</title>
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
      // Notify the parent (admin panel) window that OAuth completed
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'gmail-oauth-result', success: ${!isError}, message: ${JSON.stringify(msg)} }, '*');
      }
    } catch(e) {}
    setTimeout(function(){ try { window.close(); } catch(e){} }, 3000);
  </script>
</body>
</html>`;
}
