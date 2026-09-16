import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

// ---- Route body schemas ----------------------------------------------

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// current_password is required for a voluntary change and absent for the
// forced first-login change, where there is no old password to give. The
// route decides which case applies from must_change_password.
export const changePasswordSchema = z.object({
  current_password: z.string().min(1).optional(),
  new_password: z.string().min(8).max(200),
});

export const addPlayerSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const editPlayerSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
  })
  .refine((body) => body.name !== undefined, {
    message: "Nothing to update",
  });

// Captain contact phone (migration 43): normalized to +?digits so the
// fee-collection message carries a dialable number. Mirrors the DB CHECK.
const phoneField = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s()\-.]/g, ""))
  .pipe(z.string().regex(/^\+?\d{8,15}$/, "8–15 digits, optional +"));

// null = explicit clear; undefined = leave untouched (same convention
// as entryDate below).
export const captainPhoneSchema = z.object({
  phone: phoneField.nullable().optional(),
});

// null = explicit clear (tournament dates); undefined = leave untouched.
const entryDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "yyyy-mm-dd")
  .nullable()
  .optional();

// Credits only — everything that lowers the pool is poolDebitSchema.
export const poolCreditSchema = z
  .object({
    kind: z.enum(["deposit", "other_income"]),
    amount: z.number().int().positive(),
    // A deposit derives its ledger title from the player, so the
    // free-text message is optional there (stored as "").
    message: z.string().trim().min(1).max(200).optional(),
    player_id: z.string().uuid().optional(),
    entry_date: entryDate,
  })
  .refine((body) => body.kind !== "deposit" || body.player_id !== undefined, {
    message: "player_id is required for deposits",
  })
  .refine((body) => body.kind === "deposit" || body.message !== undefined, {
    message: "Message is required",
  });

// Three things leave the pool from the Debit sheet: an expense (plain or
// common), a withdrawal — a player taking part of their deposit back —
// and a season due carried from last season against a player. The two
// player-linked kinds are stored negative and title themselves from the
// player, so their message is optional and they are never "common".
const PLAYER_LINKED_DEBIT_KINDS = ["withdrawal", "opening_due"] as const;
export const poolDebitSchema = z
  .object({
    kind: z.enum(["expense", "withdrawal", "opening_due"]).default("expense"),
    common: z.boolean().default(false),
    amount: z.number().int().positive(),
    message: z.string().trim().min(1).max(200).optional(),
    player_id: z.string().uuid().optional(),
    entry_date: entryDate,
  })
  .refine(
    (body) =>
      !PLAYER_LINKED_DEBIT_KINDS.includes(
        body.kind as (typeof PLAYER_LINKED_DEBIT_KINDS)[number],
      ) || body.player_id !== undefined,
    { message: "player_id is required for withdrawals and season dues" },
  )
  .refine((body) => body.kind === "expense" || !body.common, {
    message: "Only an expense can be common",
  })
  .refine((body) => body.kind !== "expense" || body.message !== undefined, {
    message: "Message is required",
  });

export const poolEntryEditSchema = z
  .object({
    amount: z.number().int().positive().optional(),
    // Empty string is legal at schema level; the route rejects it for
    // kinds whose ledger title comes from the message.
    message: z.string().trim().max(200).optional(),
    entry_date: entryDate,
  })
  .refine(
    (body) =>
      body.amount !== undefined ||
      body.message !== undefined ||
      body.entry_date !== undefined,
    { message: "Nothing to update" },
  );

const usernameField = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9_]+$/, "lowercase letters, digits, underscores");

export const createAdminSchema = z.object({
  username: usernameField,
  name: z.string().trim().min(1).max(80),
});

// The team viewer's shared password, chosen by the superadmin on create
// and on reset (app/api/sa/viewer). Same floor as changePasswordSchema.
export const viewerPasswordSchema = z.object({
  password: z.string().min(8).max(200),
});

// Create: the superadmin picks the viewer's user id too (same rules as
// an admin's), so the team can be told something memorable.
export const createViewerSchema = viewerPasswordSchema.extend({
  username: usernameField,
});

// Operator console grant (app/api/ops/grants): which product, to whom.
// `name` is only needed when the account does not exist yet; the route
// enforces that on the create branch so an existing customer needs
// nothing but their user id.
export const grantSchema = z.object({
  product: z.enum(["team_ledger", "tournament_credit"]),
  username: usernameField,
  name: z.string().trim().max(80).optional(),
});

