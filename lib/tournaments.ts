import type { PoolClient } from "pg";
import { z } from "zod";
import { pool, withTransaction } from "@/lib/db";
import { ceilSplit } from "@/engine/split";
import {
  calculateTournamentFees,
  type TournamentFeeMatch,
} from "@/engine/tournamentFee";
import { formatRupees } from "@/lib/format";
import { getCurrentTeamId } from "@/lib/team";
import {
  ApiError,
  addTournamentPlayerSchema,
  createTournamentSchema,
  editTournamentSchema,
  tournamentDepositSchema,
  tournamentEntryEditSchema,
  tournamentExpenseSchema,
} from "@/lib/validate";

// Tournaments are FULLY ISOLATED ledgers: every query in this file is
// scoped by tournament_id (the composite FK on tournament_entries
// backstops entries at the DB level; the share splits rely on the
// scoped roster queries here — never copy the pool's unscoped
// `SELECT id FROM players WHERE is_active` shape).

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "23505"
  );
}

const nameTaken = (what: string) =>
  new ApiError(409, "NAME_TAKEN", `A ${what} with this name already exists`);

// Written only by their owning flow — never hand-editable.
const AUTO_KINDS = ["match_collection", "joining_fee", "tournament_collection"];

// Locks the tournament row for the duration of the transaction so money
// ops serialize against a concurrent Complete/Reopen flip. Exported for
// lib/tournamentMatches.ts — every match write must pass it too.
export async function lockTournament(
  client: PoolClient,
  id: string,
  { forWrite = true }: { forWrite?: boolean } = {},
): Promise<{ id: string; name: string; status: string }> {
  const res = await client.query(
    `SELECT id, name, status FROM tournaments WHERE id = $1 FOR UPDATE`,
    [id],
  );
  const row = res.rows[0];
  if (!row) throw new ApiError(404, "NOT_FOUND", "Tournament not found");
  if (forWrite && row.status === "completed") {
    throw new ApiError(
      409,
      "TOURNAMENT_COMPLETED",
      "This tournament is completed — reopen it to make changes",
    );
  }
  return row;
}

export async function createTournament(
  adminId: string,
  body: z.infer<typeof createTournamentSchema>,
) {
  try {
    const teamId = await getCurrentTeamId(pool);
    const res = await pool.query(
      `INSERT INTO tournaments
         (name, team_name, venue, joining_fee, start_date, end_date, created_by, team_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, status`,
      [
        body.name,
        body.team_name ?? null,
        body.venue ?? null,
        body.joining_fee ?? 0,
        body.start_date ?? null,
        body.end_date ?? null,
        adminId,
        teamId,
      ],
    );
    return res.rows[0];
  } catch (error) {
    if (isUniqueViolation(error)) throw nameTaken("tournament");
    throw error;
  }
}

// ---- Per-match fee settlement (Ravi 2026-08-17, migration-25) ---------
// One joining fee for the whole tournament, split equally across the
// COMPLETED matches; each match's pot (fee share + car money) divides
// across that match's attendees (engine/tournamentFee.ts). Runs when
// the tournament is marked completed; reopening reverses it entirely.

