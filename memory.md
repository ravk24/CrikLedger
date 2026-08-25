# Memory — session 21: match-fee rule fixed once and for all (drivers share the car pot); fee surfaces trimmed; tournament card loses its balance

Last updated: 2026-08-25 (session 21, end)

## What was built

All on `main`, pushed; working tree clean. Latest commits `be8070f` (fee rule), `9db07de` (PNG trim), `977e015` (same trim on-screen), `b2fd4a5` (toast trim), `647cefd` (tournament card). No DB migration this session; migrations 43 and 44 remain the latest applied.

### `be8070f` — one car-money rule everywhere
- `engine/calc.ts`: `carSplit` option deleted. `isSharer = broughtCar || sharedCar`; result gains `cashCosts`, `headCount`, `carCount`, `ownWayCount`. Header comment carries the full rule + a "do not reinstate" history note.
- `engine/tournamentFee.ts`: same fix in the per-match loop (`payCars` gone; `driverCredit = broughtCar ? allowance : 0`).
- `engine/calc.test.ts`, `engine/tournamentFee.test.ts`, `lib/demo/fixtures.test.ts` rewritten around the canonical examples + an invariant sweep. New `lib/format.test.ts`. 87 tests.
- `lib/matches.ts`, `lib/tournamentMatches.ts`: store the EFFECTIVE `shared_car` (`shared OR brought`) so `COUNT(shared_car)` = sharer count. `lib/validate.ts` unchanged shape (`shared_car` default false = own way).
- Wizard: `components/wizard/MatchWizard.tsx` and `components/guest/GuestMatchFlow.tsx` now track `ownWay` (the exceptions) instead of `shared`; everyone shares by default, new guests share, deselecting a player clears them from `ownWay`. `components/wizard/StepSharedCar.tsx` takes `carSharePerSharer`/`sharerCount`/`carCount` from the engine (its local `Math.ceil` is gone); drivers render ticked + locked ("Drove · shares"); "Everyone shared" master tick.
- Display: `lib/format.ts formatFee` + `components/shared/FeeAmount.tsx` — `₹5` to pay, `gets ₹53` when the team owes them. Used by `FeeTable`, `StepFeePreview`, `GuestMatchSheet`, `CostBreakdownFooter`; inlined in `app/api/share/match-sheet/route.tsx`.
- Totals: `app/matches/[id]/page.tsx` runs the engine once (`calc`) for the sheet payload AND `CostBreakdownFooter` (which now takes `result` and computes nothing). `StepFeePreview` takes `totals: PreviewTotals` (new fields `own_way_count`, `car_count`, `cash_costs`). `GuestMatchSheet` takes `result` only (no `rows` prop).
- Docs: README fee section, `CrikLedger-docs/08-business-rules.md` R-11..R-14b rewritten (worked examples + history note), `db/seed-matches-dev.sql` marks everyone shared and fixes the captain's stored fee (178 = −36 + 214), `lib/demo/fixtures.ts` ledger collection 2561 → 2572.

### `9db07de` — shared PNG trimmed
- `app/api/share/match-sheet/route.tsx`: no `Own way ₹…` footer segment, no `Guest fees charged to …` line; `ownWayCount`/`captainNote` removed from the zod schema, `MatchSheetPayload`, and both assemblers (`app/matches/[id]/page.tsx`, `GuestMatchSheet.tsx`). Footer: `Ground · Balls[ · Other] · Cars N × ₹A · Total · Per head · Surplus`.

### `977e015` — same trim on-screen
- `StepFeePreview` (Own way row + captain paragraph), `CostBreakdownFooter` (Own way + "Guest fees via" rows; `guestFee`/`captainName` props removed), `GuestMatchSheet` (Own way + Guests lines), `FeeTable` (the "guests transferred their fee to the captain" paragraph). `PreviewTotals.own_way_count` and `MatchFeeResult.ownWayCount` still exist for the engine/tests; nothing renders them.

### `b2fd4a5` — wizard completion toast
- `components/wizard/MatchWizard.tsx` `handleSubmit`: toast is now only `Collected ₹x · ₹y surplus credited to pool` (or `… (₹z ground fee recouped)`); the `· ₹n guest fees deducted from <captain>` tail is gone. `body.data.guestFee` / `captainName` are still returned by the API, just unused here.

### `647cefd` — tournaments directory card
- `components/tournaments/TournamentCard.tsx` (only used by `app/(app)/tournaments/page.tsx`): the green `fund_balance` `<Money variant="balance">` on the right is removed; card = trophy + name + subtitle. `TournamentPublic.fund_balance` stays for the tournament Home tab / ledger.

