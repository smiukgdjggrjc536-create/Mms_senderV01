# 🔑 সম্পূর্ণ এক্সেস গাইড — Vercel + Netlify + MongoDB

ভাই, এই গাইডটি একদম হুবহু বর্তমান ওয়েবসাইট অনুযায়ী বানানো। প্রতিটা বাটন, প্রতিটা ক্লিক — সব বলে দিয়েছি। আপনি ফোনে Chrome দিয়ে একটা একটা করে করবেন।

---

## 📋 আপনাকে মোট ৩টা জিনিস কমপ্লিট করতে হবে:

1. ✅ **MongoDB Atlas** — ডেটাবেস তৈরি (ফ্রি, ৫ মিনিট)
2. ✅ **Vercel** — Token তৈরি (যেহেতু Vercel অলরেডি GitHub-এ যুক্ত, শুধু token লাগবে)
3. ✅ **Netlify** — অ্যাকাউন্ট খোলা + Token তৈরি

শেষে আমাকে ৪টা জিনিস দিবেন — আমি বাকি সব নিজে করব।

---

## 🗄️ PART 1: MongoDB Atlas (ফ্রি ডেটাবেস)

> ⚠️ **গুরুত্বপূর্ণ:** MongoDB এখনই লাগাতেই হবে। Admin Panel থেকে লাগানো যাবে না। কারণ ডেটাবেস ছাড়া admin panel এ লগইন করাই যাবে না — প্রথম user/admin তৈরি হয় ডেটাবেসে।

### Step 1: অ্যাকাউন্ট খুলুন
1. ফোনে Chrome খুলুন
2. এই ঠিকানায় যান: **https://www.mongodb.com/atlas**
3. উপরে ডানদিকে **"Try Free"** বাটন দেখতে পাবেন — ক্লিক করুন
4. একটা ফর্ম আসবে:
   - **First Name** — আপনার নাম
   - **Last Name** — আপনার নাম
   - **Email** — আপনার ইমেইল
   - **Password** — একটা শক্তিশালী পাসওয়ার্ড (মনে রাখবেন!)
   - **Company** — যেকোনো কিছু লিখুন বা ফাঁকা রাখুন
5. নিচে **"Create account"** বাটনে ক্লিক করুন
6. ইমেইলে একটা verification লিংক আসবে — ইমেইল খুলে সেটায় ক্লিক করুন

### Step 2: Organization ও Project সেট করুন
1. ইমেইল verify করার পর MongoDB Atlas পেজে যাবেন
2. একটা পপ-আপ আসতে পারে যেখানে বলবে:
   - **Organization Name** — `MyOrg` লিখুন (বা যেকোনো নাম)
   - **Project Name** — `SMSProject` লিখুন (বা যেকোনো নাম)
   - নিচে **"Create Organization"** বা **"Continue"** ক্লিক করুন
3. কিছু ক্ষেত্রে সরাসরি cluster পেজে নিয়ে যায় — সেক্ষেত্রে এই step skip হবে

### Step 3: ফ্রি Cluster তৈরি করুন (খুব গুরুত্বপূর্ণ)
1. আপনি একটা পেজ দেখতে পাবেন যেখানে cluster tier বেছে নিতে বলবে
2. **"M0 Free"** অপশন বেছে নিন (এটাই ফ্রি টিয়ার — ডানদিকে "$0" লেখা থাকবে)
   - ⚠️ M2 বা M5 বেছে নেবেন না — সেগুলো পেইড
3. **Cloud Provider:** AWS সিলেক্ট করুন (ডিফল্ট থাকে)
4. **Region:** যেটা ডিফল্ট সিলেক্ট থাকে সেটা রাখুন (যেমন `ap-south-1` Mumbai বা কাছের কোনো region)
   - ⚠️ "Recommended" লেখা region বেছে নিন
5. **Cluster Name:** `Cluster0` রাখুন (বা যেকোনো নাম)
6. নিচে **"Create"** বা **"Create Cluster"** বাটনে ক্লিক করুন
7. ⏳ ২-৫ মিনিট সময় লাগবে cluster তৈরি হতে — অপেক্ষা করুন

### Step 4: Database User তৈরি করুন (অবশ্যই করতে হবে)
1. Cluster তৈরি হওয়ার পর একটা "Security Quickstart" পেজ আসতে পারে
   - যদি না আসে: বাম দিকের মেনুতে **"Database Access"** (বা Security → Database Access) এ ক্লিক করুন
