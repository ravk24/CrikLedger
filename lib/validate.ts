import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

// ---- Route body schemas ----------------------------------------------

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const changePasswordSchema = z.object({
  new_password: z.string().min(8),
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

// Ground booking: an outside team books N slots. One credit (amount
// actually paid), one booking record, N scheduled matches — one per date.
export const groundBookingSchema = z
  .object({
    kind: z.literal("ground_booking"),
    team_name: z.string().trim().min(1).max(80),
    captain: z.string().trim().min(1).max(80),
    slots: z.number().int().positive().max(20),
    amount_paid: z.number().int().nonnegative(),
    amount_pending: z.number().int().nonnegative(),
    match_dates: z
      .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "yyyy-mm-dd"))
      .min(1)
      .max(20),
    entry_date: entryDate,
  })
  .refine((body) => body.match_dates.length === body.slots, {
    message: "One date per booked slot",
  })
  .refine((body) => body.amount_paid + body.amount_pending > 0, {
    message: "Paid and pending cannot both be zero",
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

export const createAdminSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9_]+$/, "lowercase letters, digits, underscores"),
  name: z.string().trim().min(1).max(80),
});

export const scheduleMatchSchema = z
  .object({
    match_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "yyyy-mm-dd"),
    opponent: z.string().trim().min(1).max(80),
    // Create only: which scheduling flow this is. Provenance — the edit
    // route never updates it (project rule: ground is set once, at insert).
    ground: z.enum(["home", "away"]).default("home"),
    // Away ground name, away matches only; absent = unknown/keep current.
    venue: z.string().trim().min(1).max(80).optional(),
    // Away creates only: who received our team's ground share, and the
    // contribution recorded as a pool debit in the same transaction.
    fee_paid_to: z.enum(["opponent", "owner"]).optional(),
    fee_amount: z.number().int().positive().optional(),
    // Edit mode only: renames the linked ground booking's captain.
    opponent_captain: z.string().trim().min(1).max(80).optional(),
  })
  // Scheduling an away match ALWAYS records the payment (one switch is
  // required in the UI). Edit bodies never send ground, so the home
  // default keeps this refine out of their way.
  .refine(
    (body) =>
      body.ground !== "away" ||
      (body.fee_paid_to !== undefined && body.fee_amount !== undefined),
    { message: "fee_paid_to and fee_amount are required for away matches" },
  );

export const abandonMatchSchema = z.object({
  reason: z.string().trim().min(1).max(200),
});

// Clearing a booking's pending fee: the client echoes the amount it
// displayed so a stale page can't clear a different figure.
export const clearPendingSchema = z.object({
  expected_pending: z.number().int().positive(),
});

const attendeeSchema = z.object({
  player_id: z.string().uuid(),
  brought_car: z.boolean(),
});

// v2 guest rule: guests count in the fee split and their charges are
// deducted from the standing captain's balance (guests hand the
// captain cash offline). Guest cars join the pot like player cars.
const guestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  brought_car: z.boolean(),
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
  rows: z
    .array(
      attendeeSchema.extend({
        fee: z.number().int(), // may be negative for drivers
      }),
    )
    .min(1),
  guests: z.array(guestSchema).max(30).default([]),
});

// ---- Tournaments (isolated ledgers — see lib/tournaments.ts) ----------

export const createTournamentSchema = z.object({
  name: z.string().trim().min(1).max(80),
  team_name: z.string().trim().min(1).max(80).optional(),
  // Ground name from the shared grounds dropdown (custom text for
  // "Other ground…"), same as SG scheduling.
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
