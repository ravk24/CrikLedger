import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  HEADER_ROW,
  SHEET_NAMES,
  TRUNCATED_RED,
  buildLedgerWorkbook,
  type LedgerWorkbookInput,
} from "./ledgerWorkbook";

// Round-trip: build, load back with ExcelJS, assert the shape a human
// would check first — sheet names, the balance pill, dates that are real
// dates, and a running balance that ends on the pool balance.

const base: LedgerWorkbookInput = {
  title: "SuperGiants — Team ledger",
  exportedAtLabel: "Exported 09 Sep 2026, 14:05 IST",
  fundLabel: "Pool balance",
  fundBalance: 648,
  ledger: [
    { id: "1", date: "2026-08-01", kind: "Deposit", description: "Deposit by Asha", player: "Asha", amount: 1000, running: 1000, match: "", enteredBy: "Ravi" },
    { id: "2", date: "2026-08-02", kind: "Season due", description: "Season due — Ravi", player: "Ravi", amount: -300, running: 700, match: "", enteredBy: "" },
    { id: "3", date: "2026-08-03", kind: "Match collection", description: "Match surplus vs Lions", player: "", amount: 8, running: 708, match: "vs Lions", enteredBy: "" },
    { id: "4", date: "2026-08-03", kind: "Debit", description: "Balls", player: "", amount: -60, running: 648, match: "", enteredBy: "" },
  ],
  balances: [
    { name: "Asha", balance: 745, status: "low", isCaptain: true, isViceCaptain: false, isActive: true },
    { name: "Ravi", balance: -300, status: "debt", isCaptain: false, isViceCaptain: true, isActive: false },
  ],
  statements: [
    { player: "Asha", date: "2026-08-01", kind: "Deposit", description: "UPI", delta: 1000, running: 1000, matchId: "", enteredBy: "" },
    { player: "Asha", date: "2026-08-03", kind: "Match fee", description: "vs Lions", delta: -255, running: 745, matchId: "m1", enteredBy: "" },
  ],
  truncated: { ledger: false, statements: false },
};

async function load(input: LedgerWorkbookInput): Promise<ExcelJS.Workbook> {
  const bytes = await buildLedgerWorkbook(input);
  const wb = new ExcelJS.Workbook();
  // ExcelJS's index.d.ts declares a global `interface Buffer extends
  // ArrayBuffer`, which merges with Node's Buffer into a type nothing real
  // satisfies. At runtime load() takes a Node Buffer, so the cast is the
  // only way through the declaration.
  type LoadArg = Parameters<typeof wb.xlsx.load>[0];
  await wb.xlsx.load(Buffer.from(bytes) as unknown as LoadArg);
  return wb;
}

describe("buildLedgerWorkbook", () => {
  it("writes the three sheets with the header block and the rows", async () => {
    const wb = await load(base);
    expect(wb.worksheets.map((w) => w.name)).toEqual([...SHEET_NAMES]);

    const ledger = wb.getWorksheet("Ledger")!;
    expect(ledger.getCell("A1").value).toBe("SuperGiants — Team ledger");
    expect(ledger.getCell("B3").value).toBe(648);
    expect(ledger.getCell("A4").value).toBe("Rows");
    expect(ledger.getCell("B4").value).toBe(4);
    expect(ledger.getRow(HEADER_ROW).getCell(7).value).toBe("Running balance");
    expect(ledger.views[0]).toMatchObject({ state: "frozen", ySplit: HEADER_ROW });

    const first = ledger.getRow(HEADER_ROW + 1);
    expect(first.getCell(1).value).toBe(1);
    const date = first.getCell(2).value;
    expect(date).toBeInstanceOf(Date);
    expect((date as Date).toISOString().slice(0, 10)).toBe("2026-08-01");
    expect(first.getCell(4).value).toBe("Deposit by Asha");
    expect(first.getCell(6).value).toBe(1000);

    // The last running balance is the pool balance.
    const last = ledger.getRow(HEADER_ROW + base.ledger.length);
    expect(last.getCell(7).value).toBe(base.fundBalance);

    const balances = wb.getWorksheet("Balances")!;
    expect(balances.getRow(HEADER_ROW + 1).getCell(4).value).toBe("C");
    expect(balances.getRow(HEADER_ROW + 2).getCell(6).value).toBe("No");
    const sum = balances.getRow(HEADER_ROW + 3);
    expect(sum.getCell(1).value).toBe("Sum of player balances");
    expect(sum.getCell(2).value).toBe(445);

    const statements = wb.getWorksheet("Statements")!;
    expect(statements.getCell("B4").value).toBe(2);
    expect(statements.getRow(HEADER_ROW + 2).getCell(6).value).toBe(745);
  });

  it("still produces a loadable workbook for an empty team", async () => {
    const wb = await load({
      ...base,
      fundBalance: 0,
      ledger: [],
      balances: [],
      statements: [],
    });
    const ledger = wb.getWorksheet("Ledger")!;
    expect(ledger.getCell("B3").value).toBe(0);
    expect(ledger.getCell("B4").value).toBe(0);
    expect(ledger.getRow(HEADER_ROW + 1).getCell(1).value).toBe("The ledger is empty.");
    expect(wb.getWorksheet("Balances")!.getRow(HEADER_ROW + 1).getCell(2).value).toBe(0);
  });

  it("flags a truncated sheet in the header block", async () => {
    const wb = await load({ ...base, truncated: { ledger: true, statements: false } });
    const a4 = wb.getWorksheet("Ledger")!.getCell("A4");
    expect(String(a4.value)).toContain("INCOMPLETE");
    expect(a4.font?.color?.argb).toBe(TRUNCATED_RED);
    expect(wb.getWorksheet("Statements")!.getCell("A4").value).toBe("Rows");
  });
});
