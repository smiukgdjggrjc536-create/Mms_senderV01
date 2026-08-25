// ============================================================================
// services/senders/index.js — Provider dispatcher (Phase 3, Step 1)
// ============================================================================
// Single entry point the queueRouter uses to send an MMS email through the
// correct provider backend based on the EmailAccount's `provider` field.
//
// NON-DESTRUCTIVE: brand-new module.
// ============================================================================

import nodemailer from 'nodemailer';
import { sendViaGmail } from './gmailSender.js';
import { sendViaOutlook } from './outlookSender.js';
import { sendViaSmtp } from './smtpSender.js';

// ---------------------------------------------------------------------------
// Gmail App Password sender — uses nodemailer with smtp.gmail.com + the
// 16-char app password. The account.credentials stores { appPassword } and
// the account.email is the Gmail address. We adapt it to SMTP format here.
// ---------------------------------------------------------------------------
async function sendViaGmailAppPassword({ account, to, subject, body, attachment, fromName }) {
  const cred = account.credentials || {};
  const pass = String(cred.appPassword || cred.password || '').replace(/\s/g, '');
  if (!pass) {
    const err = new Error('Gmail App Password account missing appPassword in credentials');
    err.bounceType = 'AUTH';
    err.status = 0;
    throw err;
  }
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: account.email, pass },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 30000,
  });

  const fromHeader = fromName
    ? `${fromName.replace(/[\r\n<>]/g, '').trim()} <${account.email}>`
    : account.email;
  const isHtml = body && /<[a-z][\s\S]*>/i.test(body);
  const mailOptions = {
    from: fromHeader,
    to,
    subject: subject || '',
    [isHtml ? 'html' : 'text']: body || '',
  };

  // If an attachment is supplied, attach it
  if (attachment && attachment.content) {
    mailOptions.attachments = [{
      filename: attachment.filename || 'attachment',
      content: Buffer.isBuffer(attachment.content)
        ? attachment.content
        : Buffer.from(String(attachment.content), 'utf-8'),
      contentType: attachment.contentType || 'application/octet-stream',
    }];
  }

  const info = await transporter.sendMail(mailOptions);
  return { success: true, provider: 'GMAIL_APP_PASSWORD', messageId: info.messageId || null };
}

// Map EmailAccount.provider → sender function
const SENDER_MAP = {
  GMAIL_OAUTH: sendViaGmail,
  GMAIL_APP_PASSWORD: sendViaGmailAppPassword,
  OUTLOOK_GRAPH: sendViaOutlook,
  // Yahoo / AOL consumer mail can also use SMTP with app passwords
  YAHOO: sendViaSmtp,
  AOL: sendViaSmtp,
  CUSTOM_SMTP: sendViaSmtp,
};

// ---------------------------------------------------------------------------
// sendByProvider({ account, to, subject, body, attachment, fromName })
// Dispatches to the correct sender. Throws if the provider is unknown.
// fromName is optional — when provided, it's used as the display name in the
// From header (e.g. "Support Team <sender@gmail.com>").
// ---------------------------------------------------------------------------
export async function sendByProvider({ account, to, subject, body, attachment, fromName }) {
  const provider = (account.provider || '').toUpperCase();
  const sender = SENDER_MAP[provider];
  if (!sender) {
    const err = new Error(`Unknown email provider: ${provider}`);
    err.bounceType = 'AUTH';
    err.status = 0;
    throw err;
  }
  return sender({ account, to, subject, body, attachment, fromName: fromName || '' });
}

export { sendViaGmail, sendViaGmailAppPassword, sendViaOutlook, sendViaSmtp };
export default sendByProvider;
