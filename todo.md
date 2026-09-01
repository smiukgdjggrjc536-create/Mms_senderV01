# MMS SENDER V7 — Account 2 Execution Plan (P4–P7)

## P4 — Background AI Engine v2 (never-starve)
- [x] P4.1 Pool model on Redis (engine.js + aiPool.js facade + test-aipool.js) — 19/19 pass
- [x] P4.2 Restock worker (restockWorker.js + test-restock.js) — 26/26 pass
- [x] P4.3 Sender auto-rotate + auto-fill + God-Mode AI quota (autoFill.js + test-autofill.js) — 26/26 pass
- [x] P4.4 Build gate PASSED + commit eff7f92 + push v7-dev

## P5 — God-Mode Matrix v2 + Package Manager
- [ ] P5.1 Toggle registry (src/lib/toggles/registry.js)
- [ ] P5.2 Toggle API (GET/POST /api/toggles + /api/admin/toggles)
- [ ] P5.3 Package manager (src/lib/packages/manager.js + incrWithCeiling quota)
- [ ] P5.4 Package API + build gate + commit

## P6 — Completeness Sweep
- [ ] P6.1 Validator pipeline (src/lib/validate/pipeline.js)
- [ ] P6.2 4 sandbox isolation verification
- [ ] P6.3 Zero-crash (zero TODO/FIXME/placeholder/stub) verification
- [ ] P6.4 Small things sweep + build gate + commit

## P7 — Performance & Reliability
- [ ] P7.1 Observability (/api/system/health + /api/system/metrics)
- [ ] P7.2 Indexes audit (docs/INDEX_REPORT.md)
- [ ] P7.3 Load smoke test (scripts/smoke-load.js)
- [ ] P7.4 Build gate + final commit + push v7-dev

## Final
- [ ] Update PROGRESS.md + HANDOFF.md (Account 3 handoff)
- [ ] Tell operator: next = ACCOUNT_3_MASTERPOLISH_V7.txt
