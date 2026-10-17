# Memory — session 36: Tie result (m57 applied) + result-aware share captions

Last updated: 2026-10-17 (session 36; earlier sessions kept below)

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

- `main` = `0c6f5aa` (tournament ledger, NOT pushed) on top of `origin/main` = `0f98bc4`; only `memory.md` dirty. tsc clean; eslint 12 pre-existing warnings;
  vitest **137** passing (126 + 11 in `lib/poolKinds.test.ts`).
- **Prod DB: 56 migrations applied** (56 at 2026-09-16 10:15Z, via the script; deploy of `0c6f5aa` is now safe). Earlier: (55 at 2026-09-16 09:20Z, via the script). Verified
  read-only: enum has `withdrawal`, constraints present, views keep `security_invoker=true`,
  index widened, `_migrations` has 55.
- LR-SuperGiants pool balance read ₹4,904 at the time (not ₹5,000). Abhishek's own balance could
  not be read (classifier).
- **Nothing from session 34 is browser-checked** (no dev server, no admin session). Sessions
  31–34 are all unverified on the owner's phone.
- Carried from session 30, status unknown: deletion of the duplicate "Fearless Fighters" test match.

## Next session starts with

-1. Push `0c6f5aa` on the owner's word (migration 56 is already in). Then phone: team `/admin` has no money tiles (even grid); tournament Admin tab five tiles, Details full-width; tournament Ledger tab shows Credit / Debit for an admin on an active tournament — Credit = Player deposit · Other income, Debit = Expense · Withdrawal (2-up); a withdrawal above balance is refused; rows read "Withdrawal by X"; player page statement shows it; a completed tournament shows no buttons.

0. Owner phone check after the `0f98bc4` deploy: `/more` shows 8 tiles in
   4 even rows for admin and for `sg_viewer` (Purchases greyed for the viewer); "Suggest a feature"
   opens `/feedback` with the two buttons. Then the sheets: Ledger → Credit shows Player deposit · Other
   income (player picker on deposit only). Ledger → Debit shows Expense · Withdrawal · Season due
   in one row, "Season due" not clipped; Withdrawal/Season due reveal the player picker and hide
   Common; Expense keeps Common + split preview.
1. Record Abhishek Khare's real ₹5,000 withdrawal from the Debit sheet → red "Withdrawal by
   Abhishek Khare" row in the ledger, same line on `/players/<id>` with running balance, pool card
   drops by 5,000 (to about −₹96 unless the pool was topped up). If the amount exceeds his balance
   the sheet shows the `EXCEEDS_BALANCE` message — then decide the amount with him.
2. Also try: a withdrawal above balance (expect the 422 text), edit the withdrawal row (stays
   negative), an old BOOKING row still renders and opens for edit.
3. Carried checks from 31–33: match-sheet guest glyph / VC / "Ball ₹65", footer credit line,
   deposit caption on a no-guest match, tournament bar "Back" + "Matches" card.
4. Carried: Fearless Fighters test-match deletion; viewer-seat phone test; ground presets phone
   check; fee preview wrap; Feature 6 self-service; Feature 7 hardening (login rate limiting).

## Open questions

- Drop the legacy `ground_bookings` table and `ground_booking` enum value (migration 56)? Not urgent.
- Should the LedgerRow give withdrawal rows a chip (like SEASON DUE), or is the red amount enough?
- Carried: VC mark on the on-screen fee table; VC in the guest demo fixtures; abandon reason on
  `match_refund` rows; seat-list device labels; rate limiting on `/api/auth/login`; ground preset
  extras; viewer access to the tournament balances share image.
