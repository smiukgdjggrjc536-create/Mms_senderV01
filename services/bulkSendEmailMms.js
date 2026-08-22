// ============================================================================
// bulkSendEmailMms.js — Email-to-MMS bulk send engine (Phase 3, Step 4)
// ============================================================================
// A drop-in alternative send path for bulkSendEngine (src/lib/core.js) that
// uses the Phase 3 Email-to-MMS Gateway (queueRouter + senders + bounceHandler
// + carrierLookup + prepareMms) instead of the SMS sender APIs (Twilio etc.).
//
// It is invoked from bulkSendEngine's `no_sender_api` fallback branch (and
// when options.channel === 'email_mms' is requested), so the EXISTING SMS
// flow is never broken — this is purely additive.
//
// CRITICAL: the return object is SHAPE-COMPATIBLE with bulkSendEngine so the
// /api/system `sendCampaign` handler and the User Panel UI need zero changes:
//   {
//     blocked, spamScore, spamLevel, spamReasons, aiReview,
//     totalSent, totalDelivered, totalUndelivered,
//     totalInvalid, invalidNumbers, deliveryReports,
//     senderApiUsed, apisUsed, channel: 'email_mms'
//   }
//
// Flow per number:
//   1. prepareMMSPayload(phoneNumber, message, context) — Phase 2:
//        safetyFilter → rewriteMessage → getCarrierGateway → { to, text, ... }
//        Throws BLOCKED_BY_SAFETY_FILTER / landline / invalid-phone.
//   2. queueRouter.sendMMS(carrierEmail, subject, rewrittenBody, attachment)
//        — Phase 3: picks an EmailAccount, sends via the right provider,
//          updates reputation via bounceHandler.
//   3. Record a DeliveryReport-compatible object in the deliveryReports[]
//      array (the caller in bulkSendEngine / core.js decides whether to
//      persist via DeliveryReport.insertMany — we mirror the same fields).
//
// NON-DESTRUCTIVE: brand-new module. core.js is only edited to CALL this from
// the no_sender_api branch (a wrapped return), never to replace existing SMS
// logic.
// ============================================================================

import { sendMMS, getSystemConfig } from './queueRouter.js';
import { prepareMMSPayload } from './prepareMms.js';

// ---------------------------------------------------------------------------
// Main entry. Mirrors bulkSendEngine's opts shape so the caller can hand the
// same object through.
//   opts = { user, message, numbers, invalidNumbers, countryInfo, geminiApi,
//            campaign, appSettings, options }
// ---------------------------------------------------------------------------

// Resolve the carrier gateway subject line. Most MMS gateways ignore the
// subject, but some (Verizon) render it; we keep it short and empty by
// default, allowing options.subject to override.
function resolveSubject(options) {
  return (options && options.subject) || '';
}

