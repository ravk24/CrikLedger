"use client";

import { useState } from "react";
import { Car, ChevronLeft, Download, Share2, Users } from "lucide-react";
import { formatRupees } from "@/lib/format";
import { DEMO_PLAYERS, DEMO_TEAM } from "@/lib/demo/fixtures";
import type { FeeRow, MatchFeeResult } from "@/engine/calc";
import type { WizardCosts } from "@/components/wizard/wizardTypes";
import { CaptainMark } from "@/components/shared/CaptainMark";

const NAME_BY_ID = new Map(DEMO_PLAYERS.map((p) => [p.id, p.name]));

// The end of the sample: the finished match sheet, and the share that
// makes it worth finishing. The PNG is rendered by a route handler that
// touches no database and no cookies, so "no writes" holds by
// construction rather than by discipline.
export function GuestMatchSheet({
  result,
  rows,
  costs,
  captainName,
  captainId,
  onBack,
}: {
  result: MatchFeeResult;
  rows: FeeRow[]; // engine rows with any manual fee edit applied
  costs: WizardCosts;
  captainName: string | null;
  captainId: string | null;
  onBack: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Totals follow the rows on screen, so an edited fee is reflected here
  // rather than quietly showing the pre-edit engine numbers.
  const cashCosts =
    (Number(costs.ground) || 0) +
    (Number(costs.ball) || 0) +
    (Number(costs.other) || 0);
  const collected =
    rows.reduce((sum, r) => sum + r.fee, 0) + result.captainCharge;
  const surplus = Math.max(0, collected - cashCosts);
  const carCount =
    rows.filter((r) => r.broughtCar).length +
    result.guestRows.filter((g) => g.broughtCar).length;

  const payload = {
    team: DEMO_TEAM.name,
    opponent: DEMO_TEAM.opponent,
    venue: DEMO_TEAM.venue,
    date: "Sun, 13 Sep 2026",
    groundFee: Number(costs.ground) || 0,
    ballFee: Number(costs.ball) || 0,
    otherFee: Number(costs.other) || 0,
    carAllowancePerCar: Number(costs.allowance) || 0,
    carCount,
    totalCost: result.totalCost,
    surplus,
    rows: [
      ...rows.map((r) => ({
        name: NAME_BY_ID.get(r.playerId) ?? r.playerId,
        fee: r.fee,
        broughtCar: r.broughtCar,
        isCaptain: r.playerId === captainId,
      })),
      ...result.guestRows.map((g) => ({
        name: g.name,
        fee: g.fee,
        broughtCar: g.broughtCar,
      })),
    ],
    captainNote:
      result.captainCharge > 0 && captainName
        ? `Guest fees charged to ${captainName}`
        : undefined,
  };

  async function share(mode: "share" | "download") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/share/match-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("render failed");
      const blob = await res.blob();
      const file = new File([blob], "match-sheet.png", { type: "image/png" });

      // Native share sheet where the device has one (this is the WhatsApp
      // path on Android); otherwise fall back to a download.
      if (
        mode === "share" &&
        typeof navigator !== "undefined" &&
        navigator.canShare?.({ files: [file] })
      ) {
        await navigator.share({ files: [file], title: "Match sheet" });
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "match-sheet.png";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      // A cancelled native share rejects too — not worth an error.
      if ((e as Error)?.name !== "AbortError") {
        setError("Could not build the image — try the download instead.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="flex min-h-11 items-center gap-1 self-start text-sm font-medium text-text-secondary"
      >
        <ChevronLeft size={16} /> Back
      </button>

      <section className="rounded-lg border border-border bg-surface shadow-card p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-credit">
          Match complete
        </p>
        <h2 className="mt-1 text-lg font-bold text-text-primary">
          {DEMO_TEAM.name} vs {DEMO_TEAM.opponent}
        </h2>
        <p className="mt-0.5 text-sm text-text-secondary">
          {DEMO_TEAM.venue} · Sun, 13 Sep 2026
        </p>

        <ul className="mt-4 divide-y divide-border">
          {rows.map((r) => (
            <li
              key={r.playerId}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span className="text-text-primary">
                {NAME_BY_ID.get(r.playerId)}
                {r.playerId === captainId && (
                  <CaptainMark className="ml-1.5 align-text-bottom" />
                )}
                {r.broughtCar && (
                  <Car
                    size={14}
                    aria-label="Brought a car"
                    className="ml-1.5 inline shrink-0 align-text-bottom text-accent"
                  />
                )}
                {r.sharedCar && (
                  <Users
                    size={13}
                    aria-label="Shared a car"
                    className="ml-1.5 inline shrink-0 align-text-bottom text-text-muted"
                  />
                )}
              </span>
              <span
                className={
                  r.fee < 0
                    ? "font-medium text-credit"
                    : "font-medium text-text-primary"
                }
              >
                {r.fee < 0 ? "+" : ""}₹{formatRupees(r.fee)}
              </span>
            </li>
          ))}
        </ul>

        {result.guestRows.length > 0 && (
          <ul className="divide-y divide-border border-t border-border">
            {result.guestRows.map((g) => (
              <li
                key={g.name}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="text-text-primary">
                  {g.name}
                  {g.broughtCar && (
                    <Car
                      size={14}
                      aria-label="Brought a car"
                      className="ml-1.5 inline shrink-0 align-text-bottom text-accent"
                    />
                  )}
                </span>
                <span
                  className={
                    g.fee < 0
                      ? "font-medium text-credit"
                      : "font-medium text-text-primary"
                  }
                >
                  {g.fee < 0 ? "+" : ""}₹{formatRupees(g.fee)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <dl className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
          <Line label="Ground" value={Number(costs.ground) || 0} />
          <Line label="Balls" value={Number(costs.ball) || 0} />
          {Number(costs.other) > 0 && (
            <Line label="Other" value={Number(costs.other)} />
          )}
          {carCount > 0 && Number(costs.allowance) > 0 && (
            <Line
              label={`Cars ${carCount} × ₹${formatRupees(Number(costs.allowance))}`}
              value={carCount * Number(costs.allowance)}
            />
          )}
          <Line label="Total cost" value={result.totalCost} strong />
          {result.captainCharge > 0 && (
            <Line
              label={`Guests · charged to ${captainName ?? "the captain"}`}
              value={result.captainCharge}
            />
          )}
          {surplus > 0 && <Line label="Surplus to pool" value={surplus} />}
        </dl>
      </section>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => share("share")}
          disabled={busy}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md bg-accent text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          <Share2 size={16} /> {busy ? "Building…" : "Share"}
        </button>
        <button
          type="button"
          onClick={() => share("download")}
          disabled={busy}
          className="flex h-11 items-center justify-center gap-1.5 rounded-md border border-border px-4 text-sm font-medium text-text-primary disabled:opacity-60"
        >
          <Download size={16} />
          <span className="sr-only">Download</span>
        </button>
      </div>
      {error && <p className="text-sm text-debit">{error}</p>}

      <p className="text-center text-xs text-text-muted">
        {carCount} car{carCount === 1 ? "" : "s"} · this was a sample —
        nothing was saved.
      </p>
    </>
  );
}

function Line({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <dt className="text-text-secondary">{label}</dt>
      <dd
        className={
          strong ? "font-semibold text-text-primary" : "text-text-primary"
        }
      >
        ₹{formatRupees(value)}
      </dd>
    </div>
  );
}
