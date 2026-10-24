# Memory — session 38: ledger filter becomes a funnel icon; share-image button retired

Last updated: 2026-10-24 (session 38; earlier sessions kept below)

## Session 38 (2026-10-24) — Filter icon replaces the share icon and the dropdown row

Owner's ask (phone screenshot of /pool + caption): "Not liking this filter drop down design.
Remove the share icon and add one filter icon; one orange dot if any filter is applied, no dot
otherwise; remove the filter drop down." Follow-up: a proper funnel icon, not a kebab/dots glyph.

**Built and pushed: commit `f200486` on main (7425a62..f200486) on the owner's "commit and
push"; no migration — still 57. Vercel deploys from main.**
- `components/pool/LedgerFilter.tsx` rewritten: lucide `Filter` (funnel) in the old share
  button's `size-11` cell recipe; `bg-low` dot (`size-2.5`, `ring-2 ring-surface`, top-right)
  only when `value !== "all"` — `low` (#d97706) is the project's orange, Tailwind palette
  classes are banned; tapping opens a hand-rolled menu (AccountMenu recipe: `w-56`, `role=menu`,
  `menuitemradio` rows at `min-h-11`, `Check` on the active one, Escape / outside tap / select
  close). Same `router.push("/pool?kind=…")` as before; re-picking the active option is a no-op.
- `PoolAdminSection`: `filter` slot prop removed; the toolbar's third cell is now
  `<LedgerFilter value={activeFilter} />`; `DownloadImageButton` import gone. The `LedgerFilter`
  type is imported as `LedgerFilterValue` to dodge the component name (same alias the page uses).
- `app/(app)/pool/page.tsx`: viewer/megaadmin branch wraps the button in `flex justify-end`
  (list and filtered-empty branches alike); no longer passes `filter=`.
- **Retired from the UI: the ledger share image.** The share button was the only caller of
  `GET /api/share/ledger`; the route and `DownloadImageButton` stay in the tree with no caller
  (same treatment as the retired XLSX export). Owner asked for the removal explicitly.
- Docs: README `/pool` row, 02 (filter FACT + retirement note), `context/ui-registry.md`
  (LedgerFilter entry rewritten with a class table; PoolAdminSection and DownloadImageButton
  entries). 09 untouched (route unchanged).
- tsc clean, lint 12 warnings (baseline), vitest 145. Not browser-checked signed in (no
  credentials); guest `/pool` unaffected (DemoLedger has no filter).

**Phone check list:** toolbar = Credit / Debit / funnel, no share button, no dropdown row;
funnel opens a 9-row menu with a tick on the active row; picking Deposits reloads filtered and the
funnel gains the orange dot; All entries clears it; viewer login sees the funnel right-aligned
above the list; "Show older entries" keeps `&kind=`.

**Current state:** code and docs pushed (`f200486`); this notes file is the only later change.
Sessions 31–38 are all still unverified on the owner's phone — one check after this deploy
covers them.

**Next session starts with:** the owner's phone-check verdict on the funnel (list above). If the
amber `low` dot does not read as orange on the phone, the only knob is the token: do not reach
for a Tailwind palette class (banned by `context/ui-rules.md`). Pending from earlier sessions:
Abhishek's real ₹5,000 withdrawal, Feature 6 self-service, login rate limiting.

**Open questions:** none from this session. The ledger share image is retired from the UI by the
owner's explicit ask; its route stays in the tree — delete it only if the owner says so.

## Session 37 (2026-10-23) — Ledger kind filter

Owner's ask (phone screenshot of /pool + caption): one filter option on the Ledger to see auto
match deductions, season dues, withdrawals, expenses, common expenses, match fees, deposits —
available to viewers too — and "how expensive is this filter; should viewers get it or not?"

**Answer given:** cheap — one filter change costs exactly one `/pool` page load, the same as
"Show older entries" (one ledger query of ≤51 rows on the existing
`pool_entries_team_kind_date_idx`, no COUNT, no migration; a filtered page is never heavier than
the unfiltered one; the removed XLSX export was ~28 KB ≈ 1.5 page views). **Viewers get it.**

**Built (uncommitted at the time of writing, no migration — still 57):**
- `lib/poolKinds.ts`: `LedgerFilter` union, `LEDGER_FILTERS` (All entries · Deposits · Match
  collections · Match fees · Expenses · Common expenses · Withdrawals · Season dues · Other
  income), `ledgerFilterDef`, `parseLedgerFilter` (unknown → all), `rowMatchesFilter`.
  **Decision: a match fee is not a kind** — fee rows are `plain_debit` / `other_income` — so
  "Match fees" = `match_id IS NOT NULL` in `pool_ledger_public` (fee rows, pending-cleared
  slices, `match_refund`), and "Expenses" / "Other income" = that kind with `match_id IS NULL`.
  Legacy kinds (`ground_booking`, `equipment`, `expense_recovery`) only under All.
- `app/(app)/pool/page.tsx`: reads `?kind=` next to `?page=` inside the Suspense hole; applies
  `.in("kind", …)` / `.not|.is("match_id", …)` to the server query (**server-side on purpose —
  the list is paged at 50, so a browser filter would miss older pages**); "Show older entries"
  carries `&kind=`; the control renders for both branches (admin: slotted into
  `PoolAdminSection` via new `filter` prop + `activeFilter`; viewer/megaadmin: above the plain
  list). Filtered empty state = new `components/pool/LedgerEmptyFiltered.tsx` ("No <label> yet."
  + "Show all entries" link); unfiltered empty copy unchanged.
- `components/pool/LedgerFilter.tsx` (client): `<select>` (ScheduledMatchList recipe, `h-11`),
  `router.push("/pool?kind=…")`, no `useSearchParams`.
- `PoolAdminSection`: an optimistic add whose row the active filter would hide is not shown.
- `types/index.ts`: `PoolEntryKind` gains the missing legacy `expense_recovery`.
- Tests: 5 new in `lib/poolKinds.test.ts` (vitest 145). tsc clean, lint 12 warnings (baseline).
- Docs: 02 (B2 FACT + frontend row), README `/pool` row, `context/ui-registry.md`
  (LedgerFilter / LedgerEmptyFiltered entry). 09 untouched (no API change). Share image
  unchanged (latest 20, all kinds). Tournament ledger has no filter (different kind set).

**Verified:** every filter's PostgREST query run read-only against prod `pool_ledger_public`
for the owner's team: all=96 = deposit 40 + match_collection 8 + match_fee 25 + expense 7 +
common 2 + withdrawal 3 + season_due 6 + other_income 5 (match-fee rows are plain_debit +
other_income, as designed). **Not browser-checked as a signed-in user**: dev server on
localhost:3000 holds no session and I have no credentials; the guest sample rendered fine.
Phone check list: dropdown sits under Credit/Debit/share; each option narrows the list; "Show
older entries" keeps the filter; an empty option shows "No … yet." + Show all; viewer login sees
the same dropdown without the toolbar.

**Rollout:** commit on the owner's word → push on the owner's word → phone check. No migration.

Gotcha this session: `npm run dev &` inside a backgrounded Bash call leaves an orphaned `next
dev` holding the port after the shell exits — start it with `run_in_background` directly.

## Session 36 (2026-10-17) — Tie result + result-aware share captions

Owner's ask: a third button "Tie" on the wizard's first step, and the match-sheet share caption
should open with a result line (Congratulations 🎉 / Hard luck / tie) and then say either "fee has
been deducted from all players" (no guests) or "the players below need to transfer their fee to
the captain" (guests), grammar tidied.

**Built (uncommitted at the time of writing):**
- `db/migration-57.sql` (new, in `AUTOCOMMIT_FILES`): `ALTER TYPE match_result ADD VALUE 'tie'`;
  `tournament_matches_result_check` dropped and re-added with `tie`. No view touched (they only
  SELECT the column), so no `security_invoker` work. **Applied to prod by the owner 2026-10-17**
  (`node db/apply-migrations.mjs`: "1 applied, 56 previously applied, 57 total"). Verified
  read-only: `match_result` = won, lost, tie; `tournament_matches_result_check` admits tie; the
  auto-name from migration 22 matched. Deploy is now safe.
- `types/index.ts` `MatchResult` = won | lost | tie; `lib/validate.ts` `matchSubmitSchema.result`
  enum widened (tournament schema derives from it). Wizard/demo state now typed `MatchResult`.
- `components/wizard/StepResult.tsx`: three cards, `grid-cols-3`; Tie selected = `border-low
  bg-low-light text-low-foreground` (amber; grey already means Abandoned). Error copy "Pick Won,
  Lost or Tie." (`MatchWizard.tsx`). Guest demo renders the same component.
- `components/shared/ResultBadge.tsx`: new `tie` state, label "Tie", `bg-low-light
  text-low-foreground`. Before this a tie would have rendered as Lost.
- `lib/feeMessage.ts`: `resultOpener(result)` + both builders take `result`; `MatchSheetMessage`
  carries `result` on both variants. Texts: won "Congratulations team 🎉 on winning the match!",
  lost "Hard luck team — we'll come back stronger next time 💪", tie "Well played team — a tie! 🤝";
  blank line; no guests "Please refer to the match sheet above — the fee mentioned against each name
  has been deducted from every player's deposit." ("has been", not "will be" — the debit lands on
  submit); guests "Please refer to the match sheet above — the players listed below need to
  transfer their fee to captain <Name>: <phone>." + tick-off list. Session-33 rule kept: guests
  present with no captain phone → no caption. `app/matches/[id]/page.tsx` passes `match.result`
  (guard `!match.result` only narrows the type; `completed_has_result` makes it non-null).
