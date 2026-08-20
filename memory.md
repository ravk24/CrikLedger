# Memory — Feature 4 COMPLETE (auth/authz/ops) · renamed to CrikLedger · Razorpay pages written

Last updated: 2026-08-18 (session 7, end)

Repo is now **`ravk24/crikledger`** (renamed on GitHub; remote updated). `main` @
`6203670`, pushed, tree clean. Five commits this session:

| commit | |
|---|---|
| `4d083f2` | Feature 4 M1 — migration 32, accounts + per-scope memberships |
| `947a20b` | Feature 4 M2 — adaptive 5-tab shell + guest sample mode |
| `1fafc9a` | Feature 4 M3 — real read isolation + `/ops` console (migration 33) |
| `08afdee` | Rename CricLedger → CrikLedger |
| `6203670` | Razorpay compliance content |

## What was built

**M1 — data model + auth core.** `db/migration-32.sql`: `admins.role` (enum) →
`platform_role` TEXT+CHECK `('user','megaadmin')`; added `email` (partial unique on
`lower(email)`) and `session_epoch`; new `team_memberships` + `tournament_memberships`
(per-scope role, `admin_slot` 1|2, `is_active`, `revoked_at`); `teams.owner_admin_id` +
`tournaments.owner_admin_id`; `tournaments.team_id` now NULLABLE; backfilled memberships
then dropped `admins.team_id`. New `lib/roles.ts` (pure, unit-tested) is the only place
authorization is decided. `lib/session.ts` rewritten — JWT payload is `{adminId, epoch}`,
roles left the token, `loadSessionAdmin()` loads memberships in the same per-request query.
`lib/team.ts` rewritten — `CURRENT_TEAM_SLUG` and the cross-request memo deleted. New
routes: signup, username-available (POST), session/team switch; logout/change-password
bump the epoch. `db/seed-team-superadmin.sql` added.

**M2 — shell + guest mode.** `app/(app)/` route group now owns the 13 tab pages (URLs
unchanged) so the header and tab bar live in a **layout**. `lib/nav.ts` computes 5 slots;
`components/shared/{AppTabBar,AppTabBarGate,AppHeader,AccountMenu,AnalyticsIdentify}.tsx`.
Guest mode from hardcoded `lib/demo/fixtures.ts` — a pre-made match to complete and share,
a sample ledger, real team titles greyed. `/login` canonical (`/admin/login` redirects),
`/signup`, `TeamsDirectory`, share-PNG route. **Deleted** `PublicHeader`, `TabBar`,
`/api/auth/me`.

**M3 — real read isolation + ops.** `db/migration-33.sql` revokes the anon grants;
`lib/supabase-public.ts` → `lib/supabase-server.ts` using the **service role**, with a
browser-import guard. `lib/access.ts` + `components/shared/AccessGate.tsx` gate the
team-scoped pages. `/ops` console (megaadmin only): overview, teams, accounts, account
detail with reset/suspend/restore, plus payments/products stubs.

**Rename + compliance.** `scripts/generate-icons.mjs` (committed) regenerates all icons +
splash from the masters in `Project Details/cric_ledger/Support_imgs/`. Static OG/Twitter
PNGs replaced by generated `app/opengraph-image.tsx`. Nine public legal/pricing pages, new
`components/legal/LegalFooter.tsx`.

## Decisions made

- **Power comes from membership rows, never the account.** `admins` is identity only.
  One purchase = one scope (team *or* tournament), each with its own ≤2-admin allowance,
  enforced by a partial unique index on `admin_slot` (the `players_one_captain` precedent —
  this repo has no triggers).
- **A person may hold different roles in different scopes** — superadmin of their own team,
  admin on someone else's. Membership is many-to-many.
- **megaadmin (`ravi_kant`) reads everything and writes NOTHING.** `canWrite()` refuses it
  even where `canRead()` allows. It must never hold a membership row; team rights live on a
  separate account (`ravi_kant_SA`, superadmin/owner of `our-xi`).
- **Active scope = `cl_team` cookie holding a slug**, re-validated against live memberships
  every request. A stale or forged value loses. `/[team]/` URLs still deferred.
- **Read isolation is enforced by revoking anon, not by page gates.** Completed match sheets
  stay publicly link-readable (the WhatsApp loop); everything else needs a matching session.
- **Guest mode is hardcoded fixtures** — no DB reads of customer data, no writes, so it needs
  no limits or purge and cannot leak.
- `hasEntitlement()` in `lib/entitlements.ts` is the single Feature 3 swap point.
- Hardening done: current-password required to change, epoch invalidation. Rate limiting,
  CSRF, bcrypt cost ≥10 remain **Feature 7**.
- Brand is **CrikLedger** (capital C, capital L); `crikledger` lowercase for slugs/cache keys.
- **Migration files stay immutable** — their headers still say CricLedger, deliberately.
  Next migration number is **34**.
- STANDING RULE unchanged: never delete dev-DB test data.
- **V1 takes NO online payment gateway (2026-08-20).** Paid access is manual: a payment-info
  page shows the operator's payment details, the user pays directly and confirms out-of-band,
  and an admin activates the feature after verifying. **No wallet, no escrow, no
  player-to-player transfer, no automated settlement** — real settlement between players stays
  outside CrikLedger, which only records and calculates what users enter. Razorpay is deferred
  to a future release, not cancelled.
