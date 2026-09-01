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
| P4 | Background AI Engine v2 (never-starve) | Account 2 | DONE | exit 0 | P4.1 engine+aiPool 19/19, P4.2 restock 26/26, P4.3 autoFill 26/26, commit eff7f92 |
| P5 | God-Mode Matrix v2 + Package Manager | Account 2 | DONE | exit 0 | P5.1 toggles 56/56, P5.2 packages 56/56, commit e99029c |
| P6 | Completeness Sweep (validator, sandboxes, zero-crash) | Account 2 | DONE | exit 0 | P6.1 validator 63/63, P6.2 sandboxes 70/70, P6.3 zero-crash 100/100, P6.4 small things 86/86, commit 6562502 |
| P7 | Performance & Reliability Hardening | Account 2 | DONE | exit 0 | P7.1 observability 66/66, P7.2 indexes 26/11/3, P7.3 load smoke p95<500ms, P7.4 commit d8ea372 |
| P8 | VIP UI Max Polish | Account 3 | DONE | exit 0 | P8.1 theme.js tokens, P8.2 pill hardening, P8.3 editor lock, P8.4 micro-interactions, P8.5 visual consistency, commit 0711047 |
| P9 | USER PANEL MAX+++++++ HARDCORE UPGRADE | Account 3 | DONE | exit 0 | P9.1 orchestrator, P9.2 living dashboard, P9.3 mission control, P9.4 delivery center, P9.5 empty states, P9.6 power-user layer, P9.7 trust & transparency, commit 8027938 |
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
- P3.1 — Credential Parser (normalize + auto-fill + validate) — 16/16 tests
- P3.2 — Capability Probe (supportsSpoofing/dynamicRouting/limits, 7-day cache) — 18/18 tests
- P3.3 — Rotation Strategy (ROTATE_POOL/LOCK_MAIN, anti-repeat, jitter, audit) — 26/26 tests
- P3.4 — Routing API Routes (/api/routing/config, /api/routing/test) — build exit 0

### Account 2 (P4–P7) — DONE
- P4.1 — Redis pool model (engine.js + aiPool.js facade) — DONE 19/19 tests
- P4.2 — Restock worker (restockWorker.js, singleton, key rotation) — DONE 26/26 tests
- P4.3 — Sender auto-fill + auto-rotate + AI quota (autoFill.js) — DONE 26/26 tests
- P4.4 — Build gate PASSED, commit eff7f92, pushed v7-dev
- P5.1 — Toggle registry (src/lib/toggles/registry.js) + API — DONE
- P5.2 — Package manager (src/lib/packages/manager.js) + API — DONE
- P5.3 — Performance (Redis-atomic, zero N+1, force-dynamic) — DONE
- P5.4 — Build gate PASSED, commit e99029c, pushed v7-dev — 56/56 tests
- P6.1 — Validator pipeline (src/lib/validate/pipeline.js) — DONE 63/63 pass, 1000-addr recount matches
- P6.2 — 4 sandbox isolation verification — DONE 70/70 pass, zero cross-talk
- P6.3 — Zero-crash (zero TODO/FIXME/placeholder/stub) verification — DONE 100/100 pass, sendGuard
- P6.4 — Small things sweep + build gate + commit 6562502 — DONE 86/86 pass, ledger complete
- P7.1 — Observability (/api/system/health + /api/system/metrics) — DONE 66/66 pass, commit 0eff394
- P7.2 — Indexes audit (docs/INDEX_REPORT.md) — DONE 26 indexes/11 collections/3 TTL, 0 missing, commit 0aa5720
- P7.3 — Load smoke test (scripts/smoke-load.js) — DONE 200 seq + 50 concurrent, p95<500ms, commit 442e90b
- P7.4 — Final build gate + commit d8ea372 + push v7-dev — DONE
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
- `node scripts/test-credparse.js` → **16/16 PASS**. Shape 1 (array), Shape 2 ({accounts:[...]}), Shape 3 (single object) all parse to identical normalized output ({email, provider, displayName, status}). Invalid gmail (missing refresh_token), invalid smtp (missing pass), invalid email format all flagged with `status:"invalid"` + `invalidReason` — never dropped. `detectProvider` infers gmail/outlook/smtp from field shapes + email domain. `validateSender` does provider-specific sanity checks (gmail: refresh_token+client_id+client_secret or installed/web config block; outlook: client_id+client_secret+refresh_token; smtp: host+port+user+pass + port range 1-65535).

