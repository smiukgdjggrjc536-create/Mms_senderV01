// ============================================================================
// gmailSender.js — Gmail REST API sender via OAuth2 (Phase 3, Step 1)
// ============================================================================
// Sends an email (MMS payload) through Gmail's REST API using an OAuth2
// refresh-token flow. We deliberately use raw `fetch` against Google's token
// endpoint + Gmail `messages.send` endpoint instead of the `googleapis` SDK.
// This keeps the project dependency-free (package.json has no `googleapis`)
// and avoids any webpack/external-package build issues with Next.js 16.
//
// Flow:
//   1. Exchange the stored `refresh_token` for a fresh `access_token` using
//      the account's `client_id` + `client_secret` (Google OAuth2 token
//      endpoint, grant_type=refresh_token).
//   2. Build an RFC-2822 MIME message (From / To / Subject / MIME-Version /
//      Content-Type multipart-mixed with an optional attachment part).
//   3. base64url-encode the raw MIME and POST it to
//      `gmail/v1/users/me/messages/send`.
//
// The function is stateless: every call refreshes the access token. Google
// access tokens last ~1h, but refreshing per-send is safest for a low-volume
// MMS gateway and avoids token-expiry mid-batch.
//
// NON-DESTRUCTIVE: brand-new module, does not modify any existing file.
//
// [MODULE 6 WIRING]: Gmail OAuth calls (token refresh + messages.send) use
// DIRECT fetch() because they target Google's own API servers — NOT telecom
// carrier gateways. IP masking / proxy routing is only relevant for outbound
// dispatch to carrier MMS gateways (SMTP / custom-SMTP paths). Keeping Gmail
// OAuth direct avoids proxyRouter dynamic-import failures and "fetch failed"
// errors when no proxy is configured.
// ============================================================================

// NOTE: We intentionally use direct `fetch()` for BOTH Google OAuth token
// refresh AND Gmail messages.send. These are calls to GOOGLE'S OWN servers
// (oauth2.googleapis.com / gmail.googleapis.com), NOT telecom/MMS carrier
// gateways — so IP masking / proxy routing is irrelevant and would only add
// failure points (proxyRouter dynamic-import errors, Redis lookup failures,
// "fetch failed" when no healthy proxy is configured). Carrier-gateway IP
// masking is applied separately in the SMTP/custom-SMTP send paths where it
// matters. Keeping Gmail OAuth direct = robust, fewer moving parts.
const GMAIL_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

// ---------------------------------------------------------------------------
// Normalize credentials so BOTH camelCase (clientId, clientSecret,
// refreshToken) and snake_case (client_id, client_secret, refresh_token) work.
// The Admin Panel stores camelCase; the original spec used snake_case. We
// accept either to avoid silent send failures.
// ---------------------------------------------------------------------------
function normalizeCreds(creds) {
  if (!creds) return {};
  return {
    client_id: creds.client_id || creds.clientId || '',
    client_secret: creds.client_secret || creds.clientSecret || '',
    refresh_token: creds.refresh_token || creds.refreshToken || '',
    access_token: creds.access_token || creds.accessToken || undefined,
  };
}

// ---------------------------------------------------------------------------
// Refresh the OAuth2 access token using the stored refresh token.
// Returns { access_token, expires_in } or throws on failure.
// ---------------------------------------------------------------------------
async function refreshAccessToken(credsIn) {
  const creds = normalizeCreds(credsIn);
  const body = new URLSearchParams({
    client_id: creds.client_id,
    client_secret: creds.client_secret,
    refresh_token: creds.refresh_token,
    grant_type: 'refresh_token',
  });

  let resp;
  try {
    resp = await fetch(GMAIL_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(20000),
    });
  } catch (fetchErr) {
    // Wrap the generic "fetch failed" with actionable context so the admin
    // sees WHY it failed (timeout, DNS, connection refused, etc.)
    const err = new Error(
      `Gmail token refresh: could not reach Google OAuth endpoint — ${fetchErr.cause?.code || fetchErr.code || fetchErr.name}: ${fetchErr.cause?.message || fetchErr.message || 'fetch failed'}`
    );
    err.bounceType = 'TRANSIENT';
    err.status = 0;
    err.originalError = String(fetchErr);
    throw err;
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    const err = new Error(`Gmail token refresh failed: ${resp.status} ${text.slice(0, 200)}`);
    err.status = resp.status;
    err.providerError = text;
    throw err;
  }

  const json = await resp.json();
  if (!json.access_token) {
    throw new Error('Gmail token refresh returned no access_token');
  }
  return json;
}

