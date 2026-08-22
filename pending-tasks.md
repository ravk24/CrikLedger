# Pending tasks

Last updated: 2026-08-22 (evening). Items 4–24 shipped on main in commits 043c7af…f642128; see memory.md. Ordered for execution — each item is safe to ship on its own.
Perf item numbers (#n) refer to `performance-improvement-plan.md` (git-ignored, project root).
Work goes straight to `main`; prod deploys from there.

## 0. Guardrails before touching the database again

**Status 2026-08-22 (evening):** GitHub backups are ARMED — run #7 succeeded (artifact `db-backup-2026-08-22-run7`); item 1 closed. A local `pg_dump` was taken before migration 40: `C:/Users/ravk2/crikledger-backups/2026-08-22-pre-migration-40.sql`. Item 1 remains open.

1. ~~**Arm Supabase backups.**~~ DONE 2026-08-22 (see db/BACKUP.md Status). The project is shared with a separate tenancy-migration repo that wiped it once (2026-08-20); backups were still unarmed on 2026-08-21. Confirm a fresh backup exists and note the date in `db/BACKUP.md` before any migration below. (`db/BACKUP.md` describes the 5-day backup scheme — verify it actually runs.)

## 1. Verify what just shipped (no code)

2. Open the signed-in `/schedule` page in prod — never visually confirmed after the `drop-home-match-feature` merge (anonymous curl can't see the Ledger-holder branch).
3. `/admin` after `87a4bfc`: greeting reads `Hello, Ravi · SuperGiants`, rules sit behind the "What you can do" chevron, scheduled match title reads `SuperGiants vs Opponent TBD`.

## 2. Database performance — migration 39 (#3 + #19)

*(Plan called this "migration 38"; 38 is now taken by the "Our XI" cleanup.)*

4. Rewrite `player_balances` (`db/migration-29.sql`) and `tournament_player_balances` (`db/migration-30.sql`) so every `GROUP BY` subquery carries `team_id` / `tournament_id` and joins on both keys — today every Home / Pool / Admin / share render aggregates **all** teams' rows.
5. Add the missing FK indexes listed under plan item #3 (verified absent across all migrations).
6. Drop the in-view `ORDER BY` (#19).
7. Process: draft SQL and show it first → `EXPLAIN ANALYZE players_public WHERE team_id = …` before/after → `npm test` → diff one real team's balances → `node db/apply-migrations.mjs`.

## 3. Page waterfalls (#4, #11, #5)

8. `"use cache"` + `cacheTag("team:<id>")` + `cacheLife("hours")` on `getTeamById` / `getTeamBySlug` in `lib/team.ts`; call `updateTag` from `PATCH /api/sa/team` (the only team-writing route). Removes one serial hop from every page.
9. Parallelise the `getNavState()` → `getCurrentTeam()` → data chain on `app/(app)/page.tsx`, `pool/page.tsx`, `matches/page.tsx`, `schedule/*`, `tournaments/page.tsx`, `admin/page.tsx`.
10. Flatten `/matches/[id]` (10 round-trips over 8 sequential stages) and the tournament match page.

## 4. Interaction latency (#8, #13, #14)

11. Client-side fee preview in `components/wizard/MatchWizard.tsx` — run `calculateMatchFees` from `engine/calc.ts` in the browser (as `GuestMatchFlow.tsx` already does) instead of `POST /api/matches/[id]/preview`.
12. Service worker (`public/sw.js`): enable navigation preload, precache only `offline.html`, bump `STATIC_CACHE`.
13. Shrink `icon-512.png` (448 KB) and `icon-192.png` (74 KB).

## 5. Write-path efficiency (#9, #10)

14. Batch the per-row INSERT loops: `lib/matches.ts` (attendees), `lib/tournaments.ts` (per player × match on "mark completed" ≈ 160 sequential inserts), `lib/tournamentMatches.ts`, `app/api/pool/debit`, `app/api/pool/entries/[id]`.
15. Bound the unbounded selects: pool ledger, player statements, `/matches`, `/schedule/*`, `/tournaments` (every tournament on the platform), `share/balances` (slices to 60 in JS after fetching all); replace `buildAttendeeCounts` full-row fetch in `car-count` with a count view.

## 6. Mutation UX (#6) — 45 `router.refresh()` sites in 32 files

16. Wrap every `router.refresh()` in `startTransition` (done so far only in `AccountMenu.tsx` and `PrivilegesCard.tsx`).
17. `useOptimistic` on toggles and money rows (`PoolAdminSection`, `CreditSheet`, `StatementList`, `TournamentAdminPanel`, `PlayerManager`).
18. Convert writes to Server Actions returning the refreshed tree in one round-trip.

## 7. Bundle tidy-ups (#15–#18)

19. Remove duplicate Radix packages (umbrella `radix-ui` vs individual `@radix-ui/*`).
20. Replace framer-motion (used for one counter) with CSS.
21. Render `PhoneDiagram` on the server (currently shipped as client JS for guest first visit).
22. Share-image (`ImageResponse`) route tweaks.

## 8. Product gaps noticed while working

23. `teams.short_name` has no UI of its own — the rename now writes it equal to `display_name`. Decide whether a separate short name is wanted for match titles; if not, drop the column in a later migration.
24. `/api/share/match-sheet` has no signed-in caller (only the guest demo). Either wire a "share match sheet" button on the match page or remove the route.
25. V1 launch checklist: manual payments only (operator activates features by hand via the operator console) — confirm the console's grant flow is documented for the operator; no analytics is in place (PostHog already removed; privacy page states it).