### P3.2 — Capability Probe
- `node scripts/test-capability.js` → **18/18 PASS**. Static capability table correct per provider: gmail (no spoofing, dynamic routing, 20 aliases, 500/day), outlook (no spoofing, no dynamic routing, 1 alias, 300/day), smtp (spoofing yes, dynamic routing yes, 50 aliases, 1000/day). Cache path exercised: sender with fresh `probedAt` returns `fromCache:true` without re-probing. `needsReprobe` returns true for null/missing/8-day-old probes. Live probe hook with mocked verifier overrides static caps; verifier throwing → graceful null (S5 reliability); live mode OFF → null overrides (static table stands). `probeSenders` batch resolves all. `CAPABILITY_PROBE_TTL_MS` = 7 days. MongoDB persistence guarded by connection-state check (skips when not connected → no 10s buffering timeout).

### P3.3 — Rotation Strategy
- `node scripts/test-rotation.js` → **26/26 PASS**. **ACCEPTANCE (a)**: 50 resolves against a 5-sender spoofing pool with anti-repeat window K=4 → **zero repeats within K consecutive sends** (0 violations); all 5 senders used (good distribution); mode=ROTATE_POOL. Non-spoofing pool → LOCK_MAIN mode. **ACCEPTANCE (b)**: LOCK_MAIN returns primary email 10/10 times. `computeAntiRepeatK(5)=4`, `(25)=20` (capped), `(1)=0`, honors override. `determineMode`: all-spoofing→ROTATE_POOL, non-spoofing→LOCK_MAIN, single sender→LOCK_MAIN, mixed→LOCK_MAIN (ALL must be capable), explicit mode overrides auto. Jitter always in [0,1500] (crypto-secure `secureRandomInt`). `dryRunResolve` returns 10 combos in ROTATE_POOL with ≥3 unique emails; LOCK_MAIN dry-run returns primary for all 10. `buildSenderPool` only adds new senders (preserves LRU scores). `refillRoutePool` from source generator. `getPoolStats` returns pool sizes + last 20 audit entries. `getRoutingConfig`/`setRoutingConfig` work in fallback. Audit record has sendId, campaignId, fromEmail, fromName, subjectRouteId, mode, jitterMs.
- **Bug fix**: `MemoryFallback.incr()/incrby()` had a key-prefix mismatch (`_cleanKey(key)` vs `_raw(key)`) causing the counter to always return 1 — fixed, all P1 tests re-verified (redis-swap 30/30, atomic 18/18, mapping 9/9).

### P3.4 — Routing API Routes
- `POST /api/routing/config` → validates campaignId/mode/antiRepeatWindow[0-20]/jitterMaxMs[0-5000]/primaryEmail; persists to `routing_configs` (upsert); rebuilds Redis route pools from provided senders (probes capabilities); returns saved config + pool stats. Auth-gated via `requireAdmin`.
- `GET /api/routing/config?campaignId=` → returns current config + pool stats (pool sizes + last 20 audit entries). Auth-gated.
- `POST /api/routing/test` → dry-run: validates count[1-100]; populates route:senders/names/subjects pools from body if provided; resolves N routes WITHOUT sending; returns combos + uniqueness analysis (uniqueEmails/names/subjects). Auth-gated.
- Build gate: `node init-configs.js && npx next build --webpack` → **BUILD_EXIT=0**. Both routes registered (`/api/routing/config` ƒ dynamic, `/api/routing/test` ƒ dynamic).

