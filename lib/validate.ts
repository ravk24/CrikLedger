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

// null = explicit clear (tournament dates); undefined = leave untouched.
const entryDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "yyyy-mm-dd")
  .nullable()
  .optional();

export const poolCreditSchema = z
  .object({
    // opening_due: season-carryforward debt — entered positive, stored
    // negative against the player, excluded from the pool balance.
    kind: z.enum(["deposit", "other_income", "opening_due"]),
    amount: z.number().int().positive(),
    // Player-linked rows derive their ledger title from the player, so
    // the free-text message is optional there (stored as "").
    message: z.string().trim().min(1).max(200).optional(),
    player_id: z.string().uuid().optional(),
    entry_date: entryDate,
  })
  .refine(
    (body) =>
      (body.kind !== "deposit" && body.kind !== "opening_due") ||
      body.player_id !== undefined,
    { message: "player_id is required for deposits and opening dues" },
  )
  .refine(
    (body) =>
      body.kind === "deposit" ||
      body.kind === "opening_due" ||
      body.message !== undefined,
    { message: "Message is required" },
  );

// Ground booking: an outside team books N slots on the ground. One
// credit for the amount actually paid, plus one booking record.
// It no longer creates matches (migration-35), and because clearing a
// pending fee was match-scoped, the paid/pending split went with it —
// see CrikLedger-docs/dropped-home_match-feature.md.
export const groundBookingSchema = z.object({
  kind: z.literal("ground_booking"),
  team_name: z.string().trim().min(1).max(80),
  captain: z.string().trim().min(1).max(80),
  slots: z.number().int().positive().max(20),
  amount_paid: z.number().int().positive(),
  entry_date: entryDate,
});

export const poolDebitSchema = z.object({
  common: z.boolean(),
  amount: z.number().int().positive(),
  message: z.string().trim().min(1).max(200),
  entry_date: entryDate,
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

// Operator console grant (app/api/ops/grants): which product, to whom.
export const grantSchema = z.object({
  product: z.enum(["team_ledger", "tournament_credit"]),
  username: usernameField,
  name: z.string().trim().min(1).max(80),
});

// Superadmin renames their own team (app/api/sa/team).
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
// pool entry) and the card's red dot flags it.
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
// scheduling left blank, which is how a red dot becomes green. An
// absent venue/opponent keeps the stored value (COALESCE server-side).
export const editMatchSchema = FEE_RULES.reduce(
  (schema, [check, message]) => schema.refine(check, { message }),
  z.object({
    match_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "yyyy-mm-dd"),
    venue: z.string().trim().min(1).max(80).optional(),
    // Renames the linked ground booking's captain, when there is one.
    opponent_captain: z.string().trim().min(1).max(80).optional(),
    ...feeFields,
  }),
);

export const abandonMatchSchema = z.object({
  reason: z.string().trim().min(1).max(200),
});

// Clearing a booking's pending fee: the client echoes the amount it
// displayed so a stale page can't clear a different figure.
export const clearPendingSchema = z.object({
  expected_pending: z.number().int().positive(),
});

// shared_car defaults to false so the tournament routes — which never
// ask the question — keep validating unchanged, and so an older client
// posting without the field is accepted rather than 400ing.
const attendeeSchema = z.object({
  player_id: z.string().uuid(),
  brought_car: z.boolean(),
  shared_car: z.boolean().default(false),
});

// v2 guest rule: guests count in the fee split and their charges are
// deducted from the standing captain's balance (guests hand the
// captain cash offline). Guest cars join the pot like player cars.
const guestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  brought_car: z.boolean(),
  shared_car: z.boolean().default(false),
});

export const matchPreviewSchema = z.object({
  ground_fee: z.number().int().nonnegative(),
  ball_fee: z.number().int().nonnegative(),
  other_fee: z.number().int().nonnegative(),
  car_allowance_per_car: z.number().int().nonnegative(),
  attendees: z.array(attendeeSchema).min(1),
  guests: z.array(guestSchema).max(30).default([]),
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
  rows: z.array(attendeeSchema).min(1),
  guests: z.array(guestSchema).max(30).default([]),
});

// ---- Tournaments (isolated ledgers — see lib/tournaments.ts) ----------

export const createTournamentSchema = z.object({
  name: z.string().trim().min(1).max(80),
  team_name: z.string().trim().min(1).max(80).optional(),
  // Free-text ground name, same as match scheduling.
  venue: z.string().trim().min(1).max(80).optional(),
  // One participation fee for the whole tournament (0 = none yet).
  joining_fee: z.number().int().nonnegative().optional(),
  start_date: entryDate,
  end_date: entryDate,
});

export const editTournamentSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    // null clears the field; undefined leaves it untouched.
    team_name: z.string().trim().min(1).max(80).nullable().optional(),
    venue: z.string().trim().min(1).max(80).nullable().optional(),
    joining_fee: z.number().int().nonnegative().optional(),
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
export const tournamentMatchPreviewSchema = matchPreviewSchema.omit({
  guests: true,
});
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
