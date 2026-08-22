# Memory — perf/pending-task sweep shipped (migration 40)

Last updated: 2026-08-22 (session 14, end)

## What was built

All commits pushed directly to `main` (no branches); every one passed tsc, eslint, 88/88 vitest and `next build`.

**Part 1 — UI polish**
- `8b66521` admin footer: backup icon inline, 18px.
- `759ba6b` purchases: "WhatsApp us to buy" → prefilled `wa.me/919142349007` link; mailto removed.
- `f26ce92` multi-date scheduling: "Multiple dates" switch on step 1 of `components/schedule/ScheduleMatchWizard.tsx`, one bare `POST /api/matches` per date, partial-failure reporting.
- `84cbd27` joining fee required (> 0) on tournament create; editable later by superadmin only (`403 SCOPE_FORBIDDEN` otherwise); admins never send `joining_fee` in the details PATCH.
- `876bc43` tournament "Who shared the car" step; `engine/tournamentFee.ts` follows the team sharers rule; `db/migration-39.sql` adds `tournament_match_participants.shared_car`.
- `412d405` Scheduled list status filter (`components/matches/ScheduledMatchList.tsx`; `scheduledState()` shared with `MatchStatusDot`).
- `a4028fe` sample match sheet: "Base fee per player" + car-share line; PNG route accepts `carSharePerSharer`/`sharerCount`.
- `a11215a` car-fee copy says "starting location" (no more `team.meeting_point`).
- `f460d5d` full-width "Schedule a Match" card; `97bbe64` neutral form placeholders; `2c3438b` tournaments directory rows "Host — Tournament".

**Part 2 — performance plan + pending tasks**
- `043c7af` active team row rides the session query (`lib/session.ts` `teams` json_agg → `admin.activeTeam`); `getCurrentTeam()` costs nothing; list pages use `verdict.teamId`; `/matches/[id]` and tournament match page run admin reads in parallel (9 → 3 stages).
- `0e3cae7` MatchWizard computes the fee preview in-browser with `engine/calc` (both `/preview` routes and `matchPreviewSchema` deleted); `public/sw.js` v5 (navigation preload, precache only `offline.html`); icons quantized (−1.3 MB), `splash.png` deleted; `scripts/generate-icons.mjs` targets updated.
- `a77cf09` all per-row insert loops → `INSERT … SELECT FROM unnest()` (match attendance, tournament attendance, settlement charges + lines, expense shares).
- `eb65e3c` every `router.refresh()` inside `startTransition`; `useOptimistic` in TournamentAdminPanel (status), PlayerManager (is_active), PoolAdminSection + CreditSheet (`onOptimisticAdd`), StatementList.
- `ef888d5` `radix-ui` umbrella → `@radix-ui/react-dialog` / `react-switch`; framer-motion removed (rAF tween in `AnimatedRupees`); install diagrams server-rendered via `components/install/installDiagrams.tsx`; **Share match sheet** button on completed team match pages (`components/matches/ShareMatchSheetButton.tsx`); `/api/share/match-sheet` rate-limited 10/min/IP.
- `029a265` `OPERATOR.md` runbook (manual activation via `/ops` grants); README links it.
- `f642128` **migration 40 APPLIED** (`db/migration-40.sql`): tenant-keyed `player_balances` / `tournament_player_balances`; `tournament_expense_shares.tournament_id` (backfilled, NOT NULL, composite FK); 13 indexes; `pool_ledger_public` / `tournament_ledger_public` lost their ORDER BY (callers now `.order()`); new views `match_attendee_counts`, `player_car_counts`; `teams.short_name` DROPPED (`teamLabel()` reads `display_name`). App: `/pool` and `/players/[id]` paged 50 via `?page=` with "Show older entries"; tournaments directory `LIMIT 50`; `share/balances` ordered + limited in SQL; tournament fee breakdown scoped by tournament; `buildAttendeeCounts` removed.
- `5913934` / `dcb4c13` tracking notes (`pending-tasks.md`, `db/BACKUP.md`, git-ignored `performance-improvement-plan.md` ✅ markers).

## Decisions made

- `"use cache"` (perf #4a/#11) **dropped**: in Next 16.3 `updateTag` is Server-Action-only, cached scopes cannot read cookies, and a single-region serverless cache rarely persists. The team hop was removed structurally instead (#4c).
- Mutation UX stops at `startTransition` + `useOptimistic`; Server Actions (perf #6 stage 3) deferred by user choice.
- Session epoch stays (zero marginal DB cost; needed for logout/reset revocation).
- Joining fee edits superadmin-only; tournaments use the same car-money rule as team matches (riders fund, drivers rebated only when someone rode) — matches completed before migration 39 need re-editing to tick sharers.
- Share image width stays 1080 (720 untested visually).
- `CrikLedger-docs/` is git-ignored; edits there are local only and still describe pre-migration-37 activation.

## Problems solved

- "Sample match calculation wrong" was labelling: `perPlayerFee` is the base share under the sharers rule; sheet now says so.
- Migration runner: `db/apply-migrations.mjs` records files in `_migrations`; a migration applied by hand (39) is re-run on the next `node db/apply-migrations.mjs` — safe only if idempotent (it was).
- Bash heredocs with quotes/`&apos;`/backslashes break on this Windows setup; write Python edit scripts to the scratchpad and run them.
- `pg` scripts must run from the project root (copy to `./.x.tmp.mjs`, delete after) so the module resolves.
- Local backups: pg_dump 17 at `C:/Program Files/PostgreSQL/17/bin/pg_dump.exe`; session pooler URL = app `DATABASE_URL` with port 6543 → 5432.

## Current state

- `main` = `dcb4c13`, pushed, working tree clean. Prod verified after deploy: sw v5 live, `/api/health` `bom1` warm 0.15 s, signed-in `/pool` (ordered, admin controls), Home balances, `/matches` attendee counts, completed match page with share button, no console errors.
- Migrations 39 and 40 applied to the shared Supabase project; balances diffed identical before/after 40.
- **Backups ARMED 2026-08-22**: `Production` env secrets `SUPABASE_DB_URL` (session pooler, user `postgres.<ref>`, port 5432) + `BACKUP_PASSPHRASE` set; run #7 green, artifact `db-backup-2026-08-22-run7`; next scheduled 26 Aug. Local dump before migration 40: `C:/Users/ravk2/crikledger-backups/2026-08-22-pre-migration-40.sql`.
- Untested by hand today: wizard completion (client-side preview), optimistic pool/statement edits, tournament complete/reopen, player deactivate, `/pool?page=2`, Share match sheet tap.

## Next session starts with

1. Get the user to add `SUPABASE_DB_URL` (session pooler, port 5432) and `BACKUP_PASSPHRASE` to the `Production` environment secrets, run the backup workflow once, and record the date in `db/BACKUP.md` (pending-tasks item 1).
2. Hands-on browser pass of the interactive flows listed above; fix anything that misbehaves.
3. Remaining open items: perf #6 stage 3 (Server Actions), #18 share width, refresh `CrikLedger-docs` activation/feature-inventory sections (local only).

## Open questions

- Should the free-sample fixture (`lib/demo/fixtures.ts`: Supergiants vs Challengers at Barne) be renamed? Left as is.
- `tournament_ledger_public` page is capped at 200 rows with no paging UI — fine for V1, revisit if a tournament ledger grows past it.
