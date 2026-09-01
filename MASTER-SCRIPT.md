# ============================================================================
# MASTER-SCRIPT.md — Enterprise Email Sending Module
# ============================================================================
# এই ফাইলটি পুরো সিস্টেমের একক সত্য (single source of truth)।
# এটি যেকোনো AI কে দিলে সে সম্পূর্ণ প্রজেক্ট বুঝে, ৫ গুণ ভালো করে কাজ চালাতে পারবে।
#
# এই ফাইলে আছে:
#   ১. সম্পূর্ণ আর্কিটেকচার ও ফাইল ম্যাপ (প্রতিটি ফাইলের পাথ + ভূমিকা)
#   ২. সমস্ত ক্রেডেনশিয়াল (MongoDB, GitHub, Netlify, Vercel, Render, Admin)
#   ৩. ডিপ্লয়মেন্ট কমান্ড (৩ প্ল্যাটফর্ম)
#   ৪. MMS → Email রূপান্তরের সম্পূর্ণ বিবরণ (কী বদলেছে, কী থাকছে, কী বাদ গেছে)
#   ৫. পরবর্তী AI কে নির্দেশনা (কীভাবে চালাতে হবে, কী যোগ করতে হবে)
#   ৬. লাইভ URL ও ভেরিফিকেশন প্রসিডিউর
#
# ============================================================================

# অংশ ১: সিস্টেম পরিচিতি
# ============================================================================
## প্রজেক্টের নাম: Mms_senderV01 — Enterprise Email Sending Module

এই সিস্টেমটি একটি **Next.js 16.3.1 App Router** অ্যাপ্লিকেশন (React 19), যা একই কোডবেস থেকে ৩টি প্ল্যাটফর্মে ডিপ্লয় করা হয়েছে। কোন প্যানেল দেখানো হবে তা `NEXT_PUBLIC_PANEL_MODE` এনভায়রনমেন্ট ভেরিয়েবল নিয়ন্ত্রণ করে:

- **Vercel** (`NEXT_PUBLIC_PANEL_MODE=user`) → ইউজার প্যানেল (এন্ড-ইউজাররা এখান থেকে ইমেইল পাঠায়)
- **Netlify** (`NEXT_PUBLIC_PANEL_MODE=admin`) → অ্যাডমিন প্যানেল (অ্যাডমিন কনফিগারেশন, অ্যাকাউন্ট, প্রক্সি ম্যানেজ করে)
- **Render** (`NEXT_PUBLIC_PANEL_MODE=api`) → হেডলেস API (শুধু `/api/*` এন্ডপয়েন্ট, কোনো UI নেই)

## ডেটাবেস: MongoDB Atlas
- ক্লাস্টার: `mmsdb.xlplomx`
- ডেটাবেস নেম: `test`
- URI: `MONGODB_URI (.credentials.enc থেকে লোড)`

## মূল সক্ষমতা (Email Sending Module — বর্তমান অবস্থা)
- যেকোনো ইমেইল ঠিকানায় ইমেইল পাঠানো (Gmail, Yahoo, AOL, Comcast, Outlook, যেকোনো ডোমেইন)
- কোনো ক্যারিয়ার/MMS রেস্ট্রিকশন নেই — সরাসরি ইমেইল ঠিকানায় পাঠায়
- ইমেইল ভ্যালিডেশন (RFC 5322 ফরম্যাট, ডোমেইন চেক)
- মাল্টিপল সেন্ডার প্রোভাইডার: Gmail OAuth2, Gmail App Password, Outlook Graph API, Yahoo SMTP, AOL SMTP, Custom SMTP
- AI পলিমরফিজম (Gemini) — প্রতিটি মেসেজ ইউনিক করে রিরাইট করে স্প্যাম ফিল্টার এড়াতে
- সেফটি ফিল্টার — ব্লকড কিওয়ার্ড চেক
- সার্কিট ব্রেকার — বাউন্স হলে অ্যাকাউন্ট কুলডাউন
- টোকেন বাকেট + রাউন্ড-রবিন কিউ ইঞ্জিন
- অরিজিন IP মাস্কিং ও প্রক্সি রাউটিং
- বাউন্স হ্যান্ডলিং (IMAP IDLE লিসেনার সহ)
- ৩-লেয়ার অ্যাডমিন অথেন্টিকেশন (ইউজারনেম + পাসওয়ার্ড + apiKey), bcrypt হ্যাশিং, JWT (jose লাইব্রেরি), HttpOnly কুকিজ
- কনফিগ কী মাস্কিং — সেনসিটিভ কী GET রেসপন্সে মাস্ক করা হয়