2. **"Add New Database User"** বাটনে ক্লিক করুন
3. নিচের তথ্য দিন:
   - **Authentication Method:** "Password" সিলেক্ট করুন
   - **Username:** `smsadmin` লিখুন (বা যেকোনো নাম)
   - **Password:** "Autogenerate Secure Password" ক্লিক করে একটা পাসওয়ার্ড জেনারেট করুন
     - ⚠️ **এই পাসওয়ার্ড অবশ্যই কোথাও সেভ করে রাখুন!** পরে লাগবে।
     - অথবা নিজে একটা পাসওয়ার্ড লিখুন (বিশেষ ক্যারেক্টার ছাড়া, যেমন: `MyPass123456`)
   - **Database User Privileges:** "Read and write to any database" সিলেক্ট করুন
4. নিচে **"Add User"** বাটনে ক্লিক করুন

### Step 5: Network Access দিন (অবশ্যই করতে হবে)
> এটা না করলে আমাদের অ্যাপ ডেটাবেসে কানেক্ট করতে পারবে না।

1. বাম দিকের মেনুতে **"Network Access"** (Security সেকশনের নিচে) এ ক্লিক করুন
   - যদি Quickstart পেজে থাকেন, সেখানেও "Network Access" ট্যাব দেখতে পাবেন
2. **"Add IP Address"** বাটনে ক্লিক করুন
3. একটা ডায়ালগ আসবে — সেখানে **"Allow Access From Anywhere"** বাটনে ক্লিক করুন
   - এতে `0.0.0.0/0` অটোমেটিক ফিল্ড হয়ে যাবে (এর মানে: যেকোনো জায়গা থেকে কানেক্ট করতে পারবে)
   - ⚠️ এটা ফ্রি টিয়ারের জন্য পারফেক্ট এবং নিরাপদ
4. **"Confirm"** বাটনে ক্লিক করুন
5. ⏳ "Active" হতে ১-২ মিনিট লাগবে

### Step 6: Connection String কপি করুন (সবচেয়ে গুরুত্বপূর্ণ)
1. বাম দিকের মেনুতে **"Database"** (বা Overview) এ ক্লিক করুন
2. আপনার Cluster (`Cluster0`) এর পাশে **"Connect"** বাটন দেখতে পাবেন — ক্লিক করুন
3. একটা মডাল আসবে কয়েকটা অপশন সহ:
   - **"Connect with MongoDB Compass"**
   - **"Connect your application"** ← এটাতে ক্লিক করুন
4. নিচে একটা connection string দেখতে পাবেন, যেমন:
   ```
   mongodb+srv://smsadmin:<db_password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```
5. ডানদিকে **"Copy"** আইকনে ক্লিক করে string কপি করুন
6. ⚠️ **`<db_password>` এর জায়গায় আপনার আসল পাসওয়ার্ড বসান** (Step 4-এ যে পাসওয়ার্ড দিয়েছিলেন)
   - যেমন: `mongodb+srv://smsadmin:MyPass123456@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`
   - ⚠️ পাসওয়ার্ডে যদি `@`, `#`, `:` ইত্যাদি থাকে, সেগুলো URL encode করতে হবে (যেমন `@` → `%40`)। তাই পাসওয়ার্ড সহজ রাখাই ভালো।
7. এই পুরো string টা কোথাও সেভ করে রাখুন — এটাই আমার **MongoDB URI**

✅ **MongoDB সম্পূর্ণ!** আপনার কাছে এখন একটা connection string আছে।

---

## ▲ PART 2: Vercel — Access Token তৈরি

> আপনি বলেছেন Vercel অলরেডি GitHub-এ যুক্ত। তাই শুধু একটা access token লাগবে যাতে আমি CLI দিয়ে deploy করতে পারি।

### Step 1: Vercel-এ লগইন করুন
1. Chrome খুলুন → **https://vercel.com/login** এ যান
2. **"Continue with GitHub"** তে ক্লিক করুন
3. GitHub username/password দিয়ে লগইন করুন
4. যদি "Authorize Vercel" আসে → **"Authorize"** ক্লিক করুন
5. Vercel Dashboard এ পৌঁছে গেছেন ✅

