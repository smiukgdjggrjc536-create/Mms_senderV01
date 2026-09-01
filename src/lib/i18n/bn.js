// ============================================================================
// V7 P6.4 — Bangla i18n String Dictionary (complete)
// ============================================================================
// Every user-facing string in the product, in Bangla (Bengali).
// The UI imports from this single source of truth — no inline Bangla strings
// scattered across components.
//
// Usage:
//   import { t } from '@/lib/i18n/bn';
//   t('campaign.send')  → "পাঠান"
//
// Exports:
//   STRINGS, t, tFormat
// ============================================================================

export const STRINGS = {
  // --- Common / Navigation ---
  'common.loading': 'লোড হচ্ছে...',
  'common.saving': 'সংরক্ষণ হচ্ছে...',
  'common.deleting': 'মুছে ফেলা হচ্ছে...',
  'common.cancel': 'বাতিল করুন',
  'common.confirm': 'নিশ্চিত করুন',
  'common.delete': 'মুছে ফেলুন',
  'common.save': 'সংরক্ষণ করুন',
  'common.edit': 'সম্পাদনা করুন',
  'common.close': 'বন্ধ করুন',
  'common.retry': 'আবার চেষ্টা করুন',
  'common.refresh': 'রিফ্রেশ করুন',
  'common.search': 'খুঁজুন...',
  'common.noResults': 'কোনো ফলাফল পাওয়া যায়নি',
  'common.yes': 'হ্যাঁ',
  'common.no': 'না',
  'common.back': 'পিছনে',
  'common.next': 'পরবর্তী',
  'common.previous': 'পূর্ববর্তী',
  'common.actions': 'ক্রিয়াকলাপ',
  'common.status': 'অবস্থা',
  'common.date': 'তারিখ',
  'common.time': 'সময়',
  'common.total': 'মোট',
  'common.success': 'সফল',
  'common.error': 'ত্রুটি',
  'common.warning': 'সতর্কতা',
  'common.copied': 'কপি করা হয়েছে',

  // --- Empty states ---
  'empty.campaigns': 'কোনো ক্যাম্পেইন নেই। নতুন ক্যাম্পেইন তৈরি করতে উপরের বাটনে ক্লিক করুন।',
  'empty.recipients': 'এখনো কোনো প্রাপক যোগ করা হয়নি। ইমেইল ঠিকানা পেস্ট করুন বা ফাইল আপলোড করুন।',
  'empty.credentials': 'কোনো প্রেরক ক্রেডেনশিয়াল যোগ করা হয়নি। সেটিংসে গিয়ে API কী যোগ করুন।',
  'empty.apiKeys': 'কোনো API কী কনফিগার করা হয়নি। প্রথম API কী যোগ করুন।',
  'empty.geminiKeys': 'কোনো Gemini API কী যোগ করা হয়নি। AI পুল রিস্টক করতে কমপক্ষে একটি কী প্রয়োজন।',
  'empty.users': 'কোনো ব্যবহারকারী নেই।',
  'empty.logs': 'কোনো লগ এন্ট্রি নেই।',
  'empty.sandbox': 'এই স্যান্ডবক্স খালি। প্রাপক যোগ করে শুরু করুন।',

  // --- Confirm dialogs ---
  'confirm.deleteCampaign': 'আপনি কি এই ক্যাম্পেইন মুছে ফেলতে চান? এটি অপরিবর্তনীয়।',
  'confirm.deleteCredential': 'আপনি কি এই ক্রেডেনশিয়াল মুছে ফেলতে চান?',
  'confirm.deleteUser': 'আপনি কি এই ব্যবহারকারী স্থায়ীভাবে মুছে ফেলতে চান?',
  'confirm.deleteApiKey': 'আপনি কি এই API কী মুছে ফেলতে চান?',
  'confirm.deleteGeminiKey': 'আপনি কি এই Gemini API কী মুছে ফেলতে চান?',
  'confirm.clearRecipients': 'আপনি কি সমস্ত প্রাপক মুছে ফেলতে চান?',
  'confirm.pauseCampaign': 'আপনি কি এই ক্যাম্পেইন বিরতিতে দিতে চান?',
  'confirm.startCampaign': 'আপনি কি ক্যাম্পেইন শুরু করতে চান?',
  'confirm.clearSandbox': 'আপনি কি এই স্যান্ডবক্স মুছে ফেলতে চান?',

  // --- Campaign ---
  'campaign.title': 'ক্যাম্পেইন',
  'campaign.new': 'নতুন ক্যাম্পেইন',
  'campaign.name': 'ক্যাম্পেইন নাম',
  'campaign.subject': 'বিষয়',
  'campaign.sender': 'প্রেরক',
  'campaign.send': 'পাঠান',
  'campaign.pause': 'বিরতি',
  'campaign.resume': 'পুনরায় শুরু',
  'campaign.status.idle': 'অপেক্ষমাণ',
  'campaign.status.running': 'চলমান',
  'campaign.status.paused': 'বিরতিতে',
  'campaign.status.done': 'সম্পন্ন',
  'campaign.status.error': 'ত্রুটি',
  'campaign.progress': 'প্রগতি',
  'campaign.sent': 'প্রেরিত',
  'campaign.failed': 'ব্যর্থ',
  'campaign.total': 'মোট',
  'campaign.recipients': 'প্রাপকগণ',
  'campaign.sandbox': 'স্যান্ডবক্স',

  // --- Validator ---
  'validator.valid': 'বৈধ',
  'validator.invalid': 'অবৈধ',
  'validator.duplicates': 'পুনরাবৃত্তি অপসারিত',
  'validator.bounceRisk': 'বাউন্স ঝুঁকি',
  'validator.blacklisted': 'ব্ল্যাকলিস্টেড',
  'validator.highRisk': 'উচ্চ ঝুঁকি',
  'validator.grade': 'গ্রেড',
  'validator.processing': 'যাচাই করা হচ্ছে...',

  // --- Errors (from sendGuard) ---
  'error.api_failure': 'প্রদানকারীর API ত্রুটি। স্বয়ংক্রিয়ভাবে পুনরায় চেষ্টা করা হচ্ছে। অনুগ্রহ করে অপেক্ষা করুন।',
  'error.quota_exceeded': 'আপনার দৈনিক ইমেইল পাঠানোর সীমা শেষ হয়ে গেছে। ক্যাম্পেইন স্বয়ংক্রিয়ভাবে বিরতিতে আছে। প্যাকেজ আপগ্রেড করুন বা আগামীকাল আবার চেষ্টা করুন।',
  'error.network_error': 'নেটওয়ার্ক সংযোগে সমস্যা। স্বয়ংক্রিয়ভাবে পুনরায় চেষ্টা করা হচ্ছে। স্থিতি সংরক্ষিত আছে।',
  'error.redis_down': 'Redis সার্ভার অনুপস্থিত। ক্যাম্পেইন স্বয়ংক্রিয়ভাবে বিরতিতে আছে। স্থিতি সংরক্ষিত আছে। Redis ফিরে এলে স্বয়ংক্রিয়ভাবে আবার শুরু হবে।',
  'error.mongo_down': 'ডাটাবেস সংযোগে সমস্যা। ক্যাম্পেইন স্বয়ংক্রিয়ভাবে বিরতিতে আছে। স্থিতি সংরক্ষিত আছে। ডাটাবেস ফিরে এলে আবার চালু হবে।',
  'error.provider_500': 'প্রদানকারী সার্ভারে সাময়িক সমস্যা (500)। ব্যাকঅফ সহ পুনরায় চেষ্টা করা হচ্ছে। কোনো তথ্য হারানো হয়নি।',
  'error.provider_429': 'প্রদানকারীর রেট লিমিট। অল্প সময়ের জন্য বিরতি নেওয়া হচ্ছে, তারপর আবার চেষ্টা করা হবে।',
  'error.auth_failure': 'প্রদানকারীর প্রমাণীকরণ ব্যর্থ। অনুগ্রহ করে আপনার ক্রেডেনশিয়াল যাচাই করুন। ক্যাম্পেইন বিরতিতে আছে।',
  'error.validation_error': 'ইমেইল ঠিকানা যাচাইকরণে ত্রুটি। অবৈধ ঠিকানাগুলি বাদ দেওয়া হয়েছে।',
  'error.unknown': 'অজানা ত্রুটি ঘটেছে। ক্যাম্পেইন বিরতিতে আছে। স্থিতি সংরক্ষিত আছে। আবার চেষ্টা করুন।',

  // --- Settings / API ---
  'settings.title': 'সেটিংস',
  'settings.apiKeys': 'API কী',
  'settings.geminiKeys': 'Gemini API কী',
  'settings.addKey': 'কী যোগ করুন',
  'settings.package': 'প্যাকেজ',
  'settings.toggles': 'ফিচার টগল',

  // --- Packages ---
  'package.free': 'ফ্রি',
  'package.basic': 'বেসিক',
  'package.pro': 'প্রো',
  'package.enterprise': 'এন্টারপ্রাইজ',
  'package.emailQuota': 'দৈনিক ইমেইল সীমা',
  'package.credentials': 'ক্রেডেনশিয়াল সীমা',
  'package.sandboxes': 'স্যান্ডবক্স সীমা',
  'package.aiQuota': 'AI কোটা',

  // --- AI Pool ---
  'aiPool.title': 'AI পুল',
  'aiPool.senders': 'প্রেরক নাম',
  'aiPool.subjects': 'বিষয়',
  'aiPool.level': 'পুল স্তর',
  'aiPool.restock': 'রিস্টক',
  'aiPool.restocking': 'রিস্টক করা হচ্ছে...',
  'aiPool.target': 'লক্ষ্য',
  'aiPool.current': 'বর্তমান',

  // --- Keyboard shortcuts ---
  'shortcut.search': 'খুঁজুন',
  'shortcut.newCampaign': 'নতুন ক্যাম্পেইন',
  'shortcut.save': 'সংরক্ষণ',
  'shortcut.refresh': 'রিফ্রেশ',
  'shortcut.close': 'বন্ধ',

  // --- Toast / Notifications ---
  'toast.saved': 'সংরক্ষিত হয়েছে',
  'toast.deleted': 'মুছে ফেলা হয়েছে',
  'toast.copied': 'ক্লিপবোর্ডে কপি করা হয়েছে',
  'toast.error': 'একটি ত্রুটি ঘটেছে',
  'toast.paused': 'ক্যাম্পেইন বিরতিতে আছে',
  'toast.resumed': 'ক্যাম্পেইন পুনরায় শুরু হয়েছে',
};

/**
 * Translate a key to Bangla.
 * @param {string} key - dot-notation key (e.g. 'campaign.send')
 * @returns {string} Bangla string, or the key itself if not found
 */
export function t(key) {
  return STRINGS[key] || key;
}

/**
 * Translate with format substitution.
 * @param {string} key - dot-notation key
 * @param {object} params - { name: 'value' } → replaces {name} in string
 * @returns {string}
 */
export function tFormat(key, params = {}) {
  let str = STRINGS[key] || key;
  for (const [k, v] of Object.entries(params)) {
    str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return str;
}

export default { STRINGS, t, tFormat };
