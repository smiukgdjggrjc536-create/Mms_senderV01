// ============================================================================
// smtpSender.js — Custom SMTP sender via native Node net/tls (Phase 3, Step 1)
// ============================================================================
// Sends an email (MMS payload) through a user-supplied SMTP server using
// Node's built-in `net` (STARTTLS) and `tls` (implicit TLS) modules. This
// avoids adding `nodemailer` as a dependency, keeping the project lean and
// Next.js-16 build-safe.
//
// Supported flows:
//   - Implicit TLS  (port 465): connect with `tls.connect`, then AUTH.
//   - STARTTLS       (port 587/25): connect plain with `net.connect`, issue
//     EHLO → STARTTLS → upgrade to TLS → AUTH.
//   - PLAIN / LOGIN / XOAUTH2 authentication.
//
// The implementation is a minimal but correct SMTP client: it speaks EHLO,
// AUTH, MAIL FROM, RCPT TO, DATA, QUIT and parses 3-digit reply codes. It is
// NOT a full RFC-5321 implementation but covers everything needed for
// carrier-gateway MMS delivery (single recipient, plain or TLS, auth optional).
//
// NON-DESTRUCTIVE: brand-new module.
// ============================================================================

import net from 'net';
import tls from 'tls';

// ---------------------------------------------------------------------------
// A tiny line-buffered SMTP socket reader. Resolves with the full multiline
// reply text (e.g. "250-smtp.mail.com\r\n250 SIZE 52428800") once the final
// line (no `-` after the 3-digit code) arrives.
// ---------------------------------------------------------------------------
function readReply(socket) {
  return new Promise((resolve, reject) => {
    let buf = '';
    const onData = (chunk) => {
      buf += chunk.toString('utf-8');
      // SMTP multiline replies use "250-" continuation; final line "250 "
      const lines = buf.split('\r\n');
      // Keep the last possibly-incomplete line in the buffer
      buf = lines.pop();
      // Check if the last COMPLETE line is a final reply code (NNN<space>)
      if (lines.length > 0) {
        const last = lines[lines.length - 1];
        if (/^\d{3}\s/.test(last)) {
          socket.off('data', onData);
          socket.off('error', onError);
          resolve(lines.join('\r\n'));
        }
      }
    };
    const onError = (err) => {
      socket.off('data', onData);
      reject(err);
    };
    socket.on('data', onData);
    socket.on('error', onError);
  });
}

