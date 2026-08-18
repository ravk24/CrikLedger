# Memory — Feature 2 COMPLETE (config surface + rename) · Access model v2 specced

Last updated: 2026-08-18 (session 6, end)

## What was built

1. **Access model v2 → planning docs** (all in gitignored `Project Details/cric_ledger/`):
   guest mode (no login; adaptive 5-tab bar `Teams/Home · Schedule · Tournament · Ledger ·
   More`; guest schedules/completes/shares a match **entirely client-side**, old sandbox
   trial retired), 3-tier roles (`megaadmin` = Ravi platform / `superadmin` = any purchaser,
   1 team, ≤2 admins via temp-password pattern / `admin`), self-serve signup (user id
   availability + password + **email**), purchases drive tabs (Ledger → Teams becomes Home;
   Tournament Credit → Tournament tab enables), Razorpay compliance pages (6, behind
   More→"About us"), Razorpay→superadmin grant flow (order `notes` carry user_id; verified
   capture → payments row → entitlement → role upgrade, idempotent). Updated: page-order.md
   (largest rewrite — full per-state tab spec; hub bar/landing page superseded),
   products-and-payments.md, build-order.md, roadmap.md, tenancy-schema.md.
   `.env.example` gained empty `RAZORPAY_KEY_ID/KEY_SECRET/WEBHOOK_SECRET`.
2. **Feature 2 finished — commit `ccf7145` (config surface)**: cached `getTeamGrounds()` /
   `getTeamSlots()` in `lib/team.ts` over `team_grounds_public`/`team_slots_public`;
   `GROUNDS`/`GROUND_SLOTS`/`CAR_RATE_PER_KM`/`BARNE_GROUND_NAME` deleted
   (`lib/groundSlots.ts` removed); `findGround`/`resolveGroundInfo` pure over passed
   grounds + homeGroundName; grounds threaded as props to GroundSelect's 4 consumers
   (ScheduleMatchSheet, OtherScheduleWizard, CreateTournamentSheet, TournamentAdminPanel)
   and both MatchAdminActions variants; MatchWizard takes server-resolved `groundInfo`
   (ground/venue props died); /slots subtitle+counts from DB (season label + window);
   /car-fee rate + meeting point from `teams` (page needed data inside `<Suspense>` to
   build); match headers use `team.short_name ?? display_name`; chips/copy say Home/Away;
   `SESSION_COOKIE` deduped into new `lib/cookies.ts` (proxy.ts must NOT import
   lib/session.ts — pg would enter the middleware bundle).
3. **Commit `7c85101` (migration 31)**: `db/migration-31.sql` applied to dev —
   `matches.ground` values/CHECK (`matches_ground_check`)/default renamed to
   `'home'`/`'away'`; full code enum sweep (types, zod in lib/validate.ts, raw SQL in
   matches route, `.eq("ground",…)`, component literals). URLs `/slots` + `/other-slots`
   deliberately kept.

## Decisions made

- **`/[team]/` routing moved OUT of Feature 2** → folds into Features 3–5 shell/auth work
  (adaptive tab bar build; URL visibility is a Feature 4 decision). Feature 2 = done.
- Chips/copy = "Home"/"Away" everywhere; ground's real name only where a venue displays.
- Guest sample = client-side only (no DB writes, no limits); `teams.is_sandbox` currently
  unused — keep/repurpose/drop is a Feature 3 prepare decision.
- Tournament-only purchaser gets superadmin role but team-creation + 2-admin allowance
  unlock only with Team Ledger.
- Megaadmin = `ravi_kant`; **password is never stored in repo/docs** (set directly in DB at
  Feature 4 build; rotate before launch — it transited chat).
- Migration files immutable; next migration number is **32**.
- STANDING RULE unchanged: never delete dev-DB test data; `db/clear-dev-data.sql` reserved
  for the one pre-launch reset.

## Problems solved

- **Stopping a background `npm start` (TaskStop) leaves the node child holding port 3000**
  — it EADDRINUSEs the next start AND silently serves the stale build during curl E2E.
  Fix: `netstat -ano | grep :3000`, `taskkill //PID x //F`, then verify probes show
  new-build-only strings. (Also in persistent memory: windows-npm-start-orphans.)
- Grep with a negative glob (`!Project Details/**`) silently returned false "no matches"
  on Windows — a positive-glob re-grep found "Our XI"/"Avval Chaha" sites it had missed.
  Don't trust negative-glob greps here.
- This Next version fails `next build` if a page reads dynamic data (DB/cookies) outside
  `<Suspense>` — wrap data components like the existing pages do (car-fee hit this).
- Server-rendered counts like "60 of 61" carry `<!-- -->` separators in HTML — grep for
  fragments, not the full sentence.

## Current state

- Repo `ravk24/crikledger` `main` @ `7c85101`, tree clean except intentionally-local
  planning docs; all pushed. Feature 2 fully complete and E2E-verified.
- Dev DB: **31 migrations applied**; data intact (12 players, 1 completed **'home'** match,
  fee 214 / surplus 8 / pool 1408, 60/61 slots open, Season 2 Nov 2026–May 2027).
- `npm test` 30/30 (carFee now `carFee(km, rate)`, tests pass 9.6), build clean (benign
  `[auth/me]` prerender log persists). No server left running on port 3000.
- Cookie `cl_session` (constant in `lib/cookies.ts`); superadmin username `ravi_kant`
  (to become megaadmin at Feature 4).
- Inherited `.github/workflows/db-backup.yml` still fails nightly on GitHub — harmless;
  park until Feature 9.

## Next session starts with

**Feature 3 prepare session** (build-order): product/catalog spec — products/price table
decision (lean toward a `products` table), `payments`/`entitlements` DDL (sketch in
products-and-payments.md §2), fate of `teams.is_sandbox`, entitlement-gate UI wrapper,
purchase surfaces (More→Purchases card, Tournament-tab CTA). Feature 3 now also inherits
the guest client-side sample from access model v2. Alternatively: Feature 1 extras
(match-sheet share card, ledger export) — both still pending and independent.

## Open questions

- Teams publicly listed on the Teams tab — opt-out flag? Guest schedule flow: reuse wizard
  shell vs dedicated lightweight flow? Can a superadmin's 2 admins manage their
  tournaments? Purchases page content + pricing + GST (Features 3/5). Post-signup
  pre-purchase Schedule behavior. Tournament "Host a new tournament" inner pages.
- Phase 0 leftovers: PostHog project for crikledger; own backup workflow (Feature 9).
- **DEFERRED (2026-08-18): daily DB backup.** `gh run list` shows NO runs at all on
  `ravk24/crikledger` — the nightly workflow has never executed (likely the missing
  `SUPABASE_DB_URL` / `BACKUP_PASSPHRASE` secrets documented in `db/BACKUP.md`).
  Ravi's decision: implement at a later stage. **Until a run is green, the privacy
  policy must NOT claim backups** — the claim was deliberately left out of
  `app/(app)/privacy/page.tsx` for exactly this reason. Re-add it when the workflow
  is verified.
