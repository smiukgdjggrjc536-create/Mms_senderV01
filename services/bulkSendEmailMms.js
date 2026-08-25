// ============================================================================
// bulkSendEmail.js — Email Sending bulk engine (Email Sending Module)
// ============================================================================
// A drop-in alternative send path for bulkSendEngine (src/lib/core.js) that
// uses the Email Sending Gateway (queueRouter + senders + bounceHandler
// + prepareEmail) instead of the SMS sender APIs (Twilio etc.).
//
// It is invoked from bulkSendEngine's `no_sender_api` fallback branch (and
// when options.channel === 'email' is requested), so the EXISTING SMS flow is
// never broken — this is purely additive.
//
// CRITICAL: the return object is SHAPE-COMPATIBLE with bulkSendEngine so the
// /api/system `sendCampaign` handler and the User Panel UI need zero changes:
//   {
//     blocked, spamScore, spamLevel, spamReasons, aiReview,
//     totalSent, totalDelivered, totalUndelivered,
//     totalInvalid, invalidNumbers, deliveryReports,
//     senderApiUsed, apisUsed, channel: 'email'
//   }
//
// Flow per email:
//   1. prepareEmailPayload(emailAddress, message, context) — Phase 2:
//        safetyFilter → rewriteMessage → { to, text, ... }
//        Throws BLOCKED_BY_SAFETY_FILTER / invalid-email.
//   2. queueRouter.sendEmail(recipientEmail, subject, rewrittenBody, attachment)
//        — Phase 3: picks an EmailAccount, sends via the right provider,
//          updates reputation via bounceHandler.
//   3. Record a DeliveryReport-compatible object in the deliveryReports[]
//      array (the caller in bulkSendEngine / core.js decides whether to
//      persist via DeliveryReport.insertMany — we mirror the same fields).
//
// NOTE: This is the EMAIL transformation of the former bulkSendEmailMms.js.
// The carrier-lookup step is GONE — recipients are email addresses directly.
// ============================================================================

import { sendMMS as sendEmail, getSystemConfig } from './queueRouter.js';
import { prepareEmailPayload } from './prepareEmail.js';

// ---------------------------------------------------------------------------

function resolveSubject(options) {
  return (options && options.subject) || '';
}

function resolveAttachment(options) {
  if (!options || !options.attachment) return null;
  const a = options.attachment;
  if (!a || (!a.content && !a.filename)) return null;
  return a;
}

