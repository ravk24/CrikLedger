"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Crown } from "lucide-react";
import { SheetShell } from "@/components/shared/SheetShell";
import { CaptainMark } from "@/components/shared/CaptainMark";

type PlayerRow = { id: string; name: string; is_captain: boolean };

type Props = {
  players: PlayerRow[]; // active players only
  // Current captain's stored number (players.phone, migration 43) —
  // read off the base table, never players_public.
  captainPhone: string | null;
};

// Superadmin-only console tile: declare / transfer / remove the
// standing team captain (guest fees are deducted from his balance).
// Also holds the captain's contact phone for the fee-collection
// share message on completed matches.
export function CaptainTile({ players, captainPhone }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const captain = players.find((p) => p.is_captain) ?? null;

  useEffect(() => {
    if (open) {
      setSelectedId(captain?.id ?? "");
      setPhone(captainPhone ?? "");
      setError(null);
    }
  }, [open, captain?.id, captainPhone]);

  async function callCaptainApi(playerId: string, method: "POST" | "DELETE") {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/players/${playerId}/captain`, {
        method,
        ...(method === "POST"
          ? {
              headers: { "Content-Type": "application/json" },
              // Empty input = explicit clear.
              body: JSON.stringify({
                phone: phone.trim() === "" ? null : phone.trim(),
              }),
            }
          : {}),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Could not update the captain.");
        return;
      }
      setOpen(false);
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
        className="flex min-h-28 flex-col items-start justify-between gap-2 rounded-lg border border-border bg-surface shadow-card p-4 text-left text-text-primary"
      >
        <span className="flex size-9 items-center justify-center rounded-md bg-accent-light text-accent">
          <Crown size={18} />
        </span>
        <span className="text-sm font-semibold">
          Team captain
          <span className="block text-[11px] font-normal text-text-muted">
            {captain ? captain.name : "Not declared"}
          </span>
        </span>
      </button>

      <SheetShell
        open={open}
        onOpenChange={setOpen}
        title="Team captain"
        description="One standing captain for the whole group — guest fees are deducted from their balance. Superadmin only."
      >
        {captain && (
          <p className="flex items-center gap-2 rounded-md bg-surface-secondary px-3 py-2 text-sm text-text-primary">
            Current captain:{" "}
            <span className="flex items-center gap-1.5 font-semibold">
              {captain.name}
              <CaptainMark compact />
            </span>
          </p>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-secondary">
            {captain ? "Transfer captaincy to" : "Declare captain"}
          </span>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="h-11 w-full rounded-md border border-border bg-surface-secondary px-3 text-base text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="" disabled>
              Choose a player…
            </option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.is_captain ? " (current)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-secondary">
            Captain&rsquo;s phone (optional) — used in the fee-collection
            message
          </span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            className="h-11 w-full rounded-md border border-border bg-surface-secondary px-3 text-base text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </label>
        {error && <p className="text-sm text-debit">{error}</p>}
        <button
          type="button"
          disabled={
            pending ||
            !selectedId ||
            (selectedId === captain?.id &&
              phone.trim() === (captainPhone ?? ""))
          }
          onClick={() => callCaptainApi(selectedId, "POST")}
          className="h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          {pending
            ? "Saving…"
            : selectedId === captain?.id
              ? "Save phone number"
              : captain
                ? "Transfer captaincy"
                : "Declare captain"}
        </button>
        {captain && (
          <button
            type="button"
            disabled={pending}
            onClick={() => callCaptainApi(captain.id, "DELETE")}
            className="h-11 w-full rounded-md border border-debit-light text-sm font-medium text-debit disabled:opacity-60"
          >
            Remove captain
          </button>
        )}
      </SheetShell>
    </>
  );
}
