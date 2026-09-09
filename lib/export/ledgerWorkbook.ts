// The XLSX workbook behind GET /api/export/ledger. Server-only: ExcelJS
// is CommonJS with a browser build we never want bundled
// (serverExternalPackages in next.config.ts). Takes the already-shaped
// rows from lib/export/ledgerRows.ts — nothing here reads a database or
// touches money math.

import ExcelJS from "exceljs";
import {
  isoDateToUtc,
  type ExportBalanceRow,
  type ExportLedgerRow,
  type ExportStatementRow,
} from "@/lib/export/ledgerRows";

export type LedgerWorkbookInput = {
  title: string; // "<team> — Team ledger"
  exportedAtLabel: string;
  fundLabel: string; // "Pool balance"
  fundBalance: number;
  ledger: ExportLedgerRow[];
  balances: ExportBalanceRow[];
  statements: ExportStatementRow[];
  truncated: { ledger: boolean; statements: boolean };
};

export const SHEET_NAMES = ["Ledger", "Balances", "Statements"] as const;

// Rows 1–4 are the header block, row 5 is blank, row 6 holds the column
// headers; data starts at row 7. Frozen and filtered at row 6.
export const HEADER_ROW = 6;

const MONEY_FMT = "#,##0;[Red]-#,##0";
const DATE_FMT = "dd-mmm-yyyy";
const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE2E8F0" },
};
export const TRUNCATED_RED = "FFB91C1C";

type Column = { header: string; width: number; numFmt?: string };

function startSheet(
  wb: ExcelJS.Workbook,
  name: string,
  columns: Column[],
  input: LedgerWorkbookInput,
  rowCount: number,
  truncated: boolean,
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: HEADER_ROW }],
  });
  ws.columns = columns.map((c) => ({ width: c.width }));

  ws.getCell("A1").value = input.title;
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A2").value = input.exportedAtLabel;
  ws.getCell("A3").value = input.fundLabel;
  ws.getCell("B3").value = input.fundBalance;
  ws.getCell("B3").numFmt = MONEY_FMT;
  ws.getCell("B3").font = { bold: true };
  if (truncated) {
    ws.getCell("A4").value =
      `Rows (first ${rowCount} — INCOMPLETE, running balance will not match)`;
    ws.getCell("A4").font = { bold: true, color: { argb: TRUNCATED_RED } };
  } else {
    ws.getCell("A4").value = "Rows";
  }
  ws.getCell("B4").value = rowCount;

  const header = ws.getRow(HEADER_ROW);
  columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
  });
  ws.autoFilter = {
    from: { row: HEADER_ROW, column: 1 },
    to: { row: HEADER_ROW, column: columns.length },
  };
  return ws;
}

function addRow(
  ws: ExcelJS.Worksheet,
  columns: Column[],
  values: ExcelJS.CellValue[],
): ExcelJS.Row {
  const row = ws.addRow(values);
  columns.forEach((c, i) => {
    if (c.numFmt) row.getCell(i + 1).numFmt = c.numFmt;
  });
  return row;
}

const LEDGER_COLUMNS: Column[] = [
  { header: "#", width: 6 },
  { header: "Date", width: 12, numFmt: DATE_FMT },
  { header: "Kind", width: 16 },
  { header: "Description", width: 44 },
  { header: "Player", width: 22 },
  { header: "Amount", width: 14, numFmt: MONEY_FMT },
  { header: "Running balance", width: 16, numFmt: MONEY_FMT },
  { header: "Match", width: 20 },
  { header: "Entered by", width: 18 },
  { header: "Entry id", width: 38 },
];

const BALANCE_COLUMNS: Column[] = [
  { header: "Name", width: 28 },
  { header: "Balance", width: 14, numFmt: MONEY_FMT },
  { header: "Status", width: 12 },
  { header: "Captain", width: 10 },
  { header: "Vice-captain", width: 12 },
  { header: "Active", width: 10 },
];

const STATEMENT_COLUMNS: Column[] = [
  { header: "Player", width: 24 },
  { header: "Date", width: 12, numFmt: DATE_FMT },
  { header: "Kind", width: 16 },
  { header: "Description", width: 44 },
  { header: "Delta", width: 14, numFmt: MONEY_FMT },
  { header: "Running balance", width: 16, numFmt: MONEY_FMT },
  { header: "Match id", width: 38 },
  { header: "Entered by", width: 18 },
];

export async function buildLedgerWorkbook(
  input: LedgerWorkbookInput,
): Promise<Uint8Array<ArrayBuffer>> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CrikLedger";
  wb.created = new Date();

  // ---- Ledger ----
  const ledger = startSheet(
    wb,
    SHEET_NAMES[0],
    LEDGER_COLUMNS,
    input,
    input.ledger.length,
    input.truncated.ledger,
  );
  if (input.ledger.length === 0) {
    ledger.addRow(["The ledger is empty."]);
  }
  input.ledger.forEach((r, i) => {
    addRow(ledger, LEDGER_COLUMNS, [
      i + 1,
      isoDateToUtc(r.date),
      r.kind,
      r.description,
      r.player,
      r.amount,
      r.running,
      r.match,
      r.enteredBy,
      r.id,
    ]);
  });

  // ---- Balances ----
  const balances = startSheet(
    wb,
    SHEET_NAMES[1],
    BALANCE_COLUMNS,
    input,
    input.balances.length,
    false,
  );
  for (const p of input.balances) {
    addRow(balances, BALANCE_COLUMNS, [
      p.name,
      p.balance,
      p.status,
      p.isCaptain ? "C" : "",
      p.isViceCaptain ? "VC" : "",
      p.isActive ? "Yes" : "No",
    ]);
  }
  // Deliberately not called the pool balance: player balances and the
  // pool are different sums (match fees sit on players, not in the pool).
  const sumRow = addRow(balances, BALANCE_COLUMNS, [
    "Sum of player balances",
    input.balances.reduce((s, p) => s + p.balance, 0),
  ]);
  sumRow.font = { bold: true };

  // ---- Statements ----
  const statements = startSheet(
    wb,
    SHEET_NAMES[2],
    STATEMENT_COLUMNS,
    input,
    input.statements.length,
    input.truncated.statements,
  );
  if (input.statements.length === 0) {
    statements.addRow(["No statement entries yet."]);
  }
  for (const r of input.statements) {
    addRow(statements, STATEMENT_COLUMNS, [
      r.player,
      isoDateToUtc(r.date),
      r.kind,
      r.description,
      r.delta,
      r.running,
      r.matchId,
      r.enteredBy,
    ]);
  }

  // A fresh ArrayBuffer-backed copy: what fetch's Response accepts as a
  // body. At runtime writeBuffer() returns a Node Buffer (a Uint8Array),
  // but ExcelJS's index.d.ts declares it as its own `interface Buffer
  // extends ArrayBuffer`, which is neither — hence the one cast here.
  const out = (await wb.xlsx.writeBuffer()) as unknown as Uint8Array;
  const bytes = new Uint8Array(out.byteLength);
  bytes.set(out);
  return bytes;
}