# অংশ ২: সম্পূর্ণ ফাইল ম্যাপ (প্রতিটি ফাইলের পাথ + ভূমিকা)
# ============================================================================

## রুট লেভেল ফাইল
| ফাইল পাথ | ভূমিকা |
|----------|--------|
| `package.json` | ডিপেন্ডেন্সি: next 16.3.1, react 19, mongoose 9.9.3, bcryptjs, jose, nodemailer, bullmq, imapflow, ioredis, opossum |
| `jsconfig.json` | পাথ এলিয়াস: `@/*`→`./src/*`, `@/services/*`→`./services/*`, `@/models/*`→`./models/*` |
| `next.config.js` | Webpack কনফিগ, externalDir সক্রিয় (root /models, /services ইম্পোর্ট), @valkey/valkey-glide external |
| `netlify.toml` | নেটলিফাই বিল্ড কনফিগ, `NEXT_PUBLIC_PANEL_MODE=admin` |
| `render.yaml` | রেন্ডার হেডলেস কনফিগ, `NEXT_PUBLIC_PANEL_MODE=api` |
| `vercel.json` | ভার্সেল কনফিগ (ইউজার প্যানেল) |
| `.env.example` | এনভায়রনমেন্ট ভেরিয়েবল টেমপ্লেট |
| `init-configs.js` | বিল্ডের সময় কনফিগ ফাইল জেনারেট করে |
| `config-database.js` | ডেটাবেস কনফিগ প্লেসহোল্ডার (আসল কী MongoDB-তে) |
| `config-gemini.js` | Gemini API কনফিগ প্লেসহোল্ডার |
| `config-sending.js` | সেন্ডিং কনফিগ প্লেসহোল্ডার |

## ডকুমেন্টেশন ফাইল (গাইড)
| ফাইল | বিষয় |
|------|------|
| `ACCESS-GUIDE.md` | সম্পূর্ণ অ্যাক্সেস গাইড (টোকেন তৈরি, ক্রেডেনশিয়াল) |
| `AI-DEPLOY-ACCESS-GUIDE.md` | AI কে ডিপ্লয় করার গাইড (বাংলায় step-by-step) |
| `DEPLOY-GUIDE.md` | ডিপ্লয়মেন্ট গাইড |
| `ENTERPRISE-GUIDE.md` | এন্টারপ্রাইজ ফিচার গাইড |
| `DELIVERY-GUIDE.md` | ডেলিভারি রিপোর্ট গাইড |
| `SMS-USAGE-GUIDE.md` | SMS/ইমেইল ব্যবহার গাইড |
| `MASTER-SCRIPT.md` | **এই ফাইল** — মাস্টার রেফারেন্স |

## মডেল ফাইল (MongoDB Schemas) — `/models/`
| ফাইল পাথ | ভূমিকা |
|----------|--------|
| `models/emailAccount.js` | EmailAccount schema — সেন্ডার অ্যাকাউন্ট (Gmail/Outlook/SMTP), provider, status, sentToday, dailyLimit, cooldownUntil, OAuth credentials |
| `models/systemConfig.js` | SystemConfig schema — গ্লোবাল কনফিগ (routingDelaySeconds, batchSizePerAccount, geminiApiKey) |
| `models/carrierCache.js` | CarrierCache schema — লিগেসি ফোন-ক্যারিয়ার ক্যাশ (Email মডিউলে আর প্রাইমারি নয়, কম্প্যাট জন্য রাখা) |
| `models/proxyConfig.js` | ProxyConfig schema — প্রক্সি কনফিগ (cloudflare_worker, rotating_proxy, static_proxy) |

