// ============================================================================
// queueRouter.js — Dynamic Queue Router (Phase 3, Step 2)
// ============================================================================
// Implements `sendMMS(targetCarrierEmail, subject, body, attachment)` which is
// the core send primitive for the Email-to-MMS Gateway. It:
//
//   1. Reads the global SystemConfig (routingDelaySeconds, batchSizePerAccount).
//   2. Fetches every EmailAccount that is ACTIVE (status === 'ACTIVE'),
//      has not exceeded its dailyLimit (sentToday < dailyLimit), and whose
//      cooldown window (if any) has expired.
//   3. Throws an Error if NO account is available (caller surfaces 503).
//   4. Rotates accounts in Round-Robin order (sorted by lastUsedAt ascending,
//      so the least-recently-used account is picked next — this gives an even
//      distribution without a separate rotation cursor).
//   5. Applies a dynamic inter-send delay (routingDelaySeconds) between
//      successive dispatches to pace the provider and protect reputation.
//   6. Delegates the actual send to `sendByProvider` (Phase 3, Step 1) and
//      hands the result to `bounceHandler.withBounceHandling` (Phase 3, Step 3)
//      so sentToday/consecutiveBounces/CarrierCache are updated correctly.
//
// The router is stateless across requests: it always queries the DB for the
// freshest account state, which makes it safe under serverless concurrency
// (Vercel/Netlify) where no in-process state survives between invocations.
//
// NON-DESTRUCTIVE: brand-new module. Does not modify any existing file.
// ============================================================================

import { connectDB, EmailAccount, SystemConfig } from '@/lib/core';
import { sendByProvider } from './senders/index.js';
import { withBounceHandling } from './bounceHandler.js';

// ---------------------------------------------------------------------------
// Read the SystemConfig singleton. Returns a plain object with sensible
// defaults if the document does not yet exist (first run).
// ---------------------------------------------------------------------------
async function getSystemConfig() {
  let doc = await SystemConfig.findOne({}).lean();
  if (!doc) {
    doc = {
      routingDelaySeconds: 3,
      batchSizePerAccount: 5,
    };
  }
  return {
    routingDelaySeconds:
      typeof doc.routingDelaySeconds === 'number' && doc.routingDelaySeconds >= 0
        ? doc.routingDelaySeconds
        : 3,
    batchSizePerAccount:
      typeof doc.batchSizePerAccount === 'number' && doc.batchSizePerAccount > 0
        ? doc.batchSizePerAccount
        : 5,
  };
}

// ---------------------------------------------------------------------------
// Fetch all usable EmailAccounts. A usable account is:
//   - status === 'ACTIVE'
//   - sentToday < dailyLimit
//   - cooldownUntil is null OR cooldownUntil <= now
// Sorted by lastUsedAt ascending (Round-Robin: least-recently-used first).
// Accounts that have never been used (lastUsedAt null) sort first.
// ---------------------------------------------------------------------------
async function getAvailableAccounts() {
  const now = new Date();
  return EmailAccount.find({
    status: 'ACTIVE',
    sentToday: { $lt: '$dailyLimit' }, // placeholder, replaced below
  })
    .sort({ lastUsedAt: 1 })
    .lean();
}

// We cannot use a $lt on a sibling field reference in a plain query, so we
// fetch all ACTIVE accounts and filter by the per-doc limit in JS. This is
// correct because the daily limit is per-account and may differ between
// accounts (e.g. a warmed-up Gmail at 450/day vs a new one at 100/day).
async function getUsableAccounts() {
  const now = new Date();
  const all = await EmailAccount.find({
    status: 'ACTIVE',
    $or: [{ cooldownUntil: null }, { cooldownUntil: { $lte: now } }],
  })
    .sort({ lastUsedAt: 1 })
    .lean();
  return all.filter((a) => a.sentToday < (a.dailyLimit || 400));
}

// ---------------------------------------------------------------------------
// A module-level "last send timestamp" so the dynamic routingDelaySeconds is
// honoured ACROSS multiple sendMMS calls within the same serverless
// invocation / warm process. When the process is cold (new invocation) this
// resets, which is fine — the delay is a reputation-pacing hint, not a hard
// provider requirement, and the per-account dailyLimit/cooldown logic in the
// DB is the real guard.
// ---------------------------------------------------------------------------
let _lastSendAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Apply the dynamic routing delay if the previous send happened too recently.
// Reads routingDelaySeconds from SystemConfig on every call so admin tuning
// takes effect immediately.
// ---------------------------------------------------------------------------
async function applyRoutingDelay(config) {
  if (_lastSendAt > 0) {
    const elapsedMs = Date.now() - _lastSendAt;
    const targetMs = (config.routingDelaySeconds || 0) * 1000;
    if (elapsedMs < targetMs) {
      await sleep(targetMs - elapsedMs);
    }
  }
}