async function settleTournamentFees(
  client: PoolClient,
  tournament: { id: string; name: string },
  adminId: string,
) {
  const tRes = await client.query(
    `SELECT joining_fee FROM tournaments WHERE id = $1`,
    [tournament.id],
  );
  const joiningFee = Math.round(Number(tRes.rows[0].joining_fee));

  const matchesRes = await client.query(
    `SELECT id, car_allowance_per_car FROM tournament_matches
     WHERE tournament_id = $1 AND status = 'completed'`,
    [tournament.id],
  );
  const attendeesRes = await client.query(
    `SELECT match_id, player_id, brought_car
     FROM tournament_match_participants WHERE tournament_id = $1`,
    [tournament.id],
  );
  const byMatch = new Map<string, { playerId: string; broughtCar: boolean }[]>();
  for (const row of attendeesRes.rows) {
    const list = byMatch.get(row.match_id) ?? [];
    list.push({ playerId: row.player_id, broughtCar: row.brought_car });
    byMatch.set(row.match_id, list);
  }
  const matches: TournamentFeeMatch[] = matchesRes.rows.map((m) => ({
    matchId: m.id,
    carAllowancePerCar: Math.round(Number(m.car_allowance_per_car)),
    attendees: byMatch.get(m.id) ?? [],
  }));

  // Nothing played and nothing to divide — a fee-less tournament may
  // complete without a settlement.
  if (matches.length === 0 && joiningFee === 0) return;
  if (matches.length === 0) {
    throw new ApiError(
      422,
      "NO_MATCH_SLOTS",
      "No completed matches to divide the joining fee across — complete matches first or zero the fee",
    );
  }
  // The wizard requires ≥1 player per completed match (rows.min(1));
  // an empty match can only come from direct SQL, and it would make
  // that match's split undefined.
  if (matches.some((m) => m.attendees.length === 0)) {
    throw new ApiError(
      422,
      "EMPTY_MATCH",
      "A completed match has no attendees — edit or delete it before completing the tournament",
    );
  }

  const result = calculateTournamentFees({ joiningFee, matches });

  // Legacy cleanup (pre-participation-fee model, migration-22 era):
  // per-match fee rows and match_collection credits would double-count
  // against the settlement charges — neutralize them first, the same
  // way re-saving each match would.
  await client.query(
    `UPDATE tournament_match_participants SET fee_amount = 0
     WHERE tournament_id = $1 AND fee_amount <> 0`,
    [tournament.id],
  );
  await client.query(
    `DELETE FROM tournament_entries
     WHERE tournament_id = $1 AND kind = 'match_collection'`,
    [tournament.id],
  );

  // Idempotent: wholesale replace (partial uniques backstop the entries).
  await reverseSettlement(client, tournament.id);
  for (const row of result.rows) {
    await client.query(
      `INSERT INTO tournament_fee_charges
         (tournament_id, player_id, played, driver_credit, amount)
       VALUES ($1, $2, $3, $4, $5)`,
      [tournament.id, row.playerId, row.played, row.driverCredit, row.charge],
    );
  }
  // Lines FK-reference the charge rows — insert them second.
  for (const line of result.lines) {
    await client.query(
      `INSERT INTO tournament_fee_charge_lines
         (tournament_id, player_id, match_id, share, driver_credit)
       VALUES ($1, $2, $3, $4, $5)`,
      [tournament.id, line.playerId, line.matchId, line.share, line.driverCredit],
    );
  }
  if (joiningFee > 0) {
    await client.query(
      `INSERT INTO tournament_entries
         (tournament_id, kind, message, amount, created_by)
       VALUES ($1, 'joining_fee', $2, $3, $4)`,
      [
        tournament.id,
        `Joining fee — ${tournament.name}`,
        -joiningFee,
        adminId,
      ],
    );
  }
  if (result.surplus > 0) {
    await client.query(
      `INSERT INTO tournament_entries
         (tournament_id, kind, message, amount, created_by)
       VALUES ($1, 'tournament_collection', $2, $3, $4)`,
      [
        tournament.id,
        "Tournament surplus — fee settlement",
        result.surplus,
        adminId,
      ],
    );
  }
}

async function reverseSettlement(client: PoolClient, tournamentId: string) {
  // Charge lines cascade with their parent charge (tfcl_parent_charge).
  await client.query(
    `DELETE FROM tournament_fee_charges WHERE tournament_id = $1`,
    [tournamentId],
  );
  await client.query(
    `DELETE FROM tournament_entries
     WHERE tournament_id = $1 AND kind IN ('joining_fee','tournament_collection')`,
    [tournamentId],
  );
}