## সার্ভিস ফাইল (Email Sending Pipeline) — `/services/`
| ফাইল পাথ | ভূমিকা | Email মডিউলে অবস্থা |
|----------|--------|-------------------|
| `services/prepareEmail.js` | **নতুন** — prepareEmailPayload(): সেফটি ফিল্টার → AI রিরাইট → { to, text, domain, rewritten }। ক্যারিয়ার লুকআপ নেই — রিসিভার IS ইমেইল ঠিকানা | ✅ প্রাইমারি |
| `services/bulkSendEmailMms.js` | bulkSendEngineEmailMMS() — বাল্ক সেন্ড ইঞ্জিন। ইমেইল ঠিকানা ইটারেট করে, prepareEmailPayload → sendEmail। channel:'email' রিটার্ন করে | ✅ ট্রান্সফর্মড |
| `services/queueRouter.js` | sendMMS()/sendEmail() — কোর সেন্ড প্রিমিটিভ। SystemConfig পড়ে, লিস্ট-রিসেন্টলি-ইউজড ACTIVE EmailAccount বাছে, routingDelaySeconds প্রয়োগ করে, sendByProvider → bounceHandler | ✅ জেনেরিক (sendEmail এলিয়াস যোগ) |
| `services/prepareMms.js` | লিগেসি prepareMMSPayload() — সেফটি → AI রিরাইট → ক্যারিয়ার লুকআপ। Email মডিউলে আর প্রাইমারি নয় | ⚠️ লিগেসি (কম্প্যাট জন্য রাখা) |
| `services/carrierLookup.js` | getCarrierGateway() — ফোন নাম্বার → ক্যারিয়ার ইমেইল। Email মডিউলে বাদ | ⚠️ লিগেসি |
| `services/aiRewriter.js` | rewriteMessage() — Gemini দিয়ে মেসেজ ইউনিক করে রিরাইট। ফেইল-ওপেন | ✅ রাখা |
| `services/safetyFilter.js` | safetyFilter() — ব্লকড কিওয়ার্ড চেক। BLOCKED_BY_SAFETY_FILTER থ্রো করে | ✅ রাখা |
| `services/bounceHandler.js` | withBounceHandling() — সেন্ড রেজাল্ট হ্যান্ডল, sentToday/consecutiveBounces আপডেট | ✅ রাখা |
| `services/senders/index.js` | sendByProvider() — প্রোভাইডার → সেন্ডার ফাংশন ম্যাপ: GMAIL_OAUTH, GMAIL_APP_PASSWORD, OUTLOOK_GRAPH, YAHOO, AOL, CUSTOM_SMTP | ✅ জেনেরিক, কোনো পরিবর্তন নেই |
| `services/senders/gmailSender.js` | sendViaGmail() — Gmail OAuth2 REST API (googleapis SDK ছাড়া, সরাসরি fetch)। RFC-2822 MIME মেসেজ বিল্ড | ✅ জেনেরিক |
| `services/senders/smtpSender.js` | sendViaSmtp() — nodemailer দিয়ে SMTP সেন্ড | ✅ জেনেরিক |
| `services/senders/outlookSender.js` | sendViaOutlook() — Outlook Graph API সেন্ড | ✅ জেনেরিক |
| `services/senders/proxyFetch.js` | proxyFetch() — প্রক্সি-অ্যাওয়ার fetch র‍্যাপার (IP মাস্কিং) | ✅ রাখা |

