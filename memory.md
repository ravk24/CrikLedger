# Memory — session 29: ten viewer seats with per-seat sign-out (migration 52, 53 pending)

Last updated: 2026-09-10, afternoon

## What was built

- **Ten seats on the team viewer login (commit `ed0a6ae`, pushed; Vercel deploys from `main`).**
  Owner asked for up to 10 players signed in on the shared viewer credential at once (first said
  5, then settled on 10), JWT still 30 days with a fresh login after, and a per-seat list with
  sign-out on the superadmin card.
  - `db/migration-52.sql` — **APPLIED to prod** — additive only: `viewer_sessions (id, admin_id →
    admins ON DELETE CASCADE, started_at, device TEXT ≤ 40)`, index on `admin_id`, RLS + REVOKE,
    no public view.
  - `db/migration-53.sql` — **NOT applied** — drops `admins.viewer_session_started_at`. Apply only
    after the `ed0a6ae` deploy is live (old code wrote the column on every logout; new code never
    touches it).
  - `lib/viewerSeats.ts` (+ 10 tests): `VIEWER_SEAT_LIMIT = 10`, `viewerBusyMessage`,
    `seatsInUseLabel`, `deviceLabel(userAgent)` (coarse: iPhone / Android phone / Windows PC…),
    `isSeatId`, `seatCheckPasses`. `ViewerRow`/`ViewerSeat` types live here now.
  - `lib/cookies.ts` exports `SESSION_MAX_AGE_SECONDS`; `lib/session.ts` re-exports it. The reap
    window and the card's "live seats" filter both bind it as `make_interval(secs => $n)`.
  - `lib/session.ts`: `SessionPayload.sid?`, `verifySessionToken` exported and returns `sid` only
    when it is a UUID; the one session query adds `seat_alive` (PK EXISTS on `$2::uuid`, no-op when
    null); after the principal is built, `seatCheckPasses` rejects a viewer token without a seat or
    any token whose seat row is gone; `SessionAdmin.seatId`.
  - `app/api/auth/login/route.ts`: `claimViewerSeat(adminId, userAgent, ownSeat)` in
    `withTransaction` — `FOR UPDATE` on the admins row, delete the caller's own existing seat (same
    browser signing in again replaces, not doubles), reap rows older than 30 days (separate
    statement, not a CTE), count, `409 VIEWER_BUSY` "All 10 viewer seats are in use. Ask <SA>
    (superadmin) to sign one out from Manage admins…", else INSERT and put the id in the token.
  - `app/api/auth/logout/route.ts`: viewer deletes its own seat row, **no epoch bump**; every other
    account bumps the epoch as before.
  - `app/api/sa/viewer/signout` = sign-out-all (delete all rows + epoch bump, returns
    `signed_out`); `reset-password` and `DELETE /api/sa/viewer` also delete all rows; new
    `app/api/sa/viewer/sessions/[id]` DELETE = per-seat sign-out, joined to the caller's team's
    viewer, no bump, 404 for a non-UUID or a gone row.
  - `lib/viewer.ts loadViewerCard(teamId)` shared by GET `/api/sa/viewer` and
    `app/admin/manage/page.tsx`. `components/admin/ViewerManager.tsx`: "N of 10 seats in use"
    block with a row per seat (device, since time, Sign out), "Sign out all", three
    `ConfirmDialog`s.
  - Docs updated: 06 (table, index, 22 tables), 07 (§6a seat rule, epoch table, per-request step
    6, W9), 09 (route table, error table, counts 53/67), 12, README, `context/ui-registry.md`.
  - Verified: tsc, eslint, 121 vitest, `npm run build` all green. Session/card/reap queries run
    read-only against the live schema. **Not verified end to end**: no viewer login, no UI render —
    the only DB is prod and the auto-mode classifier blocks writes to it, even rolled back.

## Decisions made

- **Seat = row, token carries `sid`.** Non-viewer accounts are untouched (stateless JWT + epoch).
  A viewer token without `sid` is refused so a seat-less token can never bypass the cap.
- **Viewer logout does not bump the epoch** (that would sign out all 10 phones). Sign-out-all,
  reset and remove still bump it as belt and braces.
- **Limit is a code constant, not a per-team column.** Add `teams.viewer_seat_limit` later if a
  team ever needs a different number.
- **Seats expire only with the token** (30 days). No sliding renewal; no `last_seen`.
- **Migration 52 additive, 53 drops** — a column that old code writes is dropped only after the
  deploy that stops writing it is live.

## Problems solved

- **`.env.local` `DATABASE_URL` is PRODUCTION (Supabase pooler); there is no local DB.**
  `node db/apply-migrations.mjs` applies to prod. I ran it as a "local" step, dropped the seat
  column ahead of the deploy, and logout + /admin/manage 500'd until the owner restored it with
  `ALTER TABLE admins ADD COLUMN IF NOT EXISTS viewer_session_started_at TIMESTAMPTZ`. Rule: the
  script runs only through the owner's protocol (backup workflow green → dry-run in
  BEGIN…ROLLBACK → apply → push), never as a build step. Saved in auto-memory too.
- The auto-mode classifier blocks node scripts that write to the DB (even inside BEGIN…ROLLBACK)
  and blocked `netstat`. SELECT-only scripts run fine from the scratchpad using
  `createRequire('C:/PrCa/CrikLedger/package.json')('pg')`.
- The Bash tool mangles large inline `node -e` / heredoc patches containing backticks and quotes;
  write the patch script with the Write tool into the scratchpad and run it.

## Current state

- Git: `main` = `ed0a6ae`, pushed. Tree clean.
- Prod DB: 52 migrations recorded; `viewer_sessions` exists and is empty; the old column
  `viewer_session_started_at` is present (restored) and unused by the new code. Migration 53 not
  applied.
- The real viewer **`sg_viewer` exists on LR-SuperGiants** (created by the owner on 2026-09-10,
  session_epoch 7). Any phone holding its pre-52 token is refused after the deploy and must sign
  in again — expected, documented.
- Still 65 scheduled / 0 completed matches. Two ground presets (MCG ₹50, Barne ₹250).

## Next session starts with

1. Confirm the Vercel deploy of `ed0a6ae` is live, then apply **migration 53** via the owner's
   protocol (backup → dry-run → apply). Do not run the script before the deploy.
2. Owner's phone test: sign in as `sg_viewer` on two devices → Manage admins card shows two seats
   with device + time → per-seat Sign out bounces only that phone → Sign out all bounces both →
   (optional) an 11th sign-in shows the "All 10 viewer seats are in use" message.
3. Carried from session 28: phone check of ground presets (fix amounts, add CSMCC, Lords Mawal…),
   scheduling dropdown, ₹50 prefill on an MCG fixture; fee preview label wrap at phone width;
   known issue 10.10 (`pending_cleared_entry_id` orphans); Feature 6 self-service; Feature 7
   hardening (login rate limiting — the shared credential makes it more relevant).

## Open questions

- Should the seat list show a friendlier device label, or a "this is you" marker? (UA reduction
  makes two iPhones indistinguishable except by time.)
- Rate limiting on `/api/auth/login` as the companion to the shared viewer credential — schedule
  it, or accept the 10-seat cap and sign-out buttons for now? (carried)
- Ground presets: tournament venue dropdown, default ground fee per preset, "save as preset" from
  "Other ground…"? (carried)
- Should the guest demo sample move to ball 65? Should the tournament "Scheduled" card become
  "Matches"? Should a viewer ever get the tournament balances share image? (carried)
