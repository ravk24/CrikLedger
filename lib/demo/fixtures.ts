import type { WizardPlayer } from "@/components/wizard/wizardTypes";

// Guest-mode sample data. HARDCODED ON PURPOSE.
//
// Nothing here is read from the database and nothing guest-side is ever
// written to it, which is what makes the free sample safe: it cannot
// expose a paying team's roster or money, it needs no usage limits or
// purge cron, and it keeps working before any team exists.
//
// If you are tempted to point this at a real "demo team" row, don't —
// that is a live tenant that would then have to be excluded from the
// teams directory, every aggregate, and every purge, forever.

export const DEMO_TEAM = {
  name: "Supergiants",
  opponent: "Challengers",
  venue: "Barne",
  date: "2026-09-13",
} as const;

// Eleven names + the costs of one ordinary Sunday match. One of them is
// the captain: the guests step charges every guest fee to the captain's
// balance, so the sample needs one to demonstrate that rule.
export const DEMO_PLAYERS: WizardPlayer[] = [
  { id: "d1", name: "Arjun", is_captain: true },
  { id: "d2", name: "Vikram" },
  { id: "d3", name: "Rohit" },
  { id: "d4", name: "Sameer" },
  { id: "d5", name: "Karan" },
  { id: "d6", name: "Imran" },
  { id: "d7", name: "Nikhil" },
  { id: "d8", name: "Prakash" },
  { id: "d9", name: "Deepak" },
  { id: "d10", name: "Manish" },
  { id: "d11", name: "Sunil" },
];

// Who drove. Three cars for eleven players is a typical split.
export const DEMO_DRIVERS = ["d2", "d5", "d9"] as const;

export const DEMO_COSTS = {
  ground: "2500",
  ball: "60", // the club default the paid wizard prefills
  other: "0",
  allowance: "250",
} as const;

export const DEMO_RESULT = "won" as const;

// ---- Ledger sample -----------------------------------------------------
// Shape mirrors pool_ledger_public closely enough for the row component,
// but every value is invented.

export type DemoLedgerRow = {
  id: string;
  entry_date: string;
  title: string;
  detail: string | null;
  amount: number; // + credit, - debit
};

export const DEMO_LEDGER: DemoLedgerRow[] = [
  {
    id: "l1",
    entry_date: "2026-09-13",
    title: "Match collection · vs Challengers",
    detail: "11 players",
    // What the sample match itself collects: ceil(3310 / 11) = 301 a
    // head, less the ₹250 rebate for each of the three drivers.
    amount: 2561,
  },
  {
    id: "l2",
    entry_date: "2026-09-13",
    title: "Ground fee · Barne",
    detail: "Paid from pool",
    amount: -2500,
  },
  {
    id: "l3",
    entry_date: "2026-09-13",
    title: "New ball",
    detail: "Paid from pool",
    amount: -60,
  },
  {
    id: "l4",
    entry_date: "2026-09-06",
    title: "Deposit · Arjun",
    detail: "Season top-up",
    amount: 1500,
  },
  {
    id: "l5",
    entry_date: "2026-08-30",
    title: "Deposit · Vikram",
    detail: "Season top-up",
    amount: 1500,
  },
  {
    id: "l6",
    entry_date: "2026-08-30",
    title: "Nets booking",
    detail: "Paid from pool",
    amount: -800,
  },
];

export const DEMO_POOL_BALANCE = DEMO_LEDGER.reduce(
  (sum, r) => sum + r.amount,
  0,
);
