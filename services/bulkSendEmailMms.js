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

// ── Tag resolution: replaces all #TAG# tokens in subject & body ──
const RANDOM_NAMES = ['Sarah','John','Emily','Michael','Lisa','David','Anna','James','Maria','Robert','Linda','Chris','Jessica','Mark','Patricia','Steven','Karen','Brian','Nancy','Kevin'];
const RANDOM_CITIES = ['Chicago','Austin','Seattle','Boston','Denver','Portland','Miami','Atlanta','Phoenix','Dallas','Nashville','San Diego','Minneapolis','Charlotte'];
const RANDOM_WORDS = ['JHKHJdsk09','Kx7mP2qNz','QmXpLz3rT','bN5vR8wKj','Hg2fD6sLp','Yt9cE4mNb','Vr1aU7iOq','Wz3xS6tLk','Pj8oF2hMv','Cd5rG9nBy'];

function randomStr(n) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < n; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

function resolveTags(text) {
  if (!text || typeof text !== 'string') return text || '';
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return text
    .replace(/#RANDOM#/g, () => randomStr(6))
    .replace(/#RandomJunk#/g, () => RANDOM_WORDS[Math.floor(Math.random() * RANDOM_WORDS.length)])
    .replace(/#RANDOM_NUMBER#/g, () => String(Math.floor(Math.random() * 9999) + 1))
    .replace(/#RANDOM_STRING#/g, () => randomStr(8))
    .replace(/#RANDOM_LETTERS#/g, () => randomStr(6).replace(/[0-9]/g, 'X'))
    .replace(/#DATE#/g, dateStr)
    .replace(/#TIME#/g, timeStr)
    .replace(/#DATETIME#/g, dateStr + ' ' + timeStr)
    .replace(/#YEAR#/g, String(now.getFullYear()))
    .replace(/#WEEKDAY#/g, now.toLocaleDateString('en-US', { weekday: 'long' }))
    .replace(/#NAME#/g, () => RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)])
    .replace(/#CITY#/g, () => RANDOM_CITIES[Math.floor(Math.random() * RANDOM_CITIES.length)])
    .replace(/#GREETING#/g, greeting)
    .replace(/#SUBJECT_RANDOM#/g, () => RANDOM_WORDS[Math.floor(Math.random() * RANDOM_WORDS.length)].slice(0, 6))
    .replace(/#SENDER_NAME#/g, 'Support Team')
    .replace(/#UNSUB_LINK#/g, '[unsubscribe]');
}

function resolveSubject(options) {
  const raw = (options && options.subject) || '';
  return resolveTags(raw);
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

  // ── BM2 Ultra: per-recipient From Name + Subject rotation ──
  const fromNameVariants = Array.isArray(options.fromNameVariants) ? options.fromNameVariants : [];
  const subjectVariants = Array.isArray(options.subjectVariants) ? options.subjectVariants : [];
  const autoChangeName = !!options.autoChangeName;
  const autoChangeSubject = !!options.autoChangeSubject;
  const baseFromName = options.fromName || '';
  const trackPixel = !!options.trackPixel;
  const embedAll = !!options.embedAll;

  // Build the From Name pool: if autoChangeName + variants, rotate; else use baseFromName
  const fromNamePool = (autoChangeName && fromNameVariants.length > 0) ? fromNameVariants : (baseFromName ? [baseFromName] : []);

  // Subject resolution: base subject (with tags) OR rotate through variants
  function pickSubject(idx) {
    if (autoChangeSubject && subjectVariants.length > 0) {
      return resolveTags(subjectVariants[idx % subjectVariants.length]);
    }
    return resolveSubject(options);
  }

  // Pick a From Name for recipient idx (rotates through pool)
  function pickFromName(idx) {
    if (fromNamePool.length === 0) return '';
    return fromNamePool[idx % fromNamePool.length];
  }

  // Track pixel injection: append a 1x1 transparent pixel <img> to the HTML body
  function injectTrackPixel(htmlBody, recipientEmail, campaignId) {
    if (!trackPixel) return htmlBody;
    const cid = campaignId || (campaign && campaign._id) || 'na';
    const pixelUrl = `https://mms-gateway-engine.onrender.com/api/track/open?c=${encodeURIComponent(cid)}&r=${encodeURIComponent(recipientEmail)}&t=${Date.now()}`;
    const pixel = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;border:0;outline:none;" />`;
    // Inject before </body> if present, else append
    if (htmlBody && htmlBody.includes('</body>')) {
      return htmlBody.replace('</body>', `${pixel}</body>`);
    }
    return (htmlBody || '') + pixel;
  }

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
  for (let emailIdx = 0; emailIdx < numbers.length; emailIdx++) {
    const email = numbers[emailIdx];
    // BM2 Ultra: per-recipient subject + from name rotation
    const perSubject = pickSubject(emailIdx);
    const perFromName = pickFromName(emailIdx);
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
      // Per-recipient tag resolution for body (so #RANDOM#, #NAME#, etc. resolve uniquely per recipient)
      let resolvedBody = resolveTags(message);
      // BM2 Ultra: inject track pixel if enabled
      resolvedBody = injectTrackPixel(resolvedBody, email, campaign ? campaign._id : null);
      // BM2 Ultra: embed all (inline all images as base64 if embedAll)
      if (embedAll && resolvedBody && resolvedBody.includes('src="http')) {
        // Note: actual base64 embedding of remote images would require fetching them;
        // we mark the body so the MIME builder knows to inline. For now, we keep remote src
        // which Gmail will proxy. True inline embedding can be added later.
      }
      payload = await prepareEmailPayload(email, resolvedBody, context);
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
    // provider and runs the bounce handler). Pass fromName for MIME From header.
    try {
      const res = await sendEmail(payload.to, perSubject, payload.text, attachment, { fromName: perFromName });
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
      if (sendErr.code === 'NO_SENDER_ACCOUNT') {
        for (const remaining of numbers.slice(emailIdx + 1)) {
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
