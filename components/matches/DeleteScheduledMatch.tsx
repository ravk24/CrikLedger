"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { SheetShell } from "@/components/shared/SheetShell";
import { formatRupees } from "@/lib/format";

type Props = {
  matchId: string;
  opponent: string;
  matchDateLabel: string;
  // The pool-fronted ground fee that returns on delete.
  otherFee: number;
};

// Superadmin only — red button at the bottom of a scheduled match page.
// Deleting removes the pool-fronted ground fee debit, so the fee returns
// to the pool.
export function DeleteScheduledMatch({
  matchId,
  opponent,
  matchDateLabel,
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
      router.push("/schedule/upcoming");
      startTransition(() => router.refresh());
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
        description={`vs ${opponent} · ${matchDateLabel}. Superadmin only.`}
      >
        <p className="text-sm text-text-secondary">
          {otherFee > 0
            ? `₹${formatRupees(otherFee)} — the ground fee paid for this match — will be returned to the pool ledger automatically.`
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
