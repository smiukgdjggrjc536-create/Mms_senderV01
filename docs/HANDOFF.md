# V7 HANDOFF — Account 1 → Account 2

> The bible for the next account. Read this BEFORE touching anything. Also read `docs/PROGRESS.md` (phase table + acceptance evidence) and `ACCOUNT_2_ENGINE_V7.txt` (your script).

---

## Current state
- Branch: `v7-dev` (created from `main`; pushed to origin). `main` untouched. An old `v6-dev` branch exists — ignore, do not merge/delete.
- Account 1 completed **P0–P3**: Foundation, Security Fortress, Redis-Atomic Core, Tag Engine core, Routing core. All pushed to `v7-dev`.
- Build gate passes: `node init-configs.js && next build --webpack` (use `npx next` / `npm run build` in sandboxes where `next` is not on PATH) → exit 0.
- Baseline build (untouched tree) was exit 0 — recorded as the reference truth.

## Decisions made
1. **Redis client singleton**: a new shared client lives at `src/lib/redis/client.js` (P1.3). The legacy `src/lib/redis.js` (with its in-memory `MemoryShim` + `getRedis`/`acquireMutex`/cache/dynamic-config/metrics helpers) is PRESERVED — existing services still import from it. New P1.3+ code imports the atomic primitives from `src/lib/redis/atomic.js` and the pool primitives from `src/lib/redis/pools.js`, which internally use the same shared connection. Do NOT delete `redis.js`; extend additively.
2. **Threshold pause/resume**: the existing MongoDB-backed threshold system (`checkCredentialThreshold`, `pauseCredentialAtThreshold`, `resetCredentialThreshold`, `getThresholdStatusForUser` in `src/lib/core.js`) is PRESERVED. P1.4 adds a Redis-atomic mirror (`cred:{id}:sent` / `cred:{id}:window_start` / `cred:{id}:paused`) used as the live counter, with MongoDB as the durable store. The `thresholdStatus` props flow to `UserPanel.jsx` is NOT broken.
3. **Token bucket**: `src/services/queueEngine.js` `checkTokenBucket` previously used `cacheGet/cacheSet` (Redis-backed already). P1.4 swaps it to `redisTokenBucket` (Lua atomic) from `atomic.js` for true atomicity. Signature preserved.
4. **Rate limiter**: `src/lib/sendingEngine.js` `checkRateLimit`/`recordRateHit` were an in-memory `Map` (`rateWindows`). P1.4 swaps to `redisRateLimit` from `atomic.js`; the exported function signatures (`checkRateLimit(apiId, perMinute, perHour)`, `recordRateHit(apiId)`) are kept so `core.js:1365/1390` call sites stay unchanged.
5. **Vault**: `src/lib/security/vault.js` + `scripts/vault-cli.js` (AES-256-GCM, scrypt KDF, master key from `CRED_MASTER_KEY` env). Provider credentials loaded at runtime via `vault.decrypt()`; plaintext never on disk unencrypted.
6. **Auth**: `src/lib/auth.js` (new) holds the hardened login flow (timing-safe bcrypt, Redis lockout, JWT issuer/audience, login rate limit, `requireAdmin`). `src/lib/core.js` re-exports/uses these so existing routes keep working.
7. **No new runtime deps added** except what was already in package.json. zod was NOT added (explicit validation in `sanitize.js` instead) — if Account 2 wants zod it may add it to dependencies (NOT devDependencies, per pitfall P4).
8. **Tag engine**: 17 built-in tokens (`#NAME# #EMAIL# #INVOICE# #SNUMBER# #TFN# #DATE# #HELPDESK# #ORDERID# #TRACKING# #AMOUNT# #DUE# #CITY# #ZIP# #PHONE# #COMPANY# #RANDOM# #UUID#`). Custom tags in MongoDB `custom_tags`. Token regex `/#([A-Z0-9_]+)#/g`.
9. **Routing**: `ROTATE_POOL` (all senders support spoofing/dynamic routing → Redis pools `route:senders:<campaignId>`, `route:names:<campaignId>`, `route:subjects:<campaignId>`) vs `LOCK_MAIN` (primary API email). Anti-repeat window K = min(poolSize-1, 20). Jitter 0–1500ms. Audit in MongoDB `routing_audit` (TTL 30d). Config in `routing_configs`.

