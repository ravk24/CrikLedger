"use client";

import { useState } from "react";
import { Car, ChevronLeft, Download, Share2, Users } from "lucide-react";
import { FeeAmount } from "@/components/shared/FeeAmount";
import { formatRupees } from "@/lib/format";
import {
  DEMO_CAPTAIN_PHONE,
  DEMO_PLAYERS,
  DEMO_TEAM,
} from "@/lib/demo/fixtures";
import { buildGuestFeeMessage } from "@/lib/feeMessage";
import type { MatchFeeResult } from "@/engine/calc";
import type { WizardCosts } from "@/components/wizard/wizardTypes";
import { CaptainMark } from "@/components/shared/CaptainMark";

const NAME_BY_ID = new Map(DEMO_PLAYERS.map((p) => [p.id, p.name]));

// The end of the sample: the finished match sheet, and the share that
// makes it worth finishing. Every number is the engine's — nothing is
// recomputed here. The PNG is rendered by a route handler that touches
// no database and no cookies, so "no writes" holds by construction
// rather than by discipline.
export function GuestMatchSheet({
  result,
  costs,
  captainName,
  captainId,
  onBack,
}: {
  result: MatchFeeResult;
  costs: WizardCosts;
  captainName: string | null;
  captainId: string | null;
  onBack: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowance = Number(costs.allowance) || 0;
  const perHead = result.perPlayerFee + result.carSharePerSharer;

  const payload = {
    team: DEMO_TEAM.name,
    opponent: DEMO_TEAM.opponent,
    venue: DEMO_TEAM.venue,
    date: "Sun, 13 Sep 2026",
    groundFee: Number(costs.ground) || 0,
    ballFee: Number(costs.ball) || 0,
    otherFee: Number(costs.other) || 0,
    carAllowancePerCar: allowance,
    carCount: result.carCount,
    totalCost: result.totalCost,
    perPlayerFee: result.perPlayerFee,
    carSharePerSharer: result.carSharePerSharer,
    sharerCount: result.sharerCount,
    surplus: result.surplusToPool,
    rows: [
      ...result.rows.map((r) => ({
        name: NAME_BY_ID.get(r.playerId) ?? r.playerId,
        fee: r.fee,
        broughtCar: r.broughtCar,
        isCaptain: r.playerId === captainId,
      })),
      ...result.guestRows.map((g) => ({
        name: g.name,
        fee: g.fee,
        broughtCar: g.broughtCar,
        isGuest: true,
      })),
    ],
  };

  async function share(mode: "share" | "download") {
    setBusy(true);
    setError(null);
    // Same fee-collection message the paid flow sends, with the sample's
    // fake number — the demo exists to showcase the whole loop. Copy
    // FIRST, inside the tap's user activation (iOS revokes the gesture
    // after the fetch await), and in download mode too: the notice below
    // is how the visitor discovers the message at all.
    const message =
      result.guestRows.length > 0 && captainName
        ? buildGuestFeeMessage({
            captainName,
            captainPhone: DEMO_CAPTAIN_PHONE,
            guests: result.guestRows.map((g) => g.name),
          })
        : null;
    if (message) {
      try {
        await navigator.clipboard.writeText(message);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } catch {
        // Clipboard needs a secure context — the text still rides
        // navigator.share below where the target accepts it.
      }
    }
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
        try {
          await navigator.share({
            files: [file],
            title: "Match sheet",
            ...(message ? { text: message } : {}),
          });
        } catch (e) {
          // Some UAs accept files but reject a text rider — retry
          // image-only rather than losing the share.
          if (message && (e as Error)?.name === "TypeError") {
            await navigator.share({ files: [file], title: "Match sheet" });
          } else {
            throw e;
          }
        }
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
          {result.rows.map((r) => (
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
                {r.sharedCar && !r.broughtCar && (
                  <Users
                    size={13}
                    aria-label="Shared a car"
                    className="ml-1.5 inline shrink-0 align-text-bottom text-text-muted"
                  />
                )}
              </span>
              <FeeAmount fee={r.fee} className="font-medium" />
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
                  {g.sharedCar && !g.broughtCar && (
                    <Users
                      size={13}
                      aria-label="Shared a car"
                      className="ml-1.5 inline shrink-0 align-text-bottom text-text-muted"
                    />
                  )}
                </span>
                <FeeAmount fee={g.fee} className="font-medium" />
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
          {result.carCount > 0 && allowance > 0 && (
            <Line
              label={`Cars ${result.carCount} × ₹${formatRupees(allowance)}`}
              value={result.carCount * allowance}
            />
          )}
          <Line label="Total cost" value={result.totalCost} strong />
          <Line label="Per head" value={perHead} />
          {result.surplusToPool > 0 && (
            <Line label="Surplus to pool" value={result.surplusToPool} />
          )}
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
      {copied && (
        <p className="text-xs text-credit">
          Fee message copied — paste it below the image.
        </p>
      )}
      {error && <p className="text-sm text-debit">{error}</p>}

      <p className="text-center text-xs text-text-muted">
        {result.carCount} car{result.carCount === 1 ? "" : "s"} · this was a
        sample — nothing was saved.
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
