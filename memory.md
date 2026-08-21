# Memory — operator console, entitlements, share images

Last updated: 2026-08-21 (session 12, end)

Branch **`drop-home-match-feature`** @ `bd4585a`, pushed to `ravk24/CrikLedger`, tree clean except this file.
**Not merged to `main`.** Four commits on top of `2b2f679`:

| commit | |
|---|---|
| `a0c132d` | schedule: one flow, no ground picker, no home matches |
| `481794a` | schedule: one structure, a status dot, and three cards |
| `8986600` | share: ledger and balances as images, compact brand, 5-day backups |
| `bd4585a` | ops: one-page operator console with grants, entitlements, superadmin privileges |

## What was built

**Commit `8986600`**
- `components/shared/AppHeader.tsx` — text wordmark "Crik**Ledger**" replaces the 173px SVG wordmark (SVGs still in `public/`, now unused by the header).
- `lib/share-image.tsx` (shared satori frame), `app/api/share/ledger/route.tsx` (newest 20 pool entries + balance), `app/api/share/balances/route.tsx` (all player balances). GET, `requireTeamAdmin()`, `await connection()` before the try so the build's prerender pass bails cleanly.
- `components/shared/DownloadImageButton.tsx` — icon button; native share sheet if `navigator.canShare`, else download. Placed in `PoolAdminSection` (third grid cell) and via `PlayerGrid.downloadSlot` on Home (server-gated on `getSessionAdmin()`).
- `.github/workflows/db-backup.yml` now `30 21 */5 * *` (every 5th day). Copy on `/about` ("Your data") and `/admin` footer line.
- `/admin` pool-balance card removed.

**Commit `bd4585a`**
- `db/migration-37.sql` — `entitlements` table (product, team_id, admin_id, price_inr snapshot, consumed_by_tournament_id UNIQUE ON DELETE SET NULL, consumed_at, granted_by, note). One Ledger per team (partial unique index). Backfill: Ledger row (price 0) per team with a superadmin; consumed credit per existing tournament; sets `teams.owner_admin_id`. **Applied to the shared Supabase project.**
- `lib/roles.ts` `Principal.entitlements?: EntitlementSummary[]`; `lib/session.ts` loads per-team summaries (total/unused) alongside memberships.
- `lib/entitlements.ts` rewritten: `team_ledger` = any member team has a row; `tournament_credit` = ACTIVE team has any row; new `tournamentCreditsLeft()`. `lib/nav.ts` `NavState.tournamentCreditsLeft`. Tests in `lib/entitlements.test.ts`.
- `lib/tournaments.ts` `createTournament()` is transactional and consumes the oldest unused credit (`FOR UPDATE SKIP LOCKED`); none → 402 `NO_TOURNAMENT_CREDIT`. `CreateTournamentSheet` takes `creditsLeft`, disabled at 0 with a Pricing link.
- `POST /api/ops/grants` (`requireMegaadmin`): find-or-create account (temp password via `generateTempPassword`, shown once), find-or-create owned team (`"<name>'s team"`, slug from username with `-n` suffix) + superadmin membership, insert entitlement (99/29 from `lib/products.ts` `priceInr`). 409s: `CANNOT_GRANT_TO_OPERATOR`, `ACCOUNT_SUSPENDED`, `ALREADY_GRANTED`.
- `PATCH /api/sa/team` (`requireTeamSuperadmin`) renames `teams.display_name`; schemas `grantSchema`, `teamNameSchema` in `lib/validate.ts`.
- `/ops` rewritten: `components/ops/OpsChrome.tsx` (AppHeader + "Operator" pill + owns `<main>`), `components/ops/OpsConsole.tsx` (tiles Ledger Users / Tournament Users / Statistics, each a SheetShell; grant form + holder list linking to `/ops/accounts/[id]`; stats incl. money = SUM(price_inr)). Deleted `/ops/teams`, `/ops/payments`, `/ops/products`, `/ops/accounts` list page, `OpsHeader.tsx`. `app/ops/layout.tsx` is now a bare div.
- `/admin`: `components/admin/PrivilegesCard.tsx` (superadmin only) — welcome, inline team rename, admin slots n/2, captain/guest-fee/credits/password rules.
- Docs: `db/seed-team-superadmin.sql` header marked superseded; `CrikLedger-docs/06-database.md` lifecycle rows.

## Decisions made
- Entitlements are **team-scoped** rows; both product grants auto-create a team shell so tournament-only users still fit every team-scoped query. Tournament-only user: Home intro, greyed Ledger, live Tournaments tab.
- Money stat = Σ `price_inr`; backfilled rows carry 0 so pre-console history never inflates revenue.
- Credits are consumed on create, freed on delete (FK SET NULL). Repeat credits allowed; second Ledger grant rejected.
- Backup cadence is every 5th day (user's explicit choice over daily), 30-day artifact retention ≈ 6 backups.
- Ops pages use the app navbar + global CopyrightBar, no tab bar; chrome rendered per page after the guard (404 to non-operators must not show operator chrome).

## Problems solved
- Local `next start` on Windows cannot render any `ImageResponse` ("Input buffer contains unsupported image format" from sharp) — pre-existing, affects `match-sheet` too; `next dev` and Vercel are fine. Test image routes in dev mode.
- Route segment `export const dynamic` is rejected under `cacheComponents`; use `await connection()` (next/server) instead.
- Stale `.next/dev/types/validator.ts` references deleted pages and fails `tsc`/build after removing routes — delete `.next/dev`.
- Stale `next start` orphan on port 3000 (PID from a prior session) served an old build; kill the node child before trusting localhost:3000.

## Current state
- All typechecks, lint, 86 vitest tests, and `npm run build` pass.
- Verified in browser: header, Home/Ledger download icons, both PNG routes, `/admin` privileges card + rename round-trip, `/ops` → 404 for a team superadmin, 401s when signed out.
- **Not verified in a browser:** the `/ops` console itself (tiles, grant modals, one-time password card, statistics) — needs the megaadmin (`ravi_kant`) login, which this session didn't have. The Chrome tab also hung during the logout attempt.
- `Our XI` has **0 tournament credits** after backfill (no tournaments existed), so tournament creation is blocked until a credit is granted from `/ops`.
- A dev server may still be running on port 3100 from this session.

## Next session starts with
1. Sign in as `ravi_kant`, open `/ops`: grant a Ledger to a throwaway id (expect one-time password card), grant a tournament credit to `ravi_kant_SA` (existing account → "no new password"), check holder lists, Statistics money (should be 99 + 29), then as the superadmin create a tournament and confirm credits go 1 → 0 and the Create button disables.
2. Trigger **DB Backup (every 5 days)** once via *Run workflow* to confirm Production secrets still resolve.
3. Decide when to open the PR `drop-home-match-feature` → `main`.

## Open questions
- Should the Purchases/Pricing pages read `entitlements` (credits left, Ledger active) instead of the nav booleans? Not touched this session.
- `hasEntitlement("tournament_credit")` is per ACTIVE team; a user who is admin on a credit-holding team but active on another sees the upsell — acceptable for now, flag if confusing.
- Unused `public/wordmark-*.svg` still referenced by `app/opengraph-image.tsx` comments only; safe to leave.
