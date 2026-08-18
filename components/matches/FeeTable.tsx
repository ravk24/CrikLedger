import { Car } from "lucide-react";
import { Money } from "@/components/shared/Money";
import { CaptainMark } from "@/components/shared/CaptainMark";
import { formatRupees } from "@/lib/format";
import type { MatchParticipantPublic } from "@/types";

type Guest = { name: string; brought_car: boolean };

type Props = {
  participants: MatchParticipantPublic[];
  guests: Guest[];
};

// One fee row per playing participant, driver credits green. Guests
// (v2 rule) count in the split; their charges sit on the captain —
// merged into his row when he played, else a charge-only row below.
export function FeeTable({ participants, guests }: Props) {
  const playing = participants.filter((row) => row.is_playing);
  const captainCharge = participants.find(
    (row) => Number(row.guest_fee_share) !== 0,
  );
  const chargeAmount = captainCharge
    ? Number(captainCharge.guest_fee_share)
    : 0;
  const attendeeCount = playing.length + guests.length;

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex items-baseline justify-between border-b border-border px-4 py-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
          {attendeeCount} {attendeeCount === 1 ? "attendee" : "attendees"}
          {guests.length > 0 &&
            ` · ${guests.length} ${guests.length === 1 ? "guest" : "guests"}`}
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
          Fee
        </span>
      </div>
      <div className="divide-y divide-border">
        {playing.map((row, i) => {
          const isRebate = row.fee_amount < 0;
          const share = Number(row.guest_fee_share);
          return (
            <div
              key={i}
              className="flex min-h-11 items-center justify-between gap-2 px-4 py-2"
            >
              <span className="flex min-w-0 flex-col">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium text-text-primary">
                    {row.player_name}
                    {row.is_captain && <CaptainMark compact />}
                  </span>
                  {row.brought_car && (
                    <Car
                      size={16}
                      aria-label="Brought a car"
                      className="shrink-0 text-accent"
                    />
                  )}
                </span>
                {share !== 0 && (
                  <span className="text-[10px] text-text-muted">
                    incl. ₹{formatRupees(share)} guest{" "}
                    {share >= 0 ? "fees" : "credit"}
                  </span>
                )}
              </span>
              <Money
                amount={row.fee_amount}
                variant={isRebate ? "signed" : "neutral"}
                className="text-sm font-semibold"
              />
            </div>
          );
        })}
        {guests.map((guest, i) => (
          <div
            key={`guest-${i}`}
            className="flex min-h-11 items-center justify-between gap-2 bg-low-light/40 px-4 py-2"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium text-text-primary">
                {guest.name}
              </span>
              <span className="shrink-0 rounded-[4px] bg-low-light px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-low-foreground">
                GUEST
              </span>
              {guest.brought_car && (
                <Car
                  size={16}
                  aria-label="Brought a car"
                  className="shrink-0 text-accent"
                />
              )}
            </span>
            <span className="text-sm font-semibold text-text-muted">—</span>
          </div>
        ))}
        {captainCharge && !captainCharge.is_playing && (
          <div className="flex min-h-11 items-center justify-between gap-2 bg-accent-light/20 px-4 py-2">
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium text-text-primary">
                {captainCharge.player_name}
                <CaptainMark compact />
              </span>
              <span className="shrink-0 rounded-[4px] bg-accent-light px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-accent">
                GUEST FEES
              </span>
            </span>
            <Money
              amount={captainCharge.fee_amount}
              variant={captainCharge.fee_amount < 0 ? "signed" : "neutral"}
              className="text-sm font-semibold"
            />
          </div>
        )}
      </div>
      {guests.length > 0 && (
        <p className="border-t border-border bg-surface-secondary px-4 py-2 text-xs text-text-muted">
          {captainCharge ? (
            <>
              Guests {guests.map((g) => g.name).join(" & ")} transferred their
              fee to{" "}
              <span className="font-semibold text-text-primary">
                {captainCharge.player_name}
              </span>{" "}
              in cash — ₹{formatRupees(Math.abs(chargeAmount))} was{" "}
              {chargeAmount >= 0 ? "deducted from" : "credited to"} the
              captain&apos;s balance.
            </>
          ) : (
            // Either a legacy match completed before guest billing, or the
            // guests' fees and driver credits netted to exactly zero (no
            // charge row is written then).
            <>
              No net guest deduction was recorded for this match — either the
              guest fees netted to zero, or the captain settled offline
              (pre-billing match).
            </>
          )}
        </p>
      )}
    </section>
  );
}
