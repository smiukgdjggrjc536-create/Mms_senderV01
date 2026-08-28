# Twilio Alert System — Step-by-Step Setup Guide (Bengali)

এই গাইডটি আপনার MMS Sender Admin Panel-এ Twilio দিয়ে SMS/WhatsApp alert সিস্টেম সেটআপ করার সম্পূর্ণ নির্দেশনা দেয়।

---

## ধাপ ১: Twilio অ্যাকাউন্ট তৈরি করুন

১. **[https://www.twilio.com](https://www.twilio.com)** এ যান এবং "Sign up free" ক্লিক করুন।
২. আপনার email, নাম, এবং ফোন নম্বর দিয়ে রেজিস্টার করুন।
৩. Email verify করুন এবং আপনার ফোন নম্বর verify করুন (SMS OTP দিয়ে)।
৪. লগইন করে **Console Home** এ যান।

> 💡 Twilio তে নতুন অ্যাকাউন্ট খুললে **$15.50 free credit** পাবেন (trial balance)। এটা টেস্ট করার জন্য যথেষ্ট।

---

## ধাপ ২: Account SID ও Auth Token কপি করুন

১. Twilio Console-এ লগইন করুন: **[https://console.twilio.com](https://console.twilio.com)**
২. পেইজের উপরে (Dashboard এর নিচে) আপনি দেখবেন:
   - **Account SID** — `AC` দিয়ে শুরু হয়, ৩৪ অক্ষরের একটি স্ট্রিং
   - **Auth Token** — লুকানো থাকে, "Show" বা 👁️ আইকনে ক্লিক করে দেখুন
৩. দুটোই কপি করে রাখুন। এগুলো Admin Panel-এ বসাতে হবে।

---

## ধাপ ৩: একটি Twilio Phone Number কিনুন (SMS)

১. Console-এ বাঁ পাশের মেনু থেকে **Phone Numbers → Manage → Buy a number** এ যান।
২. আপনার পছন্দের কান্ট্রি (US, UK, ইত্যাদি) সিলেক্ট করুন।
৩. **Capabilities** এ **SMS** চেকবক্স টিক দিন।
৪. "Search" ক্লিক করুন এবং একটি নম্বর সিলেক্ট করে **Buy** ক্লিক করুন।
৫. Trial অ্যাকাউন্টে এটি ফ্রি credit থেকে কাটবে।
৬. কেনা নম্বরটি কপি করুন — এটি হবে আপনার **From Phone**।

> ⚠️ নম্বর ফরম্যাট হবে: `+12345678901` (country code সহ, কোনো space বা dash ছাড়া)

---

## ধাপ ৪: আপনার মোবাইল নম্বর Verify করুন (Trial অ্যাকাউন্টের জন্য)

Trial অ্যাকাউন্টে আপনি শুধু **verified numbers** এ SMS পাঠাতে পারবেন।

১. Console-এ **Phone Numbers → Manage → Verified Caller IDs** এ যান।
২. **+ Add a new Caller ID** ক্লিক করুন।
৩. আপনার মোবাইল নম্বর দিন (যেখানে alert পেতে চান)।
৪. ফোনে OTP আসবে — সেটি এন্টার করে verify করুন।
৫. এই নম্বরটিই হবে আপনার **To Phone**।

> 💡 যদি paid অ্যাকাউন্টে আপগ্রেড করেন, তাহলে যেকোনো নম্বরে SMS পাঠানো যাবে (verify করা লাগবে না)।

---

## ধাপ ৫: Admin Panel-এ Twilio Credentials বসান

১. আপনার Admin Panel এ লগইন করুন।
২. বাঁ পাশের মেনুতে **System → Alerts & Notifications** ট্যাবে যান।
৩. **Twilio SMS Alerts** সেকশনে নিচের ফিল্ডগুলো পূরণ করুন:

| ফিল্ড | কী দিবেন | উদাহরণ |
|------|---------|-------|
| **Twilio Account SID** | ধাপ ২ থেকে কপি করা SID | `AC1234567890abcdef...` |
| **Twilio Auth Token** | ধাপ ২ থেকে কপি করা token | `abc123def456...` |
| **From Phone** | ধাপ ৩ এ কেনা Twilio নম্বর | `+12345678901` |
| **To Phone** | আপনার মোবাইল নম্বর (verified) | `+8801XXXXXXXXX` |

৪. **Save Configuration** বাটন ক্লিক করুন।

---

## ধাপ ৬: Test Alert পাঠান

১. Save করার পর **Send Test Alert** বাটন ক্লিক করুন।
২. আপনার ফোনে একটি SMS আসবে:
   ```
   [MMS Alert] test: Test alert from MMS Sender Admin Panel — if you see this, alerts are working!
   ```
৩. যদি SMS না আসে, উপরে লাল রঙের error মেসেজ দেখুন এবং নিচের troubleshooting অংশ দেখুন।

---

## ধাপ ৭ (Optional): WhatsApp Alert সেটআপ

WhatsApp alert চাইলে:

১. Twilio Console-এ **Messaging → Try it Out → Send a WhatsApp Message** এ যান।
২. **WhatsApp Sandbox** এ join করুন — একটি join code দেখাবে (যেমন `join orange-tiger`)।
৩. আপনার ফোনে WhatsApp খুলে সেই Twilio নম্বরে মেসেজ পাঠান: `join orange-tiger`
৪. এখন Admin Panel এ **Twilio WhatsApp Alerts** সেকশনে:
   - **WhatsApp From**: Sandbox এর Twilio WhatsApp নম্বর (যেমন `+14155238886`)
   - **WhatsApp To**: আপনার verified WhatsApp নম্বর
৫. **Active Channels** এ **WhatsApp** চেক করুন।
৬. Save → Test Alert ক্লিক করুন।

---

## Credentials কোথায় রাখা হয়?

সব Twilio credentials সুরক্ষিতভাবে **MongoDB Atlas** এ `AppSettings` কালেকশনে সংরক্ষিত থাকে। এগুলো:

- `twilioAccountSid` — Account SID
- `twilioAuthToken` — Auth Token (encrypted storage নয়, কিন্তু database access-controlled)
- `twilioFromPhone` — Twilio নম্বর (SMS sender)
- `twilioToPhone` — আপনার মোবাইল নম্বর (alert recipient)
- `twilioWhatsAppFrom` — WhatsApp sender (optional)
- `twilioWhatsAppTo` — WhatsApp recipient (optional)
- `alertChannels` — কোন চ্যানেল active (`['sms']`, `['sms','whatsapp']`, ইত্যাদি)

> 🔐 credentials শুধু Super Admin দেখতে পারেন (`getAlertConfig` action শুধু admin-এর জন্য)।

---

## Alert Triggers (কখন alert পাঠানো হয়)

Admin Panel এ নিচের trigger গুলো on/off করা যায়:

- **Alert on system crash** — সিস্টেম ক্র্যাশ হলে alert
- **Alert when API is down** — API down হলে alert
- **Alert on errors** — যেকোনো error হলে alert

---

## Troubleshooting

### "SMS not configured" error
- নিশ্চিত করুন যে চারটি ফিল্ডই পূরণ করেছেন: Account SID, Auth Token, From Phone, To Phone
- Save করার পর আবার Test করুন

### "Trial account: unverified number" error
- Trial অ্যাকাউন্টে শুধু verified numbers এ SMS যায়
- **Verified Caller IDs** এ যান এবং আপনার To Phone নম্বর verify করুন

### Wrong number format
- নম্বর অবশ্যই country code সহ হতে হবে: `+8801XXXXXXXXX` (Bangladesh)
- কোনো space, dash, বা parentheses নয়

### SMS আসছে না কিন্তু error ও নেই
- Twilio Console → **Monitor → Logs → Messaging** এ যান
- সেখানে delivery status দেখুন (delivered, undelivered, failed)
- যদি "insufficient funds" হয়, ট্রায়াল credit শেষ হয়ে গেছে — আপগ্রেড করুন

### WhatsApp Sandbox এ যুক্ত হওয়া যাচ্ছে না
- Twilio WhatsApp Sandbox নম্বরে আপনার WhatsApp থেকে সঠিক join code পাঠান
- `join <word1>-<word2>` ফরম্যাটে হতে হবে (যেমন `join orange-tiger`)
- ৭২ ঘণ্টা পর আবার join করতে হতে পারে (sandbox এর timeout)

---

## API Reference (Developer Notes)

Twilio SMS API call (server-side, core.js):

```javascript
const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`;
const authHeader = 'Basic ' + Buffer.from(`${SID}:${AuthToken}`).toString('base64');
const res = await fetch(twilioUrl, {
  method: 'POST',
  headers: {
    'Authorization': authHeader,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    From: twilioFromPhone,
    To: twilioToPhone,
    Body: `[MMS Alert] ${type}: ${message}`.slice(0, 160),
  }),
});
```

WhatsApp-এর জন্য `From` এবং `To` এর আগে `whatsapp:` prefix যোগ করুন।