### Post-P3 audit-fix (S2/S5 self-audit pass)
- **Math.random eliminated from security-critical lock tokens**: `src/lib/redis/atomic.js` `withLock` and `src/lib/redis.js` `acquireMutex` previously used `Math.random` for the lock-owner token — replaced with `crypto.randomBytes(16).toString('hex')` (cryptographically unpredictable). All P1 tests re-verified after the fix (atomic 18/18, redis-swap 30/30).
- **TFN generator hardened for uniqueness**: `src/lib/tagEngine/generators/tfn.js` upgraded to derive digits 0-6 and digit 8 from an HMAC-SHA256 of the context (recipientEmail + campaignId + salt + index) so that distinct contexts yield distinct TFNs with overwhelming probability while preserving checksum validity and 9-digit "XXX XXX XXX" format. Test adjusted to 500-value uniqueness (the 9-digit + checksum constraint yields ~10^8 effective space, making 10k-birthday collisions mathematically inevitable; the script mandates 10k-duplicate tests only for INVOICE/SNUMBER/HELPDESK/ORDERID which have arbitrarily large entropy). Generators test 21/21 PASS across 8 consecutive runs (deterministic).
- **Final full test suite**: 12 scripts, 247 assertions, 0 failures (atomic 18, pools 11, redis-swap 30, auth 16, sanitize 43, registry 22, generators 21, mapping 9, applier 17, credparse 16, capability 18, rotation 26).
- **Final build gate**: `node init-configs.js && npx next build --webpack` → **BUILD_EXIT=0**.
- **S2 scan**: zero TODO/FIXME/placeholder/stub in all V7 P0-P3 files. Zero `Math.random` in V7 files (pre-existing `core.js` AI-pool generation is Account 2 P4 scope + S3 preserve item). Zero `require()` in V7 ESM files. Every API route auth-gated via `requireAdmin`.

### P4 — Background AI Engine v2 (never-starve) — Account 2
- `node scripts/test-aipool.js` → **19/19 PASS**. AI pool model on Redis (`engine.js` + `aiPool.js` facade). Body/subject/sender-name pools backed by `src/lib/redis/pools.js` primitives (ZSET sorted sets). Pool count, push, pop-fresh, drain-refill all verified. MemoryFallback ring buffer active when Redis down. Singleton worker pattern.
- `node scripts/test-restock.js` → **26/26 PASS**. Restock worker (`restockWorker.js`): 60s cycle, key rotation, per-key cooldown, `allKeysCooldownUntil` global cooldown. Singleton lock prevents double-run. `getRestockStatus()` returns lastRunAt/lastRunResult/intervalMs/keyCooldownMs/keyState. Graceful when Gemini API unavailable (retry with backoff).
- `node scripts/test-autofill.js` → **26/26 PASS**. Sender auto-fill + auto-rotate (`autoFill.js`): detects low sender pool, triggers restock, rotates primary sender. AI quota enforced via `incrWithCeiling`. God-Mode AI quota toggle integrated with P5 toggle registry. Circuit breaker integration (`getCircuitState` per account).
- Build gate PASSED. Commit eff7f92. Pushed v7-dev.

### P5 — God-Mode Matrix v2 + Package Manager — Account 2
- `node scripts/test-toggles.js` + `node scripts/test-packages.js` → **56/56 PASS** combined.
- **P5.1 Toggle registry** (`src/lib/toggles/registry.js`): server-authoritative God-Mode toggles. FeatureToggle model (singleton doc). API routes `/api/toggles` + `/api/admin/toggles`. Toggles stored in MongoDB `featuretoggles` collection, cached in Redis with 5s TTL. UI only reflects server state.
- **P5.2 Package manager** (`src/lib/packages/manager.js`): per-user package quotas. `userpackages` collection (unique index on userId). Quota enforcement via `atomic.incrWithCeiling('package:{userId}:sent', ceiling)`. API routes `/api/packages` + `/api/admin/packages`. Package shape: { packageName, dailyLimit, monthlyLimit, features[] }. `force-dynamic` on all routes.
- **P5.3 Performance**: Redis-atomic quota checks, zero N+1 queries (single-doc reads), `export const dynamic = 'force-dynamic'` on all new routes to prevent static prerender of admin data.
- Build gate PASSED. Commit e99029c. Pushed v7-dev.

### P6 — Completeness Sweep — Account 2
- `node scripts/test-validator.js` → **63/63 PASS**. **P6.1 Validator pipeline** (`src/lib/validate/pipeline.js`): RFC syntax check (email regex), duplicate detection (within campaign), bounce-risk scoring (pattern-based), blacklist check, grade score (0-100). Server numbers FINAL — UI only displays. 1000-address recount matches exactly (no silent drops).
- `node scripts/test-sandboxes.js` → **70/70 PASS**. **P6.2 4 sandbox isolation**: 4 Campaign Sandbox environments (A/B/C/D) verified zero cross-talk. Each sandbox has isolated state (separate Redis key prefixes, separate campaign configs, separate sender pools). No data leaks between sandboxes.
- `node scripts/test-zerocrash.js` → **100/100 PASS**. **P6.3 Zero-crash**: zero TODO/FIXME/placeholder/stub in all V7 P4-P6 files. `sendGuard` wrapper catches all dispatch errors and logs to ledger without crashing the process. Every async function has try/catch.
- `node scripts/test-smallthings.js` → **86/86 PASS**. **P6.4 Small things sweep**: ledger completeness verified (all send events recorded), edge cases (empty recipient list, null campaign, missing tokens), idempotency on retry. Build gate PASSED. Commit 6562502. Pushed v7-dev.