## সোর্স লাইব্রেরি — `/src/lib/`
| ফাইল পাথ | ভূমিকা |
|----------|--------|
| `src/lib/core.js` | **কোর লজিক (~2200 লাইন)** — সব মডেল ডিফিনিশন, bulkSendEngine(), validatePhoneNumber(), **validateEmailAddress()** [নতুন], getCountryCode(), isCommonEmailDomain() [নতুন], spam scoring, Gemini integration, সব গেটওয়ে কনস্ট্যান্ট রি-এক্সপোর্ট। `channel === 'email'` হলে সরাসরি email ইঞ্জিনে রাউট করে |
| `src/lib/gateway/constants.js` | গেটওয়ে কনস্ট্যান্ট — CARRIER_MMS_DOMAINS (লিগেসি), CIRCUIT_BREAKER_CONFIG, TOKEN_BUCKET_CONFIG, ROUND_ROBIN_CONFIG, AI_POLYMORPH_PROMPT ("email message rewriter"), SEND_RESULT, প্রক্সি কনস্ট্যান্ট |
| `src/lib/redis.js` | Redis ক্লায়েন্ট (ioredis) — L1 ক্যাশ, মিউটেক্স, ডায়নামিক কনফিগ, মেট্রিক্স |
| `src/lib/sendingEngine.js` | সেন্ডিং ইঞ্জিন হেল্পার |
| `src/lib/countrySupport.js` | কান্ট্রি কোড সাপোর্ট (লিগেসি) |
| `src/lib/keepAlive.js` | কিপ-অ্যালাইভ পিং (Render কোল্ড-স্টার্ট এড়াতে) |

## সোর্স সার্ভিস — `/src/services/`
| ফাইল পাথ | ভূমিকা | Email মডিউলে অবস্থা |
|----------|--------|-------------------|
| `src/services/aiPolymorph.js` | AI পলিমরফিজম (Gemini) — মেসেজ স্ট্রাকচারাল ইউনিকনেস | ✅ রাখা |
| `src/services/circuitBreaker.js` | সার্কিট ব্রেকার — কনসেকিউটিভ ফেইলিউর → কুলডাউন | ✅ রাখা |
| `src/services/hlrValidator.js` | HLR ভ্যালিডেটর — ফোন নাম্বার ভ্যালিডেশন (মাল্টি-টিয়ার ক্যাশিং) | ⚠️ লিগেসি (ফোন, Email-এ বাদ) |
| `src/services/prepareMms.js` | src-লেভেল prepareMms (hlrValidator ব্যবহার করে) | ⚠️ লিগেসি |
| `src/services/proxyRouter.js` | প্রক্সি রাউটিং — আউটবাউন্ড রিকোয়েস্ট প্রক্সির মাধ্যমে | ✅ রাখা |
| `src/services/queueEngine.js` | কিউ ইঞ্জিন (BullMQ) — রাউন্ড-রবিন ডিসপ্যাচ | ✅ রাখা |

## API রাউট — `/src/app/api/`
| ফাইল পাথ | ভূমিকা |
|----------|--------|
| `src/app/api/system/route.js` | **মেইন API রাউট (~1900 লাইন)** — সব অ্যাকশন: sendCampaign, testSystemGemini, testGeminiApi, bulkImport, ইত্যাদি। sendCampaign এখন validateEmailAddress() ব্যবহার করে, channel:'email' ফোর্স করে |
| `src/app/api/ping/route.js` | হেলথ চেক পিং |
| `src/app/api/auth/gmail/route.js` | Gmail OAuth2 অথ শুরু |
| `src/app/api/auth/gmail/callback/route.js` | Gmail OAuth2 কলব্যাক |
| `src/app/api/admin/gateway/route.js` | গেটওয়ে কনফিগ (GET/POST) — maskConfig() সেনসিটিভ কী মাস্ক করে |
| `src/app/api/admin/gateway/preview/route.js` | **ইমেইল প্রিভিউ** (dry run) — prepareEmailPayload ব্যবহার করে, email/phoneNumber দুটোই গ্রহণ করে |
| `src/app/api/admin/gateway/accounts/[id]/reset-cooldown/route.js` | অ্যাকাউন্ট কুলডাউন রিসেট |
| `src/app/api/admin/gateway/cache/clear/route.js` | ক্যাশ ক্লিয়ার |
| `src/app/api/admin/gateway/dispatch/route.js` | ম্যানুয়াল ডিসপ্যাচ |
| `src/app/api/admin/gateway/dynamic/route.js` | ডায়নামিক কনফিগ (রিয়েল-টাইম টগল) |
| `src/app/api/admin/gateway/health/route.js` | গেটওয়ে হেলথ চেক |
| `src/app/api/admin/gateway/logs/route.js` | লগ স্ট্রিম |
| `src/app/api/admin/gateway/stream/route.js` | SSE লাইভ স্ট্রিম |
| `src/app/api/admin/gateway/proxies/route.js` | প্রক্সি CRUD |
| `src/app/api/admin/gateway/proxies/[id]/route.js` | প্রক্সি edit/delete/test |
| `src/app/api/admin/system/deploy-hook/route.js` | ডিপ্লয় হুক |
| `src/app/api/admin/system/diagnostics/route.js` | সিস্টেম ডায়াগনস্টিক্স |
| `src/app/api/admin/system/webhook/route.js` | ওয়েবহুক কনফিগ |

