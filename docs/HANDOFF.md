# V7 HANDOFF — Account 2 → Account 3

> The bible for the next account. Read this BEFORE touching anything. Also read `docs/PROGRESS.md` (phase table + acceptance evidence), `docs/INDEX_REPORT.md` (index audit), and `ACCOUNT_3_MASTERPOLISH_V7.txt` (your script).

---

## Current state
- Branch: `v7-dev` (pushed to origin). `main` untouched. Old `v6-dev` exists — ignore.
- Account 1 completed **P0–P3**: Foundation, Security Fortress, Redis-Atomic Core, Tag Engine, Routing Engine.
- Account 2 completed **P4–P7**: Background AI Engine v2 (never-starve), God-Mode Matrix v2 + Package Manager, Completeness Sweep, Performance & Reliability Hardening.
- All pushed to `v7-dev`. Latest commit: `d8ea372`.
- Build gate passes: `node init-configs.js && npx next build --webpack` → exit 0.

## Commits by Account 2 (chronological)
- `eff7f92` — P4: Background AI Engine v2 (never-starve)
- `e99029c` — P5: God-Mode Matrix v2 + Package Manager
- `6562502` — P6: Completeness Sweep
- `0eff394` — P7.1: Observability (health + metrics endpoints)
- `0aa5720` — P7.2: Indexes + query audit (INDEX_REPORT.md)
- `442e90b` — P7.3: Load smoke test
- `d8ea372` — P7.4: Final build gate + push

## What Account 2 built (new files)

### P4 — Background AI Engine v2
- `src/services/ai/engine.js` — AI pool model (body/subject/sender-name pools on Redis ZSET). Exports: `getStats`, `pushToPool`, `popFromPool`, `getPoolCount`, `drainRefillPool`.
- `src/services/ai/aiPool.js` — facade over engine.js. Exports: `aiPoolPush`, `aiPoolPopFresh`, `aiPoolCount`, `aiPoolDrainRefill`.
- `src/services/ai/restockWorker.js` — singleton restock worker (60s cycle, key rotation, per-key cooldown). Exports: `getRestockStatus`, `startRestockWorker`, `stopRestockWorker`.
- `src/services/ai/autoFill.js` — sender auto-fill + auto-rotate + AI quota. Exports: `checkAndAutoFill`, `rotatePrimarySender`.
- `src/services/circuitBreaker.js` — per-account circuit breaker. Exports: `getCircuitState`, `getAllCircuitStates`, `recordSuccess`, `recordFailure`, `getFailureCount`.
- `scripts/test-aipool.js` (19/19), `scripts/test-restock.js` (26/26), `scripts/test-autofill.js` (26/26)

### P5 — God-Mode Matrix v2 + Package Manager
- `src/lib/toggles/registry.js` — server-authoritative toggle registry. Exports: `getToggle`, `setToggle`, `getAllToggles`, `TOGGLE_KEYS`.
- `src/lib/packages/manager.js` — per-user package quota manager. Exports: `getUserPackage`, `setUserPackage`, `checkQuota`, `incrementUsage`, `PACKAGE_DEFAULTS`.
- `src/app/api/toggles/route.js`, `src/app/api/admin/toggles/route.js` — toggle API (GET/POST, admin-gated)
- `src/app/api/packages/route.js`, `src/app/api/admin/packages/route.js` — package API (GET/POST, admin-gated)
- `scripts/test-toggles.js`, `scripts/test-packages.js` (56/56 combined)

### P6 — Completeness Sweep
- `src/lib/validate/pipeline.js` — validator pipeline (RFC syntax, duplicates, bounce-risk, blacklist, grade score). Exports: `validateRecipientList`, `validateSingleAddress`, `computeGrade`.
- `src/lib/sendingEngine/sendGuard.js` — zero-crash dispatch wrapper. Exports: `sendGuard`, `withErrorBoundary`.
- `scripts/test-validator.js` (63/63), `scripts/test-sandboxes.js` (70/70), `scripts/test-zerocrash.js` (100/100), `scripts/test-smallthings.js` (86/86)

