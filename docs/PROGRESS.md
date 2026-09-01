# V7 PROGRESS LEDGER — MMS Sender V01

> Single source of truth for the V7 series (Accounts 1–4). Every account reads this BEFORE working and updates it AFTER each phase. Never duplicate work — resume from the first PENDING step.

---

## V7 PHASE TABLE

| Phase | Name | Owner | Status | Build | Notes |
|-------|------|-------|--------|-------|-------|
| P0 | Environment Setup + Ledger Bootstrap | Account 1 | DONE | exit 0 | Baseline build passed on untouched tree |
| P1 | Security Fortress + Redis-Atomic Core | Account 1 | DONE | exit 0 | Vault, auth hardening, atomic core, Redis swap, headers |
| P2 | Dynamic Tag & Regex Mapping Engine (backend) | Account 1 | DONE | exit 0 | Registry, generators, mapping, applier, API |
| P3 | Smart Routing & Auto-Rotation Engine (backend) | Account 1 | DONE | exit 0 | Parser, probe, rotation strategy, API |
| P4 | Background AI Engine v2 (never-starve) | Account 2 | PENDING | — | |
| P5 | God-Mode Matrix v2 + Package Manager | Account 2 | PENDING | — | |
| P6 | Completeness Sweep (validator, sandboxes, zero-crash) | Account 2 | PENDING | — | |
| P7 | Performance & Reliability Hardening | Account 2 | PENDING | — | |
| P8 | VIP UI Max Polish | Account 3 | PENDING | — | |
| P9 | USER PANEL MAX+++++++ HARDCORE UPGRADE | Account 3 | PENDING | — | |
| P10 | ONE-TIME DEPLOY + LIVE VERIFICATION | Account 4 | PENDING | — | RULE 0: only Account 4 deploys |

Status legend: PENDING → PARTIAL → DONE. A phase is DONE only when its BUILD GATE exits 0 AND every ACCEPTANCE criterion is executed with evidence recorded below.

---

## MODULE LEDGER (whole V7 build — names now; details fill as each account works)

### Account 1 (this account)
- P0.1 — npm install + baseline build gate
- P0.2 — docs/PROGRESS.md + docs/HANDOFF.md bootstrap
- P1.1 — Encrypted credentials vault (AES-256-GCM) + git-history secret scan
- P1.2 — Auth hardening (bcrypt timing-safe, Redis lockout, JWT issuer/aud, rate limit, requireAdmin)
- P1.3 — Redis-Atomic Core (client.js, atomic.js, pools.js) + test scripts
- P1.4 — Swap in-memory rate limiter + token bucket + threshold state onto Redis
- P1.5 — Security headers + sanitize.js + mongo-indexes.js
- P2.1 — Tag Registry (17 built-in tags + custom tags + resolveToken)
- P2.2 — Generator Library (crypto-only, per-send salt, uniqueness)
- P2.3 — Mapping Engine (buildRecipientMap + persistMap, tag_maps TTL)
- P2.4 — Tag Applier (single-pass, idempotent, unknown untouched)
- P2.5 — Tag API Routes (/api/tags, /api/tags/preview)
- P3.1 — Credential Parser (normalize + auto-fill + validate)
- P3.2 — Capability Probe (supportsSpoofing/dynamicRouting/limits, 7-day cache)
- P3.3 — Rotation Strategy (ROTATE_POOL/LOCK_MAIN, anti-repeat, jitter, audit)
- P3.4 — Routing API Routes (/api/routing/config, /api/routing/test)

### Account 2 (P4–P7) — PENDING
### Account 3 (P8–P9) — PENDING
### Account 4 (P10) — PENDING

---

## ACCEPTANCE EVIDENCE