## Decisions made

- **THE fee rule (Ravi, locked 2026-08-25; also in auto-memory `crikledger-fee-rule-locked`):** base = ground+balls+other across ALL heads (players + guests), `baseShare = ceil(base/H)`; car money = cars × allowance as ONE pooled pot split evenly across everyone who rode — **drivers included** (`S = shared OR brought`), never per car; rider = base + car, own way = base, driver = base + car − allowance (may be negative). Total shown = cash + cars everywhere; surplus = collected − cash. Two separate ceils are canonical. Canonical: 2500+60, A 250, 11 players (3 drivers) + 2 guests all shared → 197 + 58 = 255 / drivers 5 / surplus 5; guests unticked → 69 → 266 / 16 / guests 197 / surplus 10. A solo driver nets the base share.
- Wizard default: everyone ticked, drivers locked on, admin unticks own-way people.
- Display convention: never a bare `+₹`/`−₹` on a per-person fee (Ravi reads "+5" as "pays 5"); tournament *statement* rows keep signed amounts because they are ledger deltas.
- Every fee surface stays minimal (PNG `9db07de`, on-screen `977e015`): rows + Total / Per head / Collected / Surplus; no "Own way" line, no "guest fees charged to the captain" sentence anywhere. The captain's "incl. ₹x guest fees" sub-label in FeeTable and the charge-only GUEST FEES row stay (they explain a number, not the rule). The completion toast follows the same rule (`b2fd4a5`).
- The `/tournaments` list card shows no money figure (`647cefd`); a paid-tournament user sees the fund balance only inside the tournament.
- `shared_car` columns stay (no migration) and now mean "funded the car pot" (drivers always true).

## Problems solved

- Root cause of "wrong calculation every time": commit `1c680ee` (2026-08-20) encoded "a driver is never a sharer" + no rebate when nobody ticked shared; it was documented as a FACT (R-14b), copied to tournaments (`876bc43`) and locked by tests, so later sessions preserved it. README/seed/migration comments described a *third* model. Fixed by collapsing to one model and rewriting docs/tests; SQL comments in `db/migration-7/-25/-34/-39.sql` are stale prose (noted in R-14b), SQL untouched.
- Five re-implementations of Total/Surplus disagreed (`/matches/[id]` PNG printed cash-only Total; demo printed cash + cars; `CostBreakdownFooter`, `StepFeePreview`, `StepSharedCar` recomputed locally) — all now read engine output.
- Bash heredocs with large Python scripts broke on Git Bash quoting; writing the script to the scratchpad and running `python <file>` works.
- Verifying the PNG: `npm run build && npm start`, POST a JSON payload to `/api/share/match-sheet`, Read the PNG; then kill the port-3000 node child (`netstat -ano | grep :3000` → `taskkill //F //PID … //T`).

## Current state

Deployed to main → Vercel (`647cefd`). `tsc`, `eslint`, 87 vitest tests, `next build` all green (pre-existing `[ops/accounts]` cookies-during-prerender line, exit 0). PNG verified from the built server for the canonical examples. Prod DB still has no completed matches, so the wizard defaults/`ownWay` flow and the real match page footer were verified by type-check + tests + PNG, not on device.

## Next session starts with

On-device walk of the fee flow with the new rule: (1) demo sample → "Who shared the car" shows all ticked, 3 drivers locked "Drove · shares", caption "₹750 … 11 ways — ₹69 each"; add 2 guests → "13 ways — ₹58"; preview riders ₹255 / drivers ₹5 / footer `Total ₹3,310 · Per head ₹255 · Surplus ₹5`; untick both guests → 266 / 16 / 197, and no "Own way" or guest-charge line on screen or on the PNG. (2) Complete a real match with those inputs → FeeTable, footer and PNG agree; ledger "Match surplus +₹5"; captain balance moves by own fee + 510; edit → guests unticked → surplus row ₹10. (3) Tournament: one match, 11 players, 3 drivers, defaults, joining fee 2,560 → driver charge 52, rider 302, fund surplus 12; confirm the `/tournaments` card shows no ₹ figure. Then continue the session-20 device walk (onboarding checklists, captain phone + WhatsApp fee message, Schedule hub dues share).

## Open questions

- Migrate the ~15 remaining hardcoded contact literals to `lib/contact.ts`? Still deferred.
- Old tournament matches-list URL redirect streams as HTTP 200 + redirect payload — fine for browsers; revisit only if SEO matters.
