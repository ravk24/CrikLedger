"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

export function ChangePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const longEnough = password.length >= 8;
  const matches = confirm.length > 0 && password === confirm;
  const valid = longEnough && matches;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) {
      setError(
        !longEnough
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
        body: JSON.stringify({ new_password: password }),
      });
      const body = await res.json();
      if (!body.success) {
        setError("Could not save the new password — try again.");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Could not reach the server — check your connection.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
