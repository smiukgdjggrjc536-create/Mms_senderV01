# V7 Account 2 — SMS Handoff Script (short, copy-paste ready)

> এই ফাইলটি অপারেটর পরের একাউন্টকে SMS হিসেবে পাঠাবেন। নিচে `--- SMS START ---` থেকে `--- SMS END ---` পর্যন্ত অংশটুকু কপি করে পাঠাবেন।

---

--- SMS START ---

তুমি V7 প্রজেক্টের Account 2 (ENGINE)। তোমার কাজ P4-P7।

REPO: github.com/smiukgdjggrjc536-create/Mms_senderV01.git
BRANCH: v7-dev (main স্পর্শ করা নিষেধ; v6-dev ইগনোর)
তোমার স্ক্রিপ্ট: ACCOUNT_2_ENGINE_V7.txt

প্রথম কাজ (শুরুতেই):
1. git clone + git checkout v7-dev
2. npm install
3. পড়ো: docs/PROGRESS.md (phase table + P0-P3 এvidence) এবং docs/HANDOFF.md (Account 1→2 handoff bible — decisions, contract points, pitfalls)
4. init-configs.js আগের কনফিগগুলো (config-database/gemini/sending) বিল্ডে তৈরি করে — মুছবে না, উপরে বিল্ড করবে।

তোমার স্কোপ:
- P4: Background AI Engine v2 (never-starve) — pool 50k+, 60s restock, Redis pools.js এ উপর বিল্ড
- P5: God-Mode Matrix v2 + Package Manager — atomic.incrWithCeiling দিয়ে quota
- P6: Completeness Sweep — validator, 4 sandbox, zero-crash
- P7: Performance & Reliability — <300ms API, zero N+1

BUILD GATE (প্রতি phase পরে): node init-configs.js && npx next build --webpack → exit 0 হলেই push।
PUSH: git add -A && git commit -m "V7 P<x>: <summary>" && git push origin v7-dev, তারপর PROGRESS.md + HANDOFF.md আপডেট।

S2 FULL-LOGIC LAW: zero TODO, zero FIXME, zero placeholder, zero stub।
S5 MAX-LEVEL: correctness+security+performance+reliability+observability+tests(evidence)।
ESM only (import/export, require নিষেধ)। React 19। Tailwind v4 dependencies-এ রাখবে (devDep না)।

RULE 0: Accounts 1-3 কখনো deploy করবে না (no Vercel/Netlify)। শুধু local build + git push। শুধু Account 4 একবার deploy করবে।

ভাষা: আমার সাথে Bangla এ কথা বলবে; কোড/কমিট/ডক্স সব English এ।
L1: capacity/credit/token/time নিয়ে কিছু বলবে না।
L2: fake completion নিষেধ — acceptance pass না হলে PARTIAL লিখবে।

শুরু করো।

--- SMS END ---

---

## অপারেটরের জন্য নোট (Bangla)

উপরের SMS ব্লকটি পরের একাউন্টকে (Account 2) পাঠাবেন। এটিতে সব মূল পয়েন্ট আছে: repo, branch, স্কোপ (P4-P7), build gate, push rule, RULE 0 (no deploy), ভাষা নিয়ম, এবং কোন ফাইলগুলো আগে পড়তে হবে। বিস্তারিত সব কিছু রেপোর docs/HANDOFF.md এবং docs/PROGRESS.md তে আছে — সেগুলো Account 1 সম্পূর্ণ লিখে গেছে।