## UI কম্পোনেন্ট — `/src/components/`
| ফাইল পাথ | ভূমিকা | Email মডিউলে অবস্থা |
|----------|--------|-------------------|
| `src/components/AdminPanel.jsx` | **অ্যাডমিন প্যানেল (~3700 লাইন)** — GatewayConfig, অ্যাকাউন্ট ম্যানেজমেন্ট, প্রক্সি, ড্যাশবোর্ড। UI থিম/বাটন স্টাইল অপরিবর্তিত | 🔲 লেবেল "MMS"→"Email" পরিবর্তন বাকি |
| `src/components/UserPanel.jsx` | ইউজার প্যানেল — এন্ড-ইউজার ইমেইল সেন্ড UI | 🔲 পরে (ইউজার বলেছে "ইউজার প্যানেল পরে") |

## অ্যাপ পেজ — `/src/app/`
| ফাইল পাথ | ভূমিকা |
|----------|--------|
| `src/app/layout.js` | রুট লেআউট |
| `src/app/page.js` | মেইন পেজ — NEXT_PUBLIC_PANEL_MODE অনুযায়ী AdminPanel/UserPanel/হেডলেস রেন্ডার করে |

# অংশ ৩: সমস্ত ক্রেডেনশিয়াল
# ============================================================================
## MongoDB Atlas
- URI: `MONGODB_URI (.credentials.enc থেকে লোড)`
- ক্লাস্টার: `mmsdb.xlplomx`, ডেটাবেস: `test`

## Admin লগইন
- ইউজারনেম: `ADMIN_USERNAME (.credentials.enc থেকে লোড)`
- পাসওয়ার্ড: `ADMIN_PASSWORD (.credentials.enc থেকে লোড)`
- apiKey: `ADMIN_API_KEY (.credentials.enc থেকে লোড)`

## JWT
- JWT_SECRET: `gCxa43PBfEY06D6Pu1qQFcJoCvL-fM29CRxlIx69qr8mZiomGpvlKIXuUch0Naio`

## GitHub
- অ্যাকাউন্ট: `smiukgdjggrjc536-create`
- রিপো: `Mms_senderV01`
- অ্যাক্সেস টোকেন: `GITHUB_TOKEN (.credentials.enc থেকে লোড)`
- ব্র্যাঞ্চ: `main`

## Netlify (অ্যাডমিন প্যানেল)
- অথ টোকেন: `nfp_•••••••••••••••••••••••••••••••••••••••`
- সাইট ID: `d96d1fdf-4a29-47d1-bc38-9bf324ecba5f`
- লাইভ URL: `https://mmsadminpanellogin.netlify.app`

## Vercel (ইউজার প্যানেল)
- টোকেন: `vcp_•••••••••••••••••••••••••••••••••••••••••••••••••••`
- লাইভ URL: `https://mms-sender-v01.vercel.app`

## Render (হেডলেস API)
- টোকেন: `rnd_txXIwfP2aY9TVGCVad15HB5640Fc`
- লাইভ URL: `https://mms-gateway-engine.onrender.com`

## Gemini API (AI রিরাইট)
- ওয়ার্কিং কী (SystemConfig + GeminiApi কালেকশনে সেভড): `GEMINI_KEY_PRIMARY (.credentials.enc থেকে লোড)`
- মডেল: `gemini-flash-lite-latest`
- ব্যবহৃত: 19/100000 (ফ্রি টিয়ার)
- ⚠️ ইউজারের নতুন কী `GEMINI_KEY_NEW (.credentials.enc থেকে লোড — 403 দেয়, ব্যবহার করবে না)` 403 PERMISSION_DENIED দেয় — ব্যবহার করবেন না

