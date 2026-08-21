# SMS Campaign System — Complete Deployment Guide

## 🎯 আপনার সিস্টেম এখন সম্পূর্ণ প্রস্তুত!

সব ৪টি Phase সম্পূর্ণ হয়েছে এবং GitHub-এ push করা হয়েছে:

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ✅ Complete | Project setup, core.js, config auto-generation |
| Phase 2 | ✅ Complete | Backend API (login, saveConfig, sendCampaign + Gemini AI) |
| Phase 3 | ✅ Complete | Admin Panel UI + 5 admin API actions |
| Phase 4 | ✅ Complete | User Panel UI + getUserCampaigns + login logic |

**GitHub Repository:** `smiukgdjggrjc536-create/Mms_senderV01`

এখন আপনাকে শুধু ২টি কাজ করতে হবে:
1. Vercel-এ User Panel deploy করা
2. Netlify-তে Admin Panel deploy করা

---

## 📋 আপনার কাছে যা যা লাগবে

deploy করার আগে নিচের জিনিসগুলো প্রস্তুত রাখুন:

### ১. MongoDB Atlas (FREE) — Database
- এটি ইতিমধ্যে Phase 1-এ তৈরি করা আছে (আপনার কাছে MongoDB URI আছে)
- যদি না থাকে: https://www.mongodb.com/atlas → Sign up → Create Free Cluster → Database Access-এ user তৈরি → Network Access-এ `0.0.0.0/0` add → Connect → "Drivers" → connection string copy করুন
- Format: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/sms_db`

### ২. Gemini API Key (FREE) — AI Spam Filter
- https://aistudio.google.com/apikey → Sign in with Google → "Create API Key" → Copy
- এটি ওভার ফ্রি, কোনো কার্ড লাগে না

### ৩. SMS Gateway API Key — SMS পাঠানোর জন্য
- আপনার SMS provider-এর API key (যেমন Twilio, Africa's Talking, বা অন্য কোনো provider)

---

## 🚀 PART A: Vercel Deploy (User Panel)

> User Panel = যেখানে সাধারণ user লগইন করে SMS campaign পাঠায়

### Step 1: Vercel Account তৈরি করুন
1. ফোনে Chrome browser খুলুন
2. https://vercel.com এ যান
3. **"Sign Up"** → **"Continue with GitHub"** তে click করুন
4. আপনার GitHub username/password দিয়ে login করুন
5. "Authorize Vercel" → **Install** তে click করুন
6. Vercel dashboard এ পৌঁছে গেছেন ✅

### Step 2: Project Import করুন
1. Vercel Dashboard-এ **"Add New..."** → **"Project"** তে click
2. "Import Git Repository" সেকশনে আপনার `Mms_senderV01` repo দেখতে পাবেন
3. যদি না দেখেন: **"Adjust GitHub App Permissions"** → `Mms_senderV01` select → Save
4. `Mms_senderV01` এর পাশে **"Import"** তে click করুন

### Step 3: ⚠️ Configuration (খুব গুরুত্বপূর্ণ — বিল্ড ফেইল করবে না)

**Framework Preset:** Next.js (অটোমেটিক সিলেক্ট হবে — ঠিক আছে)

**Root Directory:** `./` (ডিফল্ট — ঠিক আছে)

**Build Command:** এটি অটো-ডিটেক্ট হবে। যদি খালি থাকে, লিখুন:
```
npm run build
```

**Install Command:** ডিফল্ট (`npm install`) — ঠিক আছে

### Step 4: ⚠️ Environment Variables (এটা বাদ দিলে কাজ করবে না)

"Environment Variables" সেকশনে নিচের ৩টি যোগ করুন:

| Key | Value |
|-----|-------|
| `JWT_SECRET` | `1a5f30e5be1f2e62817f60225e661dae8d77c2a40eb7115e6391de3f79b83f1ffa06de15e7be97505baca53faababcc3` |
| `MONGODB_URI` | `mongodb+srv://your_mongodb_connection_string` |
| `NEXT_PUBLIC_SITE_URL` | `https://your-project-name.vercel.app` (deploy হওয়ার পর URL আপডেট করবেন) |

> **নোট:** JWT_SECRET হুবহু উপরের মতো দিন (এটি Phase 1-এ তৈরি করা secret)। MONGODB_URI-তে আপনার আসল MongoDB connection string দিন।

