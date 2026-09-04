# Memory — session 26: deleting a match-fee ledger entry deletes its scheduled match

Last updated: 2026-09-04 (session 26, end)

## What was built

- **Schedule hub rename** (committed first, `21d2fc0`): the "Scheduled" card on `/schedule` and the heading of `/schedule/upcoming` now read "Matches". The tournament schedule tab still says "Scheduled" — deliberately left alone.
- **`db/migration-48.sql`**: `pool_ledger_public` redefined with three appended columns — `match_id`, `match_opponent` (raw, NULL = "Opponent TBD"), `match_status` — via `LEFT JOIN matches m ON m.team_id = pe.team_id AND (m.other_fee_entry_id = pe.id OR m.pending_cleared_entry_id = pe.id)`. Carries `WITH (security_invoker = true)` because `CREATE OR REPLACE VIEW` resets view options and would otherwise undo migration 47 for this view.
- **`lib/matches.ts`**: new `deleteScheduledMatchWithFees(client, { id, other_fee_entry_id, pending_cleared_entry_id })` — deletes the match first, then both fee entries with `id = ANY($1::uuid[])`, returns `{ fee_reverted }` (sum of absolute amounts).
- **`app/api/pool/entries/[id]/route.ts` DELETE**: after `loadManualEntry`, locks any match owning the entry (`FOR UPDATE`, team-scoped). Completed → `409 AUTO_ENTRY` "This fee is settled inside its completed match — delete the match instead". Scheduled → helper above, returns `{ match_deleted: true, match_id, fee_reverted }`. Otherwise plain delete, `{ match_deleted: false }`. Still `requireAdmin` (any admin, per user decision).
- **`app/api/matches/[id]/cancel/route.ts`**: uses the same helper, so cancel now also removes the cleared-pending entry (previously orphaned). Output shape unchanged.
- **`types/index.ts`** `PoolLedgerRow` gained `match_id`, `match_opponent`, `match_status`; `components/shared/LedgerRow.tsx` omits them from its structural type so tournament rows still fit; `DebitSheet` / `CreditSheet` optimistic literals set them to null.
- **`components/pool/PoolAdminSection.tsx`**: confirm dialog says "This is the match fee vs X. Deleting it also deletes that scheduled match." for a scheduled match's fee; for a completed match's fee the Delete button is replaced by a muted "delete the match instead" note. `handleDelete` now keeps the sheet open until the server agrees, so a refusal is actually visible (before, `setEditing(null)` ran before the fetch and the error paragraph inside the sheet never showed).
- Docs updated (git-ignored folder): `08-business-rules.md` R-38 / R-52 / R-54, `03-user-flows.md` §9c, `06-database.md` (matches columns, view table, lifecycle row, migration-48 note with the security_invoker rule), `09-api.md` (entries DELETE, cancel), `14-known-issues.md` 10.10.

## Decisions made

- Completed match's fee: refuse deletion (mirrors the R-38 amount guard) rather than cascade or silently unlink.
- Any admin may delete a scheduled match through the ledger even though the match page's cancel is superadmin-only.
- The ledger warns before deleting; that is why the view exposes the match link.
- Abandon and the completed-match `DELETE /api/matches/[id]` still orphan `pending_cleared_entry_id` — recorded as known issue 10.10, not fixed.

## Problems solved

- Verified from the PostgreSQL source that `CREATE OR REPLACE VIEW` replaces reloptions; every future view redefinition must repeat `WITH (security_invoker = true)`.

## Current state

- **Git:** all of the above is on `main`, **uncommitted** at the time of writing (8 modified files + `db/migration-48.sql` + this notes file). `npx tsc --noEmit` clean, `npm test` 92/92, `npm run lint` at the 12 pre-existing warnings, `npm run build` clean.
- **Migration 48 is applied to prod.** Backup workflow run 33888688362 succeeded first; `node db/apply-migrations.mjs` reported `apply migration-48.sql`. Verified: `pool_ledger_public` reloptions still `{security_invoker=true}`; 46 ledger rows, 15 of them linked to scheduled matches.
- Not exercised in the browser: the delete-from-ledger flow was not run against real data (every linked row on prod belongs to a real scheduled match).

## Next session starts with

1. Confirm in the Supabase dashboard that `pool_ledger_public` still shows `security_invoker=true` after migration 48 (`SELECT reloptions FROM pg_class WHERE relname = 'pool_ledger_public'`).
2. Manual check as a non-super admin: schedule an away match with a settled fee, delete the fee row from `/pool`, confirm the match is gone from `/schedule/upcoming` and the pool total is restored. Complete a match with a fee and confirm its fee row shows the "delete the match instead" note.
3. Decide whether to give abandon and the completed-match DELETE the same both-entries cleanup (known issue 10.10).
4. Carried from session 23: Email sign-ups disabled? Advisor green?

## Open questions

- Should the tournament schedule tab's "Scheduled" card also become "Matches"?