function sendCmd(socket, cmd) {
  return new Promise((resolve, reject) => {
    socket.write(cmd + '\r\n', 'utf-8', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// Parse the 3-digit status code from a reply
function replyCode(reply) {
  const m = /^(\d{3})/.exec(reply);
  return m ? parseInt(m[1], 10) : 0;
}

// ---------------------------------------------------------------------------
// Authenticate. Tries AUTH PLAIN first (single round-trip, base64), then
// falls back to AUTH LOGIN (two round-trips). XOAUTH2 supported if an
// access_token is present in creds.
// ---------------------------------------------------------------------------
async function authenticate(socket, creds) {
  if (!creds.user || !creds.pass) {
    // No auth requested — skip
    return;
  }

  // If an OAuth2 access token is supplied (e.g. for Gmail SMTP via XOAUTH2),
  // prefer it.
  if (creds.access_token) {
    const user = creds.user;
    const token = creds.access_token;
    // XOAUTH2 string: "user=...\x01auth=Bearer ...\x01\x01"
    const authStr = `user=${user}\x01auth=Bearer ${token}\x01\x01`;
    const b64 = Buffer.from(authStr, 'utf-8').toString('base64');
    await sendCmd(socket, 'AUTH XOAUTH2 ' + b64);
    const reply = await readReply(socket);
    if (replyCode(reply) !== 235) {
      const err = new Error(`SMTP XOAUTH2 auth failed: ${reply.slice(0, 200)}`);
      err.bounceType = 'AUTH';
      err.status = 0;
      throw err;
    }
    return;
  }

  // AUTH PLAIN: base64("\0user\0pass")
  const plainStr = `\x00${creds.user}\x00${creds.pass}`;
  const plainB64 = Buffer.from(plainStr, 'utf-8').toString('base64');
  await sendCmd(socket, 'AUTH PLAIN ' + plainB64);
  let reply = await readReply(socket);
  if (replyCode(reply) === 235) return; // success

  // Some servers only advertise LOGIN — try it as a fallback
  if (replyCode(reply) === 504 || replyCode(reply) === 502 || replyCode(reply) === 535) {
    await sendCmd(socket, 'AUTH LOGIN');
    reply = await readReply(socket);
    if (replyCode(reply) !== 334) {
      const err = new Error(`SMTP AUTH LOGIN not accepted: ${reply.slice(0, 200)}`);
      err.bounceType = 'AUTH';
      err.status = 0;
      throw err;
    }
    // Server asks for username (base64)
    await sendCmd(socket, Buffer.from(creds.user, 'utf-8').toString('base64'));
    reply = await readReply(socket);
    if (replyCode(reply) !== 334) {
      const err = new Error(`SMTP AUTH LOGIN user rejected: ${reply.slice(0, 200)}`);
      err.bounceType = 'AUTH';
      err.status = 0;
      throw err;
    }
    // Server asks for password (base64)
    await sendCmd(socket, Buffer.from(creds.pass, 'utf-8').toString('base64'));
    reply = await readReply(socket);
    if (replyCode(reply) !== 235) {
      const err = new Error(`SMTP AUTH LOGIN password rejected: ${reply.slice(0, 200)}`);
      err.bounceType = 'AUTH';
      err.status = 0;
      throw err;
    }
    return;
  }

  const err = new Error(`SMTP AUTH PLAIN failed: ${reply.slice(0, 200)}`);
  err.bounceType = 'AUTH';
  err.status = 0;
  throw err;
}

// ---------------------------------------------------------------------------
// Classify an SMTP reply code into a bounce category.
//   535 / 530 / 538           → AUTH
//   421 / 450 / 451 / 452 / 4xx→ TRANSIENT
//   550 / 551 / 553 / 5.1.1   → HARD_BOUNCE (user unknown / mailbox unavailable)
//   552 / 554                  → HARD_BOUNCE (message rejected)
// ---------------------------------------------------------------------------
function classifySmtpCode(code, reply) {
  const lower = String(reply || '').toLowerCase();
  if (code === 535 || code === 530 || code === 538) return 'AUTH';
  if (code >= 400 && code < 500) return 'TRANSIENT';
  if (code === 550 || code === 551 || code === 553 || code === 552 || code === 554) {
    // 550 with "user unknown" / "mailbox" / "no such" → HARD_BOUNCE
    if (
      lower.includes('user') ||
      lower.includes('mailbox') ||
      lower.includes('no such') ||
      lower.includes('recipient') ||
      lower.includes('unknown')
    ) {
      return 'HARD_BOUNCE';
    }
    // 550 rate-limit style → TRANSIENT
    if (lower.includes('rate') || lower.includes('limit') || lower.includes('too many')) {
      return 'RATE_LIMIT';
    }
    return 'HARD_BOUNCE';
  }
  if (code === 0) return 'TRANSIENT';
  return 'TRANSIENT';
}

// ---------------------------------------------------------------------------
// Build a minimal RFC-2822 MIME message (same structure as gmailSender).
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
    return headers.join('\r\n') + '\r\n\r\n' + body + '\r\n.\r\n';
  }

  const boundary = 'mms_boundary_' + Math.random().toString(36).slice(2);
  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

  const parts = [];
  parts.push(`--${boundary}`);
  parts.push('Content-Type: text/plain; charset=UTF-8');
  parts.push('Content-Transfer-Encoding: 7bit');
  parts.push('');
  parts.push(body);
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

  return headers.join('\r\n') + '\r\n\r\n' + parts.join('\r\n') + '\r\n.\r\n';
}

// ---------------------------------------------------------------------------
// Public API: sendViaSmtp({ account, to, subject, body, attachment })
//   account.credentials = { host, port, secure, user, pass, access_token? }
// Returns { success: true, provider: 'CUSTOM_SMTP', messageId: null }.
// Throws Error with .bounceType + .status on failure.
// ---------------------------------------------------------------------------
export async function sendViaSmtp({ account, to, subject, body, attachment }) {
  const creds = account.credentials || {};
  const host = creds.host;
  const port = Number(creds.port) || (creds.secure ? 465 : 587);
  const secure = creds.secure !== undefined ? !!creds.secure : port === 465;

  if (!host) {
    const err = new Error('SMTP account missing host in credentials');
    err.bounceType = 'AUTH';
    err.status = 0;
    throw err;
  }

  // Step 1: connect (implicit TLS or plain)
  let socket;
  if (secure) {
    socket = tls.connect({ host, port, servername: host, rejectUnauthorized: false });
  } else {
    socket = net.connect({ host, port });
  }
  socket.setTimeout(30000);

  try {
    await new Promise((resolve, reject) => {
      socket.once('secureConnect', resolve);
      socket.once('connect', () => {
        // For plain connections, the server sends the greeting; resolve on it
        resolve();
      });
      socket.once('error', reject);
    });

    // Read server greeting (220)
    let reply = await readReply(socket);
    if (replyCode(reply) !== 220) {
      const err = new Error(`SMTP greeting unexpected: ${reply.slice(0, 200)}`);
      err.bounceType = 'TRANSIENT';
      err.status = 0;
      throw err;
    }

    // EHLO
    const ehloHost = account.email ? account.email.split('@')[1] : 'mms-gateway.local';
    await sendCmd(socket, `EHLO ${ehloHost}`);
    let ehloReply = await readReply(socket);
    if (replyCode(ehloReply) !== 250) {
      // Some servers want HELO
      await sendCmd(socket, `HELO ${ehloHost}`);
      ehloReply = await readReply(socket);
      if (replyCode(ehloReply) !== 250) {
        const err = new Error(`SMTP EHLO/HELO rejected: ${ehloReply.slice(0, 200)}`);
        err.bounceType = 'TRANSIENT';
        err.status = 0;
        throw err;
      }
    }

    // STARTTLS if not already secure and server advertises it
    if (!secure && ehloReply.toLowerCase().includes('starttls')) {
      await sendCmd(socket, 'STARTTLS');
      reply = await readReply(socket);
      if (replyCode(reply) === 220) {
        // Upgrade the existing plain socket to TLS
        socket = socket.constructor && socket.constructor.name === 'Socket'
          ? tls.connect({ socket, servername: host, rejectUnauthorized: false })
          : socket;
        await new Promise((resolve, reject) => {
          socket.once('secureConnect', resolve);
          socket.once('error', reject);
        });
        // Re-EHLO after TLS upgrade
        await sendCmd(socket, `EHLO ${ehloHost}`);
        await readReply(socket);
      }
    }

    // Authenticate
    await authenticate(socket, creds);

    // MAIL FROM
    await sendCmd(socket, `MAIL FROM:<${account.email}>`);
    reply = await readReply(socket);
    if (replyCode(reply) !== 250) {
      const err = new Error(`SMTP MAIL FROM rejected: ${reply.slice(0, 200)}`);
      err.bounceType = classifySmtpCode(replyCode(reply), reply);
      err.status = replyCode(reply);
      throw err;
    }

    // RCPT TO
    await sendCmd(socket, `RCPT TO:<${to}>`);
    reply = await readReply(socket);
    if (replyCode(reply) !== 250 && replyCode(reply) !== 251) {
      const err = new Error(`SMTP RCPT TO rejected: ${reply.slice(0, 200)}`);
      err.bounceType = classifySmtpCode(replyCode(reply), reply);
      err.status = replyCode(reply);
      throw err;
    }

    // DATA
    await sendCmd(socket, 'DATA');
    reply = await readReply(socket);
    if (replyCode(reply) !== 354) {
      const err = new Error(`SMTP DATA not accepted: ${reply.slice(0, 200)}`);
      err.bounceType = classifySmtpCode(replyCode(reply), reply);
      err.status = replyCode(reply);
      throw err;
    }

    // Send MIME body (already ends with \r\n.\r\n)
    const mime = buildMime({ from: account.email, to, subject, body, attachment });
    await sendCmd(socket, mime);
    reply = await readReply(socket);
    if (replyCode(reply) !== 250) {
      const err = new Error(`SMTP message rejected: ${reply.slice(0, 200)}`);
      err.bounceType = classifySmtpCode(replyCode(reply), reply);
      err.status = replyCode(reply);
      throw err;
    }

    // QUIT
    try { await sendCmd(socket, 'QUIT'); } catch (_e) { /* ignore */ }

    return { success: true, provider: 'CUSTOM_SMTP', messageId: null };
  } finally {
    try { socket.destroy(); } catch (_e) { /* ignore */ }
  }
}

export { buildMime, classifySmtpCode };