### Step 2: Account Settings এ যান
1. Dashboard এ উপরে ডানদিকে আপনার **profile picture/avatar** আইকন দেখতে পাবেন — ক্লিক করুন
2. ড্রপডাউন মেনু থেকে **"Account Settings"** (বা শুধু "Settings") সিলেক্ট করুন

### Step 3: Tokens পেজে যান
1. Account Settings পেজে বাম দিকে একটা মেনু দেখতে পাবেন
2. সেখানে **"Tokens"** অপশনে ক্লিক করুন
   - অথবা সরাসরি এই লিংকে যান: **https://vercel.com/account/tokens**
3. আপনি "Personal Access Tokens" পেজ দেখতে পাবেন

### Step 4: নতুন Token তৈরি করুন
1. উপরে **"Create Token"** (বা "Create" বাটন) এ ক্লিক করুন
2. একটা ফর্ম আসবে:
   - **Token Name:** `superninja-deploy` লিখুন (বা যেকোনো নাম)
   - **Scope:** dropdown থেকে **"Full Account"** সিলেক্ট করুন
     - ⚠️ অবশ্যই "Full Account" — না হলে deploy করতে পারব না
   - **Expiration:** dropdown থেকে **"90 days"** (বা "No expiration") সিলেক্ট করুন
3. নিচে **"Create"** (বা "Create Token") বাটনে ক্লিক করুন
4. ⚠️ **Token একবারই দেখানো হবে!** সাথে সাথে কপি করুন
   - Token দেখতে এমন: `vcp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - ডানদিকে **"Copy"** আইকনে ক্লিক করে কপি করুন
   - কোথাও সেভ করে রাখুন — পরে আর দেখা যাবে না

✅ **Vercel Token প্রস্তুত!** আপনার কাছে এখন `vcp_xxx...` দিয়ে শুরু হওয়া একটা token আছে।

---

## 🌐 PART 3: Netlify — অ্যাকাউন্ট খোলা + Token তৈরি

> আপনি বলেছেন Netlify এখনো খোলা হয়নি। এখানে শুরু থেকে সব বলছি।

### Step 1: Netlify অ্যাকাউন্ট খুলুন
1. Chrome খুলুন → **https://app.netlify.com** এ যান
   - অথবা **https://www.netlify.com** → **"Sign up"** বাটন
2. Sign up পেজে কয়েকটা অপশন দেখতে পাবেন:
   - "Continue with GitHub"
   - "Continue with GitLab"
   - "Continue with Bitbucket"
   - "Continue with Email"
3. **"Continue with GitHub"** তে ক্লিক করুন ← এটাই বেস্ট
4. GitHub login পেজ আসতে পারে — username/password দিন
5. "Authorize Netlify" পেজ আসবে:
   - **"Authorize Netlify"** বাটনে ক্লিক করুন
   - যদি GitHub install করতে বলে: "All repositories" বা `Mms_senderV01` সিলেক্ট করে **"Install"** ক্লিক করুন
6. Netlify Dashboard এ পৌঁছে গেছেন ✅
   - আপনি একটা "Welcome to Netlify" বা খালি dashboard দেখতে পাবেন

### Step 2: User Settings এ যান
1. Dashboard এ উপরে ডানদিকে আপনার **avatar/profile picture** আইকন দেখতে পাবেন — ক্লিক করুন
2. ড্রপডাউন থেকে **"User settings"** (বা "Settings") সিলেক্ট করুন

### Step 3: Applications পেজে যান
1. User settings পেজে বাম দিকে মেনু দেখতে পাবেন
2. সেখানে **"Applications"** অপশনে ক্লিক করুন
   - অথবা সরাসরি এই লিংকে যান: **https://app.netlify.com/user/applications**
3. পেজে দুটো সেকশন দেখতে পাবেন:
   - "OAuth applications" (উপরে)
   - **"Personal access tokens"** (নিচে) ← এটা দরকার

### Step 4: নতুন Token তৈরি করুন
1. "Personal access tokens" সেকশনে স্ক্রল করে নিচে নামুন
2. **"New access token"** বাটনে ক্লিক করুন
3. একটা ফর্ম আসবে:
   - **Description:** `superninja-deploy` লিখুন (বা যেকোনো নাম)
   - **Expiration:** একটা তারিখ সিলেক্ট করুন (৯০ দিন পরের বা তার বেশি)
     - যদি অপশন না থাকে, ডিফল্ট রাখুন
   - ⚠️ যদি "Allow access to my SAML-based Netlify team" অপশন থাকে — সেটা skip করুন (আপনার SAML team নেই)
4. **"Generate token"** বাটনে ক্লিক করুন
5. ⚠️ **Token একবারই দেখানো হবে!** সাথে সাথে কপি করুন
   - Token দেখতে এমন: `nfp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - **"Copy"** আইকনে ক্লিক করে কপি করুন