// Superadmin renames their own team (app/api/sa/team).
// Ground presets (migration 51): a name and the per-car allowance in
// whole rupees. The DB enforces the per-team, case-insensitive name
// uniqueness; the route maps that violation to GROUND_EXISTS.
export const groundSchema = z.object({
  name: z.string().trim().min(1).max(80),
  car_allowance: z.number().int().nonnegative(),
});

export const editGroundSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    car_allowance: z.number().int().nonnegative().optional(),
    is_active: z.boolean().optional(),
  })
  .refine(
    (body) =>
      body.name !== undefined ||
      body.car_allowance !== undefined ||
      body.is_active !== undefined,
    { message: "Nothing to update" },
  );

export const teamNameSchema = z.object({
  display_name: z.string().trim().min(2).max(60),
});

// Self-serve signup: user id + password + email. Email is stored as the
// recovery channel and purchase-correspondence address; nothing sends to
// it yet, so recovery is a megaadmin-initiated reset from the operator
// console.
export const signupSchema = z.object({
  username: usernameField,
  password: z.string().min(8).max(200),
  email: z.string().trim().toLowerCase().email().max(200),
  name: z.string().trim().min(1).max(80).optional(),
});

export const usernameAvailabilitySchema = z.object({ username: usernameField });

export const teamSwitchSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9-]*$/, "team slug"),
});

// The fee block behind the scheduling form's master switch. A fee must
// say which way it moved, because only a 'debit' is recouped at
// completion (the pool fronted that one). fee_pending is the
// outstanding slice — the pool entry is written for
// (fee_amount - fee_pending).
const feeFields = {
  opponent: z.string().trim().min(1).max(80).optional(),
  fee_amount: z.number().int().positive().optional(),
  fee_direction: z.enum(["credit", "debit"]).optional(),
  fee_pending: z.number().int().nonnegative().optional(),
};

type FeeBody = {
  fee_amount?: number;
  fee_direction?: "credit" | "debit";
  fee_pending?: number;
};

// Amount and direction travel together, and a fee cannot be more
// pending than it is large. Declared once, applied to both schemas.
const FEE_RULES: [(b: FeeBody) => boolean, string][] = [
  [
    (b) => b.fee_amount === undefined || b.fee_direction !== undefined,
    "Choose Credit to Pool or Debit from Pool",
  ],
  [
    (b) => b.fee_direction === undefined || b.fee_amount !== undefined,
    "Enter the fee amount",
  ],
  [
    (b) => (b.fee_pending ?? 0) <= (b.fee_amount ?? 0),
    "Pending amount cannot exceed the fee",
  ],
];

// Creating a match. Everything past the date is optional: the master
// switch left off schedules a bare date (opponent NULL, no fee, no
// pool entry) and the card shows "Opponent TBD".
export const createMatchSchema = FEE_RULES.reduce(
  (schema, [check, message]) => schema.refine(check, { message }),
  z.object({
    match_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "yyyy-mm-dd"),
    // Free-text ground name; no picker since migration 35.
    venue: z.string().trim().min(1).max(80).optional(),
    ...feeFields,
  }),
);

// Fixing an already-scheduled match — including filling in what
// scheduling left blank, which is how a bare date becomes a real fixture. An
// absent venue/opponent keeps the stored value (COALESCE server-side).
export const editMatchSchema = FEE_RULES.reduce(
  (schema, [check, message]) => schema.refine(check, { message }),
  z.object({
    match_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "yyyy-mm-dd"),
    venue: z.string().trim().min(1).max(80).optional(),
    ...feeFields,
  }),
);

export const abandonMatchSchema = z.object({
  reason: z.string().trim().min(1).max(200),
});

// Clearing a match's pending fee: the client echoes the amount it
// displayed so a stale page can't clear a different figure.
export const clearPendingSchema = z.object({
  expected_pending: z.number().int().positive(),
});

// shared_car = rode in a car (a driver is a sharer regardless, so the
// flag only matters for non-drivers). Defaults to false — "made their
// own way" — so an older client posting without the field is accepted
// rather than 400ing.
const attendeeSchema = z.object({
  player_id: z.string().uuid(),
  brought_car: z.boolean(),
  shared_car: z.boolean().default(false),
});

