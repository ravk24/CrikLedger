import { describe, expect, it } from "vitest";
import {
  exportFilename,
  exportedAtLabel,
  isoDateToUtc,
  kindLabel,
  ledgerTitle,
  matchLabel,
  shapeStatements,
  sortBalances,
  withRunningBalance,
  type BalanceSource,
  type LedgerSource,
  type StatementSource,
} from "./ledgerRows";

const ledger = (over: Partial<LedgerSource>): LedgerSource => ({
  id: "row",
  entry_date: "2026-08-01",
  created_at: "2026-08-01 10:00:00+00",
  kind: "deposit",
  message: "",
  amount: 0,
  player_name: null,
  edited_by: null,
  match_id: null,
  match_opponent: null,
  ...over,
});

describe("withRunningBalance", () => {
  it("sums stored amounts oldest first, every kind included", () => {
    const rows = [
      ledger({ id: "3", entry_date: "2026-08-03", kind: "match_collection", message: "Match surplus vs Lions", amount: 8 }),
      ledger({ id: "1", entry_date: "2026-08-01", kind: "deposit", player_name: "Asha", amount: 1000 }),
      // Season dues subtract from the pool total (migration 9).
      ledger({ id: "2", entry_date: "2026-08-02", kind: "opening_due", player_name: "Ravi", amount: -300 }),
      // pg hands numeric aggregates back as strings.
      ledger({ id: "4", entry_date: "2026-08-03", kind: "plain_debit", message: "Balls", amount: "-60", created_at: "2026-08-03 12:00:00+00" }),
    ];
    const { rows: out, total } = withRunningBalance(rows);
    expect(out.map((r) => r.id)).toEqual(["1", "2", "3", "4"]);
    expect(out.map((r) => r.running)).toEqual([1000, 700, 708, 648]);
    expect(total).toBe(648);
    // The pool_balance rule: a plain sum of every row.
    expect(total).toBe(rows.reduce((s, r) => s + Number(r.amount), 0));
    expect(out[0]).toMatchObject({
      date: "2026-08-01",
      kind: "Deposit",
      description: "Deposit by Asha",
      player: "Asha",
      amount: 1000,
      match: "",
      enteredBy: "",
    });
  });

  it("breaks same-day ties by created_at, then id", () => {
    const rows = [
      ledger({ id: "b", created_at: "2026-08-01 09:00:00+00", amount: 5 }),
      ledger({ id: "a", created_at: "2026-08-01 09:00:00+00", amount: 7 }),
      ledger({ id: "c", created_at: "2026-08-01 08:00:00+00", amount: 1 }),
    ];
    expect(withRunningBalance(rows).rows.map((r) => r.id)).toEqual(["c", "a", "b"]);
  });

  it("does not mutate its input", () => {
    const rows = [ledger({ id: "2", entry_date: "2026-08-02" }), ledger({ id: "1" })];
    withRunningBalance(rows);
    expect(rows.map((r) => r.id)).toEqual(["2", "1"]);
  });

  it("is empty and zero for an empty ledger", () => {
    expect(withRunningBalance([])).toEqual({ rows: [], total: 0 });
  });
});

describe("ledgerTitle / matchLabel / kindLabel", () => {
  it("titles player-linked rows by the player, like the ledger page", () => {
    expect(ledgerTitle({ kind: "deposit", message: "UPI", player_name: "Asha" })).toBe("Deposit by Asha");
    expect(ledgerTitle({ kind: "opening_due", message: "", player_name: "Ravi" })).toBe("Season due — Ravi");
    expect(ledgerTitle({ kind: "plain_debit", message: "Balls", player_name: null })).toBe("Balls");
    // A player name on any other kind does not override the message.
    expect(ledgerTitle({ kind: "other_income", message: "Sponsor", player_name: "Asha" })).toBe("Sponsor");
  });

  it("labels a match fee by opponent, TBD when unknown, blank otherwise", () => {
    expect(matchLabel({ match_id: "m1", match_opponent: "Lions" })).toBe("vs Lions");
    expect(matchLabel({ match_id: "m1", match_opponent: null })).toBe("vs Opponent TBD");
    expect(matchLabel({ match_id: null, match_opponent: null })).toBe("");
  });

  it("falls through unknown kinds unchanged", () => {
    expect(kindLabel("opening_due")).toBe("Season due");
    expect(kindLabel("something_new")).toBe("something_new");
  });
});

