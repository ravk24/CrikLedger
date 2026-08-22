"use client";

import { startTransition, useOptimistic, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { SheetShell } from "@/components/shared/SheetShell";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Money } from "@/components/shared/Money";
import { CaptainMark } from "@/components/shared/CaptainMark";
import { ViceCaptainMark } from "@/components/shared/ViceCaptainMark";
import { cn } from "@/lib/utils";

export type AdminPlayerRow = {
  id: string;
  name: string;
  is_active: boolean;
  balance: number;
  is_captain: boolean;
  is_vice_captain: boolean;
};

type Props = {
  players: AdminPlayerRow[];
};

type SheetState =
  | { mode: "closed" }
  | { mode: "add" }
  | { mode: "edit"; player: AdminPlayerRow };

type ApiErrorBody = { code?: string; message?: string };

async function callApi(
  url: string,
  method: string,
  body?: unknown,
): Promise<{ ok: boolean; error?: ApiErrorBody }> {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    return json.success ? { ok: true } : { ok: false, error: json.error };
  } catch {
    return {
      ok: false,
      error: { message: "Could not reach the server — check your connection." },
    };
  }
}

export function PlayerManager({ players: serverPlayers }: Props) {
  const router = useRouter();
  // Deactivate/reactivate flips one row's is_active instantly; the
  // refresh after the write reconciles, and a failed write reverts.
  const [players, flipActive] = useOptimistic(
    serverPlayers,
    (state, change: { id: string; is_active: boolean }) =>
      state.map((p) => (p.id === change.id ? { ...p, ...change } : p)),
  );
  const [sheet, setSheet] = useState<SheetState>({ mode: "closed" });
  const [name, setName] = useState("");
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [blocker, setBlocker] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<AdminPlayerRow | null>(
    null,
  );
  const [pending, setPending] = useState(false);

  function openAdd() {
    setName("");
    setSheetError(null);
    setSheet({ mode: "add" });
  }

  function openEdit(player: AdminPlayerRow) {
    setName(player.name);
    setSheetError(null);
    setSheet({ mode: "edit", player });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setSheetError(null);
    const payload = { name: name.trim() };
    const result =
      sheet.mode === "add"
        ? await callApi("/api/players", "POST", payload)
        : sheet.mode === "edit"
          ? await callApi(`/api/players/${sheet.player.id}`, "PATCH", payload)
          : { ok: false as const };
    setPending(false);
    if (!result.ok) {
      setSheetError(
        result.error?.code === "NAME_TAKEN"
          ? "A player with this name already exists — add a surname or initial."
          : (result.error?.message ?? "Could not save — try again."),
      );
      return;
    }
    setSheet({ mode: "closed" });
    startTransition(() => router.refresh());
  }

  function handleDeactivate(player: AdminPlayerRow) {
    setPending(true);
    setConfirmTarget(null);
    startTransition(async () => {
      flipActive({ id: player.id, is_active: false });
      const result = await callApi(
        `/api/players/${player.id}/deactivate`,
        "POST",
      );
      setPending(false);
      if (!result.ok) {
        setBlocker(
          result.error?.code === "NONZERO_BALANCE"
            ? (result.error.message ?? "Balance must be settled first.")
            : (result.error?.message ?? "Could not deactivate — try again."),
        );
        return;
      }
      setBlocker(null);
      router.refresh();
    });
  }

  function handleReactivate(player: AdminPlayerRow) {
    setPending(true);
    startTransition(async () => {
      flipActive({ id: player.id, is_active: true });
      const result = await callApi(
        `/api/players/${player.id}/reactivate`,
        "POST",
      );
      setPending(false);
      if (!result.ok) {
        setBlocker(result.error?.message ?? "Could not reactivate — try again.");
        return;
      }
      setBlocker(null);
      router.refresh();
    });
  }

  const inputClass =
    "h-11 w-full rounded-md border border-border bg-surface-secondary px-3 text-base text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

  return (
    <>
      <section className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
        {players.map((player) => (
          <div
            key={player.id}
            className={cn(
              "flex min-h-11 items-center justify-between gap-3 px-4 py-3",
              !player.is_active && "bg-surface-secondary",
            )}
          >
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "flex items-center gap-1.5 truncate text-sm font-semibold",
                  player.is_active ? "text-text-primary" : "text-text-muted",
                )}
              >
                {player.name}
                {player.is_captain && <CaptainMark />}
                {player.is_vice_captain && <ViceCaptainMark />}
                {!player.is_active && (
                  <span className="font-normal text-text-muted"> · Left</span>
                )}
              </p>
              <p className="text-xs tabular-nums text-text-muted">
                <Money
                  amount={player.balance}
                  variant="balance"
                  className="text-xs"
                />
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={() => openEdit(player)}
                className="min-h-11 text-sm font-medium text-accent"
              >
                Edit
              </button>
              {player.is_active ? (
                <button
                  type="button"
                  onClick={() => setConfirmTarget(player)}
                  className="min-h-11 text-sm font-medium text-debit"
                >
                  Deactivate
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleReactivate(player)}
                  disabled={pending}
                  className="min-h-11 text-sm font-medium text-accent disabled:opacity-60"
                >
                  Reactivate
                </button>
              )}
            </div>
          </div>
        ))}
      </section>

      {blocker && (
        <div className="flex items-start gap-2 rounded-lg border border-debit-light bg-surface p-4">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-debit" />
          <div className="text-sm text-text-primary">
            {blocker}
            <button
              type="button"
              onClick={() => setBlocker(null)}
              className="ml-2 font-medium text-accent"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={openAdd}
        className="h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground"
      >
        + Add player
      </button>
      <p className="text-center text-xs text-text-muted">
        Players who leave stay in every match and ledger they touched.
      </p>

      <SheetShell
        open={sheet.mode !== "closed"}
        onOpenChange={(open) => !open && setSheet({ mode: "closed" })}
        title={sheet.mode === "edit" ? "Edit player" : "Add player"}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">
              Name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputClass}
            />
          </label>
          {sheetError && <p className="text-sm text-debit">{sheetError}</p>}
          <button
            type="submit"
            disabled={pending}
            className="mt-1 h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground disabled:opacity-60"
          >
            {pending
              ? "Saving…"
              : sheet.mode === "edit"
                ? "Save changes"
                : "Add player"}
          </button>
        </form>
      </SheetShell>

      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title={`Deactivate ${confirmTarget?.name ?? ""}?`}
        description="They stay in all history, greyed at the bottom of the dashboard. Their balance must already be settled to zero."
        confirmLabel="Deactivate"
        destructive
        pending={pending}
        onConfirm={() => confirmTarget && handleDeactivate(confirmTarget)}
      />
    </>
  );
}
