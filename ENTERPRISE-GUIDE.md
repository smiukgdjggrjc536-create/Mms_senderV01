# Enterprise MMS Sending Platform — Complete Guide

## Live URLs

| Panel | URL | Platform |
|-------|-----|----------|
| **Admin Panel** | https://mms-sender-v01.netlify.app | Netlify |
| **User Panel** | https://mms-sender-v01.vercel.app | Vercel |

Both panels share the same MongoDB database and same GitHub repository. The panel mode is controlled by the `NEXT_PUBLIC_PANEL_MODE` environment variable (admin = Netlify, user = Vercel).

---

## Admin Panel Login (3-Layer Security)

```
Username:  admin_7f8bbcf9
Password:  kFMPNauew5d@%RhH
API Key:   sk_5b7286cc8a7c51bba69276359bc25854f77a0300
```

Open https://mms-sender-v01.netlify.app and enter all three fields, then click "Secure Login".

### Admin Panel Features (12 Tabs)

1. **Dashboard** — Real-time stats: total users, online/offline users, sending stats (today/week/month/year), inbox/spam rates, best inbox API, panel health %, API usage details, database usage. Auto-refreshes every 30 seconds.

2. **API Management** — Enterprise-grade sender API management with 4 provider integrations:
   - **Provider Selector** — Choose from Twilio, Vonage/Nexmo, MessageBird, or Custom HTTP. Each provider auto-fills the endpoint and shows field-specific help (e.g. "apiKey = Account SID, apiSecret = Auth Token" for Twilio).
   - **PROVIDER_TEMPLATES** — Auto-fills endpoint URLs and labels for each provider type.
   - **Health Rings** — Each sender API card displays an SVG circular health gauge (0-100) that color-codes green/yellow/red based on the API's health score.
   - **4-Metric Grid** — Each card shows Sent, Inbox %, Spam %, and Remaining quota in a clean grid layout.
   - **Test Send Button** — Click "Test" on any sender API to open a modal, enter a test number and message, and send a real test SMS/MMS through that provider. Results show provider message ID or error codes.
   - **Auto-Routing** — Toggle auto-route per API. The system uses AI to rank sender APIs by inbox quality and automatically routes to the best one.
   - Add up to 10 sender APIs + 10 Gemini APIs. View usage %, remaining quota, inbox rate, spam rate, health score, status (active/blocked/warning/exhausted), last error messages.

3. **User Management** — List all users with email, status, limit, sent count, expiry days remaining, IP address, last active time, last send time. Inline edit limits and expiry. Block/unblock/delete users. Set expiry to 1 hour, 2 hours, 1 day, 1 month, or 1 year.

4. **Campaigns** — View all campaigns with full delivery stats (sent, delivered, undelivered, invalid, inbox, spam), sender API used, Gemini API used, template used, country info.

5. **Content & Templates** — Create message templates by type (payment, marketing, promo, order, crypto, custom). Upload logos and photos as content assets. These appear in the user panel for sending.

6. **Sub-Admins** — Create sub-admin accounts with granular permissions. Choose which tabs/features each sub-admin can access.

7. **Database** — Add multiple MongoDB connections. The system can auto-switch when a database is full. View storage usage per connection.

8. **Blacklist** — Add/remove blacklisted phone numbers. Blacklisted numbers are automatically rejected during sending.

9. **Alerts** — Configure WhatsApp and email alerts. Get notified on server crash, API down, errors/bugs. Test alert button to verify configuration.

10. **Activity Logs** — View all admin and user activity (logins, sends, API changes, settings updates, etc.) with timestamps and IP addresses.

11. **Admin Security** — Change admin username, password, API key, and email. Credential changes require mail verification (6-digit code sent to admin email). Set up admin email for verification flow.

12. **Settings** — Platform name, logo URL, description, WhatsApp contact, email contact, phone, language (Bengali/English), MMS configuration, spam protection toggle, country rules, rate limits (per minute/per hour), default user limit, default user expiry days. These settings appear on the user panel login page and throughout the user panel.

### Primary Refresh Button
Located at the bottom of the sidebar. Click to refresh both panels, fix bugs, and reload — no data loss, no lockout.

---

## User Panel

Open https://mms-sender-v01.vercel.app

### Registration & Login
- Click "Register" tab to create a new account (email + password)
- New users get the default limit (100 sends) and default expiry (30 days) set by admin
- Click "Sign In" to log in with email + password

### User Panel Features (4 Tabs + AI Chat)

