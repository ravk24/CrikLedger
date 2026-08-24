"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

// requireCurrent mirrors the server rule: a voluntary change must prove
// the old password; the forced first-login change cannot, because the
// temp password was just spent getting here.
export function ChangePasswordForm({
  requireCurrent = false,
}: {
  requireCurrent?: boolean;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const longEnough = password.length >= 8;
  const matches = confirm.length > 0 && password === confirm;
  const hasCurrent = !requireCurrent || current.length > 0;
  const valid = longEnough && matches && hasCurrent;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) {
      setError(
        !hasCurrent
          ? "Enter your current password."
          : !longEnough
            ? "Password must be at least 8 characters."
            : "Both entries must match.",
      );
      return;
    }
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          requireCurrent
            ? { current_password: current, new_password: password }
            : { new_password: password },
        ),
      });
      const body = await res.json();
      if (!body.success) {
        const code = body.error?.code;
        setError(
          code === "INVALID_CURRENT_PASSWORD"
            ? "That is not your current password."
            : code === "CURRENT_PASSWORD_REQUIRED"
              ? "Enter your current password."
              : "Could not save the new password — try again.",
        );
        return;
      }
      // The forced first-login change (no current password asked) is a
      // fresh purchaser's first real screen — land them on Home, where
      // the "How to use" checklist waits. A voluntary change returns to
      // the console it was launched from.
      router.push(requireCurrent ? "/admin" : "/");
      startTransition(() => router.refresh());
    } catch {
      setError("Could not reach the server — check your connection.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {requireCurrent && (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-secondary">
            Current password
          </span>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
            className="h-11 rounded-md border border-border bg-surface-secondary px-3 text-base text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </label>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-text-secondary">
          New password
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          className="h-11 rounded-md border border-border bg-surface-secondary px-3 text-base text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-text-secondary">
          New password again
        </span>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
          className="h-11 rounded-md border border-border bg-surface-secondary px-3 text-base text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </label>
      {valid && (
        <p className="flex items-center gap-1.5 text-sm text-credit">
          <CheckCircle2 size={16} />
          Both entries match · {password.length} characters
        </p>
      )}
      {error && <p className="text-sm text-debit">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save and continue"}
      </button>
    </form>
  );
}