## DB-তে বর্তমান অবস্থা
- ১টি EmailAccount: `PRIMARY_EMAIL_ACCOUNT (.credentials.enc থেকে লোড)` (GMAIL_OAUTH, ACTIVE)
- GeminiApi: ওয়ার্কিং AQ. কী, gemini-flash-lite-latest, 19/100000 ব্যবহৃত

# অংশ ৪: ডিপ্লয়মেন্ট কমান্ড
# ============================================================================
## প্রিপ্রোডাকশন চেক
```bash
cd /workspace/repos/Mms_senderV01
npm run build          # জিরো এরর হতে হবে
git add -A && git commit -m "feat: MMS→Email transformation"
git push origin main   # Render অটো-ডিপ্লয় (git push থেকে)
```

## নেটলিফাই ডিপ্লয় (অ্যাডমিন প্যানেল)
```bash
cd /workspace/repos/Mms_senderV01
NETLIFY_AUTH_TOKEN="nfp_•••••••••••••••••••••••••••••••••••••••" \
npx netlify deploy --site "d96d1fdf-4a29-47d1-bc38-9bf324ecba5f" --dir .next --prod
```

## ভার্সেল ডিপ্লয় (ইউজার প্যানেল — পরে)
ভার্সেল সাধারণত GitHub ইন্টিগ্রেশন থেকে অটো-ডিপ্লয় করে। ম্যানুয়াল:
```bash
cd /workspace/repos/Mms_senderV01
npx vercel --prod --token "vcp_•••••••••••••••••••••••••••••••••••••••••••••••••••"
```

## রেন্ডার (হেডলেস API)
রেন্ডার `render.yaml` থেকে git push এ অটো-ডিপ্লয় করে। ম্যানুয়াল ট্রিগার Render ড্যাশবোর্ড থেকে।

## লাইভ ভেরিফিকেশন
```bash
# Render হেলথ
curl -s https://mms-gateway-engine.onrender.com/api/ping

# Gemini টেস্ট (অথেন্টিকেটেড)
# POST https://mmsadminpanellogin.netlify.app/api/system
# body: { action: "testSystemGemini" }
```

# অংশ ৫: MMS → Email রূপান্তরের সম্পূর্ণ বিবরণ
# ============================================================================
## কী বদলেছে (Changes Made)

### ১. `src/lib/core.js` — validateEmailAddress() যোগ
- `validateEmailAddress(email)` ফাংশন যোগ — RFC 5322 রেজেক্স, ডোমেইন লোয়ারকেস, লেংথ চেক, ডট প্লেসমেন্ট চেক, TLD চেক
- `isCommonEmailDomain(email)` হেল্পার — কমন ডোমেইন সেট (Gmail, Yahoo, AOL, Comcast, ইত্যাদি)
- `validatePhoneNumber()` রাখা হয়েছে (কম্প্যাট জন্য)
- এক্সপোর্ট ব্লকে `validateEmailAddress`, `isCommonEmailDomain` যোগ
- `bulkSendEngine()` এ `channel === 'email'` চেক যোগ — সরাসরি email ইঞ্জিনে রাউট করে (SMS পাথ বাইপাস)

### ২. `services/prepareEmail.js` — নতুন ফাইল
- `prepareEmailPayload(emailAddress, text, context)` — ২ স্টেপ: সেফটি ফিল্টার → AI রিরাইট
- ক্যারিয়ার লুকআপ স্টেপ নেই — রিসিভার IS ইমেইল ঠিকানা
- রিটার্ন: { to, text, originalText, email, domain, rewritten, safe }

### ৩. `services/bulkSendEmailMms.js` — ট্রান্সফর্মড
- এখন `prepareEmailPayload` ব্যবহার করে (prepareMMSPayload নয়)
- `sendEmail` (sendMMS এলিয়াস) ব্যবহার করে
- channel: 'email' রিটার্ন করে (আগে 'email_mms' ছিল)
- ডেলিভারি রিপোর্টে `recipientEmail`, `recipientDomain` (carrierEmail/carrierDomain/lineType এর বদলে)

