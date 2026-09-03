# MMS Sender V01 — Bulk Email Sending Platform

Enterprise-grade bulk email-sending platform with a dual-panel architecture. One codebase, two deployments: **Netlify** (Admin Panel) and **Vercel** (User Panel), switched via a single build-time environment variable.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     ONE GitHub REPO                          │
│                  (main branch only)                          │
│                                                              │
│   NEXT_PUBLIC_PANEL_MODE=admin  ──►  Netlify (Admin Panel)   │
│   NEXT_PUBLIC_PANEL_MODE=user   ──►  Vercel  (User Panel)    │
│   NEXT_PUBLIC_PANEL_MODE=api    ──►  Render  (Headless API)  │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + React 19 |
| Styling | Tailwind CSS v4 + custom dark design system |
| Database | MongoDB via Mongoose (11 collections) |
| Cache/Queue | Redis (ioredis + BullMQ) with in-memory fallback |
| Auth | jose + bcrypt (hardened JWT, HS256, 12h expiry, Redis lockout) |
| Email | nodemailer (Gmail App Password) + raw fetch (Gmail OAuth2, Outlook Graph) + native net/tls (custom SMTP) |
| Security | AES-256-GCM credentials vault, crypto-only randomness for tokens/keys |

---

## Project Structure

```
Mms_senderV01/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/                  # REST API endpoints (31 routes)
│   │   │   ├── admin/            # Admin-only endpoints
│   │   │   │   ├── gateway/      # Email-to-MMS gateway engine
│   │   │   │   ├── packages/     # Package management
│   │   │   │   ├── system/       # Deploy hook, diagnostics, webhook
│   │   │   │   └── toggles/      # Feature toggle management
│   │   │   ├── auth/             # Gmail OAuth flow
│   │   │   ├── packages/         # Public package listing
│   │   │   ├── routing/          # Routing config + test
│   │   │   ├── system/           # Main action-based API (auth, campaigns, send)
│   │   │   ├── tags/             # Tag engine preview
│   │   │   ├── track/            # Open tracking pixel
│   │   │   ├── user/             # User Gmail connect
│   │   │   └── ...
│   │   ├── globals.css           # Global styles + design tokens
│   │   ├── layout.js             # Root layout
│   │   └── page.js               # Panel switch (admin/user/api)
│   │
│   ├── components/               # React UI components
│   │   ├── AdminPanel.jsx        # Admin panel (14 tabs, 4288 lines)
│   │   ├── UserPanel.jsx         # User panel (6 tabs + AI chat, 3075 lines)
│   │   └── userpanel/            # Hardened user panel sub-components (17 files)
│   │       ├── BottomNav.jsx
│   │       ├── CommandPalette.jsx
│   │       ├── DeliveryCenter.jsx
│   │       ├── EditorArea.jsx
│   │       ├── EmptyState.jsx
│   │       ├── LivingDashboard.jsx
│   │       ├── MissionControl.jsx
│   │       ├── Orchestrator.jsx
│   │       ├── PageTransition.jsx
│   │       ├── SendStudio.jsx
│   │       ├── Skeleton.jsx
│   │       ├── TagPickerModal.jsx
│   │       ├── Toast.jsx
│   │       ├── TrustScore.jsx
│   │       ├── icons.jsx
│   │       └── useKeyboardShortcuts.js
│   │
│   ├── lib/                      # Core library
│   │   ├── core.js               # Monolith: models, bulkSendEngine, auth, API actions
│   │   ├── auth.js               # Hardened JWT + lockout
│   │   ├── sendingEngine.js      # Send orchestration
│   │   ├── countrySupport.js     # Country deliverability data
│   │   ├── keepAlive.js          # Render/Netlify keep-alive ping
│   │   ├── redis.js              # Redis client + in-memory fallback
│   │   ├── gateway/              # Gateway constants
│   │   ├── i18n/                 # Bengali localization
│   │   ├── models/               # Mongoose schemas (6 models)
│   │   ├── observability/        # Health + metrics
│   │   ├── packages/             # Package manager
│   │   ├── redis/                # Redis modules (atomic, client, pools, threshold)
│   │   ├── resilience/           # Send guard (circuit breaker)
│   │   ├── routing/              # Credential parser, capability probe, rotation
│   │   ├── sandbox/              # Sandbox isolation
│   │   ├── security/             # AES-256-GCM vault
│   │   ├── tagEngine/            # Tag engine (generators, applier, mapping, registry)
│   │   ├── toggles/              # Feature toggle registry
│   │   ├── ui/                   # Theme tokens + insertion helper
│   │   ├── ux/                   # UX helpers
│   │   └── validate/             # Sanitize + pipeline validation
│   │
│   ├── models/                   # Mongoose model schemas
│   │   ├── aiPool.js
│   │   ├── carrierCache.js
│   │   ├── emailAccount.js
│   │   ├── featureToggle.js
│   │   ├── proxyConfig.js
│   │   └── systemConfig.js
│   │
│   ├── services/                 # Service layer
│   │   ├── ai/                   # AI engine (autoFill, engine, restockWorker)
│   │   ├── email/                # Email send chain
│   │   │   ├── senders/          # Provider senders (gmail, outlook, smtp, proxy)
│   │   │   ├── aiRewriter.js
│   │   │   ├── bounceHandler.js
│   │   │   ├── bulkSendEmailMms.js
│   │   │   ├── carrierLookup.js
│   │   │   ├── prepareEmail.js
│   │   │   ├── prepareMms.js
│   │   │   ├── queueRouter.js
│   │   │   └── safetyFilter.js
│   │   ├── aiPolymorph.js
│   │   ├── aiPool.js
│   │   ├── circuitBreaker.js
│   │   ├── hlrValidator.js
│   │   ├── prepareMms.js
│   │   ├── proxyRouter.js
│   │   ├── queueEngine.js
│   │   └── rateLimiter.js
│   │
│   └── instrumentation.ts        # Next.js instrumentation hook (keep-alive)
│
├── scripts/                      # Utility + test scripts (V7 quality system)
│   ├── alias-loader.mjs          # ESM alias loader for tests
│   ├── mongo-indexes.js          # MongoDB index creation
│   ├── run-test.mjs              # Test runner wrapper
│   ├── set-tier.js               # User tier management
│   ├── smoke-load.js             # Load testing
│   ├── vault-cli.js              # Credentials vault CLI
│   └── test-*.js                 # V7 quality test suite (22 files)
│
├── tests/                        # Static analysis + regression tests
│   ├── tdz_scanner.cjs           # AST-based TDZ risk scanner
│   ├── tdz_scanner.py            # Python TDZ scanner
│   ├── dupkey_scanner.cjs        # Duplicate-key scanner
│   └── test-mail-tdz-regression.cjs  # TDZ fix regression test
│
├── public/                       # Static assets
├── .env.example                  # Environment variable template
├── .gitignore
├── init-configs.js               # Build-time config generator
├── jsconfig.json                 # Path aliases (@/ → ./src/*)
├── netlify.toml                  # Netlify deploy config (admin panel)
├── next.config.mjs               # Next.js configuration
├── package.json
├── postcss.config.mjs
└── vercel.json                   # Vercel deploy config (user panel)
```

