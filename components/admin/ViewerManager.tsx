"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Eye } from "lucide-react";
import { SheetShell } from "@/components/shared/SheetShell";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  VIEWER_SEAT_LIMIT,
  seatsInUseLabel,
  type ViewerRow,
} from "@/lib/viewerSeats";

type Props = {
  viewer: ViewerRow | null;
};

type Confirm =
  | { kind: "seat"; id: string }
  | { kind: "signout-all" }
  | { kind: "remove" }
  | null;

const INPUT_CLASS =
  "h-11 w-full rounded-md border border-border bg-surface-secondary px-3 text-base text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

// The superadmin's card for the one shared read-only login (migration
// 49) and its seats (migration 52): one row per signed-in phone, each
// with its own sign-out. The superadmin chooses the password on create
// and on reset — it is never generated, never shown back, never stored
// in plain text — so the card only ever displays the username and who
// is signed in (when, and roughly on what).
export function ViewerManager({ viewer }: Props) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function call(
    url: string,
    init: RequestInit,
  ): Promise<{
    success: boolean;
    data?: { username?: string; id?: string; signed_out?: number };
    error?: { message?: string };
  } | null> {
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(url, init);
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Could not complete the action.");
        return null;
      }
      return body;
    } catch {
      setError("Could not reach the server — check your connection.");
      return null;
    } finally {
      setPending(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const body = await call("/api/sa/viewer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
    });
    if (!body) return;
    setUsername("");
    setPassword("");
    setNotice(
      `Viewer login created. Share the user id ${body.data?.username ?? ""} and the password you just set on WhatsApp.`,
    );
    startTransition(() => router.refresh());
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    const body = await call("/api/sa/viewer/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });
    if (!body) return;
    setNewPassword("");
    setResetOpen(false);
    setNotice(
      "Password changed and everyone signed out. Share the new password with the team.",
    );
    startTransition(() => router.refresh());
  }

  async function handleConfirm() {
    if (!confirm) return;
    const action = confirm;
    const body =
      action.kind === "seat"
        ? await call(`/api/sa/viewer/sessions/${action.id}`, { method: "DELETE" })
        : action.kind === "signout-all"
          ? await call("/api/sa/viewer/signout", { method: "POST" })
          : await call("/api/sa/viewer", { method: "DELETE" });
    setConfirm(null);
    if (!body) return;
    setNotice(
      action.kind === "seat"
        ? "Seat signed out. The login is free for one more player."
        : action.kind === "signout-all"
          ? `Everyone is signed out and all ${VIEWER_SEAT_LIMIT} seats are free. The same password works on the next sign-in.`
          : "Viewer login removed. You can create a new one whenever you like.",
    );
    startTransition(() => router.refresh());
  }

  async function copyUsername() {
    if (!viewer) return;
    try {
      await navigator.clipboard.writeText(viewer.username);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — the username is still on screen
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface shadow-card p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-light text-accent">
          <Eye size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-text-primary">Team viewer</h2>
          <p className="mt-0.5 text-xs text-text-muted">
            One shared read-only login for the whole team, up to{" "}
            {VIEWER_SEAT_LIMIT} players at a time. They see balances, the
            ledger and the schedule — and can change nothing.
          </p>
        </div>
      </div>

      {notice && (
        <p role="status" className="rounded-md bg-credit-light px-3 py-2 text-xs text-credit-foreground">
          {notice}
        </p>
      )}
      {error && <p className="text-sm text-debit">{error}</p>}

      {viewer ? (
        <>
          <div className="flex items-center justify-between gap-2 rounded-md border border-dashed border-accent bg-surface px-3 py-2">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                User id
              </p>
              <code className="block truncate font-mono text-base font-bold text-text-primary">
                {viewer.username}
              </code>
            </div>
            <button
              type="button"
              onClick={copyUsername}
              className="flex shrink-0 items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground"
            >
              <Copy size={12} />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-text-muted">
            Password: the one you set · since {formatDate(viewer.created_at)}.
          </p>
          <div
            className={
              viewer.seats.length > 0
                ? "rounded-md bg-low-light px-3 py-2 text-xs text-low-foreground"
                : "rounded-md bg-surface-secondary px-3 py-2 text-xs text-text-secondary"
            }
          >
            <p className="font-medium">
              {seatsInUseLabel(viewer.seats.length, VIEWER_SEAT_LIMIT)}
            </p>
            {viewer.seats.length > 0 && (
              <ul className="mt-2 flex flex-col divide-y divide-border/60">
                {viewer.seats.map((seat) => (
                  <li
                    key={seat.id}
                    className="flex items-center justify-between gap-3 py-1.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-text-primary">
                        {seat.device ?? "Unknown device"}
                      </p>
                      <p className="text-xs text-text-muted">
                        since {formatDateTime(seat.started_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirm({ kind: "seat", id: seat.id })}
                      disabled={pending}
                      className="h-9 shrink-0 rounded-md border border-border bg-surface px-3 text-xs font-medium text-text-primary disabled:opacity-60"
                    >
                      Sign out
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {viewer.seats.length >= VIEWER_SEAT_LIMIT && (
              <p className="mt-2 text-xs">
                All seats are taken — the next player to sign in is asked to
                wait for one.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setConfirm({ kind: "signout-all" })}
              disabled={pending || viewer.seats.length === 0}
              className="h-11 rounded-md border border-border bg-surface text-sm font-medium text-text-primary disabled:opacity-60"
            >
              Sign out all
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setResetOpen(true);
              }}
              disabled={pending}
              className="h-11 rounded-md bg-accent text-sm font-medium text-accent-foreground disabled:opacity-60"
            >
              Reset password
            </button>
          </div>
          <button
            type="button"
            onClick={() => setConfirm({ kind: "remove" })}
            disabled={pending}
            className="h-11 w-full rounded-md border border-debit-light text-sm font-medium text-debit disabled:opacity-60"
          >
            Remove viewer login
          </button>
        </>
      ) : (
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">
              User id (lowercase, no spaces)
            </span>
            <input
              type="text"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
              }
              placeholder="sgsa_viewer"
              required
              minLength={3}
              maxLength={40}
              autoComplete="off"
              className={INPUT_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">
              Password for the team (at least 8 characters)
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              maxLength={200}
              autoComplete="new-password"
              className={INPUT_CLASS}
            />
          </label>
          <p className="text-xs text-text-muted">
            You will share both on WhatsApp, so pick something the team can
            type. User ids are unique across CrikLedger.
          </p>
          <button
            type="submit"
            disabled={pending || username.length < 3 || password.length < 8}
            className="h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create viewer login"}
          </button>
        </form>
      )}

      <SheetShell
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset viewer password"
        description="Everyone signed in is signed out, and the new password is needed from now on."
      >
        <form onSubmit={handleReset} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">
              New password (at least 8 characters)
            </span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              maxLength={200}
              autoComplete="new-password"
              className={INPUT_CLASS}
            />
          </label>
          {error && <p className="text-sm text-debit">{error}</p>}
          <button
            type="submit"
            disabled={pending || newPassword.length < 8}
            className="mt-1 h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground disabled:opacity-60"
          >
            {pending ? "Saving…" : "Set new password"}
          </button>
        </form>
      </SheetShell>

      <ConfirmDialog
        open={confirm?.kind === "seat"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Sign out this seat?"
        description="That phone is signed out on its next tap. The other seats stay signed in and the password is unchanged."
        confirmLabel="Sign out"
        pending={pending}
        onConfirm={handleConfirm}
      />
      <ConfirmDialog
        open={confirm?.kind === "signout-all"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Sign out everyone?"
        description="Every phone signed in with the viewer login is signed out on its next tap, and all the seats are free. The password stays the same."
        confirmLabel="Sign out all"
        pending={pending}
        onConfirm={handleConfirm}
      />
      <ConfirmDialog
        open={confirm?.kind === "remove"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Remove the viewer login?"
        description="The username stops working everywhere. You can create a new viewer login later."
        confirmLabel="Remove"
        destructive
        pending={pending}
        onConfirm={handleConfirm}
      />
    </section>
  );
}
