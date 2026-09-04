import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { ceilSplit } from "@/engine/split";
import { deleteScheduledMatchWithFees } from "@/lib/matches";
import { requireAdmin } from "@/lib/session";
import { ApiError, handleRouteError, poolEntryEditSchema } from "@/lib/validate";
import type { PoolClient } from "pg";

const MANUAL_KINDS = [
  "deposit",
  "other_income",
  "equipment",
  "ground_booking",
  "plain_debit",
  "common_debit",
  "opening_due",
];

// Scoped to the caller's team: an entry id from another team reads as
// "not found", never as editable.
async function loadManualEntry(client: PoolClient, id: string, teamId: string) {
  const res = await client.query(
    `SELECT id, kind, message, amount, entry_date, team_id
     FROM pool_entries WHERE id = $1 AND team_id = $2`,
    [id, teamId],
  );
  const row = res.rows[0];
  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "Ledger entry not found");
  }
  if (!MANUAL_KINDS.includes(row.kind)) {
    throw new ApiError(
      409,
      "AUTO_ENTRY",
      "Automatic entries change only through their source (match or common debit)",
    );
  }
  return row;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = poolEntryEditSchema.parse(await req.json());

    const result = await withTransaction(async (client) => {
      const entry = await loadManualEntry(client, id, admin.scopeId);
      // Player-linked rows derive their ledger title from the player, so
      // an empty message is fine there; every other kind titles from it.
      const playerLinked =
        entry.kind === "deposit" || entry.kind === "opening_due";
      if (body.message === "" && !playerLinked) {
        throw new ApiError(422, "MESSAGE_REQUIRED", "Message cannot be empty");
      }
      // An Other match's ground-fee debit is baked into its stored
      // match_collection at completion — changing the amount afterwards
      // would silently drift the pool by the difference (§3 reads the
      // CURRENT amount only while the match's own flows run).
      if (body.amount !== undefined && entry.kind === "plain_debit") {
        const linked = await client.query(
          `SELECT id FROM matches
           WHERE other_fee_entry_id = $1 AND status = 'completed'`,
          [id],
        );
        if (linked.rows[0]) {
          throw new ApiError(
            409,
            "AUTO_ENTRY",
            "This ground fee is settled inside its completed match — edit the match instead",
          );
        }
      }
      const isDebit =
        entry.kind === "plain_debit" ||
        entry.kind === "common_debit" ||
        entry.kind === "opening_due";
      const newAmount =
        body.amount !== undefined
          ? isDebit
            ? -body.amount
            : body.amount
          : Number(entry.amount);

      await client.query(
        `UPDATE pool_entries
         SET amount = $2,
             message = COALESCE($3, message),
             entry_date = COALESCE($4::date, entry_date),
             updated_by = $5,
             updated_at = NOW()
         WHERE id = $1 AND team_id = $6`,
        [id, newAmount, body.message ?? null, body.entry_date ?? null, admin.id, admin.scopeId],
      );

      // Editing a common debit re-runs its split in the same transaction
      // — against the entry's own team's current roster.
      if (entry.kind === "common_debit") {
        const playersRes = await client.query(
          `SELECT id FROM players WHERE team_id = $1 AND is_active ORDER BY id`,
          [entry.team_id],
        );
        const activePlayers = playersRes.rows as { id: string }[];
        if (activePlayers.length === 0) {
          throw new ApiError(422, "NO_PLAYERS", "No active players to split across");
        }
        const split = ceilSplit(Math.abs(newAmount), activePlayers.length);

        await client.query(
          `DELETE FROM expense_shares WHERE pool_entry_id = $1`,
          [id],
        );
        await client.query(
          `INSERT INTO expense_shares (pool_entry_id, player_id, amount, team_id)
           SELECT $1, p, $3, $4 FROM unnest($2::uuid[]) AS p`,
          [id, activePlayers.map((p) => p.id), split.share, entry.team_id],
        );
        return { id, share: split.share, players: split.players };
      }
      return { id };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[pool/entries]", error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    const result = await withTransaction(async (client) => {
      await loadManualEntry(client, id, admin.scopeId);

      // A plain_debit / other_income row may be a match's fee (settled
      // or cleared-pending slice). Lock the owning match so a
      // concurrent complete / cancel serialises against this delete.
      const linked = await client.query(
        `SELECT id, status, other_fee_entry_id, pending_cleared_entry_id
         FROM matches
         WHERE team_id = $2
           AND (other_fee_entry_id = $1 OR pending_cleared_entry_id = $1)
         FOR UPDATE`,
        [id, admin.scopeId],
      );
      const match = linked.rows[0];

      if (match?.status === "completed") {
        // The fee is baked into the stored collection (R-38): removing
        // it would silently drift the pool by the recouped amount.
        throw new ApiError(
          409,
          "AUTO_ENTRY",
          "This fee is settled inside its completed match — delete the match instead",
        );
      }
      if (match?.status === "scheduled") {
        // The fee cannot outlive its match, nor the match its fee:
        // remove the match and BOTH slices, whichever one was tapped.
        const { fee_reverted } = await deleteScheduledMatchWithFees(
          client,
          match,
        );
        return { match_deleted: true, match_id: match.id, fee_reverted };
      }

      // No link, or an abandoned match (abandon already returned the
      // settled fee; a leftover cleared-pending link just SET NULLs).
      // Common-debit deletes cascade their shares and recovery row via FKs.
      await client.query(
        `DELETE FROM pool_entries WHERE id = $1 AND team_id = $2`,
        [id, admin.scopeId],
      );
      return { match_deleted: false };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleRouteError("[pool/entries]", error);
  }
}