### ৪. `services/queueRouter.js` — sendEmail এলিয়াস
- `sendMMS` ফাংশন জেনেরিক (আগে থেকেই যেকোনো ইমেইল ঠিকানায় সেন্ড করত)
- `export { sendMMS as sendEmail }` যোগ
- হেডার কমেন্ট "Email Sending Module" এ আপডেট

### ৫. `src/app/api/system/route.js` — sendCampaign ট্রান্সফর্মড
- ইম্পোর্টে `validateEmailAddress`, `isCommonEmailDomain` যোগ
- sendCampaign অ্যাকশনে `validatePhoneNumber` → `validateEmailAddress` পরিবর্তন
- `getCountryCode` এর বদলে `countryInfo[email] = { domain, common }`
- ক্যাম্পেইন তৈরিতে `channel: 'email'`, `country: domain`, `countryCode: 'EMAIL'`
- sendOpts এ `channel: 'email'` + `subject` যোগ (ফোর্স email পাথ)

### ৬. `src/app/api/admin/gateway/preview/route.js` — ইমেইল প্রিভিউ
- `prepareMMSPayload` → `prepareEmailPayload`
- `phoneNumber` প্যারাম `email` এ পরিবর্তন (phoneNumber এলিয়াস হিসেবে গ্রহণ)
- `validateEmailAddress` দিয়ে প্রি-চেক, INVALID_EMAIL → 422

### ৭. `src/lib/gateway/constants.js` — কনস্ট্যান্ট আপডেট
- `AI_POLYMORPH_PROMPT` "MMS message rewriter" → "email message rewriter", "phone numbers" → "email addresses"
- `SEND_RESULT` এ `BLOCKED_INVALID_EMAIL`, `BOUNCED` যোগ (লিগেসি কোড রাখা)
- হেডার কমেন্ট "Email Sending Module" এ
- `CARRIER_MMS_DOMAINS` রাখা (লিগেসি কম্প্যাট, প্রাইমারি পাথে ব্যবহৃত নয়)

## কী থাকছে (Kept As-Is)
- সার্কিট ব্রেকার, টোকেন বাকেট, রাউন্ড-রবিন কিউ ইঞ্জিন
- প্রক্সি/IP মাস্কিং ও রাউটিং
- AI পলিমরফিজম (Gemini)
- সেফটি ফিল্টার
- বাউন্স হ্যান্ডলিং
- সব সেন্ডার সার্ভিস (Gmail OAuth, Outlook, SMTP — সব জেনেরিক, যেকোনো ইমেইলে কাজ করে)
- SystemConfig, EmailAccount, ProxyConfig মডেল
- ৩-লেয়ার অ্যাডমিন অথ, JWT, কুকিজ
- কনফিগ কী মাস্কিং

## কী বাদ গেছে / লিগেসি (Removed/Legacy)
- `services/carrierLookup.js` — লিগেসি (প্রাইমারি পাথে ব্যবহৃত নয়)
- `src/services/hlrValidator.js` — লিগেসি (ফোন ভ্যালিডেশন)
- `src/services/prepareMms.js` — লিগেসি (src-লেভেল)
- `services/prepareMms.js` — লিগেসি (root-লেভেল, কম্প্যাট জন্য রাখা)
- `CARRIER_MMS_DOMAINS` — লিগেসি কনস্ট্যান্ট (রাখা, ব্যবহৃত নয়)

## কী বাকি (Pending)
- 🔲 AdminPanel.jsx — লেবেল "MMS"→"Email" পরিবর্তন (UI থিম/বাটন স্টাইল অপরিবর্তিত রাখতে হবে)
- 🔲 UserPanel.jsx — পরে (ইউজার বলেছে "ইউজার প্যানেল পরে")
- 🔲 বিল্ড + নেটলিফাই ডিপ্লয় + ভেরিফাই
- 🔲 SYSTEM-STATE.md আপডেট