## Remaining steps (Account 2 — P4–P7)
- **P4 — Background AI Engine v2 (never-starve)**: AI body/subject/name pools at 50k+ per pool, 60s restock cycle, key rotation. Build on `src/lib/redis/pools.js` primitives (`poolPush`, `poolPopFresh`, `poolCount`, `poolDrainRefill`). **Contract points you must wire:**
  - Feed the name pool into Redis sorted set `route:names:<campaignId>` (consumed by `resolveSenderRoute` in `src/lib/routing/rotationStrategy.js`).
  - Feed the subject pool into `route:subjects:<campaignId>`; final subject text resolution happens at dispatch time — `rotationStrategy.resolveSenderRoute` returns `subjectRouteId`; you resolve it to text in the send pipeline.
  - The send pipeline hook: `mappingEngine.buildRecipientMap(recipient, campaign, sendAttemptId)` produces the per-mail token→value map; `applier.applyTags(body, map)` renders it. Wire these into the actual dispatch path so each send is unique.
- **P5 — God-Mode Matrix v2 + Package Manager**: God-Mode toggles are server-authoritative (UI only reflects state). Package quotas enforced server-side using `atomic.incrWithCeiling(key, ceiling)` from `src/lib/redis/atomic.js` — returns false at ceiling. PRESERVE the existing God-Mode toggles and FeatureToggle model; extend additively.
- **P6 — Completeness Sweep**: validator pipeline (RFC syntax, duplicates, bounce-risk, blacklist, grade score — server numbers FINAL), 4 sandbox isolation (zero cross-talk), zero-crash send path. PRESERVE the server-authoritative validator pipeline and the 4 Campaign Sandbox environments.
- **P7 — Performance & Reliability Hardening**: <300ms API, Redis-atomic, zero N+1. The big queries in `src/app/api/system/route.js` (~158KB, 107 actions) already got projection+limit in P1.5 — continue auditing.

## Known risks
- `src/app/api/system/route.js` is a ~158KB monolith with 107 actions on ONE route. P1.5 added projection+limit to unbounded `find()`s, but it remains a hotspot. Account 2/3 should consider splitting additively (never break the existing action names).
- `AdminPanel.jsx` (~292KB) and `UserPanel.jsx` (~256KB) are monoliths — Account 3 owns the UI hardening; do not break the `thresholdStatus` props contract or the Tag Pill / `insertAtCursor` / 480px editor lock.
- `init-configs.js` materializes `config-database.js` / `config-gemini.js` / `config-sending.js` at build time (gitignored). It MUST run before every build (pitfall P5). The DB URI inside `config-database.js` defaults to `mongodb://localhost:27017/sms_campaign_db` — production uses `MONGODB_URI` env at runtime via `connectDB` in `core.js`.
- Disk on the build sandbox was ~64% full at baseline (script warned ~90%). If a build OOMs or hits disk pressure: `rm -rf .next` and rebuild (pitfall P6).
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
- **L9 STYLE**: mirror this account's STYLE LOG in `docs/PROGRESS.md` exactly.