### P7 — Performance & Reliability
- `src/lib/observability/health.js` — health aggregator (6 subsystems, 3s timeouts, graceful degradation). Exports: `getHealth`, `checkDb`, `checkRedis`, `checkQueue`, `checkAiPools`, `checkRestock`, `checkCircuitBreakers`.
- `src/lib/observability/metrics.js` — Redis ZSET time-series metrics (24h p95 latency + throughput). Exports: `recordLatency`, `recordSendEvent`, `getThroughput24h`, `getP95Latency24h`, `resetObservability`.
- `src/app/api/system/health/route.js` — public health endpoint (200/503)
- `src/app/api/system/metrics/route.js` — admin-only metrics endpoint (requireAdmin)
- `scripts/test-observability.js` (66/66), `scripts/smoke-load.js` (load smoke: 200 seq + 50 concurrent, p95<500ms)
- `docs/INDEX_REPORT.md` — full index inventory (26 indexes, 11 collections, 3 TTL, 0 missing)

## MongoDB collections added by Account 2
- `userpackages` { userId, packageName, dailyLimit, monthlyLimit, features[], usage:{}, createdAt, updatedAt } — unique index on userId, index on packageName
- `featuretoggles` { toggles: {}, updatedAt } — singleton document (no additional indexes needed)

## Redis key namespaces added by Account 2
- `mms_gw:ai:pool:{type}` — AI content pools (body/sender_name/subject), ZSET
- `mms_gw:ai:restock:lock` — restock worker singleton lock
- `mms_gw:ai:restock:keycooldown:{keyId}` — per-key cooldown (TTL)
- `mms_gw:ai:restock:allkeys` — global key cooldown (TTL)
- `mms_gw:cb:{accountId}` — circuit breaker state (open/closed/halfOpen + failure count)
- `mms_gw:toggle:cache` — toggle registry cache (TTL 5s)
- `mms_gw:package:{userId}:sent` — package usage counter (incrWithCeiling)
- `mms_gw:obs:latency:api` — latency time-series ZSET (score=ts, member="ts:ms:route")
- `mms_gw:obs:sends` — send event time-series ZSET (score=ts, member="ts:status:mode")

## CRITICAL gotchas for Account 3
1. **`@/services/*` alias maps to OLD directory**: jsconfig.json has `"@/services/*": ["./services/*"]` which points to the OLD `services/` dir (NOT `src/services/`). The AI modules (engine.js, restockWorker.js, circuitBreaker.js) are in `src/services/`. When importing these from `src/lib/` or `src/app/` files, use **relative paths** (e.g., `../../services/ai/engine.js`) NOT `@/services/ai/engine`. The `@/lib/*` alias works correctly for `src/lib/` imports.
2. **`next/server` in test runner**: if you write tests that import route handlers (which import `from 'next/server'`), the alias-loader already maps `next/server` → `next/server.js`. This is set up in `scripts/alias-loader.mjs`.
3. **MongoDB fast-fail guards**: any function that calls `Model.find()` in a test/sandbox context MUST check `mongoose.connection.readyState !== 1` first and return from cache or empty — otherwise it hangs for 10s (buffering timeout). See `tagRegistry.listCustomTags()` for the pattern.
4. **`withTimeout` pattern**: for health checks or any DB-dependent call in a serverless context, wrap in `withTimeout(promise, 3000, label)` (Promise.race vs setTimeout) to prevent 10s MongoDB hangs. See `src/lib/observability/health.js`.
5. **`create_file`/`str_replace` tool paths**: these tools use `/workspace` as root, NOT `/workspace/Mms_senderV01`. Always prefix file paths with `Mms_senderV01/` when using these tools (e.g., `Mms_senderV01/src/lib/foo.js`).

