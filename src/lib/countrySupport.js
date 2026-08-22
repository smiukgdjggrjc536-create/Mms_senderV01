// ============================================================================
// Country Support Data — Email-to-MMS Gateway
// ============================================================================
// This module defines which countries & carriers the Email-to-MMS gateway
// supports. Used by the User Panel's Country Support tab + Dashboard showcase.
//
// Data is derived from src/lib/gateway/constants.js CARRIER_MMS_DOMAINS map.
// ============================================================================

export const COUNTRY_SUPPORT = [
  {
    region: 'North America',
    flag: '🇺🇸',
    countries: [
      {
        name: 'United States',
        code: '+1',
        flag: '🇺🇸',
        carriers: [
          { name: 'AT&T', domain: 'mms.att.net' },
          { name: 'Verizon', domain: 'vzwpix.com' },
          { name: 'T-Mobile', domain: 'tmomail.net' },
          { name: 'Sprint', domain: 'pm.sprint.com' },
          { name: 'US Cellular', domain: 'mms.uscc.net' },
          { name: 'Cricket Wireless', domain: 'mms.cricketwireless.net' },
          { name: 'MetroPCS / Metro by T-Mobile', domain: 'mymetropcs.com' },
          { name: 'Google Fi', domain: 'msg.fi.google.com' },
          { name: 'Mint Mobile', domain: 'tmomail.net' },
          { name: 'Xfinity Mobile', domain: 'vzwpix.com' },
          { name: 'Consumer Cellular', domain: 'mailmymobile.net' },
          { name: 'Ting', domain: 'message.ting.com' },
          { name: 'Republic Wireless', domain: 'text.republicwireless.com' },
          { name: 'Virgin Mobile', domain: 'vmpix.com' },
          { name: 'Tracfone', domain: 'mmst5.tracfone.com' },
          { name: 'Straight Talk', domain: 'mms.straighttalk.com' },
          { name: 'Page Plus', domain: 'vtext.com' },
          { name: 'Boost Mobile', domain: 'myboostmobile.com' },
        ],
      },
      {
        name: 'Canada',
        code: '+1',
        flag: '🇨🇦',
        carriers: [
          { name: 'Rogers', domain: 'pcs.rogers.com' },
          { name: 'Bell', domain: 'txt.bell.ca' },
          { name: 'Telus', domain: 'msg.telus.com' },
          { name: 'Fido', domain: 'fido.ca' },
          { name: 'Koodo', domain: 'msg.koodomobile.com' },
          { name: 'Virgin Canada', domain: 'vmobile.ca' },
          { name: 'Wind Mobile', domain: 'mms.windmobile.ca' },
        ],
      },
    ],
  },
  {
    region: 'South Asia',
    flag: '🌏',
    countries: [
      { name: 'Bangladesh', code: '+880', flag: '🇧🇩', carriers: [{ name: 'Grameenphone / Robi / Banglalink / Teletalk (via SMS gateway)', domain: 'sms.gateway.bd' }] },
      { name: 'India', code: '+91', flag: '🇮🇳', carriers: [{ name: 'Jio / Airtel / Vi / BSNL (via SMS gateway)', domain: 'sms.gateway.in' }] },
      { name: 'Pakistan', code: '+92', flag: '🇵🇰', carriers: [{ name: 'Jazz / Telenor / Zong / Ufone (via SMS gateway)', domain: 'sms.gateway.pk' }] },
      { name: 'Sri Lanka', code: '+94', flag: '🇱🇰', carriers: [{ name: 'Dialog / Mobitel (via SMS gateway)', domain: 'sms.gateway.lk' }] },
      { name: 'Nepal', code: '+977', flag: '🇳🇵', carriers: [{ name: 'NTC / Ncell (via SMS gateway)', domain: 'sms.gateway.np' }] },
      { name: 'Maldives', code: '+960', flag: '🇲🇻', carriers: [{ name: 'Dhiraagu / Ooredoo (via SMS gateway)', domain: 'sms.gateway.mv' }] },
      { name: 'Afghanistan', code: '+93', flag: '🇦🇫', carriers: [{ name: 'Afghan Wireless / Roshan (via SMS gateway)', domain: 'sms.gateway.af' }] },
    ],
  },
  {
    region: 'Southeast Asia',
    flag: '🌏',
    countries: [
      { name: 'Malaysia', code: '+60', flag: '🇲🇾', carriers: [{ name: 'Maxis / Celcom / Digi (via SMS gateway)', domain: 'sms.gateway.my' }] },
      { name: 'Singapore', code: '+65', flag: '🇸🇬', carriers: [{ name: 'SingTel / StarHub (via SMS gateway)', domain: 'sms.gateway.sg' }] },
      { name: 'Thailand', code: '+66', flag: '🇹🇭', carriers: [{ name: 'AIS / TrueMove / dtac (via SMS gateway)', domain: 'sms.gateway.th' }] },
      { name: 'Indonesia', code: '+62', flag: '🇮🇩', carriers: [{ name: 'Telkomsel / XL / Indosat (via SMS gateway)', domain: 'sms.gateway.id' }] },
      { name: 'Philippines', code: '+63', flag: '🇵🇭', carriers: [{ name: 'Globe / Smart (via SMS gateway)', domain: 'sms.gateway.ph' }] },
      { name: 'Vietnam', code: '+84', flag: '🇻🇳', carriers: [{ name: 'Viettel / MobiFone (via SMS gateway)', domain: 'sms.gateway.vn' }] },
    ],
  },
  {
    region: 'East Asia',
    flag: '🌏',
    countries: [
      { name: 'China', code: '+86', flag: '🇨🇳', carriers: [{ name: 'China Mobile / Unicom (via SMS gateway)', domain: 'sms.gateway.cn' }] },
      { name: 'Japan', code: '+81', flag: '🇯🇵', carriers: [{ name: 'NTT Docomo / SoftBank / au (via SMS gateway)', domain: 'sms.gateway.jp' }] },
      { name: 'South Korea', code: '+82', flag: '🇰🇷', carriers: [{ name: 'SK Telecom / KT / LG U+ (via SMS gateway)', domain: 'sms.gateway.kr' }] },
    ],
  },
  {
    region: 'Middle East',
    flag: '🕌',
    countries: [
      { name: 'UAE', code: '+971', flag: '🇦🇪', carriers: [{ name: 'Etisalat / du (via SMS gateway)', domain: 'sms.gateway.ae' }] },
      { name: 'Saudi Arabia', code: '+966', flag: '🇸🇦', carriers: [{ name: 'STC / Mobily / Zain (via SMS gateway)', domain: 'sms.gateway.sa' }] },
    ],
  },
  {
    region: 'Europe',
    flag: '🇪🇺',
    countries: [
      { name: 'UK', code: '+44', flag: '🇬🇧', carriers: [{ name: 'EE / O2 / Vodafone / Three (via SMS gateway)', domain: 'sms.gateway.uk' }] },
      { name: 'Germany', code: '+49', flag: '🇩🇪', carriers: [{ name: 'Deutsche Telekom / Vodafone DE (via SMS gateway)', domain: 'sms.gateway.de' }] },
      { name: 'France', code: '+33', flag: '🇫🇷', carriers: [{ name: 'Orange / SFR / Bouygues (via SMS gateway)', domain: 'sms.gateway.fr' }] },
      { name: 'Spain', code: '+34', flag: '🇪🇸', carriers: [{ name: 'Movistar / Orange ES / Vodafone ES (via SMS gateway)', domain: 'sms.gateway.es' }] },
      { name: 'Italy', code: '+39', flag: '🇮🇹', carriers: [{ name: 'TIM / Vodafone IT / Wind (via SMS gateway)', domain: 'sms.gateway.it' }] },
      { name: 'Netherlands', code: '+31', flag: '🇳🇱', carriers: [{ name: 'KPN / T-Mobile NL (via SMS gateway)', domain: 'sms.gateway.nl' }] },
      { name: 'Russia', code: '+7', flag: '🇷🇺', carriers: [{ name: 'MTS / Beeline / MegaFon (via SMS gateway)', domain: 'sms.gateway.ru' }] },
    ],
  },
  {
    region: 'Africa',
    flag: '🌍',
    countries: [
      { name: 'Egypt', code: '+20', flag: '🇪🇬', carriers: [{ name: 'Vodafone EG / Orange / Etisalat (via SMS gateway)', domain: 'sms.gateway.eg' }] },
      { name: 'Nigeria', code: '+234', flag: '🇳🇬', carriers: [{ name: 'MTN / Glo / Airtel / 9mobile (via SMS gateway)', domain: 'sms.gateway.ng' }] },
      { name: 'South Africa', code: '+27', flag: '🇿🇦', carriers: [{ name: 'Vodacom / MTN / Cell C (via SMS gateway)', domain: 'sms.gateway.za' }] },
    ],
  },
  {
    region: 'Americas (South)',
    flag: '🌎',
    countries: [
      { name: 'Brazil', code: '+55', flag: '🇧🇷', carriers: [{ name: 'Vivo / Claro / TIM (via SMS gateway)', domain: 'sms.gateway.br' }] },
      { name: 'Mexico', code: '+52', flag: '🇲🇽', carriers: [{ name: 'Telcel / AT&T MX / Movistar (via SMS gateway)', domain: 'sms.gateway.mx' }] },
      { name: 'Argentina', code: '+54', flag: '🇦🇷', carriers: [{ name: 'Movistar / Claro / Personal (via SMS gateway)', domain: 'sms.gateway.ar' }] },
    ],
  },
  {
    region: 'Oceania',
    flag: '🦘',
    countries: [
      { name: 'Australia', code: '+61', flag: '🇦🇺', carriers: [{ name: 'Telstra / Optus / Vodafone AU (via SMS gateway)', domain: 'sms.gateway.au' }] },
      { name: 'New Zealand', code: '+64', flag: '🇳🇿', carriers: [{ name: 'Spark / Vodafone NZ / 2degrees (via SMS gateway)', domain: 'sms.gateway.nz' }] },
    ],
  },
];

// Aggregate stats for the dashboard showcase
export function getCountryStats() {
  let totalCountries = 0;
  let totalCarriers = 0;
  const allCountries = [];
  for (const region of COUNTRY_SUPPORT) {
    for (const country of region.countries) {
      totalCountries++;
      totalCarriers += country.carriers.length;
      allCountries.push({ ...country, region: region.region });
    }
  }
  return { totalCountries, totalCarriers, allCountries, regions: COUNTRY_SUPPORT.length };
}
