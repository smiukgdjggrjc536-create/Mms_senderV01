# BM2 Ultra — Complete A-to-Z Rebuild of Send Email Dashboard

## Goal
Rebuild SendTab to include EVERY single option/logic from the BM2 Ultra screenshot.
NOT ONE option missing. Plus add the "All Tag" tag-picker panel the user described
(click → opens panel with many tags like Random, copy directly into Subject/Body).

## COMPLETE option list from screenshot (nothing omitted)

### Top tab bar
- [ ] Add Task | Task Status | Task Log | Task Report | Open | Open Task

### Sender section
- [ ] Sender Mail field (shows current sender email)
- [ ] "Your email is already used" red banner + Reuse button
- [ ] Sender rotation indicator

### Check Bounce section
- [ ] Check Bounce checkbox options

### Content Type (radio buttons) — ALL options
- [ ] To pdf
- [ ] To Image
- [ ] Inline Image
- [ ] Html File
- [ ] XFFT
- [ ] HTML Random Color

### Page Format section
- [ ] Color: 24 Spi
- [ ] Each Every 50

### Body section
- [ ] HTML Body? / Hint Body? toggle
- [ ] New Mail / Auto-body radio
- [ ] Import checkbox
- [ ] Auto-save checkbox
- [ ] Pick button
- [ ] Content (html) area
- [ ] #RANDOM / #RandomJunk token support

### Other options
- [ ] Random text option
- [ ] Test Mail ? checkbox
- [ ] Sending HTML button
- [ ] Stop button
- [ ] Add Task / Add / Create Task buttons

### Left panel — Recipient email list
- [ ] Numbered email list view

### Right panel — Image thumbnail grid
- [ ] Inline Image preview grid

### Bottom status
- [ ] Ready To Send indicator
- [ ] Total Sent: X of Y live counter
- [ ] Success status
- [ ] Sent: ALL / Sent: X of Y

### NEW: All Tag picker panel (user request)
- [ ] "All Tag" button → opens modal/panel
- [ ] Panel contains many tag chips: #RANDOM#, #RandomJunk#, #DATE#, #TIME#,
      #NAME#, #CITY#, #RANDOM_NUMBER#, #RANDOM_STRING#, #GREETING#, etc.
- [ ] Click a tag → inserts/copies into Subject OR Body (active field)
- [ ] Tag preview shows what it resolves to

### Backend
- [ ] sendCampaign accepts all new content types (pdf, image, inline, htmlfile, xfft, randomcolor)
- [ ] sendCampaign accepts checkBounce, htmlBody, hintBody, newMail, autoBody, import, autoSave
- [ ] Tag resolution: #RANDOM#, #RandomJunk#, #DATE#, #TIME#, etc. in subject + body
- [ ] pageFormat: color, spi, eachEvery options
- [ ] Test mail endpoint
- [ ] Stop/cancel campaign endpoint

## Build + Deploy
- [ ] npm run build (0 errors)
- [ ] commit + push main
- [ ] verify Vercel live
- [ ] respond in Bengali