// ---------------------------------------------------------------------------
// Encode a string to base64url (RFC 4648 §5) — Gmail requires this for the
// `raw` field of messages.send.
// ---------------------------------------------------------------------------
function base64url(input) {
  const b64 = Buffer.from(input, 'utf-8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ---------------------------------------------------------------------------
// Build a minimal RFC-2822 MIME message. If an attachment is supplied
// ({ filename, contentType, content: Buffer|string }) we emit a
// multipart/mixed message; otherwise a simple text/plain message.
// ---------------------------------------------------------------------------
function buildMime({ from, to, subject, body, attachment }) {
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject || ''}`,
    'MIME-Version: 1.0',
  ];

  if (!attachment) {
    headers.push('Content-Type: text/plain; charset=UTF-8');
    headers.push('Content-Transfer-Encoding: 7bit');
    return headers.join('\r\n') + '\r\n\r\n' + body + '\r\n';
  }

  // multipart/mixed with a text part + an attachment part
  const boundary = 'mms_boundary_' + Math.random().toString(36).slice(2);
  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

  const parts = [];
  // text part
  parts.push(`--${boundary}`);
  parts.push('Content-Type: text/plain; charset=UTF-8');
  parts.push('Content-Transfer-Encoding: 7bit');
  parts.push('');
  parts.push(body);
  // attachment part
  const attContent = Buffer.isBuffer(attachment.content)
    ? attachment.content
    : Buffer.from(String(attachment.content || ''), 'utf-8');
  parts.push(`--${boundary}`);
  parts.push(`Content-Type: ${attachment.contentType || 'application/octet-stream'}`);
  parts.push('Content-Transfer-Encoding: base64');
  parts.push(`Content-Disposition: attachment; filename="${attachment.filename || 'attachment'}"`);
  parts.push('');
  parts.push(attContent.toString('base64'));
  parts.push(`--${boundary}--`);

  return headers.join('\r\n') + '\r\n\r\n' + parts.join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------------------
// Classify an HTTP error from Gmail into a bounce category so the
// bounceHandler can decide whether to cool down the account or purge the
// carrier cache. We inspect the status code + error JSON.
//   400 + invalid_grant            → AUTH (refresh token revoked)
//   401 / 403                       → AUTH
//   429                             → RATE_LIMIT
//   400 "Invalid recipient" / 550*  → HARD_BOUNCE ( Gmail uses 400 with
//                                     "Recipient address rejected" )
//   anything else                   → TRANSIENT
// ---------------------------------------------------------------------------
function classifyGmailError(status, errText) {
  const lower = String(errText || '').toLowerCase();
  if (status === 429) return 'RATE_LIMIT';
  if (status === 401 || status === 403) return 'AUTH';
  if (status === 400 && lower.includes('invalid_grant')) return 'AUTH';
  // Gmail surfaces hard bounces as 400 with these phrases
  if (
    lower.includes('recipient address rejected') ||
    lower.includes('user unknown') ||
    lower.includes('no such user') ||
    lower.includes('invalid recipient') ||
    lower.includes('550')
  ) {
    return 'HARD_BOUNCE';
  }
  return 'TRANSIENT';
}

// ---------------------------------------------------------------------------
// Public API: sendViaGmail({ account, to, subject, body, attachment })
//   account  — EmailAccount doc (lean or full) with .email + .credentials
//   to       — recipient MMS gateway address (e.g. 12125551234@vzwpix.com)
//   subject  — email subject line
//   body     — plain-text message body
//   attachment — optional { filename, contentType, content }
//
// Returns { success: true, provider: 'GMAIL_OAUTH', messageId } on success.
// Throws an Error with `.bounceType` (HARD_BOUNCE / RATE_LIMIT / AUTH /
// TRANSIENT) and `.status` on failure so the bounceHandler can react.
// ---------------------------------------------------------------------------
export async function sendViaGmail({ account, to, subject, body, attachment }) {
  const credsRaw = account.credentials || {};
  // Normalize so both camelCase and snake_case work
  const creds = normalizeCreds(credsRaw);
  if (!creds.client_id || !creds.client_secret || !creds.refresh_token) {
    const err = new Error('Gmail account missing OAuth2 credentials (client_id/client_secret/refresh_token). Stored keys: ' + Object.keys(credsRaw).join(', '));
    err.bounceType = 'AUTH';
    err.status = 0;
    throw err;
  }

  let tokenJson;
  try {
    tokenJson = await refreshAccessToken(creds);
  } catch (e) {
    // Re-classify token errors so the handler can cool down on AUTH
    e.bounceType = e.status === 400 || e.status === 401 || e.status === 403 ? 'AUTH' : 'TRANSIENT';
    throw e;
  }

  const mime = buildMime({
    from: account.email,
    to,
    subject,
    body,
    attachment,
  });

  let resp;
  try {
    resp = await fetch(GMAIL_SEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenJson.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: base64url(mime) }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (fetchErr) {
    const err = new Error(
      `Gmail send: could not reach Gmail API endpoint — ${fetchErr.cause?.code || fetchErr.code || fetchErr.name}: ${fetchErr.cause?.message || fetchErr.message || 'fetch failed'}`
    );
    err.bounceType = 'TRANSIENT';
    err.status = 0;
    err.originalError = String(fetchErr);
    throw err;
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    const err = new Error(`Gmail send failed: ${resp.status} ${text.slice(0, 300)}`);
    err.status = resp.status;
    err.bounceType = classifyGmailError(resp.status, text);
    err.providerError = text;
    throw err;
  }

  const data = await resp.json().catch(() => ({}));
  return {
    success: true,
    provider: 'GMAIL_OAUTH',
    messageId: data.id || null,
  };
}

export { refreshAccessToken, buildMime, base64url, classifyGmailError, normalizeCreds };
