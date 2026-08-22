"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Award } from "lucide-react";
import { SheetShell } from "@/components/shared/SheetShell";
import { ViceCaptainMark } from "@/components/shared/ViceCaptainMark";

type PlayerRow = {
  id: string;
  name: string;
  is_captain: boolean;
  is_vice_captain: boolean;
};

type Props = {
  players: PlayerRow[]; // active players only
};

// Superadmin-only console tile: declare / transfer / remove the
// standing vice-captain. A displayed title only — no money moves
// through the vice-captain, and the captain can never hold it.
export function ViceCaptainTile({ players }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const viceCaptain = players.find((p) => p.is_vice_captain) ?? null;

  useEffect(() => {
    if (open) {
      setSelectedId(viceCaptain?.id ?? "");
      setError(null);
    }
  }, [open, viceCaptain?.id]);

  async function callViceCaptainApi(
    playerId: string,
    method: "POST" | "DELETE",
  ) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/players/${playerId}/vice-captain`, {
        method,
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Could not update the vice-captain.");
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
          <Award size={18} />
        </span>
        <span className="text-sm font-semibold">
          Team vice-captain
          <span className="block text-[11px] font-normal text-text-muted">
            {viceCaptain ? viceCaptain.name : "Not declared"}
          </span>
        </span>
      </button>

      <SheetShell
        open={open}
        onOpenChange={setOpen}
        title="Team vice-captain"
        description="One standing vice-captain for the whole group — a title only, separate from the captain. Superadmin only."
      >
        {viceCaptain && (
          <p className="flex items-center gap-2 rounded-md bg-surface-secondary px-3 py-2 text-sm text-text-primary">
            Current vice-captain:{" "}
            <span className="flex items-center gap-1.5 font-semibold">
              {viceCaptain.name}
              <ViceCaptainMark />
            </span>
          </p>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-secondary">
            {viceCaptain ? "Transfer vice-captaincy to" : "Declare vice-captain"}
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
              <option key={p.id} value={p.id} disabled={p.is_captain}>
                {p.name}
                {p.is_vice_captain ? " (current)" : ""}
                {p.is_captain ? " (captain)" : ""}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="text-sm text-debit">{error}</p>}
        <button
          type="button"
          disabled={pending || !selectedId || selectedId === viceCaptain?.id}
          onClick={() => callViceCaptainApi(selectedId, "POST")}
          className="h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          {pending
            ? "Saving…"
            : viceCaptain
              ? "Transfer vice-captaincy"
              : "Declare vice-captain"}
        </button>
        {viceCaptain && (
          <button
            type="button"
            disabled={pending}
            onClick={() => callViceCaptainApi(viceCaptain.id, "DELETE")}
            className="h-11 w-full rounded-md border border-debit-light text-sm font-medium text-debit disabled:opacity-60"
          >
            Remove vice-captain
          </button>
        )}
      </SheetShell>
    </>
  );
}