1. **Dashboard** — Live stats: quota remaining, inbox rate, spam rate, invalid hits, sending quota progress bar, account expiry with LIVE countdown timer (updates every second), delivery summary (delivered/undelivered/inbox/spam). Auto-refreshes every 30 seconds.

2. **Send MMS** — Enterprise 4-step wizard sending system with a step indicator showing progress (Compose, Recipients, Review, Send):

   **Step 1 — Compose:**
   - **Message Templates** — Select from admin-created templates by type (payment, marketing, promo, order, crypto, custom)
   - **AI/Gemini Suggestion** — Click "AI Suggestion" to get an AI-generated, spam-optimized message
   - **Live Spam Check** — As you type, the message is analyzed in real time (800ms debounce). You see a live spam score and the specific spam reasons detected (spam keywords, ALL CAPS ratio, URLs, URL shorteners, excessive exclamations, urgency words, money references, message length) so you can fix issues before sending.

   **Step 2 — Recipients:**
   - **Direct Paste** — Paste numbers directly (comma, space, or newline separated)
   - **CSV Import** — Upload a CSV/TXT file to import numbers in bulk
   - **Number Count** — Live count of parsed, valid recipients
   - **Quota Info** — Shows your remaining send quota so you know if you have enough before proceeding

   **Step 3 — Review & Launch:**
   - **SpamMeter** — A circular SVG gauge (0-100) showing your campaign's final spam score with color coding (green = safe, yellow = caution, red = blocked) and a level label (Low / Medium / High). This is the combined heuristic + Gemini AI score.
   - **Batch Size Slider** — Control how many numbers are sent per batch (1-20). Smaller batches = more stealth, larger = faster.
   - **Delay Slider** — Control the throttle delay between batches (500-5000ms). Higher delays reduce the chance of carrier flagging.
   - **Campaign Summary** — Shows recipient count, batch size, delay, estimated batches, and estimated time.
   - **Launch Button** — Disabled automatically if the spam score is too high (spam-free guard). You must lower the spam score to proceed.

   **Step 4 — Send (Live Progress):**
   - **Live Progress Polling** — Once launched, the panel polls campaign progress every 2 seconds and updates in real time.
   - **Progress Bar** — Visual bar showing sent vs total.
   - **Live Stats Grid** — Real-time counts: Sent, Delivered, Undelivered, Invalid.
   - **Status Badge** — Shows current campaign status (queued, sending, completed, blocked_spam, failed).
   - **Spam-Blocked Handling** — If the campaign was blocked by the spam-free guard, the reasons are displayed clearly.
   - **New Campaign Button** — Reset the wizard to start a fresh campaign after completion.

3. **Reports** — Campaign history with status, sender API used, template used, country, delivery stats. Click any campaign to view detailed per-number delivery reports (number, status, country, API, error message).

4. **App Info** — Admin-set platform information: name, logo, description, WhatsApp, email, phone. Shows platform features list.

### AI Chat Support Popup
A floating purple button in the bottom-right corner of the user panel. Click to open the Gemini-powered AI chat assistant. It's language-aware (responds in Bengali if admin set language to Bengali, English otherwise). Ask any question about the platform or MMS sending.

### Spam-Free Enterprise System
The platform uses a dual-layer spam detection engine that combines a heuristic detector with Gemini AI:

- **Heuristic Spam Scoring** — A built-in detector analyzes 35+ spam keywords, ALL CAPS ratio, URL count, known URL shorteners, exclamation mark density, urgency words, money references, and message length. Produces a 0-100 spam score. Including an opt-out phrase ("Reply STOP to unsubscribe") gives a -10 bonus.
- **Gemini AI Review** — The message is sent to Gemini for an independent spam assessment, also scored 0-100.
- **Combined Score** — The final spam score is a 50/50 weighted average of the heuristic and Gemini scores (if Gemini is available; otherwise heuristic-only).
- **Spam-Free Guard (BLOCKS, not just warns)** — When spam protection is enabled in admin Settings, campaigns with a high spam score are **blocked** entirely — the campaign is saved with status `blocked_spam` and no messages are sent. The user sees the spam score, level, and the specific reasons so they can rewrite the message.
- **Live Preview** — In the Compose step, users see a real-time spam score and reasons as they type (before sending). A standalone `spamCheck` action is also available for testing messages without sending.
- **Phone Validation** — Numbers are validated (format check); invalid numbers are rejected with a reason.
- **Blacklist Enforcement** — Blacklisted numbers are automatically rejected during sending.
- **Country Rule Enforcement** — Admin can set allowed/blocked country codes in Settings; the engine enforces these rules per number.
- **Country Detection** — Country codes are detected and displayed for each number.

