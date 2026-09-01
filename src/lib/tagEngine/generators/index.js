// ============================================================================
// V7 P2.2 — Generator Library index
// ============================================================================
// Aggregates all generator functions into a single dispatch table keyed by
// generatorId. The mapping engine uses this to resolve a tag def's
// generatorId → generator function.
//
// Every generator receives a context: { recipientEmail, campaignId, salt,
// index } and MUST derive output so two different recipients get different
// values, and the same recipient re-rendered with a different salt gets a
// different value too.
//
// NO Math.random is used anywhere in this module — all randomness is from
// Node crypto.
// ============================================================================

import { generateInvoice } from './invoice.js';
import { generateSerial } from './serial.js';
import { generateTfn } from './tfn.js';
import { generateHelpdesk } from './helpdesk.js';
import { smartDate, formatDate, parseDate } from './date.js';
import { generateOrderId } from './orderid.js';
import { generateTracking } from './tracking.js';
import { generateAmount, formatMoney } from './amount.js';
import { generateRandom, expandCharset } from './random.js';
import { generateUuid } from './uuid.js';
import { generateIdentity } from './identity.js';
import { generateCustom } from './custom.js';

// ---------------------------------------------------------------------------
// Dispatch table: generatorId → function.
// Identity generator needs a "field" argument, so it's wrapped.
// Date generator is used by both #DATE# and #DUE# with different defaults.
// ---------------------------------------------------------------------------
export const GENERATORS = {
  invoice: (ctx, tagDef) => generateInvoice(ctx, {}),
  serial: (ctx, tagDef) => generateSerial(ctx, {}),
  tfn: (ctx, tagDef) => generateTfn(ctx, {}),
  helpdesk: (ctx, tagDef) => generateHelpdesk(ctx, {}),
  date: (ctx, tagDef) => {
    // #DATE# → offset 7-30 days; #DUE# → offset 14-60 days
    if (tagDef && tagDef.token === '#DUE#') {
      return smartDate(ctx, { offsetDaysMin: 14, offsetDaysMax: 60, format: 'DD MMM YYYY' });
    }
    return smartDate(ctx, { offsetDaysMin: 7, offsetDaysMax: 30, format: 'DD MMM YYYY' });
  },
  orderid: (ctx, tagDef) => generateOrderId(ctx, {}),
  tracking: (ctx, tagDef) => generateTracking(ctx, {}),
  amount: (ctx, tagDef) => generateAmount(ctx, {}),
  random: (ctx, tagDef) => generateRandom(ctx, {}),
  uuid: (ctx, tagDef) => generateUuid(ctx, {}),
  identity: (ctx, tagDef) => {
    // Map tag id → identity field
    const fieldMap = {
      '#NAME#': 'name',
      '#EMAIL#': 'email',
      '#CITY#': 'city',
      '#ZIP#': 'zip',
      '#PHONE#': 'phone',
      '#COMPANY#': 'company',
    };
    const field = (tagDef && fieldMap[tagDef.token]) || 'name';
    return generateIdentity(field, ctx);
  },
  custom: (ctx, tagDef) => {
    // Custom tags are async — the dispatch caller must handle the promise.
    if (tagDef && tagDef.rule) {
      return generateCustom(tagDef.rule, { ...ctx, token: tagDef.token });
    }
    return generateRandom(ctx, {});
  },
};

// ---------------------------------------------------------------------------
// isAsyncGenerator(generatorId) — custom generators are async (DB writes).
// ---------------------------------------------------------------------------
export function isAsyncGenerator(generatorId) {
  return generatorId === 'custom';
}

export {
  generateInvoice,
  generateSerial,
  generateTfn,
  generateHelpdesk,
  smartDate,
  formatDate,
  parseDate,
  generateOrderId,
  generateTracking,
  generateAmount,
  formatMoney,
  generateRandom,
  expandCharset,
  generateUuid,
  generateIdentity,
  generateCustom,
};
