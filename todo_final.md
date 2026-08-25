# Single-Page BM2 Ultra SendTab — Final Integration

## Backend (route.js)
- [x] Import EmailAccount from @/lib/core
- [x] Add listSenders action (verifyAny, returns sender accounts without credentials)
- [x] Add all new BM2 options to sendOpts (checkResult, checkReply, autoReply, autoSend, importFlag, randomHtml, randomTest, speedMode, changeAfterStart, useName, sendQuestion, confirmedShipping, prioritySend, scheduledTask, colorSec, testMail, testRecipient)

## Frontend (UserPanel.jsx)
- [x] Removed 4-step wizard (step state, StepIndicator, Next/Back)
- [x] Single-page three-column layout
- [x] All BM2 Ultra labels present (Speed ALL, Check Result?, Change After.start, Name?, Send?, Check Reply?, Auto Reply, Auto Send, Confirmed Shipping, Priority To Send, Random HTML, Random Test, Pause, Color: 05 Sec, Scheduled task, To HTML, PPT, Render Mail)
- [x] credentials.json rotation dropdown (listSenders fetch)
- [x] MiniToggle with static Tailwind classes
- [x] Babel PARSE OK

## Build & Deploy
- [x] npm run build — no errors
- [x] git commit & push to main
- [x] Verify Vercel deployment live
- [x] Respond in Bengali
