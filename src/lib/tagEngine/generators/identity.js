// ============================================================================
// V7 P2.2 — Generator Library: Identity generator
// ============================================================================
// Handles the "identity" category tokens: #NAME#, #EMAIL#, #CITY#, #ZIP#,
// #PHONE#, #COMPANY#. These resolve from the recipient context (provided
// by the mapping engine) with crypto-random fallbacks when the recipient
// record lacks a field.
// ============================================================================

import crypto from 'crypto';

const CITIES = [
  'Melbourne', 'Sydney', 'Brisbane', 'Perth', 'Adelaide', 'Gold Coast',
  'Newcastle', 'Canberra', 'Hobart', 'Darwin', 'Geelong', 'Cairns',
  'Ballarat', 'Bendigo', 'Toowoomba', 'Sunshine Coast', 'Wollongong',
];
const COMPANIES = [
  'Acme Holdings Pty Ltd', 'BlueSky Ventures', 'Coastal Logistics Group',
  'Delta Financial Services', 'Eagle Ridge Partners', 'Fjord Industries',
  'Greenfield Capital', 'Harborview Trading Co', 'Ironclad Solutions Ltd',
  'Junction Point Enterprises', 'Keystone Advisory Group', 'Lakeside Ventures',
];
const FIRST_NAMES = [
  'James', 'Sarah', 'Michael', 'Emma', 'David', 'Lisa', 'Daniel', 'Jessica',
  'Paul', 'Rachel', 'Andrew', 'Nicole', 'Thomas', 'Olivia', 'Christopher',
  'Sophie', 'Matthew', 'Charlotte', 'Anthony', 'Grace', 'William', 'Mia',
];
const LAST_NAMES = [
  'Smith', 'Jones', 'Williams', 'Brown', 'Wilson', 'Taylor', 'Johnson',
  'White', 'Martin', 'Anderson', 'Thompson', 'Nguyen', 'Thomas', 'Walker',
  'Harris', 'Lee', 'King', 'Wright', 'Lopez', 'Hill', 'Scott', 'Green',
];

function pickRandom(arr) {
  return arr[crypto.randomInt(0, arr.length)];
}

function generatePhone() {
  // +61 4XX XXX XXX (Australian mobile format)
  const p1 = crypto.randomInt(0, 10);
  const p2 = crypto.randomInt(0, 10);
  const p3 = crypto.randomInt(0, 100).toString().padStart(2, '0');
  const p4 = crypto.randomInt(0, 100).toString().padStart(2, '0');
  const p5 = crypto.randomInt(0, 100).toString().padStart(2, '0');
  return `+61 4${p1}${p2} ${p3} ${p4} ${p5}`;
}

function generateZip() {
  // 4-digit Australian postcode
  let zip = '';
  for (let i = 0; i < 4; i++) {
    zip += crypto.randomInt(0, 10).toString();
  }
  return zip;
}

/**
 * Resolve an identity token from context.
 * @param {string} field — 'name' | 'email' | 'city' | 'zip' | 'phone' | 'company'
 * @param {object} ctx - { recipientEmail, recipientName, recipientCity,
 *                        recipientZip, recipientPhone, recipientCompany,
 *                        campaignId, salt, index }
 * @returns {string}
 */
export function generateIdentity(field, ctx = {}) {
  switch (field) {
    case 'name':
      if (ctx.recipientName && typeof ctx.recipientName === 'string' && ctx.recipientName.trim()) {
        return ctx.recipientName.trim();
      }
      return `${pickRandom(FIRST_NAMES)} ${pickRandom(LAST_NAMES)}`;
    case 'email':
      if (ctx.recipientEmail && typeof ctx.recipientEmail === 'string') {
        return ctx.recipientEmail;
      }
      // Fallback: random email
      return `recipient${crypto.randomInt(1000, 9999)}@example.com`;
    case 'city':
      if (ctx.recipientCity && typeof ctx.recipientCity === 'string' && ctx.recipientCity.trim()) {
        return ctx.recipientCity.trim();
      }
      return pickRandom(CITIES);
    case 'zip':
      if (ctx.recipientZip && typeof ctx.recipientZip === 'string' && ctx.recipientZip.trim()) {
        return ctx.recipientZip.trim();
      }
      return generateZip();
    case 'phone':
      if (ctx.recipientPhone && typeof ctx.recipientPhone === 'string' && ctx.recipientPhone.trim()) {
        return ctx.recipientPhone.trim();
      }
      return generatePhone();
    case 'company':
      if (ctx.recipientCompany && typeof ctx.recipientCompany === 'string' && ctx.recipientCompany.trim()) {
        return ctx.recipientCompany.trim();
      }
      return pickRandom(COMPANIES);
    default:
      return '';
  }
}

export default generateIdentity;
