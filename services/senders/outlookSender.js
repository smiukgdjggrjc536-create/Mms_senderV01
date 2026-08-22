// ============================================================================
// outlookSender.js — Microsoft Graph API sender via OAuth2 (Phase 3, Step 1)
// ============================================================================
// Sends an email (MMS payload) through the Microsoft Graph `sendMail` endpoint
// using an OAuth2 refresh-token flow. Raw `fetch` is used (no SDK) so the
// project stays dependency-free and Next.js-16 build-safe.
//
// Flow:
//   1. Exchange the stored `refresh_token` for a fresh `access_token` at
//      the common OAuth2 token endpoint (scope =
//      https://graph.microsoft.com/.default offline_access).
//   2. POST a JSON `sendMail` payload to
//      `https://graph.microsoft.com/v1.0/me/sendMail` with the message
//      object (subject/body + optional attachments).
//
// Graph's `sendMail` returns 202 Accepted on success (no body), so we treat
// any 2xx as success. Errors are classified into bounce categories for the
// bounceHandler.
//
// NON-DESTRUCTIVE: brand-new module.
//
// [MODULE 6 WIRING]: Both outbound HTTP calls (token refresh + sendMail) now
// route through routedFetch() which respects the IP-masking toggle. When IP
// masking is ON, requests go through Cloudflare Workers / rotating proxies
// with strict origin-header stripping. When OFF, it falls back to direct
// fetch. See services/senders/proxyFetch.js.
// ============================================================================

import { routedFetch } from './proxyFetch.js';

const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const MS_SEND_URL = 'https://graph.microsoft.com/v1.0/me/sendMail';

// ---------------------------------------------------------------------------
// Refresh the OAuth2 access token. The account's credentials object holds
// client_id, client_secret, refresh_token, and optionally tenant_id
// (defaults to "common" for multi-tenant consumer accounts).
// ---------------------------------------------------------------------------
async function refreshAccessToken(creds) {
  const tenant = creds.tenant_id || 'common';
  const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: creds.client_id,
    client_secret: creds.client_secret,
    refresh_token: creds.refresh_token,
    grant_type: 'refresh_token',
    scope: 'https://graph.microsoft.com/Mail.Send offline_access',
  });

  const resp = await routedFetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    const err = new Error(`Outlook token refresh failed: ${resp.status} ${text.slice(0, 200)}`);
    err.status = resp.status;
    err.providerError = text;
    throw err;
  }

  const json = await resp.json();
  if (!json.access_token) {
    throw new Error('Outlook token refresh returned no access_token');
  }
  return json;
}

// ---------------------------------------------------------------------------
// Classify a Graph API error into a bounce category.
//   401 / 403 + invalid_grant   → AUTH
//   429                          → RATE_LIMIT (with Retry-After header)
//   400 "recipient" / 550*       → HARD_BOUNCE
//   5xx                          → TRANSIENT
// ---------------------------------------------------------------------------
function classifyOutlookError(status, errText) {
  const lower = String(errText || '').toLowerCase();
  if (status === 429) return 'RATE_LIMIT';
  if (status === 401 || status === 403) return 'AUTH';
  if (status === 400 && lower.includes('invalid_grant')) return 'AUTH';
  if (
    lower.includes('recipient') ||
    lower.includes('user unknown') ||
    lower.includes('no such user') ||
    lower.includes('mailbox unavailable') ||
    lower.includes('550')
  ) {
    return 'HARD_BOUNCE';
  }
  if (status >= 500) return 'TRANSIENT';
  return 'TRANSIENT';
}

// ---------------------------------------------------------------------------
// Build the Graph `sendMail` JSON message object.
// ---------------------------------------------------------------------------
function buildGraphMessage({ from, to, subject, body, attachment }) {
  const message = {
    subject: subject || '',
    body: {
      contentType: 'Text',
      content: String(body || ''),
    },
    toRecipients: [{ emailAddress: { address: to } }],
    from: { emailAddress: { address: from } },
  };

  if (attachment) {
    const attContent = Buffer.isBuffer(attachment.content)
      ? attachment.content.toString('base64')
      : Buffer.from(String(attachment.content || ''), 'utf-8').toString('base64');
    message.attachments = [
      {
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: attachment.filename || 'attachment',
        contentType: attachment.contentType || 'application/octet-stream',
        contentBytes: attContent,
      },
    ];
  }

  return message;
}

// ---------------------------------------------------------------------------
// Public API: sendViaOutlook({ account, to, subject, body, attachment })
// Returns { success: true, provider: 'OUTLOOK_GRAPH', messageId: null }.
// Graph's sendMail returns 202 with no body, so messageId is null on success.
// Throws Error with .bounceType + .status on failure.
// ---------------------------------------------------------------------------
export async function sendViaOutlook({ account, to, subject, body, attachment }) {
  const creds = account.credentials || {};
  if (!creds.client_id || !creds.client_secret || !creds.refresh_token) {
    const err = new Error('Outlook account missing OAuth2 credentials (client_id/client_secret/refresh_token)');
    err.bounceType = 'AUTH';
    err.status = 0;
    throw err;
  }

  let tokenJson;
  try {
    tokenJson = await refreshAccessToken(creds);
  } catch (e) {
    e.bounceType = e.status === 400 || e.status === 401 || e.status === 403 ? 'AUTH' : 'TRANSIENT';
    throw e;
  }

  const message = buildGraphMessage({
    from: account.email,
    to,
    subject,
    body,
    attachment,
  });

  const resp = await routedFetch(MS_SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, saveToSentItems: false }),
    signal: AbortSignal.timeout(30000),
  });

  // 202 Accepted = success (Graph returns no body)
  if (resp.status === 202 || resp.status === 201) {
    return { success: true, provider: 'OUTLOOK_GRAPH', messageId: null };
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    const err = new Error(`Outlook send failed: ${resp.status} ${text.slice(0, 300)}`);
    err.status = resp.status;
    err.bounceType = classifyOutlookError(resp.status, text);
    err.providerError = text;
    throw err;
  }

  // Any other 2xx
  return { success: true, provider: 'OUTLOOK_GRAPH', messageId: null };
}

export { refreshAccessToken, buildGraphMessage, classifyOutlookError };