## Files created by Account 1 (new)
- `docs/PROGRESS.md`, `docs/HANDOFF.md` (this file)
- `src/lib/security/vault.js` — `export function encrypt(obj)`, `export function decrypt()`, `export function loadCredentials()`
- `scripts/vault-cli.js` — CLI: `set <key> <value>` / `get <key>` / `list`
- `src/lib/auth.js` — `export async function hardenedLogin(username, password, apiKey)`, `export function requireAdmin(req)`, `export async function checkLoginRateLimit(ip)`, `export async function recordFailedLogin(username)`, `export async function isLockedOut(username)`, JWT helpers
- `src/lib/redis/client.js` — `export function getRedisClient()`, `export function isRedisLive()`
- `src/lib/redis/atomic.js` — `export async function withLock(key, ttlMs, fn)`, `export async function incrWithCeiling(key, ceiling)`, `export async function redisRateLimit(key, limit, windowSec)`, `export async function redisTokenBucket(key, capacity, refillPerSec)`
- `src/lib/redis/pools.js` — `export async function poolPush(pool, item, score)`, `export async function poolPopFresh(pool, maxAgeMs)`, `export async function poolCount(pool)`, `export async function poolDrainRefill(pool, source, batchSize)`
- `src/lib/validate/sanitize.js` — `export function sanitizeApiInput(schema, payload)`, `export function stripNoSqlKeys(obj)`, per-endpoint validators
- `scripts/mongo-indexes.js` — creates indexes (users.email unique, campaigns.userId+createdAt, emails.campaignId+status, sent_logs.credentialId+ts TTL, tag_maps TTL, routing_audit TTL, custom_tags)
- `scripts/test-atomic.js`, `scripts/test-pools.js`, `scripts/test-generators.js`, `scripts/test-mapping.js`, `scripts/test-applier.js`, `scripts/test-credparse.js`, `scripts/test-rotation.js`
- `src/lib/tagEngine/tagRegistry.js` — `export const TAGS`, `export function resolveToken(body)`, `export async function registerCustomTag(...)`, `export async function listCustomTags(userId)`, `export async function deleteCustomTag(id, userId)`
- `src/lib/tagEngine/generators/{invoice,serial,tfn,helpdesk,date,orderid,tracking,amount,random,uuid,custom}.js` — each `export function generate(context)`
- `src/lib/tagEngine/mappingEngine.js` — `export async function buildRecipientMap(recipient, campaign, sendAttemptId)`, `export async function persistMap(sendId, map, ...)`
- `src/lib/tagEngine/applier.js` — `export function applyTags(htmlOrText, map)`
- `src/app/api/tags/route.js`, `src/app/api/tags/preview/route.js`
- `src/lib/routing/credentialParser.js` — `export function parseCredentialsJson(rawText)`, `export function validateSender(entry)`, `export async function persistSenders(parsed, userId)`
- `src/lib/routing/capabilityProbe.js` — `export async function probeSender(sender)`, `export async function getCachedCapabilities(senderId)`
- `src/lib/routing/rotationStrategy.js` — `export async function resolveSenderRoute(campaign, sendAttemptId)`, `export async function rebuildRoutingPools(campaignId)`, `export async function emitRoutingAudit(...)`
- `src/app/api/routing/config/route.js`, `src/app/api/routing/test/route.js`

## MongoDB collections created
- `custom_tags` { token, userId, rule, createdAt } — index token+userId unique
- `tag_maps` { sendId, campaignId, recipient, map, createdAt } — TTL 30 days on createdAt
- `routing_audit` { sendId, campaignId, fromEmail, fromName, subjectRouteId, mode, jitterMs, createdAt } — TTL 30 days
- `routing_configs` { campaignId, mode, antiRepeatWindow, jitterMaxMs, updatedAt }
- `senders` { email, provider, authFields, displayName, status, capabilities, probedAt, ownerId, createdAt }

## Redis key namespaces (Account 1)
- `mms_gw:lock:{key}` — distributed locks (withLock)
- `mms_gw:rl:{key}` — rate limit fixed windows (redisRateLimit)
- `mms_gw:tb:{key}` — token buckets (redisTokenBucket)
- `mms_gw:ceiling:{key}` — incrWithCeiling counters
- `mms_gw:lockout:{username}` — auth lockout (TTL 900s)
- `mms_gw:cred:{id}:sent` / `mms_gw:cred:{id}:window_start` / `mms_gw:cred:{id}:paused` — threshold live state
- `mms_gw:tag:seq:{campaignId}` — per-campaign send-attempt INCR sequence
- `mms_gw:route:senders:{campaignId}` — sender rotation pool (sorted set)
- `mms_gw:route:names:{campaignId}` — sender-name rotation pool (sorted set) ← Account 2 feeds this
- `mms_gw:route:subjects:{campaignId}` — subject rotation pool (sorted set) ← Account 2 feeds this

## Exact contract points Account 2 must wire
1. **Send pipeline hook**: in the dispatch path, call `buildRecipientMap(recipient, campaign, sendAttemptId)` then `applyTags(body, map)` and `applyTags(subject, map)` so every mail is unique. `sendAttemptId` = `tag:seq:{campaignId}` INCR + `crypto.randomBytes(8).toString('hex')`.
2. **AI pool feeds**: populate `route:names:<campaignId>` and `route:subjects:<campaignId>` sorted sets via `pools.poolPush`. `rotationStrategy.resolveSenderRoute` already pops from these with anti-repeat + jitter.
3. **Subject final resolution**: `resolveSenderRoute` returns `subjectRouteId`; resolve it to final subject text in the dispatch path (Account 2 owns the subject pool text).
4. **Quota ceilings**: package quotas via `atomic.incrWithCeiling('package:{userId}:sent', ceiling)` — returns `{ allowed: false }` at ceiling.
5. **Validator pipeline**: keep server-authoritative; UI only displays server numbers.
