# Memory — perf/pending-task sweep shipped (migration 40)

Last updated: 2026-08-22 (session 14, late)

## What was built

All commits pushed directly to `main` (no branches). In order:

- `8b66521` admin footer: database-backup icon inline with the text, 18px (`app/admin/page.tsx`).
- `759ba6b` purchases: "WhatsApp us to buy" → `https://wa.me/919142349007?text=…` prefilled; mailto removed (`app/(app)/purchases/page.tsx`).
- `f26ce92` **Multi-date scheduling** — "Multiple dates" switch on step 1 of `components/schedule/ScheduleMatchWizard.tsx`; add/remove date chips, one bare `POST /api/matches` per date sequentially, partial-failure reporting. No API change.
- `84cbd27` **Joining fee mandatory on create, superadmin-only to edit** — `createTournamentSchema.joining_fee` required int > 0; `editTournamentSchema` positive optional; `PATCH /api/tournaments/[id]` throws `403 SCOPE_FORBIDDEN` if a non-superadmin sends `joining_fee`; `TournamentAdminPanel` fee field disabled for admins and never sent by them (fixes a latent "blank field zeroes fee" bug); `CreateTournamentSheet` submit disabled until fee > 0.
- `876bc43` **Tournament "Who shared the car" step + riders fund car money** — `db/migration-39.sql` (APPLIED to Supabase: `tournament_match_participants.shared_car`, appended last to `tournament_match_participants_public`); `engine/tournamentFee.ts` now mirrors `engine/calc.ts` sharers rule (car pool split CEIL over sharers on top of base share; driver credit only when someone shared; driver never a sharer); `lib/tournamentMatches.ts` writes `shared_car`; `lib/tournaments.settleTournamentFees` reads it; `TournamentMatchAdminActions` no longer passes `hasSharing={false}`; match page hydrates `shared` for edit. Tests rewritten in `engine/tournamentFee.test.ts` (88/88 pass).
- `412d405` Scheduled list status filter — `components/matches/ScheduledMatchList.tsx` (client `<select>`: All / Green / Orange / Red); dot rule extracted to `scheduledState()` + `SCHEDULED_STATE_META` in `MatchStatusDot.tsx`.
- `a4028fe` Sample match sheet: headline = "Base fee per player" + "+ ₹X car share for the N who rode" line; rider icon on rows; PNG route `app/api/share/match-sheet/route.tsx` accepts `carSharePerSharer`/`sharerCount` (default 0).
- `a11215a` Car fee calculator copy: generic "starting location" instead of `team.meeting_point` ("Avval Chaha"); README row updated. Column left in DB, unused.
- `f460d5d` Schedule tab: "Schedule a Match" is a full-width horizontal card (`ACTION_CLASS`, `col-span-2`).
- `97bbe64` Neutral form placeholders (Opponent team name / Ground name / Your team name / Tournament name / What the money was spent on) across 7 sheet components.
- `2c3438b` Tournaments directory rows read "Host name — Tournament name" (server `pool` join `tournaments.created_by → admins.name` in `app/(app)/tournaments/page.tsx`).

## Session 14 part 2 — performance plan + pending tasks executed

Commits on main, in order (each passed tsc/eslint/88 tests/next build):
- `043c7af` perf: active team row rides the session query (`lib/session.ts` `teams` json_agg → `admin.activeTeam`; `getActiveTeam()` uses it, megaadmin falls back to lookup). List pages use `verdict.teamId`; `/matches/[id]` and tournament match page run admin reads in `Promise.all` (9 → 3 stages).
- `0e3cae7` perf: MatchWizard computes the fee preview in-browser with `engine/calc` (preview routes + `matchPreviewSchema` deleted); `public/sw.js` v5 (navigation preload, precache only offline.html); icons quantized (public/ −1.3 MB), `splash.png` deleted.
- `a77cf09` perf: all 6 insert loops → `INSERT … SELECT FROM unnest()`.
- `eb65e3c` ux: every `router.refresh()` in `startTransition`; `useOptimistic` in TournamentAdminPanel (status), PlayerManager (is_active), PoolAdminSection + CreditSheet (`onOptimisticAdd`), StatementList.
- `ef888d5` perf: `radix-ui` umbrella → `@radix-ui/react-dialog`/`react-switch`; framer-motion removed (rAF tween in AnimatedRupees); install diagrams server-rendered via `components/install/installDiagrams.tsx`; **Share match sheet** button on completed team match page; `/api/share/match-sheet` rate-limited 10/min/IP.
- `029a265` docs: `OPERATOR.md` runbook (manual activation via /ops grants).
- `f642128` **db: migration-40 APPLIED** — tenant-keyed `player_balances`/`tournament_player_balances`, `tournament_expense_shares.tournament_id` (NOT NULL, composite FK), 13 indexes, ledger views lost ORDER BY (callers now `.order()`), new views `match_attendee_counts` + `player_car_counts`, `teams.short_name` DROPPED (`teamLabel()` reads display_name). Balances diffed identical before/after. `/pool` and `/players/[id]` paged 50/`?page=` with "Show older entries"; directory LIMIT 50; share/balances ordered+limited in SQL.
- `5913934` notes.