### P7 — Performance & Reliability Hardening — Account 2
- `node scripts/test-observability.js` → **66/66 PASS**. **P7.1 Observability**:
  - `src/lib/observability/health.js` — health aggregator for 6 subsystems (db, redis, queue, aiPools, restock, circuitBreakers). Each check has 3s `withTimeout` to prevent MongoDB hang. Status: 'healthy'|'degraded'|'unhealthy'. Critical = db+redis.
  - `src/lib/observability/metrics.js` — Redis ZSET time-series for 24h-windowed throughput + p95 latency. `recordLatency(route, ms)` → ZSET `obs:latency:api`. `recordSendEvent(status, mode)` → ZSET `obs:sends`. `getThroughput24h()` returns {sent, failed, total, failureRate, failureBreakdown}. `getP95Latency24h()` returns {p95, sampleCount, perRoute:{route:{count,p95,avg}}}. MemoryFallback ring buffers (max 5000 latency / 10000 sends).
  - `src/app/api/system/health/route.js` — public health endpoint (200 healthy/degraded, 503 unhealthy).
  - `src/app/api/system/metrics/route.js` — admin-only metrics endpoint (requireAdmin gate, 401 if not admin). Collects throughput + p95 + circuit breaker states + lifetime counters.
  - p95 correctness verified: p95 of 1..20 = 19, p95 of 1..100 = 95.
  - Commit 0eff394. Pushed v7-dev.
- **P7.2 Indexes audit** (`docs/INDEX_REPORT.md`): full index inventory — 26 indexes across 11 collections, 3 TTL indexes (deliveryreports, tag_maps, routing_audits). Audited all 10 P4-P6 modules: only 1 new MongoDB collection (`userpackages`, already has unique index on userId). Added 2 explicit indexes to `scripts/mongo-indexes.js` (userId_unique, packageName). 0 missing indexes. All other P4-P6 modules use Redis for ephemeral state or are pure functions. Commit 0aa5720. Pushed v7-dev.
- `node scripts/smoke-load.js` → **PASS exit 0**. **P7.3 Load smoke test**:
  - Phase 1: 200 sequential campaign-resolve calls (poolPushRoute/poolCountRoute/poolMembersRoute) — 200/200 success, 0 errors, p95=0ms.
  - Phase 2: 50 concurrent tag previews (buildRecipientMap/generateSendAttemptId/applyTags) — 50/50 success, 0 errors, p95=3ms.
  - Both phases well under 500ms p95 target.
  - **Bug fix**: `tagRegistry.listCustomTags()` was hitting MongoDB with 10s timeout when cache empty. Added `mongoose.connection.readyState !== 1` fast-fail guard → returns from cache or empty array without DB call. After fix: p95=3ms (was 10014ms).
  - Commit 442e90b. Pushed v7-dev.
- **P7.4 Final build gate**: `node init-configs.js && npx next build --webpack` → **BUILD_EXIT=0**. Commit d8ea372. Pushed v7-dev (6562502..d8ea372).

---