### Step 5: Deploy করুন
1. **"Deploy"** button এ click করুন
2. 2-5 মিনিট অপেক্ষা করুন (build হচ্ছে)
3. ✅ "Congratulations!" দেখলে deploy সফল!
4. আপনার User Panel URL পাবেন: `https://mms-sender-v01.vercel.app` (এমন কিছু)

### Step 6: প্রথমবার Login (Admin Account তৈরি)
1. আপনার Vercel URL-এ যান
2. Login form দেখতে পাবেন
3. প্রথম login = admin account তৈরি হয়
4. Email ও password দিন → **Sign In**
5. এখন আপনি Admin Panel দেখতে পাবেন
6. **Configuration সেট করুন:**
   - MongoDB URI input এ আপনার MongoDB string দিন → Save
   - Gemini API Key input এ API key দিন → Save
   - SMS API Key input এ SMS gateway key দিন → Save
7. ✅ System ready!

> **গুরুত্বপূর্ণ:** Vercel-এ deploy করার পর `NEXT_PUBLIC_SITE_URL` environment variable আপডেট করে আসল Vercel URL দিন এবং আবার Redeploy করুন।

---

## 🚀 PART B: Netlify Deploy (Admin Panel)

> Admin Panel = যেখানে admin লগইন করে users ও configs ম্যানেজ করে

### Step 1: Netlify Account তৈরি করুন
1. Chrome browser খুলুন
2. https://app.netlify.com এ যান
3. **"Sign up"** → **"GitHub"** তে click করুন
4. GitHub login করুন → "Authorize Netlify" → Install
5. Netlify dashboard এ পৌঁছে গেছেন ✅

### Step 2: New Site তৈরি করুন
1. Dashboard-এ **"Add new site"** → **"Import an existing project"**
2. **"GitHub"** select করুন
3. `Mms_senderV01` repo খুঁজে বের করুন → Select করুন
4. যদি না দেখেন: "Configure the Netlify app on GitHub" → `Mms_senderV01` select → Save

### Step 3: ⚠️ Build Settings

**Base directory:** (খালি রাখুন — ডিফল্ট)

**Build command:** (netlify.toml থেকে অটো আসবে `npm run build`)

**Publish directory:** (netlify.toml থেকে অটো আসবে `.next`)

> netlify.toml ফাইল ইতিমধ্যে repo-তে আছে, তাই এগুলো অটো-ডিটেক্ট হবে।

### Step 4: ⚠️ Environment Variables (এটা বাদ দিলে কাজ করবে না)

"Environment variables" সেকশনে নিচের ৩টি যোগ করুন:

| Key | Value |
|-----|-------|
| `JWT_SECRET` | `1a5f30e5be1f2e62817f60225e661dae8d77c2a40eb7115e6391de3f79b83f1ffa06de15e7be97505baca53faababcc3` |
| `MONGODB_URI` | `mongodb+srv://your_mongodb_connection_string` |
| `NEXT_PUBLIC_SITE_URL` | `https://your-netlify-site-name.netlify.app` |

> **JWT_SECRET এবং MONGODB_URI Vercel ও Netlify দুই জায়গায় একই দিন** — এটা জরুরি, তাহলে দুই panel একই database শেয়ার করবে।

### Step 5: Deploy করুন
1. **"Deploy site"** button এ click করুন
2. 2-5 মিনিট অপেক্ষা করুন
3. ✅ Deploy complete!
4. আপনার Admin Panel URL: `https://mms-sender-v01.netlify.app` (এমন কিছু)

### Step 6: Netlify এ Next.js Plugin (যদি দরকার হয়)
Netlify তে Next.js deploy করার সময় অনেক সময় `@netlify/plugin-nextjs` plugin লাগে:
1. Netlify dashboard → আপনার site → **Plugins** tab
2. যদি "Next.js Runtime" plugin অটো ইনস্টল না হয়:
   - **Plugins** → **Browse plugins** → "Next.js" search → Install
3. অধিকাংশ ক্ষেত্রে এটি অটোমেটিক ইনস্টল হয়

---

## 🔑 কীভাবে AI (SuperNinja) কে Vercel ও Netlify Access দিবেন

আপনি চাইলে AI-কে সম্পূর্ণ deploy করার access দিতে পারেন। এর জন্য:

### Option 1: Vercel Access দেওয়া (AI সরাসরি deploy করবে)

