# Memory — Feature 2 tenancy schema built + own GitHub repo + nav v2

Last updated: 2026-08-18 (session 5)

## What was built

1. **Feature 2 tenancy schema — DONE** (spec `Project Details/cric_ledger/tenancy-schema.md`,
   all decisions recorded there; migrations applied to dev DB, rerun no-ops):
   - `db/migration-26.sql` — `teams` (slug/display/short name, home ground name+label,
     meeting point, `status_threshold` default 900, `car_rate_per_km` default 9.6, branding
     cols, `is_sandbox`), `team_grounds`, `team_seasons`, `team_slots`; RLS + anon revoke;
     seeds team `our-xi` ("Our XI") + 16 grounds + Season 2 + 61 slots verbatim from
     `lib/grounds.ts` / `lib/groundSlots.ts`; new views `teams_public`,
     `team_grounds_public`, `team_slots_public` (anon-granted).
   - `db/migration-27.sql` — `team_id` on players/matches/pool_entries/ground_bookings/
     tournaments (+ nullable on admins; bare col on match_participants/expense_shares),
     backfill to `our-xi`, NOT NULL, `UNIQUE (team_id, id)` targets,
     `matches (team_id, match_date)` index, re-scoped uniques (player name, captain/vice
     partials ON (team_id), tournament name).
   - `db/migration-28.sql` — 11 composite FKs `(team_id, X)` (cross-team refs structurally
     impossible); SET NULL links use PG15+ column-list form (dev DB is PG 17.6).
   - `db/migration-29.sql` — 8 SG views rewritten (append team_id; `pool_balance` one row
     PER TEAM; `players_public` uses `teams.status_threshold` — 900 literal dead;
     `matches_public` +ground_booking_id; `ground_bookings_public` +id);
     `anon_read_matches` policy DROPPED + `REVOKE ALL ON matches FROM anon`.
   - `db/migration-30.sql` — 9 tournament views append team_id/tournament_id.
2. **Code team-scoping**: new `lib/team.ts` (`CURRENT_TEAM_SLUG = "our-xi"`,
   `getCurrentTeam()` React-cached for pages, `getCurrentTeamId(pool|client)` memoized for
   routes). All INSERTs stamp team_id (players/matches/pool credit+debit/entries re-split/
   bookings/tournaments routes + `lib/matches.ts`, `lib/bookings.ts`, `lib/tournaments.ts`);
   captain + vice routes scoped `WHERE team_id`; preview route captain lookup scoped;
   `matches` table reads → `matches_public` (app/matches, app/slots, app/other-slots);
   every list page filters `.eq("team_id", …)`; booking↔match opponent-name heuristic
   replaced with `ground_booking_id` id-join (match detail page + schedule-edit route);
   `Match` type gained `team_id`; `db/seed-dev.sql` rewritten team-aware.
3. **Own GitHub repo**: `ravk24/cricledger`, branch `main`, pushed (Phase 0 leftover done).
   `.gitignore` created (Next standard + `.env.local` + **`/Project Details/` and
   `/context/` are gitignored** — planning docs stay local only).
4. **UI tweaks (committed 1092c3f, 03f5715)**: splash hold 1700→1500ms, icon shown whole
   (removed `rounded-2xl` crop); tab bar now 4 tabs — Home, Schedule, **Tournaments**
   (promoted from More), More; Matches + Ledger tiles moved into `/more` drawer
   (More tab `also`-highlights /matches and /pool).

## Decisions made

- Tenancy spec decisions (full detail in `tenancy-schema.md`): admins get nullable team_id
  (NULL = platform); only `teams.is_sandbox` now — `payments`/`entitlements` DDL is
  Feature 3; dev data backfilled as team #1 `our-xi`; barne→home rename deferred to the
  config-surface step; anon read model accepted interim (definer views + server-side team
  filter; DB-level read isolation revisited Feature 4/7); team deletion = hard CASCADE
  everywhere (sandbox purge = one DELETE; no archived status); booking ids exposed publicly
  (heuristic dead).
- **STANDING RULE (Ravi): never delete dev-DB test data during development** — data
  accumulates as the verification baseline; destructive checks only inside BEGIN…ROLLBACK;
  `db/clear-dev-data.sql` is reserved for the ONE pre-launch reset. (Also in persistent
  Claude memory + build-order.md rule 4 + the SQL file header.)
- Migration files stay immutable; next migration number is **31**.

## Problems solved

- Orphaned Next server from a prior session held port 3000 (`EADDRINUSE` on npm start) —
  find PID via `netstat -ano | grep :3000` / `Get-NetTCPConnection`, `taskkill /PID x /F`.
- `CREATE OR REPLACE VIEW` works for all 17 rewrites because every change is append-only
  (columns added at END); grants survive. No DROP VIEW needed anywhere.
- Auto-generated FK names verified against pg_constraint before migration-28 — all were
  Postgres defaults (`<table>_<col>_fkey`).
- `git commit` with nothing staged does nothing — `git add -A` first (initial commit).

## Current state

- Repo `ravk24/cricledger` `main` = 496d11b…03f5715, tree clean, all pushed. Dev DB has
  30 migrations applied; test data intact (12 players, 1 completed match w/ canonical
  numbers fee 214 / surplus 8 / pool 1408, booking credit) — all E2E-verified post-tenancy.
- `npm test` 30/30, `npm run build` clean (benign `[auth/me]` prerender log persists).
- Second-team smoke test passed (rolled back): dup names + second captain allowed across
  teams, cross-team FK rejected (`pe_player_same_team`), team CASCADE delete clean.
- Inherited `.github/workflows/db-backup.yml` is now live on GitHub and will fail nightly
  (no secrets configured) — harmless noise; disable in Actions tab or park until Feature 9.
- Cookie is `cl_session`; a fresh admin login may still be needed (superadmin `ravi_kant`).

## Next session starts with

**Feature 2 continues — config-surface step** (roadmap Phase 2): `getTeamConfig` /
`getCurrentTeam` consuming `teams_public` + `team_grounds_public` + `team_slots_public`
in the UI (grounds list, slot calendar, car rate as engine parameter, copy/team-name
sites from `constants-inventory.md`), then barne→home/other→away rename (migration 31,
separate), then `/[team]/` routing (Phase 3). Alternatively Feature 1 extras (share card,
export) if preferred.

## Open questions

- Pricing/GST (Features 3/5); greyed-out map + sample-limit UX (deferred); public-link vs
  login-only viewing (Feature 4); per-team DB-level read isolation (Feature 4/7).
- Phase 0 leftovers: PostHog project for cricledger; own backup workflow (Feature 9) — and
  the inherited backup workflow currently failing nightly on GitHub (see Current state).
