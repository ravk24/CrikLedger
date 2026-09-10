"use client";

import { startTransition, useOptimistic, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { SheetShell } from "@/components/shared/SheetShell";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Money } from "@/components/shared/Money";
import { MoneyInput } from "@/components/shared/MoneyInput";
import type { TeamGround } from "@/lib/grounds";
import { cn } from "@/lib/utils";

type Props = {
  grounds: TeamGround[];
};

type SheetState =
  | { mode: "closed" }
  | { mode: "add" }
  | { mode: "edit"; ground: TeamGround };

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

// The superadmin's ground list (migration 51): a name and the per-car
// allowance. Same shape as PlayerManager — one list, an add/edit sheet,
// an optimistic hide/show, a confirmed remove. Presets only move
// prefills: hiding or removing one never changes a completed match.
export function GroundManager({ grounds: serverGrounds }: Props) {
  const router = useRouter();
  const [grounds, flipActive] = useOptimistic(
    serverGrounds,
    (state, change: { id: string; is_active: boolean }) =>
      state.map((g) => (g.id === change.id ? { ...g, ...change } : g)),
  );
  const [sheet, setSheet] = useState<SheetState>({ mode: "closed" });
  const [name, setName] = useState("");
  const [allowance, setAllowance] = useState("");
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [blocker, setBlocker] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<TeamGround | null>(null);
  const [pending, setPending] = useState(false);

  function openAdd() {
    setName("");
    setAllowance("");
    setSheetError(null);
    setSheet({ mode: "add" });
  }

  function openEdit(ground: TeamGround) {
    setName(ground.name);
    setAllowance(String(ground.car_allowance));
    setSheetError(null);
    setSheet({ mode: "edit", ground });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setSheetError(null);
    const payload = { name: name.trim(), car_allowance: Number(allowance) || 0 };
    const result =
      sheet.mode === "add"
        ? await callApi("/api/sa/grounds", "POST", payload)
        : sheet.mode === "edit"
          ? await callApi(`/api/sa/grounds/${sheet.ground.id}`, "PATCH", payload)
          : { ok: false as const };
    setPending(false);
    if (!result.ok) {
      setSheetError(
        result.error?.code === "GROUND_EXISTS"
          ? "A ground with this name is already on the list — edit that one instead."
          : (result.error?.message ?? "Could not save — try again."),
      );
      return;
    }
    setSheet({ mode: "closed" });
    startTransition(() => router.refresh());
  }

  function handleToggle(ground: TeamGround, is_active: boolean) {
    setPending(true);
    startTransition(async () => {
      flipActive({ id: ground.id, is_active });
      const result = await callApi(`/api/sa/grounds/${ground.id}`, "PATCH", {
        is_active,
      });
      setPending(false);
      if (!result.ok) {
        setBlocker(result.error?.message ?? "Could not save — try again.");
        return;
      }
      setBlocker(null);
      router.refresh();
    });
  }

  function handleRemove(ground: TeamGround) {
    setPending(true);
    setConfirmTarget(null);
    startTransition(async () => {
      const result = await callApi(`/api/sa/grounds/${ground.id}`, "DELETE");
      setPending(false);
      if (!result.ok) {
        setBlocker(result.error?.message ?? "Could not remove — try again.");
        return;
      }
      setBlocker(null);
      setSheet({ mode: "closed" });
      router.refresh();
    });
  }

  const inputClass =
    "h-11 w-full rounded-md border border-border bg-surface-secondary px-3 text-base text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

  return (
    <>
      {grounds.length === 0 ? (
        <section className="rounded-lg border border-border bg-surface shadow-card p-4 text-sm text-text-secondary">
          No grounds yet. Add the grounds your team plays at with the car
          allowance for each — scheduling then offers them as a dropdown, and
          completing a match at one of them prefills that car fee.
        </section>
      ) : (
        <section className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface shadow-card">
          {grounds.map((ground) => (
            <div
              key={ground.id}
              className={cn(
                "flex min-h-11 items-center justify-between gap-3 px-4 py-3",
                !ground.is_active && "bg-surface-secondary",
              )}
            >
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-sm font-semibold",
                    ground.is_active ? "text-text-primary" : "text-text-muted",
                  )}
                >
                  {ground.name}
                  {!ground.is_active && (
                    <span className="font-normal text-text-muted"> · Hidden</span>
                  )}
                </p>
                <p className="text-xs text-text-muted">
                  <Money amount={ground.car_allowance} className="text-xs" /> per
                  car
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => openEdit(ground)}
                  className="min-h-11 text-sm font-medium text-accent"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleToggle(ground, !ground.is_active)}
                  disabled={pending}
                  className={cn(
                    "min-h-11 text-sm font-medium disabled:opacity-60",
                    ground.is_active ? "text-text-secondary" : "text-accent",
                  )}
                >
                  {ground.is_active ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

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
        + Add ground
      </button>
      <p className="text-center text-xs text-text-muted">
        Presets only prefill. A completed match keeps the car fee it was
        confirmed with, whatever changes here later.
      </p>

      <SheetShell
        open={sheet.mode !== "closed"}
        onOpenChange={(open) => !open && setSheet({ mode: "closed" })}
        title={sheet.mode === "edit" ? "Edit ground" : "Add ground"}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">
              Ground name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Barne, Pusane"
              required
              maxLength={80}
              className={inputClass}
            />
          </label>
          <MoneyInput
            label="Car allowance (per car)"
            value={allowance}
            onChange={setAllowance}
            required
          />
          <p className="text-xs text-text-muted">
            What each driver gets back for a match here. 0 means no car
            money at this ground.
          </p>
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
                : "Add ground"}
          </button>
          {sheet.mode === "edit" && (
            <button
              type="button"
              onClick={() => setConfirmTarget(sheet.ground)}
              disabled={pending}
              className="h-11 w-full rounded-md border border-debit-light text-sm font-medium text-debit disabled:opacity-60"
            >
              Remove ground
            </button>
          )}
        </form>
      </SheetShell>

      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title={`Remove ${confirmTarget?.name ?? ""}?`}
        description="It leaves the dropdown and stops prefilling. Matches already scheduled or completed there are untouched — the name stays on them as typed text."
        confirmLabel="Remove"
        destructive
        pending={pending}
        onConfirm={() => confirmTarget && handleRemove(confirmTarget)}
      />
    </>
  );
}
