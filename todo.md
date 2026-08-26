# User Panel Enterprise Redesign — Current Sprint

## Phase A: UserPanel.jsx Complete Rewrite
- [ ] Write new UserPanel.jsx (full_file_rewrite) — enterprise redesign
  - No scroll, single screen fit (h-screen flex, internal scroll only)
  - Subject line at TOP
  - Recipient email list on RIGHT side with Paste button
  - Removed: Task Status, Task Log, Task Report, Open, Open Task tabs
  - Removed: Render Mail config, Auto Send, Random Test, Scheduled Task, Random HTML, Auto-Signup, PL-Rotate, Humanized, Page Format, Color 24-bit, Auto Route Sender
  - Start Campaign button on RIGHT, Stop = pause/resume
  - Email preview overlay (in-page, close + fullscreen)
  - Check Bounce at top (results + Replace button)
  - Sending limit + expiry compact in corner
  - Connect Email small button in top corner
  - Anti-spam config behind toggle (show/hide + Save)
  - State persistence via localStorage (no refresh loss)
  - Auto-change name interval selector + AI 1040 names
  - Millisecond delay input (min 100ms)
  - Recipient list live results (green check / red cross)
  - Gmail OAuth credentials.json connect (fixed redirect_uri)
- [ ] Build test — zero errors
- [ ] Deploy to Vercel (user panel)
- [ ] Deploy to Netlify (admin panel)
- [ ] Deploy to Render (API gateway)
- [ ] Verify all 3 platforms live
