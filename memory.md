# Memory — performance audit and the region fix

Last updated: 2026-08-21 (session 13, end)

## What was built

- A full read-only performance audit of the app (DB / Supabase / Next.js / React / data fetching / UI / bundle). The deliverable is `performance-improvement-plan.md` in the project root — **git-ignored** (added to `.gitignore` this session), 20 ranked items with file:line evidence, mechanism, fix, risk, % estimate, and an execution order. Treat it as the working plan; update its ✅ markers as items land.
- `vercel.json`: added `"regions": ["bom1"]`. Committed on `drop-home-match-feature` and **cherry-picked onto `main` as `57eee8a`**, pushed; production redeployed and `/api/health` now reports `region: "bom1"`. This is the only code change of the session.
- Project-level Claude memory note `crikledger-region-mismatch.md` (in the user's `.claude/projects/...` memory dir) recording the root cause.

## Decisions made

- **Production deploys from `main`**, not from the feature branch (verified: a branch-only route 404s in prod). The branch is ~83 files ahead of `main`; it was deliberately NOT merged — only the one-line region commit was cherry-picked. Keep doing config-only hotfixes this way until the branch is reviewed and merged.
- Region is `bom1` (Mumbai), not `sin1`: users are in India, DB is in Singapore (~40 ms away); `bom1` is the better trade.
- The rendering architecture (PPR shells, Suspense holes, server-resolved nav, no client fetch waterfalls, no `loading.tsx`) is verified sound and must be left alone. The lag was network geography × serial awaits. Do not "fix" client/server split, RLS (no policies exist), middleware, or the service worker's caching policy.
- Execution order for the remaining items is fixed in the plan file: (2) `lib/db.ts` pool config + hoist `getCurrentTeamId` out of `withTransaction` + use `admin.scopeId` in API routes → (3) migration 38 with tenant-keyed balance views + indexes → (4) `"use cache"` on team config and parallelised page fetches, flatten `/matches/[id]` → (5) client-side fee preview, SW navigation preload, small assets → (6) batched inserts, bounded selects → (7) `useOptimistic` / Server Actions → (8) bundle tidy-ups.

## Problems solved

- Root cause of "lagging a lot": functions in `iad1`, Supabase in `ap-southeast-1`. A single `SELECT 1` via `/api/health` was 0.52–0.66 s warm / 2.86 s cold; after `bom1` it is 0.13–0.16 s warm / 1.33 s cold. Anonymous `/tournaments` went 1.30 s → 0.20 s, `/` 0.49 → 0.20 s, `/pool` 0.29 → 0.12 s.
- `/api/health` requires `Authorization: Bearer <CRON_SECRET>` (value lives in `.env.local`, redacted here). It reports `region`, `db`, `sign` — use it as the before/after probe for every perf step.
- Latent bug found (not yet fixed): `getCurrentTeamId()` is called **inside** `withTransaction` in `api/pool/credit`, `api/players/[id]/captain`, `api/players/[id]/vice-captain`; with pool `max: 3` this self-deadlocks under 3 concurrent writes. The comment in `lib/team.ts` claiming the hazard was removed is wrong.
- `React.cache()` on `loadSessionAdmin` dedupes within an RSC render only; every API route that calls both `require*()` and `getCurrentTeamId()` runs the session query twice (three times in the captain routes).
- `player_balances` / `tournament_player_balances` views (`db/migration-29.sql`, `migration-30.sql`) aggregate all tenants because the GROUP BY subqueries lack `team_id`; ~10 FK indexes are missing. Only 5 plain indexes exist in the whole schema.

## Current state

- Working tree on `drop-home-match-feature`: `.gitignore` modified (uncommitted), `performance-improvement-plan.md` present and ignored, `vercel.json` region commit in place. `main` = `57eee8a` (region commit on top of `2b2f679`).
- Production is faster but every waterfall/N+1/view issue in the plan still exists; items #2–#20 are untouched.
- Stale background monitors from the audit are finished; nothing is running.

## Next session starts with

Run `/remember restore`, open `performance-improvement-plan.md`, and do execution-order step 2 as one PR on `drop-home-match-feature`: in `lib/db.ts` set `max: 10–15`, `keepAlive: true`, `connectionTimeoutMillis`, `statement_timeout`; hoist `getCurrentTeamId()` above `withTransaction` in the three routes above (or replace with `admin.scopeId`); replace the second session lookup with `admin.scopeId` in `api/matches/[id]/preview`, `pool/credit`, `pool/debit`, `matches`, `players`, `players/[id]/captain`, `players/[id]/vice-captain`, `tournaments`, `share/balances`, `share/ledger`. Then `npm test`, `npm run build`, and re-probe `/api/health` + a signed-in page.

## Open questions

- Should `lib/db.ts` hotfixes (#2, #12) also be cherry-picked onto `main` ahead of the branch merge, like the region change was? (The hang is latent in prod today.)
- Migration 38 (#3) touches money views on a Supabase project shared with another repo — confirm a fresh backup exists before applying.
- Commit the `.gitignore` change on the branch (it is currently unstaged).