## Remaining steps (Account 3 — P8–P9)
- **P8 — VIP UI Max Polish**: Harden `AdminPanel.jsx` (~292KB) and `UserPanel.jsx` (~256KB). These are monoliths — extend additively, never break existing action names or props contracts. PRESERVE: Tag Pills + insertAtCursor, 480px editor lock, `thresholdStatus` props flow, PANEL_MODE switch. The new P4-P7 backend endpoints (`/api/system/health`, `/api/system/metrics`, `/api/toggles`, `/api/packages`, `/api/admin/toggles`, `/api/admin/packages`) need UI surfaces — wire them into the admin panel.
- **P9 — USER PANEL MAX+++++++ HARDCORE UPGRADE**: User-facing panel upgrades. PRESERVE the 4 Campaign Sandbox environments (A/B/C/D), God-Mode toggles (server-authoritative — UI only reflects), server-authoritative validator pipeline (UI only displays server numbers). The AI pool status (`getStats` from engine.js), restock status (`getRestockStatus`), and circuit breaker states (`getAllCircuitStates`) are available for dashboard display.

## Known risks (updated)
- `src/app/api/system/route.js` is a ~158KB monolith with 107 actions on ONE route. P1.5 added projection+limit. Account 3 may split additively (never break existing action names).
- `AdminPanel.jsx` (~292KB) and `UserPanel.jsx` (~256KB) are monoliths — Account 3 owns the UI hardening. Do not break the `thresholdStatus` props contract or the Tag Pill / `insertAtCursor` / 480px editor lock.
- `init-configs.js` materializes `config-database.js` / `config-gemini.js` / `config-sending.js` at build time (gitignored). It MUST run before every build (pitfall P5).
- Tailwind v4 + `@netlify/plugin-nextjs` + `@tailwindcss/postcss` MUST stay in `dependencies` (not devDependencies) or Netlify CI fails (pitfall P4). Do not touch `postcss.config.mjs` (pitfall P4).

## Pitfall summary (RULE 0–13 / section [2] of the Account 1 script)
- **RULE 0**: Accounts 1–3 NEVER deploy (no Vercel, no Netlify — not a single remote build). Only local build gate + git push. Only Account 4 deploys, ONCE.
- **L1 CAPACITY SILENCE**: never mention/estimate credits/tokens/limits/time remaining.
- **L2 NO FAKE COMPLETION**: never write "complete/done/working" unless acceptance passed; else mark PARTIAL with exact remaining steps.
- **L3 BUILD GATE**: `node init-configs.js && next build --webpack` after every phase; phase pushable only when build exits 0. Never comment out working code to force a pass.
- **L4 PUSH + LEDGER**: `git add -A && git commit -m "V7 P<x>: <summary>" && git push origin v7-dev` then update this file + `docs/PROGRESS.md`.
- **L5 BRANCH LAW**: all work on `v7-dev`; `main` untouched until Account 4. Old `v6-dev` exists — ignore.
- **L6 PRESERVE LIST**: 4 Campaign Sandboxes (A/B/C/D), God-Mode toggles (server-authoritative), AI Pool (Redis-backed, resume), Threshold resume system, server-authoritative validator pipeline, Tag Pills + insertAtCursor, 480px editor lock, UserPanel `thresholdStatus` props, PANEL_MODE switch. Extend additively — never replace.
- **L7 PITFALLS**:
  - P1: Netlify deploy (Account 4 only) — after CLI deploy PATCH site config `build_settings.branch=main` or it builds the wrong branch.
  - P2: CLI deploys always work; UI-based deploy setup is unreliable.
  - P3: Admin creds `Admin@665_Sam1` / `ArThac751Hgafn116` — `ensureAdminCredentials` (`src/lib/core.js:688`) reseeds ONLY if the user doc is absent. Admin username after the @ is **665** (six-six-five, NOT zero).
  - P4: Tailwind v4 + `@netlify/plugin-nextjs` + `@tailwindcss/postcss` stay in `dependencies`. Don't touch `postcss.config.mjs`.
  - P5: `init-configs.js` runs before every build.
  - P6: OOM/disk pressure → `rm -rf .next` and rebuild.
  - P7: ESM — `import/export` only, never `require()`.
  - P8: React 19 — no legacy lifecycle; server components by default in `app/`.
- **L8 LANGUAGE**: talk to the operator in Bangla; all code/commits/docs/logs in English.
- **L9 STYLE**: mirror the STYLE LOG in `docs/PROGRESS.md` exactly (Account 1 + Account 2 entries).