Verified on prod after deploy: sw v5 live, `/api/health` bom1 warm 0.15 s, signed-in /pool (ordered, admin controls), Home balances, /matches (attendee counts), completed match page with share button; no console errors.

**Backups:** GitHub workflow has NEVER succeeded (`SUPABASE_DB_URL` env secret missing in `Production`). Local dump taken before migration 40: `C:/Users/ravk2/crikledger-backups/2026-08-22-pre-migration-40.sql` (pg_dump 17 at `C:/Program Files/PostgreSQL/17/bin`, session pooler = app URL with port 5432). User must add the two secrets (pending-tasks item 1).

Dropped/deferred: perf #11 `"use cache"` (updateTag is Server-Action-only; cookies forbidden in cached scopes; single-region serverless cache rarely persists) — replaced by #4c. #6 stage 3 Server Actions deferred. #18 share width kept 1080 (untested at 720). `tournament_ledger_public` page limits to 200 rows (no paging UI).

## Decisions made

- Session epoch **stays** (assessed: zero marginal DB cost — same admins row already read for `is_active`; removing it would break logout-everywhere / password-reset revocation over the 30-day cookie). User chose "keep everything as is".
- Joining fee edits are superadmin-only (user confirmed).
- Tournaments now use the **same car-money rule as team matches** (riders pay, drivers rebated only if someone rode). Consequence: tournament matches completed before migration-39 have no sharers recorded → their drivers get no rebate on settlement until the match is re-edited.
- `CrikLedger-docs/` is git-ignored — doc edits there (09-api.md joining-fee notes) are local only.

## Problems solved

- "Sample match calculation wrong" was a labelling bug, not math: `perPlayerFee` became the base share when the sharers rule landed (migration-34) and the sample sheet/PNG still called it "Fee per player".
- Bash heredocs containing `&apos;`/quotes broke; writing Python edit scripts to the scratchpad and running them is the reliable pattern on this Windows setup.
- Running a `pg` script for migrations must happen from the project root (copied to `./.migrate39.tmp.mjs`, then removed) so `pg` resolves; reads `DATABASE_URL` from `.env.local`.

## Current state

- `main` = `2c3438b`, pushed; tsc/eslint clean; 88/88 vitest; migration-39 applied to the shared Supabase project.
- Nothing verified in a browser this session — all changes checked by typecheck/lint/tests only.
- Untracked `pending-tasks.md` in project root (user's file, not committed).

## Next session starts with

1. Ask the user to add `SUPABASE_DB_URL` + `BACKUP_PASSPHRASE` env secrets and run the backup workflow; record the date in `db/BACKUP.md`.
2. Browser pass on interactive flows not exercised today: complete a match through the wizard (client-side preview), pool credit/edit/delete (optimistic rows), tournament complete/reopen, player deactivate, `/pool?page=2`, Share match sheet tap.
3. Remaining open items: perf #6 stage 3 (Server Actions), #18 share width, `CrikLedger-docs` (git-ignored) still describe pre-migration-37 activation.

## Open questions

- Should the free-sample fixture (`lib/demo/fixtures.ts`: Supergiants vs Challengers at Barne) be renamed? User said only input placeholders, so left as is.
- Active tournaments with car matches completed before today: remind the user to re-edit those matches (tick sharers) before marking the tournament completed.