---

## Deployment

### Netlify — Admin Panel

| Setting | Value |
|---------|-------|
| Build command | `npm run build` |
| Environment | `NEXT_PUBLIC_PANEL_MODE=admin` |
| URL | https://precious-beijinho-eae5dd.netlify.app |

### Vercel — User Panel

| Setting | Value |
|---------|-------|
| Build command | `npm run build` |
| Environment | `NEXT_PUBLIC_PANEL_MODE=user` |
| URL | https://mms-user-panel.vercel.app |

Both deployments auto-deploy on push to the `main` branch.

### Build Gate

```bash
node init-configs.js && npx next build --webpack
```

Must exit 0. The `init-configs.js` script generates `config-database.js`, `config-gemini.js`, and `config-sending.js` from templates (these are gitignored).

---

## Environment Variables

See `.env.example` for the full list. Critical ones:

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | HS256 JWT secret (64 hex chars) |
| `REDIS_URL` | Redis URL (falls back to in-memory if unset) |
| `NEXT_PUBLIC_PANEL_MODE` | `admin` / `user` / `api` |
| `NEXT_PUBLIC_SITE_URL` | Public site URL |
| `CRED_MASTER_KEY` | AES-256-GCM vault master key |

---

## Admin Panel (14 Tabs)

1. **Dashboard** — KPIs, live metrics, system health
2. **Gateway** — Email-to-MMS gateway configuration, accounts, proxies, logs, dispatch
3. **API Management** — Sender API keys, Gemini API pool management
4. **User Management** — User accounts, tiers, quotas
5. **Campaigns** — Campaign monitoring and control
6. **Scheduled Sends** — Scheduled campaign management
7. **Content** — Body templates, subject categories
8. **God Mode Matrix** — 31 God-Mode toggles for advanced control
9. **Alerts** — System alerts and notifications
10. **Sub-Admins** — Sub-administrator management (super admin only)
11. **Database** — Database maintenance and queries
12. **Logs** — Activity logs with filtering
13. **Security** — Security settings, lockout config
14. **Settings** — System configuration

