# MMS→Email Module Transformation Plan — BM2 Ultra Enterprise Upgrade

## Phase 1: UX Fixes (Sidebar + No-Scroll)  ✅
- [x] Sidebar collapse layout bug → flex layout (no fixed+margin hack)
- [x] Page scroll → h-screen flex, internal scroll only
- [x] Header + mobile tab bar = flex-shrink-0

## Phase 2: BM2 Ultra Config UI (SendTab)  ✅
- [x] From Name field + From Name Variants (rotation)
- [x] Auto-change Name / Auto-change Subject toggles
- [x] Subject Variants textarea (one per line)
- [x] Track Pixel toggle (open tracking)
- [x] Embed ALL content type option
- [x] Speed ALL/SLOW/SAFE modes
- [x] Sender rotation dropdown (credentials.json list)
- [x] Config chips in action bar (Track, Auto-Name, Auto-Subject, fromName)

## Phase 3: Backend Support  ✅
- [x] Auto name/subject rotation in bulkSendEmailMms engine
- [x] Track pixel endpoint /api/track/open (1x1 GIF + OpenEvent log)
- [x] OpenEvent schema + model in core.js + exported in barrel
- [x] From Name injection in email MIME (buildMime → sendViaGmail → queueRouter → bulk)
- [x] HTML content auto-detection in buildMime
- [x] ownerId field added to EmailAccount schema (multi-tenant isolation)
- [x] credentials.json upload endpoint (/api/user/gmail/connect) — initiate OAuth
- [x] credentials.json callback endpoint (/api/user/gmail/connect/callback)
- [x] "Connect Gmail" UI in SendTab (file upload → OAuth popup → result message)
- [x] listSenders action filter by ownerId (user sees own + shared pool)

## Phase 4: Build + Deploy  ✅
- [x] Build test — compiled successfully (17 routes, 0 errors)
- [x] Git push → Vercel auto-deploy (user panel) — LIVE (commit 8b8ee5b)
- [x] Render auto-deploy (API gateway) — LIVE (track/open endpoint confirmed, GIF verified)
- [~] Netlify manual deploy (admin panel) — BLOCKED: token expired (needs new token from user)
- [x] Verify Vercel + Render URLs live + report

## ALL BM2 ULTRA FEATURES LIVE ON VERCEL (USER PANEL) ✅

## ⚠️ Netlify Admin Panel — Needs New Token
The Netlify auth token (nfp_WgaFR5M4gTPDmf262U4dmG33FzVtGkR19cca) has EXPIRED (HTTP 401).
The admin panel (mmsadminpanellogin.netlify.app) is still live on the PREVIOUS deploy
and fully functional for admin operations. To deploy the latest code to Netlify:
  → User needs to generate a new Netlify Personal Access Token at:
    https://app.netlify.com/user/applications#personal-access-tokens
  → Then I can run: NETLIFY_AUTH_TOKEN="<new>" netlify deploy --site d96d1fdf-... --dir .next --prod
