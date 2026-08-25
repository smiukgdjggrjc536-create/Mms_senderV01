# BM2 Ultra — Complete A-to-Z Rebuild of Send Email Dashboard

## Goal
Rebuild SendTab to include EVERY single option/logic from the BM2 Ultra screenshot.
NOT ONE option missing. Plus add the "All Tag" tag-picker panel the user described
(click → opens panel with many tags like Random, copy directly into Subject/Body).

## COMPLETE option list from screenshot (nothing omitted)

### Top tab bar
- [x] Add Task | Task Status | Task Log | Task Report | Open | Open Task

### Sender section
- [x] Sender Mail field (shows current sender email)
- [x] "Your email is already used" red banner + Reuse button
- [x] Sender rotation indicator

### Check Bounce section
- [x] Check Bounce checkbox options

### Content Type (radio buttons) — ALL options
- [x] To pdf
- [x] To Image
- [x] Inline Image
- [x] Html File
- [x] XFFT
- [x] HTML Random Color

### Page Format section
- [x] Color: 24 Spi
- [x] Each Every 50

### Body section
- [x] HTML Body? / Hint Body? toggle
- [x] New Mail / Auto-body radio
- [x] Import checkbox
- [x] Auto-save checkbox
- [x] Pick button
- [x] Content (html) area
- [x] #RANDOM / #RandomJunk token support

### Other options
- [x] Random text option
- [x] Test Mail ? checkbox
- [x] Sending HTML button
- [x] Stop button
- [x] Add Task / Add / Create Task buttons

### Left panel — Recipient email list
- [x] Numbered email list view

### Right panel — Image thumbnail grid
- [x] Inline Image preview grid

### Bottom status
- [x] Ready To Send indicator
- [x] Total Sent: X of Y live counter
- [x] Success status
- [x] Sent: ALL / Sent: X of Y

### NEW: All Tag picker panel (user request)
- [x] "All Tag" button → opens modal/panel
- [x] Panel contains many tag chips: #RANDOM#, #RandomJunk#, #DATE#, #TIME#,
      #NAME#, #CITY#, #RANDOM_NUMBER#, #RANDOM_STRING#, #GREETING#, etc.
- [x] Click a tag → inserts/copies into Subject OR Body (active field)
- [x] Tag preview shows what it resolves to

### Backend
- [x] sendCampaign accepts all new content types (pdf, image, inline, htmlfile, xfft, randomcolor)
- [x] sendCampaign accepts checkBounce, htmlBody, hintBody, newMail, autoBody, import, autoSave
- [x] Tag resolution: #RANDOM#, #RandomJunk#, #DATE#, #TIME#, etc. in subject + body
- [x] pageFormat: color, spi, eachEvery options
- [x] Test mail endpoint
- [x] Stop/cancel campaign endpoint

## Build + Deploy
- [x] npm run build (0 errors)
- [x] commit + push main
- [x] verify Vercel live
- [x] respond in Bengali
