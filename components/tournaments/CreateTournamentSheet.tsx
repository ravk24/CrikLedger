"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { Plus } from "lucide-react";
import { SheetShell } from "@/components/shared/SheetShell";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { GroundSelect, OTHER_GROUND } from "@/components/shared/GroundSelect";
import type { Ground } from "@/lib/grounds";

export function CreateTournamentSheet({ grounds }: { grounds: Ground[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [groundChoice, setGroundChoice] = useState("");
  const [customName, setCustomName] = useState("");
  const [joiningFee, setJoiningFee] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const venue =
      groundChoice === OTHER_GROUND ? customName.trim() : groundChoice;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          ...(teamName.trim() ? { team_name: teamName.trim() } : {}),
          ...(venue ? { venue } : {}),
          ...(Number(joiningFee) > 0 ? { joining_fee: Number(joiningFee) } : {}),
          ...(startDate ? { start_date: startDate } : {}),
          ...(endDate ? { end_date: endDate } : {}),
        }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Could not create — try again.");
        return;
      }
      posthog.capture("tournament_created");
      setOpen(false);
      setName("");
      setTeamName("");
      setGroundChoice("");
      setCustomName("");
      setJoiningFee("");
      setStartDate("");
      setEndDate("");
      router.push(`/tournaments/${body.data.id}`);
      router.refresh();
    } catch {
      setError("Could not reach the server — check your connection.");
    } finally {
      setPending(false);
    }
  }

  const inputClass =
    "h-11 w-full rounded-md border border-border bg-surface-secondary px-3 text-base text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 w-full items-center justify-center gap-1 rounded-md bg-accent text-sm font-medium text-accent-foreground"
      >
        <Plus size={16} /> New tournament
      </button>
      <SheetShell
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setError(null); // no stale errors on reopen
        }}
        title="New tournament"
        description="Its players and ledger are fully separate from the team ledger and from every other tournament."
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">
              Tournament Name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pimpri Premier League"
              required
              maxLength={80}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">
              Your Team Name{" "}
              <span className="font-normal text-text-muted">(optional)</span>
            </span>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Your XI"
              maxLength={80}
              className={inputClass}
            />
          </label>
          <GroundSelect
            grounds={grounds}
            choice={groundChoice}
            customName={customName}
            onChoiceChange={setGroundChoice}
            onCustomNameChange={setCustomName}
          />
          <MoneyInput
            label="Joining Fee (optional — settles when the tournament completes)"
            value={joiningFee}
            onChange={setJoiningFee}
          />
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs font-medium text-text-secondary">
                Starts{" "}
                <span className="font-normal text-text-muted">(optional)</span>
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs font-medium text-text-secondary">
                Ends{" "}
                <span className="font-normal text-text-muted">(optional)</span>
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
          {error && <p className="text-sm text-debit">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="mt-1 h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create tournament"}
          </button>
        </form>
      </SheetShell>
    </>
  );
}
