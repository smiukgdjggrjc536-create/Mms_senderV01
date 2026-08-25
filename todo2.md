# User Panel Send Email — BM2-Ultra-style Transformation

## Goal
Rebuild SendTab to match the LOGIC/CONFIG/OPTIONS shown in the BM2 Ultra screenshot,
but with a MORE premium UI (not a visual clone). Keep current dark theme + enterprise
anti-spam engine. Add all missing options.

## Options to add (from screenshot)
- [x] Content Mode radio: Plain Text / HTML / Inline Image / Attach Image
- [x] "Change content after each send" toggle (maps to polymorph)
- [x] "Inject random text" toggle (anti-fingerprint padding)
- [x] "Send test mail first" toggle + test recipient input
- [x] Page/Template format selector
- [x] Live counter "Total Sent X of Y" in progress step
- [x] Recipient Pick/Import panel with list view (left rail)
- [x] Sender rotation indicator ("sender in use → auto-rotating")
- [x] "Add Task" multi-task queue concept (keep simple: task chips)
- [x] Ready/Pending status badge
- [x] Keep: subject + #RANDOM#, batch, delay, jitter, humanize, drip, spam meter

## Backend wiring
- [x] sendCampaign action: accept contentMode, randomText, testMail, testRecipient
- [x] Pass new options through bulkSendEngine

## Build + Deploy
- [x] npm run build
- [x] commit + push (main)
- [x] verify Vercel live
- [x] respond in Bengali
