// ============================================================================
// services/senders/index.js — Provider dispatcher (Phase 3, Step 1)
// ============================================================================
// Single entry point the queueRouter uses to send an MMS email through the
// correct provider backend based on the EmailAccount's `provider` field.
//
// NON-DESTRUCTIVE: brand-new module.
// ============================================================================

import { sendViaGmail } from './gmailSender.js';
import { sendViaOutlook } from './outlookSender.js';
import { sendViaSmtp } from './smtpSender.js';

// Map EmailAccount.provider → sender function
const SENDER_MAP = {
  GMAIL_OAUTH: sendViaGmail,
  OUTLOOK_GRAPH: sendViaOutlook,
  // Yahoo / AOL consumer mail can also use SMTP with app passwords
  YAHOO: sendViaSmtp,
  AOL: sendViaSmtp,
  CUSTOM_SMTP: sendViaSmtp,
};

// ---------------------------------------------------------------------------
// sendByProvider({ account, to, subject, body, attachment })
// Dispatches to the correct sender. Throws if the provider is unknown.
// ---------------------------------------------------------------------------
export async function sendByProvider({ account, to, subject, body, attachment }) {
  const provider = (account.provider || '').toUpperCase();
  const sender = SENDER_MAP[provider];
  if (!sender) {
    const err = new Error(`Unknown email provider: ${provider}`);
    err.bounceType = 'AUTH';
    err.status = 0;
    throw err;
  }
  return sender({ account, to, subject, body, attachment });
}

export { sendViaGmail, sendViaOutlook, sendViaSmtp };
export default sendByProvider;