describe("sortBalances", () => {
  const player = (over: Partial<BalanceSource>): BalanceSource => ({
    id: "p",
    name: "P",
    is_active: true,
    balance: 0,
    status: "low",
    is_captain: false,
    is_vice_captain: false,
    ...over,
  });

  it("puts active players first, biggest debtors on top, names as tiebreak", () => {
    const out = sortBalances([
      player({ id: "1", name: "Zed", balance: "950", status: "surplus" }),
      player({ id: "2", name: "Gone", balance: -50, is_active: false, status: "inactive" }),
      player({ id: "3", name: "Bo", balance: -200, status: "debt", is_captain: true }),
      player({ id: "4", name: "Al", balance: -200, status: "debt" }),
    ]);
    expect(out.map((p) => p.name)).toEqual(["Al", "Bo", "Zed", "Gone"]);
    expect(out[1]).toEqual({
      name: "Bo",
      balance: -200,
      status: "debt",
      isCaptain: true,
      isViceCaptain: false,
      isActive: true,
    });
    expect(out[2].balance).toBe(950);
  });
});

describe("shapeStatements", () => {
  const row = (over: Partial<StatementSource>): StatementSource => ({
    player_id: "p1",
    entry_date: "2026-08-01",
    created_at: "2026-08-01 10:00:00+00",
    kind: "deposit",
    description: "",
    delta: 0,
    running_balance: 0,
    match_id: null,
    source_id: "s",
    edited_by: null,
    ...over,
  });
  const names = new Map([
    ["p1", "Ravi"],
    ["p2", "Asha"],
  ]);

  it("groups per player by name and keeps the view's running balance", () => {
    const out = shapeStatements(
      [
        row({ player_id: "p1", source_id: "a", delta: 500, running_balance: "500" }),
        row({ player_id: "p2", source_id: "b", delta: 100, running_balance: 100 }),
        row({ player_id: "p1", source_id: "c", entry_date: "2026-08-03", kind: "match_fee", description: "vs Lions", delta: -255, running_balance: 245, match_id: "m1" }),
        row({ player_id: "p1", source_id: "d", entry_date: "2026-08-02", kind: "driver_rebate", description: "vs Tigers", delta: 5, running_balance: 505, match_id: "m0", edited_by: "Admin" }),
      ],
      names,
    );
    expect(out.map((r) => [r.player, r.date])).toEqual([
      ["Asha", "2026-08-01"],
      ["Ravi", "2026-08-01"],
      ["Ravi", "2026-08-02"],
      ["Ravi", "2026-08-03"],
    ]);
    expect(out.map((r) => r.running)).toEqual([100, 500, 505, 245]);
    expect(out[3]).toEqual({
      player: "Ravi",
      date: "2026-08-03",
      kind: "Match fee",
      description: "vs Lions",
      delta: -255,
      running: 245,
      matchId: "m1",
      enteredBy: "",
    });
    expect(out[2].kind).toBe("Car rebate");
    expect(out[2].enteredBy).toBe("Admin");
  });

  it("names an unknown player rather than dropping the row", () => {
    const out = shapeStatements([row({ player_id: "ghost" })], names);
    expect(out).toHaveLength(1);
    expect(out[0].player).toBe("(unknown player)");
  });
});

describe("dates and filenames", () => {
  it("builds a UTC-midnight Date for a tz-less DATE", () => {
    const d = isoDateToUtc("2026-08-01");
    expect(d.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    // A timestamp string is trimmed to its day.
    expect(isoDateToUtc("2026-12-31T23:59:59+05:30").toISOString()).toBe("2026-12-31T00:00:00.000Z");
  });

  it("names the file by team slug and day", () => {
    expect(exportFilename("super-giants", "2026-09-09")).toBe("super-giants-ledger-2026-09-09.xlsx");
  });

  it("stamps the export in IST", () => {
    // 20:35 UTC is 02:05 IST the next day.
    const label = exportedAtLabel(new Date("2026-09-09T20:35:00Z"));
    expect(label.startsWith("Exported 10 Sep")).toBe(true);
    expect(label).toContain("02:05");
    expect(label.endsWith(" IST")).toBe(true);
  });
});