# অংশ ৬: পরবর্তী AI কে নির্দেশনা (HOW TO RUN THIS PROJECT)
# ============================================================================
## প্রাথমিক সেটআপ
১. রিপো ক্লোন/আপডেট করুন: `/workspace/repos/Mms_senderV01`
২. ডিপেন্ডেন্সি ইনস্টল: `cd /workspace/repos/Mms_senderV01 && npm install`
৩. এই ফাইল (`MASTER-SCRIPT.md`) পুরো পড়ুন — এটাই সত্যের উৎস।
৪. `todo.md` দেখুন — কোন টাস্ক বাকি আছে।

## কোড পরিবর্তন করার নিয়ম
- **UI থিম/বাটন স্টাইল কখনো বদলাবেন না** — শুধু টেক্সট লেবেল "MMS"→"Email" করুন।
- **কনফিগারেশন ঠিক রাখুন** — সার্কিট ব্রেকার, প্রক্সি, AI, কিউ ইঞ্জিন সব রাখুন।
- **কম্প্যাট রাখুন** — `validatePhoneNumber` বদলাবেন না (লিগেসি কোড কম্প্যাট)। নতুন `validateEmailAddress` ব্যবহার করুন।
- **নন-ডেস্ট্রাক্টিভ** — লিগেসি ফাইল ডিলিট করবেন না, শুধু প্রাইমারি পাথ থেকে বাদ দিন।
- **shape-compatible return** — bulkSendEngineEmailMMS এর রিটার্ন অবজেক্ট bulkSendEngine এর সাথে ম্যাচ করতে হবে।

## টেস্ট করার প্রসিডিউর
১. `npm run build` — জিরো এরর/ওয়ার্নিং হতে হবে।
২. লোকাল রান: `npm run dev` → `localhost:3000`
৩. অ্যাডমিন লগইন টেস্ট: ইউজারনেম `ADMIN_USERNAME (.credentials.enc থেকে লোড)`, পাসওয়ার্ড `ADMIN_PASSWORD (.credentials.enc থেকে লোড)`, apiKey `ADMIN_API_KEY (.credentials.enc থেকে লোড)`
৪. Gemini টেস্ট: `{ action: "testSystemGemini" }` — "Gemini API test successful." হতে হবে।
৫. ইমেইল ভ্যালিডেশন টেস্ট: ভালো ইমেইল (test@gmail.com) → valid:true; খারাপ (abc) → valid:false।
৬. নেটলিফাই ডিপ্লয় → `https://mmsadminpanellogin.netlify.app` এ ভেরিফাই।
৭. রেন্ডার ভেরিফাই → `https://mms-gateway-engine.onrender.com/api/ping`

## ইউজারের প্রত্যাশা
- এন্টারপ্রাইজ লেভেল, প্রফেশনাল কোড।
- সময়/ক্রেডিট নষ্ট না করে সরাসরি কাজ।
- প্রশ্ন কম, কাজ বেশি ("কিছু জিজ্ঞেস করা লাগবে না, তুমি জানো কিভাবে করবে")।
- ইউজার বাংলায় কথা বলেন — উত্তরে বাংলা ব্যবহার করুন।
- ইউজার চমকে যেতে চান ("আমি যাতে দেখে চমকে জাই")।

## পরবর্তী ফিচার (ইউজার পরে বলবেন)
ইউজার বলেছেন: "আমি কি কি যোগ করবো তোমাকে এটা পরে বলব"। তাই এখন শুধু MMS→Email রূপান্তর সম্পূর্ণ করুন। অতিরিক্ত ফিচার যোগ করবেন না।

# অংশ ৭: গিট হিস্ট্রি (সাম্প্রতিক কমিট)
# ============================================================================
```
319759f fix(testSystemGemini): import SystemConfig model — fixes 'not defined' runtime error
b49d385 fix(gemini-test): test SAVED key from DB when form key is masked — fixes 401 error
038a145 fix(preview): return 422 for fast-fail/invalid number rejections instead of 500
e10af57 fix(validation): fast-fail check now tests raw digits too
5bc9cf7 fix: number validation over-blocking + Gemini API test button in Gateway Settings
```
পরবর্তী কমিট হবে: `feat: MMS→Email module transformation` (এই ফাইলসহ)

# ============================================================================
# এই ফাইলের শেষ। পরবর্তী AI: এই ফাইল পড়ে todo.md ধরে কাজ চালিয়ে যান।
# ============================================================================
