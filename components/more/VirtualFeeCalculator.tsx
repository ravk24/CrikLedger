"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { virtualFee, type VirtualFeeResult } from "@/engine/virtualFee";
import { Money } from "@/components/shared/Money";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type NameBalls = { name: string; balls: string };

// Hidden position charges (positions 1–5) — the calculation internals
// are deliberately not shown on the page.
const POSITION_CHARGES = [200, 200, 150, 75, 35];

// Fun-only calculator — everything lives in component state, nothing
// is ever written to the database.
export function VirtualFeeCalculator() {
  const [matchFee, setMatchFee] = useState("2000");
  const [overs, setOvers] = useState("15");
  const [batsmen, setBatsmen] = useState<NameBalls[]>([
    { name: "", balls: "" },
    { name: "", balls: "" },
  ]);
  const [bowlers, setBowlers] = useState<NameBalls[]>([{ name: "", balls: "" }]);

  const num = (raw: string) => {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const namedBatsmen = batsmen.filter((b) => b.name.trim() !== "");
  const namedBowlers = bowlers.filter((b) => b.name.trim() !== "");
  const fee = Number(matchFee);
  const oversNum = Number(overs);
  const ready =
    Number.isFinite(fee) &&
    fee > 0 &&
    Number.isFinite(oversNum) &&
    oversNum > 0 &&
    namedBatsmen.length + namedBowlers.length > 0;

  let result: VirtualFeeResult | null = null;
  let feeTooLow = false;
  if (ready) {
    try {
      result = virtualFee({
        matchFee: fee,
        overs: oversNum,
        positionCharges: POSITION_CHARGES,
        batsmen: namedBatsmen.map((b) => ({
          name: b.name.trim(),
          ballsFaced: num(b.balls),
        })),
        bowlers: namedBowlers.map((b) => ({
          name: b.name.trim(),
          ballsBowled: num(b.balls),
        })),
      });
    } catch (e) {
      // FEE_BELOW_FIXED: the occupied batting positions' fixed charges
      // exceed the fee — nothing sensible to split.
      if (!(e instanceof Error && e.message === "FEE_BELOW_FIXED")) throw e;
      feeTooLow = true;
    }
  }

  const updateRow =
    (rows: NameBalls[], setRows: (r: NameBalls[]) => void) =>
    (i: number, patch: Partial<NameBalls>) =>
      setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const removeRow =
    (rows: NameBalls[], setRows: (r: NameBalls[]) => void) => (i: number) =>
      setRows(rows.filter((_, j) => j !== i));
  const updateBatsman = updateRow(batsmen, setBatsmen);
  const updateBowler = updateRow(bowlers, setBowlers);

  const addButton = (onClick: () => void, label: string) => (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 items-center justify-center gap-1.5 rounded-md border border-dashed border-border text-sm font-medium text-text-secondary"
    >
      <Plus size={16} /> {label}
    </button>
  );

  const removeButton = (onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      aria-label="Remove"
      className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border text-text-muted"
    >
      <X size={14} />
    </button>
  );

  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
          Match settings
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vf-fee">Match fee</Label>
            <Input
              id="vf-fee"
              inputMode="numeric"
              value={matchFee}
              onChange={(e) => setMatchFee(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vf-overs">Overs</Label>
            <Input
              id="vf-overs"
              inputMode="numeric"
              value={overs}
              onChange={(e) => setOvers(e.target.value)}
              className="h-11"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
          Batsmen — in batting order
        </p>
        {batsmen.map((b, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-md border border-border p-3"
          >
            <div className="flex items-center gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-surface-secondary text-xs font-bold tabular-nums text-text-secondary">
                {i + 1}
              </span>
              <Input
                placeholder="Batsman name"
                value={b.name}
                onChange={(e) => updateBatsman(i, { name: e.target.value })}
                className="h-10 placeholder:font-light"
              />
              {removeButton(() => removeRow(batsmen, setBatsmen)(i))}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-text-muted">Balls faced</span>
              <Input
                inputMode="numeric"
                placeholder="0"
                value={b.balls}
                onChange={(e) => updateBatsman(i, { balls: e.target.value })}
                className="h-10 placeholder:font-light"
              />
            </div>
          </div>
        ))}
        {addButton(
          () => setBatsmen([...batsmen, { name: "", balls: "" }]),
          "Add batsman",
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
          Bowlers — any order
        </p>
        {bowlers.map((b, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              placeholder="Bowler name"
              value={b.name}
              onChange={(e) => updateBowler(i, { name: e.target.value })}
              className="h-10 placeholder:font-light"
            />
            <div className="w-24 shrink-0">
              <Input
                inputMode="numeric"
                placeholder="Balls"
                value={b.balls}
                onChange={(e) => updateBowler(i, { balls: e.target.value })}
                className="h-10 placeholder:font-light"
              />
            </div>
            {removeButton(() => removeRow(bowlers, setBowlers)(i))}
          </div>
        ))}
        {addButton(
          () => setBowlers([...bowlers, { name: "", balls: "" }]),
          "Add bowler",
        )}
      </div>

      {feeTooLow && (
        <p className="rounded-lg border border-debit-light bg-surface p-4 text-sm text-debit">
          The match fee is below the fixed charges for the occupied batting
          positions — enter a higher fee or fewer batsmen.
        </p>
      )}
      {result ? (
        // Only the final per-player amounts — the calculation stays hidden.
        <div className="rounded-lg border border-border bg-surface">
          <p className="px-4 pb-1 pt-3 text-sm font-bold text-text-primary">
            Player totals
          </p>
          <div className="divide-y divide-border">
            {result.totals.map((t) => (
              <div
                key={t.name}
                className="flex items-center justify-between px-4 py-2.5"
              >
                <span className="text-sm font-semibold text-text-primary">
                  {t.name}
                </span>
                <Money
                  amount={t.amount}
                  variant="balance"
                  className="text-sm font-bold"
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-border bg-surface p-4 text-xs text-text-muted">
          Enter the match fee, overs, and at least one player to see the fun
          split.
        </p>
      )}
    </>
  );
}