- Guest demo: `GuestMatchSheet` takes `matchResult` (from the flow's chosen result) so the sample
  caption gets the same opener; its no-guests behaviour (no caption) unchanged.
- Tests: `lib/feeMessage.test.ts` rewritten (opener × body). Docs: 09 (submit input, share note),
  06 (m57 row, enum, tournament CHECK), 08 R-26, 02 B4 + D2 (caption rule verbatim), ui-registry
  (ResultBadge, wizard entry — also fixed its stale "6-step" wording to 8), ui-tokens (`low` row).

**Rollout:** migration 57 is in (2026-10-17). Remaining: commit → push on the owner's word → phone
check.

**Not browser-checked** at the time of writing. Phone check list: wizard step 1 shows three cards,
Tie selects amber, submit stores it, card + page badge read "Tie"; share caption on a no-guest
match = opener + deposit line, with guests = opener + transfer list; guest demo step 1 same cards.

## What was built

Session 34 (2026-09-16), two code commits on `main`, both pushed on the owner's explicit
instruction ("push it", "commit and push"). Migration 55 applied to prod by the owner.

**`fd28c95` feat(pool): withdrawal ledger kind (migration 55)** — prompted by Abhishek Khare
(LR-SuperGiants): ₹19,000 deposited, pool at ₹5,000, wants ₹5,000 back as its own ledger line
rather than by shrinking the deposit row.
- `db/migration-55.sql` (autocommit; registered in `AUTOCOMMIT_FILES` in `db/apply-migrations.mjs`):
  `pool_entry_kind` gains `withdrawal`; `sign_matches_kind` puts it in the `< 0` list;
  `withdrawal_has_player`; `player_balances` deposit leg becomes `kind IN ('deposit','withdrawal')`;
  `player_statement` gains a fifth UNION branch; `pool_entries_team_player_kind_idx` widened. Both
  views re-created `WITH (security_invoker = true)`. `pool_balance` and `pool_ledger_public` untouched.
- `lib/poolKinds.ts` (new) + `lib/poolKinds.test.ts` (11 tests): `MANUAL_KINDS`, `PLAYER_LINKED_KINDS`,
  `NEGATIVE_MANUAL_KINDS`, `isManualKind/isPlayerLinked/isNegativeManual`, and `ledgerRowTitle`
  ("Deposit by X" / "Withdrawal by X" / "Season due — X" / message). Used by `app/api/pool/credit`,
  `app/api/pool/debit`, `app/api/pool/entries/[id]`, `PoolAdminSection`, `LedgerRow`, and
  `app/api/share/ledger/route.tsx` (its duplicate `rowTitle` deleted).
- `app/api/pool/debit/route.ts`: player-linked branch — locks the player `FOR UPDATE`, refuses
  inactive/other-team (`422 INACTIVE_PLAYER`), refuses a withdrawal above the player's balance
  (`422 EXCEEDS_BALANCE`, "<name>'s balance is ₹X — a withdrawal cannot exceed it"), inserts negative.
- `components/pool/DebitSheet.tsx`: kind control + player `<select>` (copied from CreditSheet);
  `PoolAdminSection` passes `players` and uses the helpers; `StatementList` shows/edits withdrawal rows.
- `types/index.ts`: `"withdrawal"` added; `ground_booking`/`equipment` marked LEGACY.

**`a5d45ee` refactor(pool): Credit sheet drops ground booking; season due moves to Debit**
- CreditSheet = Player deposit · Other income (2-up). DebitSheet = Expense · Withdrawal · Season due
  (3-up, `grid-cols-3`; label shortened from "Last season due" to fit 360px). Per-kind copy in
  `PLAYER_KIND_COPY`. Common switch + split preview are expense-only.
- `poolCreditSchema.kind` = deposit|other_income (no negation in the credit route any more);
  `poolDebitSchema.kind` = expense|withdrawal|opening_due (player-linked kinds need `player_id`,
  refuse `common`). Debit route handles `withdrawal || opening_due` in one branch; the balance
  guard applies to withdrawals only.
- Ground booking retired: option, form fields and route branch removed; `groundBookingSchema` and
  `lib/bookings.ts` deleted. No migration — `ground_booking` enum value and `ground_bookings`
  table stay as legacy (old rows keep the BOOKING chip, still editable).
- Docs in step: README (ledger table + sheet sentence), `CrikLedger-docs/06` (11 kinds, constraints,
  views, index, AUTOCOMMIT set), `08` (new R-32a Withdrawals; R-32 → Debit sheet; R-06 retired;
  §5 ground booking marked RETIRED; R-31/39/41/43/46 touched), `02` (B2 sheets; B5 RETIRED), `09`
  (credit/debit/entries/schedule/clear-pending rows), `dropped-home_match-feature.md` §2 update,
  `context/ui-registry.md` (sheets, LedgerRow title rule), `context/architecture.md` enum line.

**`0f98bc4` ui(more): feedback becomes a tile, grid always 4x2 (pushed on "push it")** — owner screenshot:
the More grid ended with an empty cell (Purchases only appeared for signed-in admins → 6 or 7
tiles) and a differently shaped "Help us make CrikLedger better" card under it. Now Purchases keeps
its slot for everyone (disabled when not entitled, the file's disabled-not-hidden rule) and an
eighth tile "Suggest a feature" (MessageSquarePlus, accent chip) links to a new static
`app/(app)/feedback/page.tsx` holding the old card verbatim (WhatsApp filled / Email outlined,
strings from `lib/contact.ts`). `/feedback` added to `MORE_ALSO` in `lib/nav.ts`. `/more` is now
eight equal tiles and nothing else. `context/ui-registry.md` gained "More page" and "Feedback page"
entries and lost two stale tile mentions.

**`0c6f5aa` feat(tournaments): Credit/Debit on the Ledger tab with the team's kinds (migration 56); drop admin money tiles (NOT pushed; **migration 56 applied to prod 2026-09-16 10:15Z by the owner and verified read-only**: 8-kind CHECK, widened sign CHECK, `t_withdrawal_has_player`, both player views keep `security_invoker=true` and contain the withdrawal leg/branch, `_migrations` has 56)** — owner request. Team `/admin` lost its "Pool credit" / "Pool debit" shortcut tiles; the tournament Admin tab lost its Credit / Debit tiles (Details is now a full-width `col-span-2` card so five tiles leave no hole). The tournament Ledger tab gained the `/pool` toolbar (`grid-cols-2`, no share image) and reuses `CreditSheet` / `DebitSheet`, which now take `endpoint`, `title`, `fundNoun`, `kinds` props (tournament passes `kinds={["expense","withdrawal"]}` — no Season due). `db/migration-56.sql` (ONE transaction, TEXT+CHECK swap, NOT in AUTOCOMMIT_FILES): `tournament_entries` kinds + `other_income` / `plain_debit` / `withdrawal`, `t_sign_matches_kind` widened, `t_withdrawal_has_player`, `tournament_player_balances` deposit leg → `IN (deposit, withdrawal)`, `tournament_player_statement` + withdrawal branch, both `WITH (security_invoker = true)`. `lib/tournaments.ts`: `addCredit` / `addDebit` (withdrawal guard `422 EXCEEDS_BALANCE` via `tournament_player_balances`; tournament keeps `409 PLAYER_INACTIVE`), `editEntry` / `deleteEntry` gate on `lib/poolKinds` helpers. Routes `/api/tournaments/[id]/credit` + `/debit` replace `/deposit` + `/expense`; `tournamentCreditSchema = poolCreditSchema`, new `tournamentDebitSchema`; `TournamentDepositSheet.tsx` / `TournamentExpenseSheet.tsx` deleted. `TournamentStatementRow` shows withdrawals. vitest 138. Docs: 06 (8 tournament kinds + constraint table, views, m56 row), 08 (R-72, new R-74a, R-85), 09, 02 (C1), 15 (D14), ui-registry (sheet props, TournamentLedgerSection, Admin consoles note), README route table.

## Decisions made

- **Withdrawal guard (owner's pick):** refuse an amount above the *player's* balance; the *pool* is
  not guarded (like any plain debit it may go negative). Edits of a withdrawal are not re-checked.
- **Withdrawal lives on the Debit sheet** with a player picker, mirroring deposit on Credit (owner).
- **Sheets split by sign** (owner agreed with my recommendation): everything on Credit adds to the
  pool, everything on Debit subtracts, so `opening_due` moved to Debit as "Season due".
- **Ground booking retired** (owner): scheduling a match with "Credit to Pool" records the income
  as `other_income`; a match-less ground rental is "Other income" with a message. My check: the
  `ground_bookings` row had been unread since migration 46. Dropping the table/enum value is a
  possible future migration 56, not needed.
- `lib/poolKinds.ts` is the single home for kind lists — add any new kind there first.
- A season due is a debt being recorded, not cash leaving, so it skips the balance guard.
- Money entry lives on a Ledger page only — no Credit/Debit tiles on either admin console (owner).
- Tournament ledger = team ledger minus Season due; same withdrawal guard (player balance only).
- `lib/poolKinds.ts` serves both ledgers unchanged (tournament auto kinds are simply not manual).
- More drawer rule: a tile that needs copy or actions links to its own route, never a different
  card shape under the grid; the tile count stays even by disabling, not hiding.

## Problems solved

- Nothing hard. Reminders that saved time: `CREATE OR REPLACE VIEW` must restate
  `WITH (security_invoker = true)` (verified after apply: all four views still have it);
  enum-adding migrations go in `AUTOCOMMIT_FILES`; the classifier blocks reads of prod *player*
  data from ad-hoc node scripts ("Production Reads") but allowed a schema-only check via a
  scratchpad `.mjs` importing `file:///C:/PrCa/CrikLedger/node_modules/pg/lib/index.js`.

## Current state

- `main` = `origin/main` = `da9558a` (session 36, pushed 2026-10-17 on the owner's "commit and
  push"; this notes commit follows). tsc clean; eslint 12 pre-existing warnings; vitest **140**.
- **Prod DB: 57 migrations applied** (57 at 2026-10-17 05:37Z, via the script, by the owner —
  before the push, so the deploy is safe). Verified read-only: `match_result` = won, lost, tie;
  `tournament_matches_result_check` admits tie (the migration-22 auto-name matched); no view touched.
- Session 36 was built with no dev server and no admin session — **not browser-checked**.
  Sessions 31–36 are all unverified on the owner's phone.
- Earlier carried state: LR-SuperGiants pool read ₹4,904 on 2026-09-16; Abhishek Khare's ₹5,000
  withdrawal still to be recorded; duplicate "Fearless Fighters" test-match deletion status unknown.

## Next session starts with

0. Phone check after the `da9558a` deploy: complete a scheduled match — step 1 shows Won / Lost /
   Tie, Tie selects amber, submit stores it, the match card and match page badge read "Tie" (also
   on a tournament match). Share a completed no-guest match: the copied caption is the result line,
   a blank line, then "…has been deducted from every player's deposit."; with guests: result line,
   then the transfer-to-captain list. Guest demo step 1 shows the same three cards.
1. Carried from sessions 34–35: team `/admin` has no money tiles; tournament Admin tab five tiles,
   Details full-width; tournament Ledger tab Credit / Debit (Expense · Withdrawal, 2-up); `/more`
   8 tiles in 4 even rows (Purchases greyed for `sg_viewer`); Ledger → Credit = Player deposit ·
   Other income, Debit = Expense · Withdrawal · Season due, "Season due" not clipped; wizard footer
   reads plain "Next".
2. Record Abhishek Khare's real ₹5,000 withdrawal from the Debit sheet (pool was ₹4,904 — expect
   it to go to about −₹96 unless topped up; above-balance amounts get `EXCEEDS_BALANCE`).
3. Carried checks from 31–33: match-sheet guest glyph / VC / "Ball ₹65", footer credit line,
   tournament bar "Back" + "Matches" card.
4. Carried: Fearless Fighters test-match deletion; viewer-seat phone test; ground presets phone
   check; fee preview wrap; Feature 6 self-service; Feature 7 hardening (login rate limiting).

## Open questions

- Should the shared match-sheet PNG itself show the result (Won / Lost / Tie)? Today only the
  copied caption does (owner did not ask for it on 2026-10-17).
- Drop the legacy `ground_bookings` table and `ground_booking` enum value (migration 56)? Not urgent.
- Should the LedgerRow give withdrawal rows a chip (like SEASON DUE), or is the red amount enough?
- Carried: VC mark on the on-screen fee table; VC in the guest demo fixtures; abandon reason on
  `match_refund` rows; seat-list device labels; rate limiting on `/api/auth/login`; ground preset
  extras; viewer access to the tournament balances share image.
