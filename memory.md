# Memory — CricLedger: planning docs + Feature 1 basic + rebrand

Last updated: 2026-08-18

## What was built

1. **Planning docs** (all under `Project Details/`):
   - `old_project/implementation-reference.md` — full "how supergiants works" reference
     (fee engine formulas, pool ledger rules, derived balances, tournament fee model,
     transaction/reversal patterns, schema + 17 views + RLS, test suite, money invariants).
   - `old_project/constants-inventory.md` — exhaustive constants→variables audit.
   - `cric_ledger/roadmap.md` — technical phases 0–7.
   - `cric_ledger/products-and-payments.md` — products, Razorpay flow, share/export specs.
   - `cric_ledger/build-order.md` — **authoritative Feature 1→10 delivery order**.
   - `cric_ledger/page-order.md` — page order v1 + future nav architecture.
2. **Feature 1 basic (DONE)**:
   - `db/apply-migrations.mjs` — applied all 25 migrations to the fresh dev Supabase
     (tracks in `_migrations`; reruns no-op). Seeded superadmin (username `ravi_kant`,
     dev password known to Ravi — [REDACTED]) + 5 dev players via `db/seed-dev.sql`.
   - Icons regenerated from `Project Details/cric_ledger/Support_imgs/cricLedger-icon.png`
     (transparent badge, full image, no crop): `public/icon-192/512.png`, maskable (66% on
     white), `apple-touch-icon.png` (white bg), `app/icon.png` (favicon), `public/logo.png`
     (transparent). Wordmark SVGs = "CRIC" navy + "LEDGER" green, viewBox 240×36.
   - `components/shared/SplashScreen.tsx` — icon holds **1700ms** on `bg-background`,
     300ms fade, once per session (`cl-splash-shown` sessionStorage), mounted in layout.
   - `public/sw.js` cache = `cricledger-static-v2`.
3. **Full brand-text sweep** (49 replacements / 26 files): all LR-SuperGiants/lrsg text →
   CricLedger across app metadata, manifest, offline.html, headers, admin pages, install
   nudge (`cl-install-nudge-*`), tournament copy, comments, README, context/ docs.
   Session cookie renamed `lrsg_session` → **`cl_session`** (proxy.ts + lib/session.ts).
   New `app/opengraph-image.png` + `twitter-image.png` (1200×630 badge on white).
   Scratchpad scripts: `make_icons.ps1`, `rebrand.mjs`, `e2e-match.mjs`.

## Decisions made

- **One app, many teams** (single DB, team_id scoping; tournament subsystem = prior art).
  ₹ / en-IN / Asia/Kolkata stay hardcoded.
- **Paid app**: Team Ledger (**yearly**) + Tournament Credit (**1 tournament/payment**) +
  free sample = **sandbox team** (1 scheduled match w/ 1 booking slot, 1 completion,
  5 manual ledger entries), **discarded on purchase**. Everything visible after login,
  unpurchased = greyed out never hidden. Payments = **Razorpay** (orders server-side,
  webhook source of truth, idempotent grants).
- Ledger **export only** (CSV no-dep + **ExcelJS**; never npm `xlsx`). Match-sheet share =
  **image card** (ImageResponse + Web Share API).
- **Build order Features 1→10** (build-order.md wins over roadmap phases); auth moved to
  **Feature 4** (payments need users); its deep design discussion = Feature 4 prepare step.
- **Page order v1**: splash → app exactly as supergiants, ALL features enabled; greyed-out
  and sample-limit decisions deferred. Future nav locked: `/` landing, two-level tab bars
  (hub + team bar w/ exit tab), sample on same `/[team]` routes, pure calculators free at
  hub level.
- Interim names: display "Our XI", placeholders "Your XI", footer "CricLedger · v0.1".
- Dev DB now / prod DB at launch; never the SG prod DB. Standing rule: spec before code;
  migrations immutable (new number per change); engine pure, `ceilRupees` only rounding.

## Problems solved

- Migrations 4 & 8 must run **statement-by-statement** (ALTER TYPE ADD VALUE) — runner
  splits those files; others run per-file.
- `db/seed-matches-dev.sql` is broken (pre-migration-6 schema) — skip it; create matches
  via UI/API instead.
- API responses wrap as `{success, data}` with snake_case (e.g. preview `data.rows`
  `{player_id, brought_car, fee}`).
- Killing a background `npm run dev` can orphan the actual Next server (port 3000 held);
  fix: `taskkill /PID <pid> /F`.
- New icon source has native transparency → use full image, no crop/threshold needed.

## Current state

- App runs fully on the dev Supabase DB: all pages/assets 200, tests **30/30**, build clean
  (41 pages; `[auth/me]` cookies log during prerender is pre-existing/benign).
- E2E verified with canonical numbers: 2000+60, 2 cars @250, 12 heads → fee 214, driver
  −36, collected 2068, **surplus 8**; pool balance 1408. Dev DB contains this test data
  (12 players, 1 completed match, booking credit).
- `.env.local` holds dev Supabase URL/keys + generated SESSION_SECRET/CRON_SECRET
  (values in the file only — never in memory). PostHog vars empty.
- Cookie rename means one fresh admin login is needed.
- Grep for supergiants/lrsg is clean in code; only deliberate lineage mentions remain
  (README status line, old_project docs, progress-tracker.md).

## Next session starts with

**Feature 2 prepare session**: the tenancy-schema spec (teams table + settings columns,
team_id + composite FKs everywhere, re-scoped uniques, all 17 views team-filtered,
`payments`/`entitlements`/`teams.is_sandbox`) — discuss with Ravi before any migration.
Alternative quick wins if preferred: Feature 1 extras (match-sheet share image card,
ledger xlsx/csv export — specs in products-and-payments.md §3–4).

## Open questions

- Pricing amounts (₹/year, ₹/tournament), refund/expiry UX, GST — parked for Feature 3/5.
- Exact greyed-out map + sample-limit UX — deliberately deferred (page-order.md).
- Public-link viewing vs login-only for paid teams — Feature 4 (auth) discussion.
- Phase 0 leftovers: own GitHub repo for cricledger not yet created; PostHog project for
  cricledger not yet set up; backup workflow for the new DB pending.
