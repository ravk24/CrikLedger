"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Crown } from "lucide-react";
import { SheetShell } from "@/components/shared/SheetShell";
import { CaptainMark } from "@/components/shared/CaptainMark";
import type { TournamentPlayerPublic } from "@/types";

type Props = {
  tournamentId: string;
  players: TournamentPlayerPublic[]; // active roster only
  disabled?: boolean; // completed tournament
};

// Tournament Admin console tile: declare / transfer / remove this
// tournament's captain. Any admin (unlike the SG captain tile).
export function TournamentCaptainTile({
  tournamentId,
  players,
  disabled = false,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const captain = players.find((p) => p.is_captain) ?? null;

  useEffect(() => {
    if (open) {
      setSelectedId(captain?.id ?? "");
      setError(null);
    }
  }, [open, captain?.id]);

  async function callApi(playerId: string, method: "POST" | "DELETE") {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/tournaments/${tournamentId}/players/${playerId}/captain`,
        { method },
      );
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Could not update the captain.");
        return;
      }
      setOpen(false);
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
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="flex min-h-28 flex-col items-start justify-between gap-2 rounded-lg border border-border bg-surface p-4 text-left text-text-primary disabled:cursor-not-allowed disabled:text-text-muted disabled:opacity-70"
      >
        <span className="flex size-9 items-center justify-center rounded-md bg-accent-light text-accent">
          <Crown size={18} />
        </span>
        <span className="text-sm font-semibold">
          Captain
          <span className="block text-[11px] font-normal text-text-muted">
            {captain ? captain.name : "Not Declared"}
          </span>
        </span>
      </button>

      <SheetShell
        open={open}
        onOpenChange={setOpen}
        title="Tournament captain"
        description="One captain for this tournament — separate from the team captaincy."
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
        {error && <p className="text-sm text-debit">{error}</p>}
        <button
          type="button"
          disabled={pending || !selectedId || selectedId === captain?.id}
          onClick={() => callApi(selectedId, "POST")}
          className="h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          {pending
            ? "Saving…"
            : captain
              ? "Transfer captaincy"
              : "Declare captain"}
        </button>
        {captain && (
          <button
            type="button"
            disabled={pending}
            onClick={() => callApi(captain.id, "DELETE")}
            className="h-11 w-full rounded-md border border-debit-light text-sm font-medium text-debit disabled:opacity-60"
          >
            Remove captain
          </button>
        )}
      </SheetShell>
    </>
  );
}