// v2 guest rule: guests count in the fee split and their charges are
// deducted from the standing captain's balance (guests hand the
// captain cash offline). Guest cars and guest sharing count exactly
// like a player's.
const guestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  brought_car: z.boolean(),
  shared_car: z.boolean().default(false),
});

export const matchSubmitSchema = z.object({
  result: z.enum(["won", "lost"]),
  ground_fee: z.number().int().nonnegative(),
  ball_fee: z.number().int().nonnegative(),
  other_fee: z.number().int().nonnegative(),
  car_allowance_per_car: z.number().int().nonnegative(),
  // No fee field: per-player fees are computed by the server from the
  // costs and attendance, never accepted from the client. Manual fee
  // editing was removed, and with it the reason to trust these numbers.
  rows: z.array(attendeeSchema).min(1).max(60),
  guests: z.array(guestSchema).max(30).default([]),
});

// ---- Tournaments (isolated ledgers — see lib/tournaments.ts) ----------

export const createTournamentSchema = z.object({
  name: z.string().trim().min(1).max(80),
  team_name: z.string().trim().min(1).max(80).optional(),
  // Free-text ground name, same as match scheduling.
  venue: z.string().trim().min(1).max(80).optional(),
  // One participation fee for the whole tournament — required, since
  // settlement divides it across the matches; a superadmin can change it
  // later from the Details sheet.
  joining_fee: z.number().int().positive(),
  start_date: entryDate,
  end_date: entryDate,
});

export const editTournamentSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    // null clears the field; undefined leaves it untouched.
    team_name: z.string().trim().min(1).max(80).nullable().optional(),
    venue: z.string().trim().min(1).max(80).nullable().optional(),
    // Superadmin only — the route enforces it (see app/api/tournaments/[id]).
    joining_fee: z.number().int().positive().optional(),
    start_date: entryDate,
    end_date: entryDate,
    status: z.enum(["active", "completed"]).optional(),
  })
  .refine(
    (body) =>
      body.name !== undefined ||
      body.team_name !== undefined ||
      body.venue !== undefined ||
      body.joining_fee !== undefined ||
      body.start_date !== undefined ||
      body.end_date !== undefined ||
      body.status !== undefined,
    { message: "Nothing to update" },
  );

export const addTournamentPlayerSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const tournamentDepositSchema = z.object({
  player_id: z.string().uuid(),
  amount: z.number().int().positive(),
  // Deposits are titled by player name — free text optional (stored "").
  message: z.string().trim().min(1).max(200).optional(),
  entry_date: entryDate,
});

export const tournamentExpenseSchema = z.object({
  amount: z.number().int().positive(),
  message: z.string().trim().min(1).max(200),
  entry_date: entryDate,
});

// Tournament matches: time is REQUIRED — tournaments run all day in
// slots (Ravi). Ground comes from the tournament's venue, never here.
export const tournamentScheduleMatchSchema = z.object({
  opponent: z.string().trim().min(1).max(80),
  match_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "yyyy-mm-dd"),
  match_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:mm"),
});

// No guests in tournaments — .omit removes the key entirely and the
// non-strict parse strips the wizard's `guests: []`, so a non-empty
// guests array can never reach the tournament money path.
export const tournamentMatchSubmitSchema = matchSubmitSchema.omit({
  guests: true,
});

export const tournamentEntryEditSchema = z
  .object({
    amount: z.number().int().positive().optional(),
    // Empty string legal at schema level; the lib rejects it for
    // common debits (their ledger title comes from the message).
    message: z.string().trim().max(200).optional(),
    entry_date: entryDate,
  })
  .refine(
    (body) =>
      body.amount !== undefined ||
      body.message !== undefined ||
      body.entry_date !== undefined,
    { message: "Nothing to update" },
  );

// ---- Error plumbing ---------------------------------------------------
// Error codes are part of the API contract (code-standards.md).

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function handleRouteError(prefix: string, error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { success: false, error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "INVALID_BODY", message: "Invalid request body" },
      },
      { status: 422 },
    );
  }
  console.error(prefix, error);
  return NextResponse.json(
    {
      success: false,
      error: { code: "INTERNAL", message: "Something went wrong" },
    },
    { status: 500 },
  );
}
