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

2. **API Management** — Add up to 10 sender APIs + 10 Gemini APIs. View usage %, remaining quota, inbox rate, spam rate, health score, status (active/blocked/warning/exhausted). Toggle auto-routing per API. When auto-route is on, the system automatically picks the best API (highest health + inbox rate) and switches when a limit is exhausted.

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

2. **Send MMS** — Full sending system:
   - **Message Templates** — Select from admin-created templates by type (payment, marketing, promo, etc.)
   - **AI/Gemini Suggestion** — Click "AI Suggestion" to get an AI-generated message
   - **New & Auto Sending** — Click to generate a fresh, unique message each time
   - **Auto-generate after N sends** — Set to auto-generate a new message after every 1/3/5/10 sends
   - **Number Routing** — Choose to send to all numbers, or only first 3/4/5/10
   - **CSV Import** — Upload a CSV/TXT file to import numbers
   - **Direct Paste** — Paste numbers directly (comma or newline separated)
   - **Send Result** — Shows sent/delivered/undelivered/invalid counts, AI spam check verdict, invalid numbers with reasons
   - **Scheduled Sends** — Schedule campaigns for future delivery

3. **Reports** — Campaign history with status, sender API used, template used, country, delivery stats. Click any campaign to view detailed per-number delivery reports (number, status, country, API, error message).

4. **App Info** — Admin-set platform information: name, logo, description, WhatsApp, email, phone. Shows platform features list.

### AI Chat Support Popup
A floating purple button in the bottom-right corner of the user panel. Click to open the Gemini-powered AI chat assistant. It's language-aware (responds in Bengali if admin set language to Bengali, English otherwise). Ask any question about the platform or MMS sending.

### Spam-Free Enterprise System
- Phone numbers are validated (format check) — invalid numbers are rejected with a reason
- Blacklisted numbers are automatically rejected
- Gemini AI checks messages for spam likelihood before sending
- Country codes are detected and displayed
- The system warns (but doesn't block) if AI detects spam, and provides improvement suggestions

---

## Auto-Routing System

When a user sends a campaign:
1. The system selects the best sender API (highest health score + inbox rate + priority + remaining quota)
2. If that API's limit is exhausted, it automatically switches to the next best API
3. Sending continues without stopping during routing
4. The admin can also manually control which APIs are used by toggling auto-route

The same auto-routing applies to Gemini APIs for spam checking and AI chat.

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
