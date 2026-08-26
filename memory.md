# Memory — session 22: performance plan v2 written and fully implemented; auth scoping; migrations 45–46; dead code gone

Last updated: 2026-08-26 (session 22, end)

## What was built

One commit on `main`, pushed and deployed: `b4e3167` (113 files: 100 modified, 10 deleted, 4 added). Migrations **45** and **46** applied to prod (backups in `~/crikledger-backups/2026-08-26-pre-migration-4{5,6}.sql`). The plan itself is `performance-improvement-plan-v2.md` (git-ignored, like v1); every item there carries a status.

### The audit (first half of the session)
Three read-only explorers (dead code · server/data · client/PWA) plus hand verification of every high-severity claim. Headline answers: the Matches page and the home-match feature were already cleanly gone; what remained was three unused shadcn files, six unused lib exports, stale seeds, two SVGs, one stale sentence of copy and the ~250-line booking-linked-match path. The audit also found **three authorization holes** and that migration 40's tenant-keying never reached the views.

### Correctness / auth
- `app/tournaments/[id]/players/[pid]/page.tsx` had **no auth at all** — now gated by the tournament's own scope (team, or the tournament for a credit-only owner), `AccessGate` otherwise.
- `lib/session.ts requireTournamentWrite(id, { superadmin? })` — loads `tournaments.team_id`, applies the Admin-tab rule, refuses megaadmin. All 15 `app/api/tournaments/[id]/**` handlers use it; `requireAdmin()` there only proved the caller could write their OWN active team.
- `app/api/pool/entries/[id]` PATCH/DELETE now `AND team_id = admin.scopeId`.
- `matchSubmitSchema.rows.max(60)`.

### Database
- **Migration 45**: `players_public` / `tournament_players_public` join their balance views `ON b.id = p.id AND b.team_id = p.team_id` (resp. `tournament_id`). Before, the caller's `WHERE team_id` never reached the aggregate legs (no equivalence class through the PK) — `EXPLAIN` showed `HashAggregate → Seq Scan` on every leg; after, `team_id` filters + index scans. View output dumped before/after: byte-identical. `tournaments_public` fund/count are correlated scalar subqueries. New `tournament_match_attendee_counts` view. Indexes: `matches (team_id, status, match_date DESC)`, `pool_entries (team_id, kind, entry_date DESC, created_at DESC)`, `tournaments (created_at DESC)`, `entitlements (admin_id)`, `tournament_match_participants (tournament_id, match_id)`. `app/admin/players/page.tsx` SQL gained the same join predicate.
- **Migration 46**: booking-linked-match machinery retired after confirming 0 rows on prod (`ground_bookings`, linked matches, pending amounts). Dropped `matches.ground_booking_id` (+ index), `ground_bookings.amount_pending` / `pending_cleared_entry_id`, `ground_bookings_public`; `matches_public` recreated without the column. `lib/bookings.ts` is now just `buildBookingMessage(team, captain, slots)`; `revertBookingShare`, `clearBookingPending`, `computeSlotShare`, the `opponentCaptain`/`bookingShare`/`bookingFee` props and `opponent_captain` in the edit schema are gone. The Pool-page booking credit still works.

### Server round trips
Captain-phone reads ride the page `Promise.all` (Home via a props-only `LedgerHowTo`; tournament Home and Admin tab, gated on use); `BackLink` shares a `React.cache`d row loader with the body on both match pages; `/matches/[id]` reuses `admin.activeTeam`; `/tournaments` runs nav + directory together; `/admin` two scalars in one statement; `/ops` `HOLDERS_SQL` once for both products; session query has a `WITH my_teams` CTE; `count:"exact"` → base-table counts (Home, tournament Home) or a `PAGE_SIZE + 1` probe (`/pool`, `/players/[id]`, tournament statement — now paged); `/schedule/completed` capped at 100 and ordered in SQL; `/schedule/upcoming` dropped its attendee query (participants only exist after completion); `lib/supabase-server.ts` pins `cache: "no-store"` via `global.fetch`. `"use cache"` on exactly two money-free reads: the tournament directory (`cacheLife("minutes")`, tag `tournament-directory`, `revalidateTag(…, "max")` from create/edit/delete) and the team row (`cacheLife("hours")`, tag `team:<id>`, revalidated from `PATCH /api/sa/team`).