## User Panel (6 Tabs + AI Chat)

1. **Dashboard** — Live animated counters, stats
2. **Send Email** — Campaign composer (SendStudio 3-zone single-screen)
3. **Deliverability** — Country support and carrier data
4. **Inbox & Auto-Reply** — Inbox monitoring and auto-reply rules
5. **Delivery Reports** — Delivery center with bounce analysis
6. **App Information** — App info and features
7. **AI Chat Popup** — AI assistant (floating)

---

## Testing

### V7 Quality Test Suite

```bash
node --experimental-loader ./scripts/alias-loader.mjs scripts/run-test.mjs scripts/test-<name>.js
```

Key test suites:
- `test-credparse.js` — Credential JSON parsing (16/16 pass)
- `test-atomic.js` — Redis atomic operations (18/18 pass)
- `test-redis-swap.js` — Redis/in-memory swap (30/30 pass)
- `test-auth.js` — Authentication flow
- `test-pipeline.js` — Validation pipeline
- `test-rotation.js` — Account rotation strategy
- `test-sandbox.js` — Sandbox isolation
- `test-sendguard.js` — Send guard / circuit breaker

### Static Analysis

```bash
node tests/tdz_scanner.cjs [files...]     # TDZ risk scanner
node tests/dupkey_scanner.cjs              # Duplicate-key scanner
node tests/test-mail-tdz-regression.cjs    # TDZ regression test
```

---

## Key Design Decisions

1. **Dual-panel from one repo** — `NEXT_PUBLIC_PANEL_MODE` switches between admin/user/api at build time. No separate codebases.
2. **Action-based API** — `/api/system` uses a single POST endpoint with an `action` field for all user/admin operations. Gateway endpoints are RESTful under `/api/admin/gateway/*`.
3. **Multi-tenant isolation** — Email accounts are isolated by `ownerId`. Shared accounts use `visibleToUsers: true` + `ownerId: null`.
4. **ESM-only** — All source uses `import/export`. No `require()` in production code.
5. **Crypto-only randomness** — `crypto.randomBytes`/`crypto.randomInt` for all security-critical code (tokens, keys, lock tokens). `Math.random` only in non-security paths (AI pool name generation).
6. **In-memory Redis fallback** — If `REDIS_URL` is unset, the system falls back to an in-memory shim (single-process only, not for production).
7. **Path aliases** — `@/*` maps to `./src/*` (see `jsconfig.json`).

---

## Maintenance Notes

- **Never commit** `config-*.js`, `.credentials.enc`, `.env*` (except `.env.example`) — these are gitignored.
- **After pulling**, run `node init-configs.js` to regenerate config files, then fill in placeholder values.
- **Sensitive credentials** were scrubbed from all committed docs in the V7 cleanup. Never hardcode passwords/API keys in source or docs.
- **Build gate** must pass before any deploy: `node init-configs.js && npx next build --webpack` → exit 0.
- **God-Mode Matrix** has 31 toggles — see `src/lib/toggles/registry.js` for the full list.
- **AI Pool** — managed via `src/services/aiPool.js` and `src/services/ai/` (engine, autoFill, restockWorker).
- **Tag Engine** — 12 generators in `src/lib/tagEngine/generators/` (amount, custom, date, helpdesk, identity, invoice, orderid, random, serial, tfn, tracking, uuid).
- **480px Editor Lock** — `src/components/userpanel/EditorArea.jsx` locks the editor width for consistent rendering.
- **Threshold Resume** — paused campaigns can be resumed via the Delivery Center.

---

## License

Proprietary — All rights reserved.