---

## Sending Engine & Auto-Routing System

The platform includes a real, production-grade bulk sending engine (`sendingEngine.js` + `bulkSendEngine` in `core.js`) with 4 live provider integrations and intelligent routing:

### Provider Integrations (Real HTTP)
- **Twilio** — HTTP Basic auth, form-urlencoded POST to `/Messages.json`
- **Vonage/Nexmo** — HTTP Basic auth, JSON Messages API at `/v0.1/messages`
- **MessageBird** — AccessKey header auth, JSON body
- **Custom HTTP** — Bearer auth, JSON body `{to, from, message, apiKey, sender}` for any provider

### AI Ranking of Sender APIs
When a campaign launches, Gemini AI ranks all available sender APIs by inbox quality. If Gemini is unavailable, a deterministic fallback sort is used (healthScore, then inboxRate, then priority, then remaining quota). The best-ranked API is used first.

### Batching & Throttling
Recipients are split into batches (default 5 per batch) with a configurable delay between batches (default 1200ms). This mimics human sending patterns and reduces carrier spam flags. Users control both via sliders in the Review step.

### Rate Limiting
An in-memory sliding window rate limiter enforces per-API limits (per-minute and per-hour, set in admin Settings). If an API hits its rate limit mid-campaign, the engine pauses and waits until the window resets.

### Retry with Exponential Backoff
Failed sends are retried up to 2 times with exponential backoff (1s, 2s, 4s delays). Terminal errors (authentication failures, invalid numbers, blacklisted numbers) and all 4xx errors are not retried — they are marked failed immediately.

### Auto-Routing Continuation
If the current sender API exhausts its quota or fails repeatedly mid-campaign, the engine automatically switches to the next-best ranked API and continues sending from the same batch index — no messages are lost or duplicated.

### Live Delivery Reports
Every send attempt writes a DeliveryReport with: recipient number, provider used, provider message ID, status, error code, attempt count, batch index, and timestamp. These are visible in the user's Reports tab and the admin's Campaigns tab.

### Delivery Status Webhook
A public `/api/system` endpoint with `action=deliveryStatus` accepts provider delivery webhooks (no auth required). It maps provider-specific statuses (delivered, sent, queued, undelivered, failed, rejected, bounced) and updates the corresponding DeliveryReport and campaign totals in real time.

### Gemini API Auto-Routing
The same auto-routing logic applies to Gemini APIs for spam checking and AI chat — the best available Gemini API is used, and it switches automatically if one is exhausted or down.

---

## Configuration

### To start sending real MMS:
1. Log into the Admin Panel
2. Go to **API Management** tab
3. Add your sender API (Twilio, Vonage, or any MMS/SMS provider) — enter name, provider, API key, secret, endpoint, sender ID, and limit
4. Add a Gemini API (for AI spam checking and chat support) — get a free key from https://aistudio.google.com/apikey
5. Templates will appear in the user panel automatically

### To customize the platform:
1. Go to **Settings** tab in admin panel
2. Set platform name, logo, description, contact info, language
3. Set default user limit and expiry days
4. Configure spam protection and country rules

### To manage users:
1. Go to **User Management** tab
2. Set custom limits and expiry per user
3. Block/unblock users as needed

---

## Technical Details

- **Framework**: Next.js 16.3.1 (App Router, webpack build)
- **Database**: MongoDB (Mongoose 9.9.3) with global caching
- **Auth**: JWT (jose, HS256, 24h expiry) + bcryptjs (12 salt rounds)
- **Admin Auth**: 3-layer (username + password + API key)
- **Sub-Admin**: Granular permissions with access control
- **Deployment**: Vercel (user) + Netlify (admin), same repo, same DB
- **GitHub**: https://github.com/smiukgdjggrjc536-create/Mms_senderV01

---

## Quick Start for Admin

1. Open https://mms-sender-v01.netlify.app
2. Login with the 3 credentials above
3. Go to API Management → Add at least 1 sender API + 1 Gemini API
4. Go to Settings → Set platform name, contact info, language
5. Go to Content & Templates → Create message templates
6. Go to User Management → Set limits and expiry for users
7. Users can now log in at https://mms-sender-v01.vercel.app and send campaigns

Everything is live and ready to use.
