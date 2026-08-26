# User Panel UPGRADE — Preserve Existing UI, Add Features

## Phase 0: Restore + Deploy (DONE)
- [x] Restore original UserPanel.jsx from backup
- [x] Set up new Vercel account + project
- [x] Set env vars + fix Node 20.x
- [x] Deploy to Vercel (mms-sender-v01-ten.vercel.app)

## Phase 1: UPGRADE SendTab (keep existing UI, add features)
- [x] Subject line at TOP of send form
- [x] Recipient email list on RIGHT side with Paste button
- [x] Remove: Task Status, Task Log, Task Report, Open, Open Task tabs
- [x] Remove: Render Mail, Auto Send, Random Test, Scheduled Task, Random HTML, Page Format
- [x] Start Campaign button on RIGHT, Stop = pause/resume
- [x] Email preview overlay (in-page, close + fullscreen)
- [x] Check Bounce at top (results + Replace button)
- [x] Sending limit + expiry compact in corner
- [x] Connect Email small button in top corner
- [x] Anti-spam config behind toggle (show/hide + Save)
- [x] State persistence via localStorage (no refresh loss)
- [x] Auto-change name interval selector
- [x] Millisecond delay input (min 100ms)
- [x] Recipient list live results (green check / red cross)
- [x] Multi-campaign (up to 4, auto-named)
- [x] Live monitoring (sent/delivered/bounced/invalid/inbox rate)

## Phase 2: New Features
- [x] Terms of Agreement screen on login
- [x] Email validator with loading animation
- [x] No scroll fix (single screen fit - h-[calc(100vh-220px)])

## Phase 3: Build + Deploy
- [x] Build test — zero errors (17 routes, 0 errors)
- [ ] Commit to GitHub
- [ ] Deploy to Vercel (user panel)
- [ ] Deploy to Netlify (admin panel)
- [ ] Deploy to Render (API gateway — auto from GitHub)
- [ ] Verify all 3 platforms live
