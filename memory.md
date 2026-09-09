# Memory — session 27: team viewer, backup hardening, export built-and-removed, VC medal

Last updated: 2026-09-10, early morning (session 27 close; medal added the next morning)

## What was built

- **Team viewer** (migrations 49–50; commit `06aec24`): a third team role, `viewer` — one shared read-only login per team, created by the superadmin with a **user id and password of their choosing** (`createViewerSchema` = `usernameField` + password ≥ 8). Reads everything a member reads (Home, `/pool`, schedule, matches, statements, car counter, the team's tournaments); writes nothing. **One seat at a time:** `admins.viewer_session_started_at` (migration 50) is claimed atomically by `login` after the password check (`claimViewerSeat`); a second sign-in gets `409 VIEWER_BUSY` — "already in use since 09 Sept, 11:33 pm. Ask Ravi Kant (superadmin) to sign that session out, or ask whoever is signed in on your WhatsApp group to log out." The viewer's own logout, and the superadmin's Sign out / Reset password / Remove, free the seat and bump the epoch.
  - `lib/roles.ts`: `ScopeRole` gains `"viewer"`; **`canWrite()` now consults the role** (it used to grant any membership row); `isViewer(p)`; 7 new tests in `lib/roles.test.ts`.
  - `lib/session.ts`: `requireScope` / `requireTournamentWrite` throw `viewerReadOnlyError()` → `403 VIEWER_READ_ONLY`, so every write, both share images and `change-password` inherit it. `lib/nav.ts` `NavState` gains `isViewer`, `canWriteActiveTeam`.
  - Routes: `app/api/sa/viewer` (GET → `{username, created_at, in_use_since} | null`; POST `{username, password}` → 201 `{username}`; DELETE deactivates membership + account), `sa/viewer/signout`, `sa/viewer/reset-password`. `app/api/sa/admins` refuses to link a viewer account (`409 VIEWER_ACCOUNT`) and excludes it from GET; `app/api/ops/accounts` grant picker excludes viewer accounts. `auth/logout` bumps the epoch and clears the seat for every account. `LoginForm` shows the server message for `VIEWER_BUSY`.
  - UI: `components/admin/ViewerManager.tsx` on `/admin/manage` (create form; active card with user id + Copy, seat line "In use since …" / "Not signed in right now", **Sign out the viewer** (disabled while free), **Reset password** sheet, **Remove viewer login**). Session-presence gates replaced by `canWrite`/`isViewer` on Home share button, `/pool` admin section, `/schedule` tile (hidden for viewers), `/admin`, `/admin/players`, `/admin/password`, `/purchases` (redirect `/`), More Purchases tile, `AccountMenu` (Team admin / Purchases / Change password hidden), `TournamentTabBarGate` (Admin tab greyed). `PrivilegesCard` and README Roles table gained the viewer.
- **Backups** (`.github/workflows/db-backup.yml`, `db/BACKUP.md`; commits `2e0f4ca`, `5aa6e1f`): retention is now **count-based, newest 7** (a final step lists `db-backup-*` artifacts, `sort -r | tail -n +8`, deletes; `actions: write` on the job token; `retention-days` 90 as backstop only; runs only after a successful upload). `apt-get update` now refreshes only the PGDG list, after a Google Chrome mirror hash mismatch on the runner failed two backups. The owner lost `BACKUP_PASSPHRASE`, rotated the Production environment secret, and run 14 went green with it. Runbook corrected: the repo is private.
- **Share image buttons** (`8bdb608`): `DownloadImageButton` is a thin wrapper over a generic `DownloadFileButton` (`label`, `mimeType`, `icon`, `errorText`, `share?`); image flavour shows `Share2` + "Share X image". A `NotAllowedError` from `navigator.share` falls through to a plain download.
- **Excel export — built then removed** (`27363b3` → `bb153fa`). See Decisions.
- **Vice-captain medal (2026-09-10):** `ViceCaptainMark` now mirrors `CaptainMark` — lucide `Medal` in a new `--color-silver` (#6b7280) token before the silver "VC" pill, with the same `compact` prop; the admin and tournament Vice-captain tiles switched from `Award` to `Medal` so the role has one glyph everywhere. Owner chose Medal over Award/Star.

## Decisions made

- **Viewer, by the owner:** name "viewer" (not "guest" — that word means demo mode and non-roster players here); one per team; superadmin picks user id and password; one seat at a time; view only — no share images, no export, no change-password, no purchases. A seat is never freed by time; the message names the superadmin instead.
- **Export removed by the owner** despite the measurement: on the Supabase free plan they asked what it costs. Measured read-only for their team: ledger 54 rows ~15 KB, players 21 ~3 KB, statements 33 ~10 KB → **~28 KB of Postgres egress per export**, ≈1.5 `/pool` page renders, ≈37,000 exports per GB against 5 GB/month; the xlsx bytes to the phone are Vercel egress. Recommended keeping; removed anyway. Do not re-propose unless raised. `DownloadFileButton` stayed (the PNG buttons depend on it).
- Any admin of the team (not only the superadmin) may export was moot after removal; kept for the record that share images stay `requireTeamAdmin`.
- Migrations: every one is dry-run in `BEGIN…ROLLBACK` on prod first, backup run before, and the owner is asked before `apply-migrations.mjs` runs. Constraint name for 49 was verified on prod (`team_memberships_team_role_check`).

## Problems solved

- **Android "Permission denied" on the spreadsheet button** was Chrome's `NotAllowedError` from `navigator.share`: the page-side `canShare()` accepts any file but the share dialog refuses `.xlsx`. Fixed with `share={false}` and the fallback; still relevant to any future non-image file.
- **Backup workflow failing at `apt-get update`** (exit 100, Chrome mirror hash mismatch): refresh only the PGDG source list.
- **Dev-server tab kept a stale client bundle** after edits (hydration mismatch in the dev log, old copy on screen) — a hard reload (`ctrl+shift+r`) fixes it; a plain navigate does not.
- **A third-party Chrome extension ("BHK widget") swallows clicks and typing** on the manage page when driving the owner's browser; set form values by element reference (`form_input`) and click by ref.
- **Gated pages answer 200 to curl for a viewer** but stream `NEXT_REDIRECT … /` because the redirect fires inside the Suspense boundary; the browser lands on Home. Check the body, not the status.
- ExcelJS's `index.d.ts` declares a global `interface Buffer extends ArrayBuffer` — irrelevant now the package is gone.

## Current state

- **Git:** `main` is pushed and in sync with `origin/main` after the final "notes" commit of this session (the vice-captain medal and this file went in together); Vercel deploys from it. Tree clean.
- **DB:** migrations 49 and 50 applied to prod (single Supabase project serves dev and prod). **No viewer exists yet.** Two test viewer accounts were created and deleted; the ids `sgsa_viewer_test` and `ravi_kant_sgsa_viewer` are free.
- **Verified:** tsc clean, `npm test` 99/99, lint at the 12 pre-existing warnings; viewer flow end to end (browser as superadmin, curl as viewer: create/sign-out/reset/remove, `VIEWER_BUSY`, every write `VIEWER_READ_ONLY`, read pages without controls, gated pages redirect, seat freed by logout).
- **Owner confirmed at session end:** DB password rotated; plaintext secrets stripped from `Project Details/notes/cricLedger.txt`; phone export and Vercel function size checked before the export was removed.
- Backups: seven artifacts kept, newest run 17; next scheduled run will prune to seven again.

## Next session starts with

1. On the phone after the deploy: open Manage admins, create the real viewer (user id + password), share both in the group, and have a second player try to sign in while the first is in — expect the "already in use … Ask Ravi Kant" message. Then try Sign out the viewer from the card.
2. Carried: known issue 10.10 (abandon and completed-match DELETE still orphan `pending_cleared_entry_id`); browser check of the delete-from-ledger flow as a non-super admin.
3. Backlog candidates (owner's rough priority): Feature 6 self-service (team settings UI, proper password change, account deletion, email password reset); the one-year-term contradiction (`entitlements` has no `expires_at`, Terms say no subscription); Feature 7 hardening (rate limiting — now more relevant with a shared viewer credential — bcrypt cost, audit log).

## Open questions

- Should the tournament schedule tab's "Scheduled" card also become "Matches"? (carried)
- Should a viewer ever get the tournament balances share image, or is view-only final? (today: refused with `VIEWER_READ_ONLY`)
- Rate limiting on `/api/auth/login` is the natural companion to a shared credential — schedule it, or accept the seat message as enough for now?
