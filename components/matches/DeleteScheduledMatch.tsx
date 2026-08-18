"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { SheetShell } from "@/components/shared/SheetShell";
import { formatRupees } from "@/lib/format";

type Props = {
  matchId: string;
  opponent: string;
  matchDateLabel: string;
  ground: "barne" | "other";
  // This match's per-slot share of the booking credit; 0 = no booking.
  bookingShare: number;
  // Other matches: the pool-fronted ground fee that returns on delete.
  otherFee: number;
};

// Superadmin only — red button at the bottom of a scheduled match page.
// Barne: deletes the match (its slot reopens) and the server returns the
// slot's share of the booking credit; the captain settles the opponent's
// cash offline. Other: no slot exists — the fee debit is deleted, so the
// paid ground fee returns to the pool.
export function DeleteScheduledMatch({
  matchId,
  opponent,
  matchDateLabel,
  ground,
  bookingShare,
  otherFee,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/cancel`, {
        method: "POST",
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Could not delete the match.");
        return;
      }
      posthog.capture("match_deleted", {
        booking_share: body.data?.booking_share ?? 0,
      });
      router.push("/matches");
      router.refresh();
    } catch {
      setError("Could not reach the server — check your connection.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-11 w-full rounded-md bg-debit text-sm font-medium text-white"
      >
        Delete Match
      </button>

      <SheetShell
        open={open}
        onOpenChange={setOpen}
        title="Delete match"
        description={
          ground === "barne"
            ? `vs ${opponent} · ${matchDateLabel} — the date reopens on Barne Slots. Superadmin only.`
            : `vs ${opponent} · ${matchDateLabel} — away match. Superadmin only.`
        }
      >
        <p className="text-sm text-text-secondary">
          {ground === "other"
            ? otherFee > 0
              ? `₹${formatRupees(otherFee)} — the ground fee paid for this match — will be returned to the pool ledger automatically.`
              : "No pool entry is affected."
            : bookingShare > 0
              ? `₹${formatRupees(bookingShare)} — this match's share of the booking credit — will be deducted from the pool ledger automatically. The captain settles the opponent's cash offline.`
              : "No pool entry is affected."}
        </p>
        {error && <p className="text-sm text-debit">{error}</p>}
        <button
          type="button"
          disabled={pending}
          onClick={handleDelete}
          className="h-11 w-full rounded-md bg-debit text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Deleting…" : "Delete match"}
        </button>
      </SheetShell>
    </>
  );
}