### P8 — VIP UI Max Polish — Account 3
- **P8.1 Design System** (`src/lib/ui/theme.js`): centralized design tokens — SURFACE (panel/elevated/inset/modal), ACCENT (violet/cyan/emerald/amber/rose/sky), RADIUS (sm/md/lg/xl/2xl/3xl/full), glow shadows, typography scale, transition timings. Zero hardcoded hex in components — all consume tokens via `cx()` helper. `globals.css` design-system layer: CSS custom properties mapped to tokens, keyframes (fadeIn/scaleIn/slideDown/shimmer/pulse-glow), `@media (prefers-reduced-motion)` skip. Build gate EXIT=0.
- **P8.2 Pill Hardening** (`TagPickerModal.jsx`, `insertion.js`, `icons.jsx`): shared icon set (`icons.jsx`, `_svg` factory pattern inside `Icon = {...}` object — NOT separate exports). Full keyboard nav (ArrowUp/Down/Left/Right/Home/End/Enter/Tab), ARIA (role=listbox, aria-selected, aria-label), `insertAtCursor` preserved (cursor-aware via native setter + `setSelectionRange` + rAF focus restore), `data-tag-target` attrs on subject/body inputs. Wired into UserPanel. Build gate EXIT=0.
- **P8.3 Editor Lock** (`EditorArea.jsx`): 480px hard lock from GRID constant (style height + maxHeight + overflowY), local mirror state + 180ms debounce sync (flush on Enter/blur/paste), live char/token count via rAF, scrollTop preserve/restore on re-render, smart scroll. `data-camp-body` forwarded via rest props. Build gate EXIT=0.
- **P8.4 Micro-interactions** (`Toast.jsx`, `Skeleton.jsx`, `PageTransition.jsx`): `useToastStack` + `ToastStack` (stack/auto-dismiss 4s/ARIA live regions/exit animation). `Skeleton`/`SkeletonText`/`SkeletonCard`/`SkeletonList`/`SkeletonStatGrid` (shimmer via CSS gradient). `PageTransition`/`StaggerList`/`StaggerItem` (keyed fade-in + staggered children). Wired: toast stack replaces inline toasts, DashboardTab skeleton grid, tab content wrapped in PageTransition. Removed redundant inline keyframes. Build gate EXIT=0.
- **P8.5 Visual Consistency**: `AdminPanel.jsx` imports `theme.js` tokens (SURFACE/ACCENT/RADIUS/cx). Both panels use `v7-mesh-bg` animated gradient mesh. AdminPanel sidebar `v7-glass-inset` + SURFACE.panel, header `v7-glass-card`. Login screens mesh-bg. UserPanel dashboard + login mesh-bg. Shared `#0B0F19` base. Build gate EXIT=0. Commit 0711047. Pushed v7-dev (503d947..0711047).

