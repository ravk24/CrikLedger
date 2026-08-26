// Shared types mirroring the database views (db/migration-1.sql).

export type PlayerStatus = "surplus" | "low" | "debt" | "inactive";

export type PlayerPublic = {
  id: string;
  name: string;
  is_active: boolean;
  balance: number;
  status: PlayerStatus;
  is_captain: boolean;
  is_vice_captain: boolean;
};

export type PoolEntryKind =
  | "deposit"
  | "other_income"
  | "ground_booking"
  | "equipment"
  | "match_collection"
  | "plain_debit"
  | "common_debit"
  | "opening_due"; // season carryforward — player debt, not pool money

export type PoolLedgerRow = {
  id: string;
  entry_date: string;
  kind: PoolEntryKind;
  message: string;
  amount: number;
  edited_by: string | null;
  player_name: string | null; // linked player, deposit / opening_due only
  created_at: string; // same-day tiebreak; entry_date alone is just a DATE
};

export type MatchStatus = "scheduled" | "completed" | "abandoned";
export type MatchResult = "won" | "lost";

export type Match = {
  id: string;
  team_id: string;
  match_date: string;
  opponent: string | null; // NULL = not known yet (shown as "Opponent TBD")
  status: MatchStatus;
  result: MatchResult | null;
  abandoned_reason: string | null;
  ground_fee: number;
  ball_fee: number;
  other_fee: number;
  car_allowance_per_car: number;
  guest_names: string[];
  guest_cars: boolean[]; // index-aligned with guest_names; legacy = []
  guest_shared_cars: boolean[]; // same alignment; funded the car pot (drivers always true)
  venue: string | null; // free-text ground name, typed when scheduling
  fee_paid_to: "opponent" | "owner" | null; // legacy; nothing new writes it
  // Which way the match fee moved. NULL = no fee recorded. Only a
  // 'debit' is recouped at completion — the pool fronted that one.
  fee_direction: "credit" | "debit" | null;
  fee_pending: number; // still-outstanding slice of the fee; 0 = settled
  updated_at: string | null;
  created_at: string;
};

export type MatchParticipantPublic = {
  match_id: string;
  player_name: string;
  brought_car: boolean;
  shared_car: boolean; // funded the car pot (always true for a driver)
  fee_amount: number;
  is_captain: boolean;
  is_playing: boolean; // FALSE = charge-only captain row (guest fees)
  guest_fee_share: number; // slice of fee_amount that is guest money
};

export type AdminRole = "admin" | "superadmin";

// ---- Tournaments (migration-19) — fully isolated from the above ----

export type TournamentStatus = "active" | "completed";

export type TournamentPublic = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: TournamentStatus;
  fund_balance: number;
  player_count: number;
  created_at: string;
  team_name: string | null; // what our side is called in this tournament
  venue: string | null; // free-text ground name
  joining_fee: number; // one participation fee for the whole tournament
  // Null since migration 32: a Tournament-Credit buyer owns no team, so
  // a tournament can stand alone. Exposed by tournaments_public (m30).
  team_id: string | null;
};

// No ₹900 threshold here — tournaments only distinguish debt vs clear.
export type TournamentPlayerStatus = "clear" | "debt" | "inactive";

export type TournamentPlayerPublic = {
  id: string;
  tournament_id: string;
  name: string;
  is_active: boolean;
  balance: number;
  status: TournamentPlayerStatus;
  is_captain: boolean;
  is_vice_captain: boolean;
};

// Shape-compatible with PoolLedgerRow so <LedgerRow> renders it as-is;
// tournament kinds are a strict subset of PoolEntryKind.
export type TournamentLedgerRow = {
  id: string;
  tournament_id: string;
  entry_date: string;
  kind:
    | "deposit"
    | "common_debit"
    | "match_collection" // legacy per-match model
    | "joining_fee"
    | "tournament_collection";
  message: string;
  amount: number;
  edited_by: string | null;
  player_name: string | null; // deposits only
  created_at: string; // same-day tiebreak; entry_date alone is just a DATE
};

export type TournamentStatementRow = {
  player_id: string;
  entry_date: string;
  kind:
    | "deposit"
    | "expense_share"
    | "match_fee" // legacy per-match model
    | "driver_rebate" // legacy per-match model
    | "tournament_fee";
  description: string;
  delta: number;
  running_balance: number;
  created_at: string;
  source_id: string;
  match_id: string | null;
  edited_by: string | null;
};

// Mirrors tournament_fee_charges_public (migration-24) — the persisted
// settlement rollup behind a statement's tournament_fee row.
export type TournamentFeeChargePublic = {
  tournament_id: string;
  player_id: string;
  played: number;
  driver_credit: number;
  amount: number; // net charge, negative for heavy drivers
  created_at: string; // settlement timestamp
};

// Mirrors tournament_fee_breakdown_public (migration-25) — one
// persisted settlement line per (player, match); each match has its
// own rate under the per-match model. Empty for pre-25 settlements.
export type TournamentFeeBreakdownRow = {
  player_id: string;
  tournament_id: string;
  match_id: string;
  match_date: string;
  match_time: string;
  opponent: string;
  share: number; // charged for that match
  driver_credit: number; // that match's car allowance, 0 without a car
};

// Mirrors tournament_matches_public. No guests, no venue (the venue
// lives on the tournament), no booking concepts.
export type TournamentMatch = {
  id: string;
  tournament_id: string;
  match_date: string;
  match_time: string; // HH:mm[:ss], NOT NULL — slot time is essential
  opponent: string;
  status: MatchStatus;
  result: MatchResult | null;
  abandoned_reason: string | null;
  ground_fee: number;
  ball_fee: number;
  other_fee: number;
  car_allowance_per_car: number;
  created_at: string;
  updated_at: string | null;
  updated_by_name: string | null;
};
