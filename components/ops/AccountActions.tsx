"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";

// The megaadmin's account-level actions. These are NOT scope writes —
// the platform account cannot touch a team's ledger — but it can act on
// the account itself, which is what makes it the recovery channel while
// there is no password-reset email.
export function AccountActions({
  accountId,
  username,
  isActive,
  isSelf,
}: {
  accountId: string;
  username: string;
  isActive: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [temp, setTemp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(action: "reset-password" | "suspend" | "restore") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/ops/accounts/${accountId}/${action}`, {
        method: "POST",
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "That did not work.");
        return;
      }
      // Shown ONCE — never stored or logged in plaintext.
      if (action === "reset-password") setTemp(body.data.temp_password);
      startTransition(() => router.refresh());
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-[11px] font-medium uppercase tracking-wider text-text-muted">
        Actions
      </h2>

      {temp && (
        <div className="rounded-lg border border-accent bg-surface p-4">
          <p className="text-xs text-text-secondary">
            One-time password for <strong>{username}</strong> — shown once.
            They must change it on next sign-in.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 rounded-md bg-surface-secondary px-3 py-2 font-mono text-sm text-text-primary">
              {temp}
            </code>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(temp)}
              className="flex size-10 items-center justify-center rounded-md border border-border text-text-secondary"
              aria-label="Copy password"
            >
              <Copy size={16} />
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => call("reset-password")}
        disabled={busy}
        className="h-11 rounded-md border border-border bg-surface shadow-card text-sm font-medium text-text-primary disabled:opacity-60"
      >
        Reset password
      </button>

      {/* Suspending yourself would lock the platform out of its own
          console, so it is refused here and again on the server. */}
      {!isSelf &&
        (isActive ? (
          <button
            type="button"
            onClick={() => call("suspend")}
            disabled={busy}
            className="h-11 rounded-md border border-debit text-sm font-medium text-debit disabled:opacity-60"
          >
            Suspend account
          </button>
        ) : (
          <button
            type="button"
            onClick={() => call("restore")}
            disabled={busy}
            className="h-11 rounded-md border border-credit text-sm font-medium text-credit disabled:opacity-60"
          >
            Restore account
          </button>
        ))}

      {error && <p className="text-sm text-debit">{error}</p>}
    </section>
  );
}