### P9 — USER PANEL MAX+++++++ HARDCORE UPGRADE — Account 3
- **P9.1 Orchestrator** (`Orchestrator.jsx`): 3-zone command deck (Audience / Message Studio / Live Intel). AI Composure Coach — live client-side heuristic `scoreComposure` (length/tokens/spam-words/caps/subject/structure/CTA), score ring (SVG arc) + grade + actionable tips. Body Lab A/B — side-by-side scoring, winner crown, promote-to-primary. View toggle (classic | orchestrator) in CampaignEditor header. Build gate EXIT=0.
- **P9.2 Living Dashboard** (`LivingDashboard.jsx`): `useCountUp` (rAF easeOutCubic, reduced-motion skip to instant), `LiveCounter` (animated tabular-nums), `LivePulse` (LIVE dot with pulse), `useLivePoll` (interval polling hook with cleanup). LivingDashboard grid (sent/remaining/today/delivery%). Wired into DashboardTab top. Build gate EXIT=0.
- **P9.3 Mission Control** (`MissionControl.jsx`): cinematic 4-step modal (Audience Lock-In / Message Review + AI Verdict / Throttle Dial / Launch Go-No-Go). `StepIndicator` progress dots. AI verdict conic-gradient ring. Throttle speed modes + estimated send time. 7-item pre-flight checklist all-green gate. `SendWaveViz` animated bars + progress. Pause/resume wired to threshold engine. LAUNCH button gated (disabled until all checks pass). `v7-primary-glow` CSS on LAUNCH. Build gate EXIT=0.
- **P9.4 Delivery Center** (`DeliveryCenter.jsx`): per-campaign breakdown (sent/delivered/failed/rate). Drill-down per-recipient ledger with search + status filter. RFC-4180-safe CSV export via Blob download (`csvEscape` quotes/commas/newlines). Bounce-reason clustering (`ERROR_REASON_MAP` — Twilio-style codes 21211/21612/21614/21610/30001-30008 + auth/timeout/rate_limit → human labels, grouped counts + example numbers). Credential health cards (`CredentialHealthCard` — capacity bar/threshold %/status pill/Test Send probe via `/api/system` `testSenderApi` with graceful admin-only fallback). `RateRing` SVG. `EmptyDeliveryState`. `STATUS_PILL` mapping object for static Tailwind classes. Wired into ReportsTab slot with `thresholdStatus` + `onResumePaused` props preserved. Build gate EXIT=0.
- **P9.5 Premium Visual Language** (`EmptyState.jsx`): preset catalog (campaigns/reports/inbox/templates/credentials/search/generic) — each with icon, accent, glow color, title, Bangla/English nudge. Illustrated concentric-ring icon composition + soft glow + optional CTA button. `ACCENT_RING` mapping object for static Tailwind classes. Wired into campaign-list + inbox empty states. `.v7-primary-glow` CSS (hover-intensify cyan+violet glow, active scale 0.985 — reserved for flagship CTAs only) applied to MissionControl LAUNCH button. Glassmorphic panels + animated gradient mesh + shared icon set + skeleton/shimmer all from P8. Build gate EXIT=0.
- **P9.6 Power-user Layer**: `CommandPalette.jsx` (Ctrl+K/Cmd+K fuzzy search — `fuzzyScore` substring + character-sequence match across tabs + campaigns + actions, keyboard nav ArrowUp/Down/Enter/Esc, grouped results by group label, backdrop + glass panel z-80, scroll-into-view via `data-cp-idx`). `useKeyboardShortcuts.js` hook (N=new campaign, 1-4=tab switch, Space=pause/resume toggle, /=search; ignores typing in INPUT/TEXTAREA/contenteditable except Ctrl+K; ignores Alt modifier; all wrapped in try/catch). `BottomNav.jsx` (native fixed bottom-nav for ≤1024px, max 5 items, active-state pill with cyan glow, safe-area-inset-bottom for iOS/Android home indicator, `lg:hidden`, aria-label + aria-current). Wired: palette state + commands + shortcuts in UserDashboard, BottomNav replaces horizontal tab-bar, content `pb-24` on mobile. Build gate EXIT=0.
- **P9.7 Trust & Transparency Surface** (`TrustScore.jsx`): three components — `TrustScore` (5-step validator ring chart SVG arc + per-step pass/fail breakdown; `STEP_META` array with 5 steps syntax/dedup/bounce/blacklist/grade; trust score = passRate*0.6 + spamSafe*0.4 from server numbers only; tier success≥80/warning≥50/danger; spam signals as pills), `ConfirmDialog` (double-confirm with type-to-confirm gate, Escape to cancel, z-90, resets on open), `QuotaNotice` (renders server's Bangla quota-exceeded message VERBATIM via `whitespace-pre-wrap` — never altered; falls back to clean Bangla default; recovery nudge button). Wired: TrustScore card after bounce results in CampaignEditor, ConfirmDialog rendered in CampaignEditor return + native `confirm()` replaced with `requestDelete()`, QuotaNotice in `limitExhausted` block with `onRefreshThreshold` recovery nudge. Build gate EXIT=0.
- **Final build gate after P9**: `node init-configs.js && npx next build --webpack` (clean `rm -rf .next` first) → **BUILD_EXIT=0**. Commit 8027938. Pushed v7-dev (0711047..8027938).
- **S2 self-audit scan**: zero TODO/FIXME/stub in all P8-P9 files (the word "placeholder" appears only as legitimate HTML `placeholder=""` attributes + one color-token comment). Zero `Math.random` in P8-P9 files. Zero `require()` in P8-P9 ESM files. Every P9 component has try/catch error boundaries.
- **PRESERVE LIST verified intact**: Account 3 touched only `UserPanel.jsx` + `globals.css` + 9 new P9 component files. Zero backend PRESERVE files modified (`core.js`, `registry.js`, `sandbox/isolation.js`, `engine.js`, `route.js` untouched). 4 Campaign Sandboxes (A/B/C/D) isolation in `src/lib/sandbox/isolation.js` intact. God-Mode toggles in `registry.js` intact. AI Pool + restock engine intact. Threshold resume system props contract preserved (`thresholdStatus`, `onResumePaused`, `resumeFrom`). Server-authoritative validator pipeline preserved (UI displays server numbers only — TrustScore uses `bounceResults`/`spamPreview` from server). Tag Pills + `insertAtCursor` + `data-tag-target` preserved. 480px editor lock preserved. `PANEL_MODE` switch intact. Accounts 1-2 backends untouched.

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

### Account 2 style
- **Mirrors Account 1 exactly**: same module layout (`src/lib/<domain>/<file>.js`), same ESM-only convention, same Redis client singleton pattern, same MongoDB model registration pattern, same crypto-only randomness, same try/catch error handling. No deviations.
- **AI engine modules** live in `src/services/ai/` (engine.js, restockWorker.js, circuitBreaker.js) — NOT in `src/lib/`. When importing these from `src/lib/` files, use **relative paths** (`../../services/ai/engine.js`) because the `@/services/*` alias in jsconfig.json maps to the OLD `services/` directory (not `src/services/`). The `@/lib/*` alias works correctly for `src/lib/` imports.
- **Observability pattern**: time-series metrics use Redis ZSET (score=timestamp, member="ts:value:route"). 24h sliding window via `ZRANGEBYSCORE`. MemoryFallback uses `globalThis.__obs<Name>Buf` ring buffers (bounded, FIFO eviction). Health checks wrapped in `withTimeout(promise, 3000, label)` (Promise.race vs setTimeout) to prevent 10s MongoDB hangs in serverless/sandbox environments.
- **Graceful degradation**: every subsystem check returns a structured object with a `reachable: boolean` field. `getHealth()` uses `Promise.all` (not `allSettled`) so all checks run in parallel; a failed check sets its subsystem to `reachable:false` but does not crash the aggregator. Status logic: both db+redis down → 'unhealthy'; one critical down → 'degraded'; all up → 'healthy'.
- **Test runner**: `scripts/run-test.mjs` sets `MONGODB_URI` with 1s timeout + `REDIS_URL=''` BEFORE importing tests. `scripts/alias-loader.mjs` maps `@/*` → `src/*` and `next/server` → `next/server.js` for dynamic imports. Test scripts use `from '@/lib/...'` imports (alias works in `src/lib/`). MongoDB-dependent functions get `connection.readyState !== 1` fast-fail guards to avoid 10s hangs.

### Account 3 style
- **Mirrors Accounts 1-2 exactly**: same ESM-only convention (import/export, never `require()`), same `src/lib/<domain>/<file>.js` + `src/components/userpanel/*.jsx` layout, same crypto-only randomness (zero `Math.random` in new files), same try/catch error handling with meaningful messages, same camelCase functions / PascalCase components / UPPER_SNAKE constants.
- **Component pattern**: every new component is a default-exported React function (or named exports for multi-component files like `TrustScore.jsx`). Props are destructured in the signature with defaults. Each component wraps its render body in try/catch returning a graceful fallback (null or minimal state) — zero-crash UI law. Shared icon set via `Icon.<Name>` from `icons.jsx` (icons defined inside `const Icon = {...}` using `_svg()` factory — NOT separate exports).
- **Tailwind v4 dynamic-class law**: `bg-${accent}-500/15` does NOT work with JIT compilation. Every accent-dependent className uses a static mapping object (e.g. `STATUS_PILL`, `ACCENT_RING`, `C` color maps) with pre-written full class strings. Never interpolate color names into Tailwind classes.
- **Design tokens**: all colors/radii/shadows come from `src/lib/ui/theme.js` tokens consumed via the `cx()` class-joiner. Zero hardcoded hex in component files. CSS custom properties in `globals.css` map to tokens. Glassmorphic surfaces use `v7-glass-card` / `v7-glass-inset` / `v7-glass-modal` utility classes. Animated gradient mesh via `v7-mesh-bg`.
- **Server-authoritative UI law**: the UI NEVER invents its own validation numbers, trust scores, or quota states. `TrustScore` computes its ring from server-provided `bounceResults` + `spamPreview` only. `QuotaNotice` renders the server's Bangla message VERBATIM (`whitespace-pre-wrap`, never rewritten) and falls back to a clean default only when the server sends no message. God-Mode toggles are reflected from `/api/toggles` — never set client-side.
- **Accessibility**: ARIA roles/labels on all interactive surfaces (role=dialog, aria-modal, aria-label, aria-live for dynamic updates, aria-current on active nav). Keyboard navigation on TagPickerModal (ArrowUp/Down/Enter/Esc/Home/End) and CommandPalette (ArrowUp/Down/Enter/Esc). `prefers-reduced-motion` respected in `useCountUp` (skips rAF animation).
- **File sizing**: new component files target 8-15 KB. Feature-dense single-responsibility components (DeliveryCenter 36KB with full ledger+CSV+clustering, MissionControl 20KB with 4-step cinematic flow) exceed the guideline but remain cohesive — each has one clear responsibility, full error boundaries, and no dead code.
