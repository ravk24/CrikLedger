# Memory — session 28: single-ceiling fee rounding, fee preview columns, ball default 65

Last updated: 2026-09-10, late morning

## What was built

- **Single-ceiling fee rounding (rule change, uncommitted at the time of writing).** Owner's phone
  screenshot showed 11 players / 3 cars / cash 3,565 → per head 394, surplus 19; they expected 393
  and 8. Cause: `engine/calc.ts` CEILed the cash share and the car share separately, so the two
  remainders added (up to 2×heads). Now `sharerFee = CEIL(cash/H + pot/S)` computed on integers
  `(cash·S + pot·H)/(H·S)`, own-way stays `CEIL(cash/H)`, and `carSharePerSharer` is exported as
  `sharerFee − baseShare` so every "Per head = perPlayerFee + carSharePerSharer" consumer is
  untouched. Surplus is now strictly below the head count. `engine/tournamentFee.ts` mirrors it
  (`(joiningFee·sharers + pool·N·att)/(N·att·sharers)`). New `engine/reconstruct.ts`
  (`reconstructMatchFees`) rebuilds a completed match's figures from the stored
  `match_participants` rows; `app/matches/[id]/page.tsx` uses it instead of re-running the engine,
  so a match always agrees with its own FeeTable whichever rule wrote it. Tests: `calc.test.ts`
  (two pins changed: demo case 301/51/2561/1, guest-driver case 300/50/3350/0; property test now
  asserts surplus < heads and the integer ceiling), `tournamentFee.test.ts` (canonical 301/51/2561/1),
  `lib/demo/fixtures.ts` + test (ledger row 2572 → 2561, guest cases 276 and 282),
  `engine/reconstruct.test.ts` (6 cases incl. old-rule rows 302/52 → 2572/12). Copy:
  `StepSharedCar` caption "about ₹68 each". Docs: README rule block + worked example 3,
  `CrikLedger-docs/08-business-rules.md` R-11/R-13 + "History 2 (2026-09-10)". 106 tests, tsc, eslint green.

- **Fee preview summary layout** (`components/wizard/StepFeePreview.tsx`, commit `ec0dbb2`): the five totals rows (Cars, Total match cost, Per head, Collected, Rounding surplus) now render through a local `SummaryRow` helper. Label column is `min-w-0 flex-1` and wraps inside its width; amount column is `<Money>` with `w-24 shrink-0 whitespace-nowrap text-right`, so a signed five-digit value (`+₹12,345`) stays on one line and every amount shares a right edge. `items-baseline gap-3` keeps the amount on the label's first line. Colours and weights unchanged. Prompted by the owner's screenshot where "Rounding surplus credited to pool" wrapped and "+₹10" split across two lines.
- **Ball cost prefill 60 → 65** (`components/wizard/MatchWizard.tsx`). This literal is the only product default: the DB column default stays 0, the zod schema has no default, edit mode reseeds from the stored row.
- `context/ui-registry.md` StepFeePreview entry notes the `SummaryRow` pattern.

## Decisions made

- **Rounding rule (owner, 2026-09-10):** single ceiling per head; the 2026-08-25 "two ceilings are
  canonical" text was wrong about the size of the effect. Old matches keep stored fees and are
  displayed from them (no re-save, no balance change); tournaments mirror the change; settled
  tournaments untouched. In practice the DB had **0 completed matches and 0 participant rows** on
  2026-09-10 (65 scheduled), so nothing historical was affected.

- **Guest demo fixture stays at ball 60** (`lib/demo/fixtures.ts`). `lib/demo/fixtures.test.ts` pins the sample to the canonical 2560-cost numbers (total 3310, per head 233, collected 2572, surplus 12) and `DEMO_LEDGER[0]` / `DEMO_POOL_BALANCE` depend on them. Bumping it means re-deriving that chain; only the comment changed. Revisit if the owner wants the demo to match the live default.
- Sibling read-only renderings of the same totals (`components/matches/CostBreakdownFooter.tsx`, `components/guest/GuestMatchSheet.tsx`, `app/api/share/match-sheet/route.tsx`) were left alone; the screenshot was the wizard step only.
- No per-team ball-price setting was added. `teams` has `status_threshold` and `car_rate_per_km` but no ball fee column; if the owner wants per-team defaults later, thread it the way `initialGroundFee` already reaches `MatchWizard`.

## Problems solved