- **V1 runs on the minimum set of external services (2026-08-20).** Analytics, tracking, and
  telemetry are out of scope; a new service earns its place only when the existing architecture
  genuinely cannot deliver the value. **PostHog therefore comes out before launch** (30 files,
  the four `POSTHOG_*` env keys, and its privacy-policy disclosure).

## Problems solved

- **A migration can be applied to the DB without `_migrations` recording it.** Migration 31
  had been run manually; the runner re-ran it and its `CASE ground WHEN 'barne' … ELSE 'away'`
  flipped the completed match to `away`. Caught only because a JSON snapshot was taken first.
  **Always snapshot before `node db/apply-migrations.mjs`** (`pg_dump` is not installed here;
  a row-level JSON dump via `pg` works).
- **The anon read hole was real and total** — a plain `curl` with `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  returned player names, individual debts and the pool balance. Fixed by swapping ONE module to
  the service role (all 19 readers were already server-only) rather than rewriting 18 files.
  **Consequence: the service role bypasses RLS, so every read must still filter by team in app
  code.** Real row-level enforcement is Feature 7.
- `notFound()` replaces the page slot but **keeps the layout** — `/ops` leaked its own chrome
  and nav to a non-megaadmin. Chrome now renders inside the guard.
- `useSearchParams()` makes a component client-only under `cacheComponents`, so `/login`
  server-rendered as a bare skeleton. Read `?next=` at submit time instead.
- Icons/OG could not be renamed because the name was baked into pixels. The masters are RGB
  with **no alpha** (icon surround pure black, splash white); flood-filling the surround inward
  from the border reproduces the squircle exactly, rather than guessing a corner radius.
- `PolicyPage` styled only `h2` — list/link-heavy legal copy needed `ul/li/a/h3/strong/dl`
  child selectors, or it renders with browser defaults.
- React splits numbers with `<!-- -->`, so grep the raw HTML for fragments (`408`), not `1,408`.
- Windows: stopping a background `npm start` leaves a node child on port 3000 that silently
  serves the stale build. `netstat -ano | grep :3000` then `taskkill //PID x //F`.

## Current state

- **Dev DB: 33 migrations applied.** Baseline intact and verified repeatedly: 12 players,
  1 completed **`home`** match, 6 pool entries, 61 slots, pool **1408**, fee 214.
- Two accounts only: `ravi_kant` (megaadmin, **no** memberships) and `ravi_kant_SA`
  (superadmin + owner of `our-xi`). Passwords set directly in the DB — **never stored in the
  repo; both transited chat and MUST be rotated before launch.**
- `npm test` 66/66 · `npx tsc --noEmit` clean · `npm run build` clean · lint at its
  pre-existing baseline (one unrelated `react/no-unescaped-entities` error in
  `OtherScheduleWizard.tsx`, present before this session).
- 21 auth/isolation E2E probes pass. Nine legal/pricing pages return 200 with no cookie.
- Payments are NOT built — buy buttons are inert and say "Payments opening shortly".
- **Verified only by inspection, not by use:** the guest match flow's click-through, and the
  new icons/splash on a real device. Installing the PWA tests both.

## Next session starts with

**Feature 3 — products & entitlements** (the last thing between here and paid access —
whose payment path is now **manual activation**, not a gateway):
`products`/`payments`/`entitlements` DDL as **migration 34**, then swap the body of
`hasEntitlement()` in `lib/entitlements.ts` — it was built as the single seam so nothing else
should need to change. Prices currently live in three places (`/pricing`, `/purchases`,
Terms §2); the products table should become the source of truth. Also decide the fate of
`teams.is_sandbox` (shipped in migration 26, still unused).

Alternatively **Feature 7 hardening** (rate limiting on login + the signup availability
oracle, CSRF, bcrypt cost ≥10, RLS) — signup is now public, which raises its urgency.

## Open questions

- **Deferred by decision (2026-08-18): the daily DB backup.** `gh run list` shows NO runs at
  all on the repo — the nightly workflow has never executed (likely the missing
  `SUPABASE_DB_URL` / `BACKUP_PASSPHRASE` secrets in `db/BACKUP.md`). **The privacy policy
  deliberately does NOT claim backups.** Re-add the claim only once a run is green.
- Account deletion is **not implemented**; the privacy policy promises an email-request path
  (`crikledger@gmail.com`), so that inbox must actually be actioned.
- Compliance content is written but is **not legal advice** — worth a review before launch.
- **The Razorpay copy is now WRONG for V1.** Nine public pages (privacy, terms, refund/return/
  shipping policies, pricing, purchases) and `Project Details/cric_ledger/crikledger-TnC.txt`
  all say payments are processed through Razorpay. They need a manual-payment rewrite before
  launch.
- **Revisit the public address.** Ravi's home address and personal phone are publicly crawlable
  only because *Razorpay* required it — that justification no longer holds in V1.
- **PostHog removal is now required pre-launch**, so "PostHog project for crikledger still
  unmade" is resolved as **won't do**.
- Secure the `crikledger` domain.
- Can a superadmin's 2 admins manage that team's tournaments? Teams opt-out of the public
  directory? `/[team]/` URL routing (deferred out of Feature 4). GST on pricing.