// Also handles Complete (status: 'completed') and Reopen ('active') —
// any admin may flip either way (mistake insurance, Ravi 2026-08-15).
// Completing runs the participation-fee settlement; reopening reverses
// it (derived balances restore instantly).
export async function updateTournament(
  adminId: string,
  id: string,
  body: z.infer<typeof editTournamentSchema>,
) {
  try {
    return await withTransaction(async (client) => {
      const cur = await client.query(
        `SELECT id, name, status FROM tournaments WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (!cur.rows[0]) {
        throw new ApiError(404, "NOT_FOUND", "Tournament not found");
      }
      const prevStatus = cur.rows[0].status as string;
      // Completed = read-only: field edits would diverge from the written
      // settlement. Only the Reopen flip is allowed through.
      if (prevStatus === "completed" && body.status !== "active") {
        throw new ApiError(
          409,
          "TOURNAMENT_COMPLETED",
          "This tournament is completed — reopen it to make changes",
        );
      }

      const res = await client.query(
        `UPDATE tournaments SET
           name        = COALESCE($2, name),
           team_name   = CASE WHEN $3::boolean THEN $4 ELSE team_name END,
           venue       = CASE WHEN $5::boolean THEN $6 ELSE venue END,
           joining_fee = COALESCE($7, joining_fee),
           start_date  = CASE WHEN $8::boolean THEN $9::date ELSE start_date END,
           end_date    = CASE WHEN $10::boolean THEN $11::date ELSE end_date END,
           status      = COALESCE($12, status),
           updated_by  = $13,
           updated_at  = NOW()
         WHERE id = $1
         RETURNING id, name, status`,
        [
          id,
          body.name ?? null,
          body.team_name !== undefined, // explicit set (may be null = clear)
          body.team_name ?? null,
          body.venue !== undefined,
          body.venue ?? null,
          body.joining_fee ?? null,
          body.start_date !== undefined,
          body.start_date ?? null,
          body.end_date !== undefined,
          body.end_date ?? null,
          body.status ?? null,
          adminId,
        ],
      );
      const updated = res.rows[0];

      if (prevStatus === "active" && updated.status === "completed") {
        await settleTournamentFees(client, updated, adminId);
      } else if (prevStatus === "completed" && updated.status === "active") {
        await reverseSettlement(client, id);
      }
      return updated;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw nameTaken("tournament");
    throw error;
  }
}

// Superadmin-only (checked in the route). Cascades roster, entries and
// shares via the FKs — one statement removes the whole tournament.
export async function deleteTournament(id: string) {
  return withTransaction(async (client) => {
    // Explicit dependency order. Two reasons this can't be one cascade:
    // (1) tournament_match_participants' player FK is NO ACTION and
    // Postgres checks it while cascading tournament_players, before the
    // matches-side cascade has removed the participant rows; deleting
    // the matches first routes the participants through their own
    // single-path cascade. (2) tournament_fee_charges has NO cascade
    // path from tournaments at all (its only FK is the NO ACTION
    // player guard), so settled tournaments need the explicit delete.
    // tournament_fee_charge_lines (migration-25) needs nothing here:
    // it cascades from both matches and its parent charge row.
    await client.query(
      `DELETE FROM tournament_matches WHERE tournament_id = $1`,
      [id],
    );
    await client.query(
      `DELETE FROM tournament_fee_charges WHERE tournament_id = $1`,
      [id],
    );
    const res = await client.query(
      `DELETE FROM tournaments WHERE id = $1 RETURNING name`,
      [id],
    );
    if (res.rowCount === 0) {
      throw new ApiError(404, "NOT_FOUND", "Tournament not found");
    }
    return { name: res.rows[0].name };
  });
}

export async function addPlayer(
  tournamentId: string,
  body: z.infer<typeof addTournamentPlayerSchema>,
) {
  return withTransaction(async (client) => {
    await lockTournament(client, tournamentId);
    try {
      const res = await client.query(
        `INSERT INTO tournament_players (tournament_id, name)
         VALUES ($1, $2)
         RETURNING id, name, is_active`,
        [tournamentId, body.name],
      );
      return res.rows[0];
    } catch (error) {
      if (isUniqueViolation(error)) throw nameTaken("player");
      throw error;
    }
  });
}

// Removal rule (Ravi 2026-08-15): only at zero derived balance. Players
// with ledger rows are soft-removed (history stays); rowless typo
// entries are hard-deleted so the roster isn't littered.
export async function removePlayer(tournamentId: string, playerId: string) {
  return withTransaction(async (client) => {
    await lockTournament(client, tournamentId);
    const res = await client.query(
      `SELECT tp.name, tp.is_captain, tp.is_vice_captain, b.balance
       FROM tournament_players tp
       JOIN tournament_player_balances b ON b.id = tp.id
       WHERE tp.id = $1 AND tp.tournament_id = $2`,
      [playerId, tournamentId],
    );
    const row = res.rows[0];
    if (!row) throw new ApiError(404, "NOT_FOUND", "Player not found");
    if (row.is_captain) {
      throw new ApiError(
        409,
        "IS_CAPTAIN",
        `${row.name} is the tournament captain — transfer the role first, then remove`,
      );
    }
    if (row.is_vice_captain) {
      throw new ApiError(
        409,
        "IS_VICE_CAPTAIN",
        `${row.name} is the tournament vice-captain — transfer the role first, then remove`,
      );
    }
    const balance = Number(row.balance);
    if (balance !== 0) {
      const direction = balance > 0 ? "credit" : "debt";
      throw new ApiError(
        409,
        "NONZERO_BALANCE",
        `${row.name} still has a balance of ${balance < 0 ? "−" : ""}₹${formatRupees(balance)} (${direction}) — record the settlement first, then remove`,
      );
    }
    const hasRows = await client.query(
      `SELECT EXISTS (SELECT 1 FROM tournament_entries WHERE player_id = $1)
           OR EXISTS (SELECT 1 FROM tournament_expense_shares WHERE player_id = $1)
           OR EXISTS (SELECT 1 FROM tournament_match_participants WHERE player_id = $1)
           OR EXISTS (SELECT 1 FROM tournament_fee_charges WHERE player_id = $1)
           AS has_rows`,
      [playerId],
    );
    if (hasRows.rows[0].has_rows) {
      await client.query(
        `UPDATE tournament_players SET is_active = FALSE WHERE id = $1`,
        [playerId],
      );
      return { id: playerId, name: row.name, removed: "soft" as const };
    }
    await client.query(`DELETE FROM tournament_players WHERE id = $1`, [
      playerId,
    ]);
    return { id: playerId, name: row.name, removed: "hard" as const };
  });
}

// Captain/vice-captain declares — SG pattern (atomic clear-then-set)
// scoped per tournament; any admin may declare (Ravi 2026-08-15).
// Declaring captain clears is_vice_captain on the same row, or the
// t_captain_is_not_vice CHECK aborts the transaction.
export async function setCaptain(tournamentId: string, playerId: string) {
  return withTransaction(async (client) => {
    await lockTournament(client, tournamentId);
    await client.query(
      `UPDATE tournament_players SET is_captain = FALSE
       WHERE tournament_id = $1 AND is_captain`,
      [tournamentId],
    );
    const res = await client.query(
      `UPDATE tournament_players
       SET is_captain = TRUE, is_vice_captain = FALSE
       WHERE id = $1 AND tournament_id = $2 AND is_active
       RETURNING id, name`,
      [playerId, tournamentId],
    );
    if (res.rowCount === 0) {
      throw new ApiError(
        422,
        "NOT_ACTIVE",
        "The captain must be an active player of this tournament",
      );
    }
    return res.rows[0];
  });
}

export async function clearCaptain(tournamentId: string, playerId: string) {
  return withTransaction(async (client) => {
    await lockTournament(client, tournamentId);
    const res = await client.query(
      `UPDATE tournament_players SET is_captain = FALSE
       WHERE id = $1 AND tournament_id = $2 AND is_captain
       RETURNING id, name`,
      [playerId, tournamentId],
    );
    if (res.rowCount === 0) {
      throw new ApiError(404, "NOT_FOUND", "This player is not the captain");
    }
    return res.rows[0];
  });
}

export async function setViceCaptain(tournamentId: string, playerId: string) {
  return withTransaction(async (client) => {
    await lockTournament(client, tournamentId);
    await client.query(
      `UPDATE tournament_players SET is_vice_captain = FALSE
       WHERE tournament_id = $1 AND is_vice_captain`,
      [tournamentId],
    );
    const res = await client.query(
      `UPDATE tournament_players SET is_vice_captain = TRUE
       WHERE id = $1 AND tournament_id = $2 AND is_active AND NOT is_captain
       RETURNING id, name`,
      [playerId, tournamentId],
    );
    if (res.rowCount === 0) {
      const probe = await client.query(
        `SELECT is_captain FROM tournament_players
         WHERE id = $1 AND tournament_id = $2 AND is_active`,
        [playerId, tournamentId],
      );
      if (probe.rows[0]?.is_captain) {
        throw new ApiError(
          422,
          "IS_CAPTAIN",
          "The captain cannot also be vice-captain — transfer the captaincy first",
        );
      }
      throw new ApiError(
        422,
        "NOT_ACTIVE",
        "The vice-captain must be an active player of this tournament",
      );
    }
    return res.rows[0];
  });
}

export async function clearViceCaptain(tournamentId: string, playerId: string) {
  return withTransaction(async (client) => {
    await lockTournament(client, tournamentId);
    const res = await client.query(
      `UPDATE tournament_players SET is_vice_captain = FALSE
       WHERE id = $1 AND tournament_id = $2 AND is_vice_captain
       RETURNING id, name`,
      [playerId, tournamentId],
    );
    if (res.rowCount === 0) {
      throw new ApiError(
        404,
        "NOT_FOUND",
        "This player is not the vice-captain",
      );
    }
    return res.rows[0];
  });
}

export async function addDeposit(
  adminId: string,
  tournamentId: string,
  body: z.infer<typeof tournamentDepositSchema>,
) {
  return withTransaction(async (client) => {
    await lockTournament(client, tournamentId);
    const playerRes = await client.query(
      `SELECT name, is_active FROM tournament_players
       WHERE id = $1 AND tournament_id = $2`,
      [body.player_id, tournamentId],
    );
    const player = playerRes.rows[0];
    if (!player) throw new ApiError(404, "NOT_FOUND", "Player not found");
    if (!player.is_active) {
      throw new ApiError(
        409,
        "PLAYER_INACTIVE",
        `${player.name} was removed from this tournament`,
      );
    }
    const res = await client.query(
      `INSERT INTO tournament_entries
         (tournament_id, kind, message, amount, player_id, entry_date, created_by)
       VALUES ($1, 'deposit', $2, $3, $4, COALESCE($5::date, CURRENT_DATE), $6)
       RETURNING id, amount`,
      [
        tournamentId,
        body.message ?? "",
        body.amount,
        body.player_id,
        body.entry_date ?? null,
        adminId,
      ],
    );
    return res.rows[0];
  });
}

// One expense, split equally across the tournament's CURRENT active
// roster (ceilSplit — rounding favors the fund). The split freezes at
// entry time: players added later owe nothing for it.
export async function addExpense(
  adminId: string,
  tournamentId: string,
  body: z.infer<typeof tournamentExpenseSchema>,
) {
  return withTransaction(async (client) => {
    await lockTournament(client, tournamentId);
    const roster = await client.query(
      `SELECT id FROM tournament_players
       WHERE tournament_id = $1 AND is_active
       ORDER BY id`,
      [tournamentId],
    );
    if (roster.rows.length === 0) {
      throw new ApiError(
        422,
        "NO_PLAYERS",
        "Add players to the tournament before recording a shared expense",
      );
    }
    const split = ceilSplit(body.amount, roster.rows.length);
    const entryRes = await client.query(
      `INSERT INTO tournament_entries
         (tournament_id, kind, message, amount, entry_date, created_by)
       VALUES ($1, 'common_debit', $2, $3, COALESCE($4::date, CURRENT_DATE), $5)
       RETURNING id`,
      [tournamentId, body.message, -body.amount, body.entry_date ?? null, adminId],
    );
    const entryId = entryRes.rows[0].id;
    for (const { id: playerId } of roster.rows) {
      await client.query(
        `INSERT INTO tournament_expense_shares (entry_id, player_id, amount)
         VALUES ($1, $2, $3)`,
        [entryId, playerId, split.share],
      );
    }
    return { id: entryId, share: split.share, players: split.players };
  });
}

// Edits keep the entry's kind; amounts arrive positive and are re-signed
// by kind. Editing a common debit re-splits across the CURRENT active
// roster (same rule as the pool common debit) — that is intentional.
export async function editEntry(
  adminId: string,
  tournamentId: string,
  entryId: string,
  body: z.infer<typeof tournamentEntryEditSchema>,
) {
  return withTransaction(async (client) => {
    await lockTournament(client, tournamentId);
    const cur = await client.query(
      `SELECT kind, message, amount FROM tournament_entries
       WHERE id = $1 AND tournament_id = $2 FOR UPDATE`,
      [entryId, tournamentId],
    );
    const entry = cur.rows[0];
    if (!entry) throw new ApiError(404, "NOT_FOUND", "Entry not found");
    if (AUTO_KINDS.includes(entry.kind)) {
      throw new ApiError(
        409,
        "AUTO_ENTRY",
        "This row is written automatically — it changes only through its source",
      );
    }

    const message = body.message ?? entry.message;
    if (entry.kind === "common_debit" && message.trim() === "") {
      throw new ApiError(
        422,
        "MESSAGE_REQUIRED",
        "Shared expenses need a message — it is the ledger row's title",
      );
    }
    const newAbs = body.amount ?? Math.abs(Number(entry.amount));
    const signed = entry.kind === "deposit" ? newAbs : -newAbs;

    await client.query(
      `UPDATE tournament_entries SET
         amount = $2, message = $3,
         entry_date = COALESCE($4::date, entry_date),
         updated_by = $5, updated_at = NOW()
       WHERE id = $1`,
      [entryId, signed, message, body.entry_date ?? null, adminId],
    );

    if (entry.kind === "common_debit") {
      const roster = await client.query(
        `SELECT id FROM tournament_players
         WHERE tournament_id = $1 AND is_active
         ORDER BY id`,
        [tournamentId],
      );
      if (roster.rows.length === 0) {
        throw new ApiError(
          422,
          "NO_PLAYERS",
          "The tournament has no active players to split this expense across",
        );
      }
      const split = ceilSplit(newAbs, roster.rows.length);
      await client.query(
        `DELETE FROM tournament_expense_shares WHERE entry_id = $1`,
        [entryId],
      );
      for (const { id: playerId } of roster.rows) {
        await client.query(
          `INSERT INTO tournament_expense_shares (entry_id, player_id, amount)
           VALUES ($1, $2, $3)`,
          [entryId, playerId, split.share],
        );
      }
      return { id: entryId, share: split.share, players: split.players };
    }
    return { id: entryId };
  });
}

export async function deleteEntry(tournamentId: string, entryId: string) {
  return withTransaction(async (client) => {
    await lockTournament(client, tournamentId);
    const res = await client.query(
      `DELETE FROM tournament_entries
       WHERE id = $1 AND tournament_id = $2 AND kind <> ALL($3::text[])
       RETURNING kind`,
      [entryId, tournamentId, AUTO_KINDS],
    );
    if (res.rowCount === 0) {
      const probe = await client.query(
        `SELECT kind FROM tournament_entries
         WHERE id = $1 AND tournament_id = $2`,
        [entryId, tournamentId],
      );
      if (probe.rows[0] && AUTO_KINDS.includes(probe.rows[0].kind)) {
        throw new ApiError(
          409,
          "AUTO_ENTRY",
          "This row is written automatically — it changes only through its source",
        );
      }
      throw new ApiError(404, "NOT_FOUND", "Entry not found");
    }
    return { id: entryId, kind: res.rows[0].kind };
  });
}