// ---------------------------------------------------------------------------
// Pick the next account in Round-Robin order. `getUsableAccounts` already
// sorts by lastUsedAt ascending, so the first element is the
// least-recently-used usable account — exactly the Round-Robin choice.
// ---------------------------------------------------------------------------
function pickNextAccount(accounts) {
  return accounts[0];
}

// ---------------------------------------------------------------------------
// Public API: sendMMS(targetCarrierEmail, subject, body, attachment)
//
//   targetCarrierEmail — the MMS gateway address (e.g. 12125551234@vzwpix.com)
//   subject            — email subject (usually empty for MMS gateways)
//   body               — plain-text message body
//   attachment         — optional { filename, contentType, content }
//
// Returns:
//   { success: true, provider, accountEmail, messageId, carrierEmail }
//
// Throws:
//   Error('No active email account available for sending') when every
//   account is exhausted / in cooldown / suspended. The caller (bounceHandler
//   / bulkSendEngine wrapper) maps this to a 503-style result.
//
//   Any provider error is wrapped by withBounceHandling BEFORE it reaches
//   the caller, so sentToday / consecutiveBounces / CarrierCache are updated.
// ---------------------------------------------------------------------------
export async function sendMMS(targetCarrierEmail, subject, body, attachment) {
  await connectDB();
  const config = await getSystemConfig();

  const accounts = await getUsableAccounts();
  if (!accounts || accounts.length === 0) {
    const err = new Error('No active email account available for sending');
    err.code = 'NO_SENDER_ACCOUNT';
    throw err;
  }

  const account = pickNextAccount(accounts);

  // Honour the dynamic inter-send delay
  await applyRoutingDelay(config);

  // Dispatch through the bounce-aware interceptor. withBounceHandling runs
  // the actual sendByProvider call and, depending on the outcome, updates
  // sentToday / consecutiveBounces / CarrierCache on the account that was
  // used. It re-throws provider errors (with .bounceType attached) so the
  // caller knows the send failed.
  const result = await withBounceHandling({
    account,
    sendFn: () =>
      sendByProvider({
        account,
        to: targetCarrierEmail,
        subject,
        body,
        attachment,
      }),
    carrierEmail: targetCarrierEmail,
  });

  _lastSendAt = Date.now();

  return {
    success: true,
    provider: result.provider,
    accountEmail: account.email,
    messageId: result.messageId,
    carrierEmail: targetCarrierEmail,
  };
}

// ---------------------------------------------------------------------------
// Bulk convenience wrapper: sendMMSBatch(targets, subject, body, attachment)
//   targets — array of { phoneNumber, carrierEmail } (or plain carrierEmail
//             strings). Iterates with the dynamic delay between each.
// Returns an array of per-target results:
//   { target, success, provider?, accountEmail?, messageId?, error? }
// ---------------------------------------------------------------------------
export async function sendMMSBatch(targets, subject, body, attachment) {
  await connectDB();
  const config = await getSystemConfig();
  const results = [];

  const list = Array.isArray(targets) ? targets : [];
  for (const t of list) {
    const carrierEmail = typeof t === 'string' ? t : t && t.carrierEmail;
    const phoneNumber = typeof t === 'object' && t ? t.phoneNumber : null;
    if (!carrierEmail) {
      results.push({ target: t, success: false, error: 'Missing carrierEmail' });
      continue;
    }
    try {
      const res = await sendMMS(carrierEmail, subject, body, attachment);
      results.push({
        target: { phoneNumber, carrierEmail },
        success: true,
        provider: res.provider,
        accountEmail: res.accountEmail,
        messageId: res.messageId,
      });
    } catch (e) {
      results.push({
        target: { phoneNumber, carrierEmail },
        success: false,
        error: e.message,
        code: e.code || e.bounceType || null,
      });
    }
    // Inter-target pacing (the intra-batch delay). sendMMS already applies
    // the routing delay, but we add an explicit one here so even fast
    // failures don't burst-fire the next account.
    if (config.routingDelaySeconds > 0) {
      await sleep(config.routingDelaySeconds * 1000);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// resetRoutingDelayState — exposed for tests / admin "flush pacing" action.
// Resets the module-level last-send timestamp so the next send fires
// immediately regardless of how recently the previous one ran.
// ---------------------------------------------------------------------------
export function resetRoutingDelayState() {
  _lastSendAt = 0;
}

export { getSystemConfig, getUsableAccounts, pickNextAccount, sleep };