6. **"Done"** বাটনে ক্লিক করুন

✅ **Netlify Token প্রস্তুত!** আপনার কাছে এখন `nfp_xxx...` দিয়ে শুরু হওয়া একটা token আছে।

---

## 🚀 PART 4 (Bonus): Gemini API Key (AI Spam Filter)

> এটা ফ্রি এবং অ্যাডমিন প্যানেল থেকেও দেওয়া যায়, কিন্তু এখন নিলে আমি deploy-এর সময় environment variable হিসেবে সেট করে দিতে পারব।

1. Chrome খুলুন → **https://aistudio.google.com/apikey** এ যান
2. Google অ্যাকাউন্ট দিয়ে লগইন করুন
3. **"Create API Key"** বাটনে ক্লিক করুন
4. একটা API key জেনারেট হবে — কপি করুন
   - দেখতে এমন: `AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`
5. সেভ করে রাখুন

> ⚠️ এটা এখন না নিলেও চলবে — পরে অ্যাডমিন প্যানেল থেকেও দেওয়া যাবে। কিন্তু এখন নিলে deploy-এর সময়ই সব রেডি হয়ে যাবে।

---

## ✅ সব কমপ্লিট! এখন আমাকে কী দিবেন

নিচের জিনিসগুলো কপি করে আমাকে একটা message এ পাঠান:

```
📦 আমার ডিপ্লয় তথ্য:

1. MongoDB URI:
mongodb+srv://smsadmin:MyPass123456@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0

2. Vercel Token:
vcp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

3. Netlify Token:
nfp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

4. Gemini API Key (যদি নিয়ে থাকেন):
AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

এই তথ্য দিয়ে আমার Mms_senderV01 রিপোজিটরি deploy করো:
- Vercel এ User Panel
- Netlify এ Admin Panel
- দুই জায়গায় environment variables সেট করো
- deploy হওয়ার পর URL আমাকে দাও
```

> ⚠️ **প্রতিটা token ও URI হুবহু কপি করে দিন** — কোনো অক্ষর বাদ পড়লে deploy কাজ করবে না।

---

## 🤔 সমস্যা হলে

| সমস্যা | সমাধান |
|--------|---------|
| MongoDB cluster তৈরি হচ্ছে না | M0 Free সিলেক্ট করেছেন কিনা চেক করুন |
| `0.0.0.0/0` add করতে পারছি না | "Allow Access From Anywhere" বাটনে ক্লিক করুন |
| Vercel-এ "Create Token" পাচ্ছি না | https://vercel.com/account/tokens এ সরাসরি যান |
| Netlify-তে "New access token" পাচ্ছি না | https://app.netlify.com/user/applications#personal-access-tokens এ যান |
| Token কপি করতে ভুলে গেছি | নতুন token বানাতে হবে — পুরনো আর দেখা যায় না |
| GitHub authorize করতে বলছে | "Authorize" ক্লিক করুন, ভয় পাওয়ার নেই |

---

## 📋 চেকলিস্ট (এক এক করে টিক দিন)

- [ ] MongoDB Atlas অ্যাকাউন্ট খোলা হয়েছে
- [ ] ফ্রি Cluster (M0) তৈরি হয়েছে
- [ ] Database User (username + password) তৈরি হয়েছে
- [ ] Network Access এ `0.0.0.0/0` add করা হয়েছে
- [ ] Connection string কপি করা হয়েছে (পাসওয়ার্ড বসানো)
- [ ] Vercel-এ লগইন করা হয়েছে
- [ ] Vercel Token (`vcp_xxx...`) তৈরি ও কপি করা হয়েছে
- [ ] Netlify অ্যাকাউন্ট খোলা হয়েছে (GitHub দিয়ে)
- [ ] Netlify Token (`nfp_xxx...`) তৈরি ও কপি করা হয়েছে
- [ ] (Bonus) Gemini API Key নেওয়া হয়েছে
- [ ] সব তথ্য আমাকে পাঠানো হয়েছে

সব দিলে আমি সরাসরি deploy শুরু করে দিব! 🚀
