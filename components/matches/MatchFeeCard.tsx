"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { formatRupees } from "@/lib/format";

type Props = {
  matchId: string;
  opponent: string;
  matchDateLabel: string;
  amountPending: number;
  // Which way the outstanding amount will move when cleared. Legacy
  // booking-linked matches have no direction and always credit.
  feeDirection: "credit" | "debit" | null;
};

// Admin-only match-fee state. Clearing is one-way (the outstanding
// amount is posted to the pool in the fee's own direction), so the
// pending state offers a button and the paid state is just a chip —
// nothing that suggests it can be switched back.
export function MatchFeeCard({
  matchId,
  opponent,
  matchDateLabel,
  amountPending,
  feeDirection,
}: Props) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cleared = amountPending === 0;
  const movement =
    feeDirection === "debit" ? "debited from" : "credited to";

  async function handleConfirm() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/clear-pending`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expected_pending: amountPending }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Could not clear the pending fee.");
        return;
      }
      setConfirmOpen(false);
      router.refresh();
    } catch {
      setError("Could not reach the server — check your connection.");
    } finally {
      setPending(false);
    }
  }

  if (cleared) {
    return (
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-text-primary">Match Fee</p>
          <span className="rounded-full bg-credit-light px-2 py-0.5 text-xs font-medium text-credit-foreground">
            Fully paid
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-text-primary">Match Fee</p>
        <p className="text-xs font-medium text-low">
          ₹{formatRupees(amountPending)} pending
        </p>
      </div>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="h-11 w-full rounded-md bg-low text-sm font-medium text-white"
      >
        Clear pending fee
      </button>
      {error && <p className="text-sm text-debit">{error}</p>}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Mark match fee as cleared?"
        description={`vs ${opponent} · ${matchDateLabel} — ₹${formatRupees(amountPending)} pending will be ${movement} the pool ledger. This cannot be switched back.`}
        confirmLabel="Clear pending fee"
        pending={pending}
        onConfirm={handleConfirm}
      />
    </section>
  );
}
