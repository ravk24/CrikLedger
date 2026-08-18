"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { Award } from "lucide-react";
import { SheetShell } from "@/components/shared/SheetShell";
import { ViceCaptainMark } from "@/components/shared/ViceCaptainMark";
import type { TournamentPlayerPublic } from "@/types";

type Props = {
  tournamentId: string;
  players: TournamentPlayerPublic[]; // active roster only
  disabled?: boolean; // completed tournament
};

export function TournamentViceCaptainTile({
  tournamentId,
  players,
  disabled = false,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const vice = players.find((p) => p.is_vice_captain) ?? null;

  useEffect(() => {
    if (open) {
      setSelectedId(vice?.id ?? "");
      setError(null);
    }
  }, [open, vice?.id]);

  async function callApi(playerId: string, method: "POST" | "DELETE") {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/tournaments/${tournamentId}/players/${playerId}/vice-captain`,
        { method },
      );
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Could not update the vice-captain.");
        return;
      }
      posthog.capture(
        method === "POST"
          ? "tournament_vice_captain_set"
          : "tournament_vice_captain_cleared",
      );
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
          <Award size={18} />
        </span>
        <span className="text-sm font-semibold">
          Vice-Captain
          <span className="block text-[11px] font-normal text-text-muted">
            {vice ? vice.name : "Not Declared"}
          </span>
        </span>
      </button>

      <SheetShell
        open={open}
        onOpenChange={setOpen}
        title="Tournament vice-captain"
        description="One vice-captain for this tournament — the captain can't hold both roles."
      >
        {vice && (
          <p className="flex items-center gap-2 rounded-md bg-surface-secondary px-3 py-2 text-sm text-text-primary">
            Current vice-captain:{" "}
            <span className="flex items-center gap-1.5 font-semibold">
              {vice.name}
              <ViceCaptainMark />
            </span>
          </p>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-secondary">
            {vice ? "Transfer the role to" : "Declare vice-captain"}
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
                {p.is_vice_captain
                  ? " (current)"
                  : p.is_captain
                    ? " (captain)"
                    : ""}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="text-sm text-debit">{error}</p>}
        <button
          type="button"
          disabled={pending || !selectedId || selectedId === vice?.id}
          onClick={() => callApi(selectedId, "POST")}
          className="h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          {pending
            ? "Saving…"
            : vice
              ? "Transfer role"
              : "Declare vice-captain"}
        </button>
        {vice && (
          <button
            type="button"
            disabled={pending}
            onClick={() => callApi(vice.id, "DELETE")}
            className="h-11 w-full rounded-md border border-debit-light text-sm font-medium text-debit disabled:opacity-60"
          >
            Remove vice-captain
          </button>
        )}
      </SheetShell>
    </>
  );
}