### Client / PWA
- `AccountMenu` is a hand-rolled disclosure; `components/ui/dropdown-menu.tsx`, `@radix-ui/react-dropdown-menu` and `next-themes` are gone (no `.dark` CSS existed; the provider only stripped a class nothing styled).
- Header logo `unoptimized`, no `priority`; `next.config.ts images.unoptimized = true` (no `next/image` optimisation left anywhere).
- Eight raw `<a href="/…">` in the legal pages → `<Link>`.
- `renderInstallDiagrams(only?)`: signed-out Home streams 2 diagrams (first step per platform) + "See every step illustrated" → `/install`, which still renders all 8.
- `public/sw.js` **v7**: cache-first for same-origin `GET /_next/static/*` with no query (Next 16 serves them under `/_next/static/immutable/…`, `Cache-Control: immutable` — verified on prod). `RegisterSW` waits for `load`, calls `registration.update()` on every foreground return, reloads on `controllerchange` only if a controller existed before and no `[role="dialog"]` is open.
- `viewportFit: "cover"` (safe-area insets were 0 on iOS — the tab bar sat under the home indicator); `metadataBase` (og:image used to resolve to `VERCEL_URL`); `app/(app)/error.tsx` (no data, no placeholder figures) + `not-found.tsx`; manifest `id`/`scope`/shortcuts (`/pool`, `/schedule`); skeleton `bg-muted`.
- `lib/format.ts`: module-level `Intl` formatters. `lib/format.test.ts` is 121 assertions captured from the OLD implementation (lakh/crore, `.5` rounding, 18:30 UTC boundary, leap day).
- `AnimatedRupees` tweens via `ref.textContent`; `PlayerGrid` `useMemo` + `useDeferredValue` + `memo(PlayerCard)`; `"use client"` removed from `SheetShell`, `StepCars`, `StepFeePreview`.
- `useOptimistic` added to `MatchFeeCard` (paid chip), the four captain/vice-captain tiles (name on the tile), `DebitSheet` (row into `PoolAdminSection`'s existing reducer via `onOptimisticAdd`, mirroring `CreditSheet`). 10 components use it now.
- Share images at **720 px**: every constant in `lib/share-image.tsx` and the four routes is the old 1080 value × ⅔ (`balanceImageHeight` = `min(1467, max(600, 280 + half·40))`, ledger `max(600, 280 + n·43)`, match sheet `min(1067, max(507, 253 + half·37))`).

### Dead code / tooling
`components/ui/{badge,card,checkbox}.tsx`, `hasEnvVars`, `SUPPORT_PHONE_DISPLAY`, `getTeamBySlug`, `checkActiveTeamWrite`, `tournamentMemberships`, `violatesMegaadminIsolation`, `season_label`, `expense_recovery`, `GroundBookingPublic`, `Match.ground_booking_id`, `TeamPublic` trimmed to 5 columns, `db/seed-{dev,matches-dev}.sql`, `scripts/repair-duplicate-account.mjs`, `public/wordmark-*.svg`, `app/admin/login` (the four `redirect("/admin/login")` go to `/login`; proxy exception removed), `LEGACY_DISMISS_KEY`, `--color-card*` tokens, CreditSheet's "schedules a match per booked date" sentence. `next@16.3.0` and `@supabase/supabase-js@2.112.3` pinned exact; `eslint-config-next@16.3.0` with a native flat `eslint.config.mjs` (`@eslint/eslintrc` removed); `sharp` devDependency; `npm run analyze` = `next experimental-analyze`. Stale banners prepended to `context/{architecture,code-standards,library-docs,project-overview}.md` and `CrikLedger-docs/{04,05,09–16}`; v1 plan marked superseded.

## Decisions made

- **Deferred, on purpose (both recorded in the v2 file):** Part E stage 2 (Server Actions — a rewrite of every money write; needs the device walk first) and G17 (`cn`/`cx` split — 84 sites, silent styling risk for ~8 KB).
- **`reactCompiler` evaluated, NOT enabled** — money app with `useOptimistic`; the concrete hot spots were fixed by hand instead.
- **F2 (header chip on static pages)** keeps its one session read; a display-only cookie is a new auth surface for no visible gain.
- **C6**: column lists only where the TS type is narrow (Home roster, team row); tournament tabs and match reads keep `*` because `TournamentPublic`/`Match` consume every column and a cast would hide `undefined`s.
- **Lint rules from eslint-config-next 16**: `react-hooks/set-state-in-effect` → **warn** (12 hits, all the documented re-seed-on-open sheets; a key-based remount is its own refactor); `react-hooks/error-boundaries` → **off for `app/api/share/**`** (satori renders synchronously inside `ImageResponse`).
- Tournament Admin tab's phone read is now parallel and gated on *use*, not on fetch (one indexed read for a bounced visitor was the accepted trade).
- `/return-policy` → `/shipping-policy` and the `LegacyTournamentMatches` redirect stay for old links.

## Problems solved

- **satori drops nested `<svg>` AND `<img>` under a parent `transform: scale()`** — a `ShareCanvas` wrapper (1080 layout scaled to 720) lost the crown/car marks; data-URI PNG marks vanished too. Fixed by rescaling the constants instead; inline SVG marks restored at ⅔ size. Verified by eye on the built server and on prod (720×512, crown + C + car marks present).
- Perl multi-line edits silently skipped several files with CRLF endings (`app/api/tournaments/[id]/route.ts`, `ScheduleMatchSheet.tsx`, `MatchAdminActions.tsx`, `share/balances`); after any bulk perl pass, grep for the old text and finish with exact Edits.
- `npx tsc` reported stale `.next/types/validator.ts` errors for the deleted `/admin/login` page — `rm -rf .next/types .next/dev/types`, the build regenerates them.
- The `todayIST` regex in the generated test lost its backslashes going through a bash heredoc → template literal; fixed by hand.
- Node 24 runs `.ts` directly (type stripping) — used to capture the formatter's old output from `lib/format.ts` without a build.
- `pg_dump` lives at `C:\Program Files\PostgreSQL\17\bin\pg_dump.exe`; a dbcheck script must live inside the repo (scratchpad can't resolve `pg`).

## Current state

Deployed (`b4e3167`) and probed from here: `/api/health` bom1/db ok; warm pages `/` 0.09 s, `/pool` 0.08, `/schedule` 0.10, `/tournaments` 0.10, `/privacy` 0.08 (9.5 KB), `/more` 0.09 — at or under the v1 baseline; no image preload, canonical `og:image`, `viewport-fit=cover`, no theme script; `sw.js` v7; manifest id + shortcuts; match sheet 720×512 in 0.25 s; hashed chunks `immutable`, CDN HIT. `tsc` clean, 92 vitest tests, lint 0 errors / 12 warnings, `next build` green (same `[ops/accounts]` prerender line as before). Prod DB: 2 teams, 21 players, 45 pool entries, 1 tournament, 0 match participants — the wizard/fee flows are still verified by tests + PNG, not on device.

## Next session starts with

The signed-in on-device walk that curl cannot cover, in this order: (1) account menu (hand-rolled: opens, Escape/outside-tap close, team switch, logout); (2) Home install card — 2 pictures + the "See every step illustrated" link; (3) `/admin` captain change → the tile updates instantly, phone saves; (4) `/pool` debit → row appears at once, reconciles on refresh; (5) a scheduled match → clear pending fee → "Fully paid" chip flips at once; (6) all four share images (balances, ledger, tournament balances, match sheet) look right at 720; (7) tournament statement page bounces a non-member and pages at 50; (8) an installed PWA closed and reopened after this deploy picks up the new build (SW update flow), and a sheet left open is NOT reloaded under the user. Then the session-21 fee-rule walk that was still pending.

## Open questions

- Part E stage 2 (Server Actions) and G17 (`cn`/`cx`) — only after the walk above; both documented in `performance-improvement-plan-v2.md`.
- The 12 `set-state-in-effect` warnings: refactor the re-seed sheets to key-based remounts, or leave as warnings?
- Migrate the ~15 remaining hardcoded contact literals to `lib/contact.ts`? Still deferred.