- **"Stale client bundle" in the dev tab is the app's own service worker.** `public/sw.js` v7
  caches `/_next/static/*` cache-first on the assumption the URLs are content-hashed. In `next dev`
  they are not, so the tab keeps old chunks across edits and even across server restarts (a hard
  reload does not help). Fix during verification: in the tab run
  `navigator.serviceWorker.getRegistrations()` → unregister all, `caches.keys()` → delete all, then
  navigate again. Production is unaffected (hashed URLs).
- **Old dev server survives TaskStop.** Stopping the background task leaves `next dev` (its own
  PID) on port 3000; a later `npm run dev` exits 1 "port in use". After engine edits that process
  returned 500 on `/matches/[id]` ("Failed to generate static paths … Jest worker"). `taskkill //PID
  <pid> //F` then start again.
- **Ad-hoc read-only DB queries:** `node --input-type=module < script.mjs` from the project root
  (so `pg` resolves), reading `DATABASE_URL` from `.env.local`; a script placed in the scratchpad
  cannot import `pg`.

- **Reaching the wizard in the browser:** `/matches/new` is a 404. The paid wizard opens from a scheduled match page via **Complete match** (`MatchAdminActions`), then Won → costs → players → guests → car fee (toggle "Ignore car fee") → fee preview. Stop before "Submit match"; Escape closes the sheet without writing. No match was recorded during verification.
- **Chrome driving:** coordinate clicks land off-target in the owner's browser (they closed the sheet by hitting the backdrop); `find` + click-by-ref and `form_input` work every time. The first screenshot after an action usually times out at 30 s — retry once and it succeeds. `resize_window` reports success but the window stays wide, so a true phone-width check of the label wrap was not possible from the desktop.
- **Dev server from the Bash tool:** `npm run dev > log &` with run_in_background exits without the server. Run `npm run dev` directly with run_in_background and poll `netstat` for port 3000; stop it with TaskStop afterwards.

## Current state

- **Git:** `main` at `eb8f1f8` (notes) on top of `ec0dbb2` (fee preview columns, ball 65), pushed.
  **The rounding change is in the working tree, not committed** — 9 modified files plus
  `engine/reconstruct.ts` and `engine/reconstruct.test.ts`. Verified in the local app: the same
  11-player / 3-car / 3,565 case now previews 393 / 3,573 / +8 (nothing submitted).
- **Verified:** tsc clean, eslint clean on the three files, `vitest run lib/demo engine` 47/47. In the local app: Costs step prefilled Ball cost 65; with a 90000 ground fee the fee preview showed `₹90,065` / `₹22,517` / `₹90,068` / `+₹3` on one line each, right-aligned.
- **Not verified:** the wrapped-label case at real phone width. The CSS makes it deterministic, but eyeball it on the phone after the deploy.
- DB: 50 migrations on prod; no migration this session. No real viewer login exists yet (carried from session 27).

## Next session starts with

0. If the rounding change is still uncommitted: `git status`, re-run `npx vitest run`, commit as
   `feat(engine): one ceiling per head …` and push when the owner says so.
1. On the phone after the deploy: open a scheduled match → Complete match → fee preview and confirm the surplus label wraps inside the left column with the amount on one line, and that the 11-player case reads 393 / +8. Because the phone's service worker caches static chunks, the first load after a deploy is fine (hashed URLs), no action needed.
2. Carried from session 27: create the real team viewer from Manage admins (user id + password), share in the group, have a second player try to sign in while the first is in — expect the "already in use … Ask Ravi Kant" message; then try Sign out the viewer from the card.
3. Carried: known issue 10.10 (abandon and completed-match DELETE still orphan `pending_cleared_entry_id`); browser check of the delete-from-ledger flow as a non-super admin.
4. Backlog (owner's rough priority): Feature 6 self-service (team settings UI, proper password change, account deletion, email password reset); the one-year-term contradiction (`entitlements` has no `expires_at`, Terms say no subscription); Feature 7 hardening (login rate limiting — more relevant with a shared viewer credential — bcrypt cost, audit log).

## Open questions

- Should the guest demo sample also move to ball 65, accepting the re-derived fixture numbers?
- Should the tournament schedule tab's "Scheduled" card also become "Matches"? (carried)
- Should a viewer ever get the tournament balances share image, or is view-only final? (carried; today refused with `VIEWER_READ_ONLY`)
- Rate limiting on `/api/auth/login` as the companion to the shared viewer credential — schedule it, or accept the seat message for now? (carried)