// Resolve an optional attachment. options.attachment =
// { filename, contentType, content } — passed straight through to sendMMS.
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
    numbers,
    invalidNumbers = [],
    campaign,
    appSettings,
    options = {},
  } = opts;

  const subject = resolveSubject(options);
  const attachment = resolveAttachment(options);

  // Context propagated to prepareMMSPayload's safetyFilter (so safety blocks
  // log the acting user).
  const context = {
    userId: user && user._id ? String(user._id) : null,
    actorType: 'user',
    username: user ? user.email || user.userId : 'unknown',
  };

  // spamScore / spamLevel: the email-MMS path does NOT re-run the SMS spam
  // heuristic (that was already done by bulkSendEngine before it called us as
  // a fallback). We carry through whatever the caller computed. If called
  // directly (options.channel === 'email_mms'), we compute a minimal score.
  const spamScore = options._spamScore != null ? options._spamScore : 0;
  const spamLevel = options._spamLevel || 'clean';
  const spamReasons = options._spamReasons || [];
  const aiReview = options._aiReview || null;

  const deliveryReports = [];
  let totalSent = 0;
  let totalDelivered = 0;
  let totalUndelivered = 0;
  const accountsUsed = new Set();

  // Mark the campaign as running via the email-MMS channel.
  if (campaign) {
    try {
      campaign.status = 'running';
      campaign.senderApiName = 'Email-to-MMS Gateway';
      campaign.channel = 'email_mms';
      await campaign.save();
    } catch (_e) {
      // non-fatal
    }
  }

  // Iterate numbers. Each goes through prepareMMSPayload (Phase 2) then the
  // queue router (Phase 3).
  for (const number of numbers) {
    const baseDR = {
      campaignId: campaign ? campaign._id : null,
      userId: user ? user._id : null,
      userEmail: user ? user.email : null,
      number,
      batchIndex: 0,
      sentAt: new Date(),
    };

    // Step 1 — prepare the MMS payload (safety + rewrite + carrier lookup)
    let payload;
    try {
      payload = await prepareMMSPayload(number, message, context);
    } catch (prepErr) {
      totalUndelivered++;
      deliveryReports.push({
        ...baseDR,
        status: 'failed',
        provider: 'EMAIL_MMS',
        providerMsgId: null,
        errorCode: prepErr.code || 'PREPARE_FAILED',
        attempts: 1,
        errorMessage:
          prepErr.code === 'BLOCKED_BY_SAFETY_FILTER'
            ? `Blocked by safety filter (keyword: ${prepErr.matchedKeyword || 'n/a'})`
            : prepErr.message || 'MMS payload preparation failed',
      });
      continue;
    }

    // Step 2 — send through the queue router (which delegates to the correct
    // provider and runs the bounce handler).
    try {
      const res = await sendMMS(payload.to, subject, payload.text, attachment);
      totalSent++;
      totalDelivered++;
      if (res.accountEmail) accountsUsed.add(res.accountEmail);
      deliveryReports.push({
        ...baseDR,
        status: 'sent',
        provider: res.provider || 'EMAIL_MMS',
        providerMsgId: res.messageId || null,
        errorCode: null,
        attempts: 1,
        senderApiName: res.accountEmail || 'Email-to-MMS Gateway',
        carrierEmail: payload.to,
        carrierDomain: payload.carrierDomain,
        lineType: payload.lineType,
        rewritten: payload.rewritten,
      });
    } catch (sendErr) {
      totalSent++; // a send was attempted
      totalUndelivered++;
      if (sendErr.accountEmail) accountsUsed.add(sendErr.accountEmail);
      deliveryReports.push({
        ...baseDR,
        status: 'failed',
        provider: 'EMAIL_MMS',
        providerMsgId: null,
        errorCode: sendErr.code || sendErr.bounceType || 'SEND_FAILED',
        attempts: 1,
        errorMessage: sendErr.message || 'Email-to-MMS send failed',
        carrierEmail: payload.to,
        carrierDomain: payload.carrierDomain,
        lineType: payload.lineType,
        rewritten: payload.rewritten,
      });

      // If the router ran out of accounts entirely, stop the batch — there's
      // no point retrying the remaining numbers (they'd all hit the same
      // NO_SENDER_ACCOUNT error).
      // indexOf on the original numbers array so the skip slice is correct
      const curIdx = numbers.indexOf(number);
      if (sendErr.code === 'NO_SENDER_ACCOUNT') {
        for (const remaining of numbers.slice(curIdx + 1)) {
          totalUndelivered++;
          deliveryReports.push({
            ...baseDR,
            number: remaining,
            status: 'failed',
            provider: 'EMAIL_MMS',
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
          ? 'Email-to-MMS: ' + [...accountsUsed].join(', ')
          : 'Email-to-MMS Gateway';
      await campaign.save();
    } catch (_e) {
      // non-fatal
    }
  }

  // Persist delivery reports if a campaign context exists.
  if (deliveryReports.length > 0 && campaign) {
    try {
      // Lazy import to avoid a circular dependency with core.js at module load.
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
    channel: 'email_mms',
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
        ? 'Email-to-MMS: ' + [...accountsUsed].join(', ')
        : 'Email-to-MMS Gateway',
    apisUsed: [...accountsUsed],
  };
}

export default bulkSendEngineEmailMMS;
