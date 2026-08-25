# MMS→Email Module Transformation Plan

## Phase 1: Core Validation & Engine Transformation
- [x] Explore codebase (complete from prior session)
- [x] Read prepareMms.js, bulkSendEmailMms.js, queueRouter.js, constants.js, core.js
- [x] Read sendCampaign action in system/route.js
- [x] Add `validateEmailAddress()` to core.js (keep validatePhoneNumber for compat)
- [x] Create `services/prepareEmail.js` (safety + AI rewrite, NO carrier lookup)
- [x] Transform `services/bulkSendEmailMms.js` → email-direct bulk engine
- [x] Update `services/queueRouter.js` — add sendEmail alias, update comments

## Phase 2: API & Constants Transformation
- [ ] Transform `sendCampaign` action in system/route.js — validate emails
- [ ] Update `src/lib/gateway/constants.js` — update AI prompt, SEND_RESULT
- [ ] Update preview route for email preview

## Phase 3: UI Transformation (Admin Panel only — NOT user panel)
- [ ] Update AdminPanel.jsx labels MMS→Email (keep styling/theme unchanged)

## Phase 4: Build, Deploy, Verify
- [ ] Build Next.js app
- [ ] Deploy to Netlify (admin panel)
- [ ] Verify live
- [ ] Update SYSTEM-STATE.md
- [ ] Commit & push to GitHub