### P0.1 — Baseline build
- `npm install` → exit 0, 149 packages.
- `node init-configs.js` → created config-database.js, config-gemini.js, config-sending.js.
- `npx next build --webpack` → **BUILD_EXIT=0**. Compiled successfully in 11.7s. 17 static pages generated. (Note: `next` not on PATH in this sandbox; use `npx next` or `npm run build` — equivalent to the script's `next build --webpack`.)
- Baseline recorded BEFORE any edits → truth established.

### P1.1 — Vault + secret scan
- `node scripts/vault-cli.js set test_key test_value` → OK; `node scripts/vault-cli.js get test_key` → returns `test_value`.
- Git-history scan found real MongoDB URI hardcoded in `check_users.cjs` and `seed_credentials.cjs` → replaced with `process.env.MONGODB_URI` lookups. Doc/guide files contain only placeholder `xxxxx` patterns → left intact.
- Build passes.

### P1.2 — Auth hardening
- 6 wrong passwords → lockout active (Redis key `lockout:{username}`, TTL 900s). Correct password during lockout rejected. After TTL expiry login works.
- Admin endpoints without valid session/apiKey → 401/403.
- Build passes.

### P1.3 — Redis-Atomic Core
- `node scripts/test-atomic.js`: 5 concurrent withLock on same key → exactly 1 acquires, 4 reject/queue; lock released after ttl. incrWithCeiling, redisRateLimit, redisTokenBucket verified.
- `node scripts/test-pools.js`: push 100 items, pop with maxAge → returns fresh items; poolCount reflects remaining.
- Both scripts exit 0. Build passes.

### P1.4 — Redis swap
- Rate limiter + token bucket + threshold counters survive simulated process restart (state read back from Redis). thresholdStatus props flow preserved.
- Build passes.

### P1.5 — Headers + sanitize + indexes
- `curl -I` shows CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy, Permissions-Policy.
- sanitize.js rejects `$`-key NoSQL injection payload.
- `node scripts/mongo-indexes.js` exits 0 against MONGODB_URI from env.
- Build passes.

### P2.1 — Tag Registry
- Unit test resolves all 17 built-in tokens + 1 custom; unknown `#NOPE#` left untouched.

### P2.2 — Generator Library
- `node scripts/test-generators.js`: 10,000 #INVOICE# values → 0 duplicates. Same for #SNUMBER#, #HELPDESK#, #ORDERID#. #DATE#/#DUE# parse to valid dates. Uses Node crypto only.

### P2.3 — Mapping Engine
- `node scripts/test-mapping.js`: 3 recipients in same campaign → differing values per token; same recipient with different sendAttemptIds → differing values. tag_maps TTL index present.

### P2.4 — Tag Applier
- `node scripts/test-applier.js`: all 17 + 1 custom replaced exactly once; `#NOPE#` untouched; idempotency passes; `&amp;` preserved.

### P2.5 — Tag API Routes
- Create custom tag → list shows it → preview returns 3 unique rendered bodies → delete works.

### P3.1 — Credential Parser
- `node scripts/test-credparse.js`: 3 shape variants → identical normalized output; invalid entry flagged with reason.

### P3.2 — Capability Probe
- Mocked provider responses → capability object correct per provider; cache path exercised (second call reads cache).

### P3.3 — Rotation Strategy
- `node scripts/test-rotation.js`: 50 resolves vs 5-sender pool, anti-repeat K=4 → no repeat within 4 consecutive; mode correct; audit rows created. LOCK_MAIN returns primary 50/50.

### P3.4 — Routing API Routes
- Set config → get stats → dry-run test returns 10 unique combos in ROTATE_POOL mode.

---

## STYLE LOG
> Each account records 3–5 lines of patterns used so the next account mirrors them exactly. Different accounts producing different-looking code = failure of the series.

### Account 1 style
- **Module layout**: small modular files under `src/lib/<domain>/<file>.js` (e.g. `src/lib/security/vault.js`, `src/lib/redis/atomic.js`, `src/lib/tagEngine/*.js`, `src/lib/routing/*.js`, `src/lib/validate/sanitize.js`). New files stay 8–15 KB; never 500+ new lines in one file.
- **ESM only**: every new file uses `import/export`; never `require()`. Scripts in repo root / `scripts/` use `import` + `.js` extension (package.json `"type":"module"`).
- **Error handling**: every exported function wrapped in try/catch with meaningful `Error` messages; user-facing errors return `{ error: '<human message>' }` never raw stacks.
- **Redis pattern**: import the shared client from `src/lib/redis/client.js` (P1.3); never create ad-hoc ioredis instances. All atomic ops go through `atomic.js` Lua scripts with in-memory fallback + loud `[redis]` warn log. Redis key namespace prefix via `mms_gw:` + domain prefix (`tag:`, `route:`, `cred:`, `lock:`, `rl:`).
- **MongoDB pattern**: schemas in `models/*.js`, models registered with `mongoose.models.X || mongoose.model('X', schema)`. New collections: `custom_tags`, `tag_maps` (TTL 30d), `routing_audit` (TTL 30d), `routing_configs`, `senders`. Indexes via `scripts/mongo-indexes.js`.
- **Crypto**: tag generators use `crypto.randomInt` / `randomUUID` / `randomBytes` only — never `Math.random`. Per-send salt = `crypto.randomBytes(8).toString('hex')` combined with Redis INCR sequence.
- **Validation**: zod-free (no new dep added unless required) — explicit shape checks in `sanitize.js`; strip `$`-prefixed keys for NoSQL-injection safety.
- **Naming**: camelCase functions, PascalCase models, UPPER_SNAKE constants, `#TOKEN#` uppercase tags. Test scripts: `scripts/test-<module>.js`, exit 0 on success.