export async function bulkSendEngineEmailMMS(opts) {
  const {
    user,
    message,
    numbers,        // historically "numbers" — now holds email addresses
    invalidNumbers = [],
    campaign,
    appSettings,
    options = {},
  } = opts;

  const subject = resolveSubject(options);
  const attachment = resolveAttachment(options);

  const context = {
    userId: user && user._id ? String(user._id) : null,
    actorType: 'user',
    username: user ? user.email || user.userId : 'unknown',
  };

  const spamScore = options._spamScore != null ? options._spamScore : 0;
  const spamLevel = options._spamLevel || 'clean';
  const spamReasons = options._spamReasons || [];
  const aiReview = options._aiReview || null;

  const deliveryReports = [];
  let totalSent = 0;
  let totalDelivered = 0;
  let totalUndelivered = 0;
  const accountsUsed = new Set();

  // Mark the campaign as running via the email channel.
  if (campaign) {
    try {
      campaign.status = 'running';
      campaign.senderApiName = 'Email Gateway';
      campaign.channel = 'email';
      await campaign.save();
    } catch (_e) {
      // non-fatal
    }
  }

  // Iterate emails. Each goes through prepareEmailPayload (safety + rewrite)
  // then the queue router (send).
  for (const email of numbers) {
    const baseDR = {
      campaignId: campaign ? campaign._id : null,
      userId: user ? user._id : null,
      userEmail: user ? user.email : null,
      number: email,           // field name kept for schema compat; holds email
      batchIndex: 0,
      sentAt: new Date(),
    };

    // Step 1 — prepare the email payload (safety + rewrite)
    let payload;
    try {
      payload = await prepareEmailPayload(email, message, context);
    } catch (prepErr) {
      totalUndelivered++;
      deliveryReports.push({
        ...baseDR,
        status: 'failed',
        provider: 'EMAIL',
        providerMsgId: null,
        errorCode: prepErr.code || 'PREPARE_FAILED',
        attempts: 1,
        errorMessage:
          prepErr.code === 'BLOCKED_BY_SAFETY_FILTER'
            ? `Blocked by safety filter (keyword: ${prepErr.matchedKeyword || 'n/a'})`
            : prepErr.message || 'Email payload preparation failed',
      });
      continue;
    }

    // Step 2 — send through the queue router (delegates to the correct
    // provider and runs the bounce handler).
    try {
      const res = await sendEmail(payload.to, subject, payload.text, attachment);
      totalSent++;
      totalDelivered++;
      if (res.accountEmail) accountsUsed.add(res.accountEmail);
      deliveryReports.push({
        ...baseDR,
        status: 'sent',
        provider: res.provider || 'EMAIL',
        providerMsgId: res.messageId || null,
        errorCode: null,
        attempts: 1,
        senderApiName: res.accountEmail || 'Email Gateway',
        recipientEmail: payload.to,
        recipientDomain: payload.domain,
        rewritten: payload.rewritten,
      });
    } catch (sendErr) {
      totalSent++; // a send was attempted
      totalUndelivered++;
      if (sendErr.accountEmail) accountsUsed.add(sendErr.accountEmail);
      deliveryReports.push({
        ...baseDR,
        status: 'failed',
        provider: 'EMAIL',
        providerMsgId: null,
        errorCode: sendErr.code || sendErr.bounceType || 'SEND_FAILED',
        attempts: 1,
        errorMessage: sendErr.message || 'Email send failed',
        recipientEmail: payload.to,
        recipientDomain: payload.domain,
        rewritten: payload.rewritten,
      });

      // If the router ran out of accounts entirely, stop the batch — there's
      // no point retrying the remaining emails (they'd all hit the same
      // NO_SENDER_ACCOUNT error).
      const curIdx = numbers.indexOf(email);
      if (sendErr.code === 'NO_SENDER_ACCOUNT') {
        for (const remaining of numbers.slice(curIdx + 1)) {
          totalUndelivered++;
          deliveryReports.push({
            ...baseDR,
            number: remaining,
            status: 'failed',
            provider: 'EMAIL',
            providerMsgId: null,
            errorCode: 'NO_SENDER_ACCOUNT',
            attempts: 0,
            errorMessage: 'No active email account available for sending',
          });
        }
        break;
      }
    }
  }

  // Finalize the campaign document (mirror bulkSendEngine's finalize step).
  if (campaign) {
    try {
      campaign.totalSent = totalSent;
      campaign.totalDelivered = totalDelivered;
      campaign.totalUndelivered = totalUndelivered;
      campaign.status =
        totalSent === 0
          ? 'failed'
          : totalDelivered === totalSent
            ? 'sent'
            : 'partial';
      campaign.senderApiName =
        accountsUsed.size > 0
          ? 'Email: ' + [...accountsUsed].join(', ')
          : 'Email Gateway';
      await campaign.save();
    } catch (_e) {
      // non-fatal
    }
  }

  // Persist delivery reports if a campaign context exists.
  if (deliveryReports.length > 0 && campaign) {
    try {
      const { DeliveryReport } = await import('@/lib/core');
      if (DeliveryReport && DeliveryReport.insertMany) {
        await DeliveryReport.insertMany(deliveryReports);
      }
    } catch (_e) {
      // Best-effort; non-fatal.
    }
  }

  // SHAPE-COMPATIBLE return (matches bulkSendEngine exactly + a `channel` tag).
  return {
    blocked: false,
    channel: 'email',
    spamScore,
    spamLevel,
    spamReasons,
    aiReview,
    totalSent,
    totalDelivered,
    totalUndelivered,
    totalInvalid: invalidNumbers.length,
    invalidNumbers,
    deliveryReports,
    senderApiUsed:
      accountsUsed.size > 0
        ? 'Email: ' + [...accountsUsed].join(', ')
        : 'Email Gateway',
    apisUsed: [...accountsUsed],
  };
}

export default bulkSendEngineEmailMMS;