1. **Vercel CLI Token তৈরি করুন:**
   - https://vercel.com/account/tokens এ যান
   - **"Create Token"** এ click করুন
   - Name: `superninja-deploy`
   - Scope: `Full Account`
   - Expiration: `90 days` (বা আপনার পছন্দ)
   - Token copy করুন (এটি `vercel_xxx...` দিয়ে শুরু হবে)

2. **AI-কে দিন:**
   ```
   আমার Vercel Token: vercel_xxxxxxxxxxxxxxxxx
   এই token দিয়ে আমার Mms_senderV01 repo deploy করো User Panel হিসেবে
   ```

3. **AI তখন নিজেই:**
   - Vercel CLI install করবে
   - Token দিয়ে login করবে
   - Project create করবে
   - Environment variables set করবে
   - Deploy করবে
   - আপনাকে final URL দিবে

### Option 2: Netlify Access দেওয়া

1. **Netlify Personal Access Token তৈরি করুন:**
   - https://app.netlify.com/user/applications এ যান
   - **"New access token"** এ click করুন
   - Description: `superninja-deploy`
   - **"Generate token"** → Token copy করুন

2. **AI-কে দিন:**
   ```
   আমার Netlify Token: nfp_xxxxxxxxxxxxxxxxx
   এই token দিয়ে আমার Mms_senderV01 repo deploy করো Admin Panel হিসেবে
   ```

3. **AI তখন নিজেই:**
   - Netlify CLI install করবে
   - Token দিয়ে login করবে
   - Site create করবে
   - Environment variables set করবে
   - Deploy করবে
   - আপনাকে final URL দিবে

### Option 3: সব একসাথে (সবচেয়ে সহজ)

AI-কে এক message এ দুটো token দিন:

```
Vercel Token: vercel_xxxxxxxxxxxxxxxxx
Netlify Token: nfp_xxxxxxxxxxxxxxxxx
MongoDB URI: mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/sms_db
Gemini API Key: AIzaSyxxxxxxxxxxxxxxxx
SMS API Key: your_sms_api_key

এই সব দিয়ে আমার সম্পূর্ণ সিস্টেম deploy করো:
- Vercel এ User Panel
- Netlify এ Admin Panel
- দুই জায়গায় একই environment variables
- deploy হওয়ার পর URL আমাকে দাও
```

---

## ✅ Deploy হওয়ার পর যা করবেন

1. **Vercel URL** খুলুন → Login করুন (প্রথম user = admin)
2. Admin Panel এ config save করুন (MongoDB, Gemini, SMS key)
3. **Netlify URL** খুলুন → একই email/password দিয়ে login করুন
4. দুই panel একই database শেয়ার করছে ✅
5. Admin panel থেকে user manage করুন
6. User panel থেকে SMS campaign পাঠান

---

## 🆘 সমস্যা হলে

| সমস্যা | সমাধান |
|--------|---------|
| Build fail করে | Environment variables ঠিক দিয়েছেন কিনা চেক করুন |
| Login করতে পারে না | MongoDB URI ঠিক আছে কিনা চেক করুন |
| "AI Spam Filter not configured" | Admin panel এ Gemini API Key save করুন |
| Cookie error | NEXT_PUBLIC_SITE_URL আসল URL দিন |
| 404 আসে | netlify.toml / vercel.json ঠিক আছে কিনা চেক করুন |

---

## 📁 আপনার সিস্টেমের সব Files (GitHub এ)

```
Mms_senderV01/
├── src/
│   ├── app/
│   │   ├── api/system/route.js    ← 9 API actions
│   │   ├── page.js                ← Login + role dispatch
│   │   ├── layout.js
│   │   └── globals.css
│   ├── components/
│   │   ├── AdminPanel.jsx         ← Admin UI (372 lines)
│   │   └── UserPanel.jsx          ← User UI (campaign form, history)
│   └── lib/
│       └── core.js                ← DB, JWT, password hash, schemas
├── package.json                   ← Build: node init-configs.js && next build --webpack
├── vercel.json                    ← User Panel deploy config
├── netlify.toml                   ← Admin Panel deploy config
├── .env.example                   ← Environment variable template
├── init-configs.js                ← Auto-generates config files during build
├── jsconfig.json                  ← @/ path alias
├── next.config.mjs
└── postcss.config.mjs
```

সব কিছু প্রস্তুত! 🎉
