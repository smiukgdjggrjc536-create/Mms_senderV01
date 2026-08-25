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

## Phase 4: Build + Deploy (IN PROGRESS)
- [x] Build test — compiled successfully (17 routes, 0 errors)
- [ ] Git push → Vercel auto-deploy (user panel)
- [ ] Render auto-deploy (API gateway)
- [ ] Netlify manual deploy (admin panel)
- [ ] Verify all 3 URLs live + report
