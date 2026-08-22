"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { SheetShell } from "@/components/shared/SheetShell";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { AdminRole } from "@/types";

export type AdminListRow = {
  id: string;
  username: string;
  name: string;
  role: AdminRole;
  is_active: boolean;
  created_at: string;
};

type Props = {
  admins: AdminListRow[];
  selfId: string;
};

type Reveal = { name: string; tempPassword: string };
type Confirm =
  | { kind: "revoke"; admin: AdminListRow }
  | { kind: "reset"; admin: AdminListRow }
  | { kind: "restore"; admin: AdminListRow };

export function AdminManager({ admins, selfId }: Props) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/sa/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          name: name.trim(),
        }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(
          body.error?.code === "USERNAME_TAKEN"
            ? "That username is taken — pick another."
            : (body.error?.message ?? "Could not create the admin."),
        );
        return;
      }
      setCreateOpen(false);
      setUsername("");
      setName("");
      setReveal({ name: body.data.name, tempPassword: body.data.temp_password });
      startTransition(() => router.refresh());
    } catch {
      setError("Could not reach the server — check your connection.");
    } finally {
      setPending(false);
    }
  }

  async function handleConfirm() {
    if (!confirm) return;
    setPending(true);
    setError(null);
    try {
      const url =
        confirm.kind === "revoke"
          ? `/api/sa/admins/${confirm.admin.id}/revoke`
          : confirm.kind === "restore"
            ? `/api/sa/admins/${confirm.admin.id}/restore`
            : `/api/sa/admins/${confirm.admin.id}/reset-password`;
      const res = await fetch(url, { method: "POST" });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Could not complete the action.");
        setConfirm(null);
        return;
      }
      if (confirm.kind === "reset") {
        setReveal({
          name: body.data.name,
          tempPassword: body.data.temp_password,
        });
      }
      setConfirm(null);
      startTransition(() => router.refresh());
    } catch {
      setError("Could not reach the server — check your connection.");
    } finally {
      setPending(false);
    }
  }

  async function copyPassword() {
    if (!reveal) return;
    try {
      await navigator.clipboard.writeText(reveal.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — the password is still on screen
    }
  }

  return (
    <>
      {reveal && (
        <section className="rounded-lg border border-accent bg-accent-light/40 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-accent">
            Temporary password for {reveal.name}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-dashed border-accent bg-surface px-3 py-2">
            <code className="font-mono text-lg font-bold text-text-primary">
              {reveal.tempPassword}
            </code>
            <button
              type="button"
              onClick={copyPassword}
              className="flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground"
            >
              <Copy size={12} />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-xs text-text-secondary">
            Shown once. Send it over WhatsApp — their first sign-in forces a new
            password.
          </p>
          <button
            type="button"
            onClick={() => setReveal(null)}
            className="mt-1 text-xs font-medium text-accent"
          >
            Dismiss
          </button>
        </section>
      )}

      <section className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface shadow-card">
        {admins.map((admin) => (
          <div
            key={admin.id}
            className={cn(
              "flex min-h-11 items-center justify-between gap-3 px-4 py-3",
              !admin.is_active && "bg-surface-secondary",
            )}
          >
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "flex items-center gap-2 truncate text-sm font-semibold",
                  admin.is_active ? "text-text-primary" : "text-text-muted",
                )}
              >
                {admin.name}
                {admin.role === "superadmin" && (
                  <span className="rounded-full bg-accent-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                    Superadmin
                  </span>
                )}
                {!admin.is_active && (
                  <span className="rounded-full bg-debit-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-debit-foreground">
                    Revoked
                  </span>
                )}
              </p>
              <p className="text-xs text-text-muted">
                {admin.username} · since {formatDate(admin.created_at)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {admin.id === selfId ? (
                <span className="text-xs text-text-muted">You</span>
              ) : admin.role === "superadmin" ? null : (
                <>
                  {admin.is_active ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setConfirm({ kind: "reset", admin })}
                        className="min-h-11 text-sm font-medium text-accent"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirm({ kind: "revoke", admin })}
                        className="min-h-11 text-sm font-medium text-debit"
                      >
                        Revoke
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirm({ kind: "restore", admin })}
                      className="min-h-11 text-sm font-medium text-accent"
                    >
                      Restore
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </section>

      {error && <p className="text-sm text-debit">{error}</p>}

      <button
        type="button"
        onClick={() => {
          setError(null);
          setCreateOpen(true);
        }}
        className="h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground"
      >
        + Create admin
      </button>
      <p className="text-center text-xs text-text-muted">
        Revoking an admin ends their live session on their very next request.
      </p>

      <SheetShell
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create admin"
        description="They get a one-time temp password and must change it on first sign-in."
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">
              Username (lowercase, no spaces)
            </span>
            <input
              type="text"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
              }
              placeholder="sunil_ad"
              required
              minLength={3}
              className="h-11 w-full rounded-md border border-border bg-surface-secondary px-3 text-base text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">
              Display name (shown on edited-by stamps)
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sunil"
              required
              className="h-11 w-full rounded-md border border-border bg-surface-secondary px-3 text-base text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </label>
          {error && <p className="text-sm text-debit">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="mt-1 h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create admin"}
          </button>
        </form>
      </SheetShell>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={
          confirm?.kind === "revoke"
            ? `Revoke ${confirm.admin.name}?`
            : confirm?.kind === "restore"
              ? `Restore ${confirm.admin.name}?`
              : `Reset ${confirm?.admin.name ?? ""}'s password?`
        }
        description={
          confirm?.kind === "revoke"
            ? "They lose access on their next request. Their name stays on every edited-by stamp."
            : confirm?.kind === "restore"
              ? "They can sign in again with their old password. Pair with a reset if they've forgotten it."
              : "Their current password stops working — you'll get a new one-time temp password to relay."
        }
        confirmLabel={
          confirm?.kind === "revoke"
            ? "Revoke"
            : confirm?.kind === "restore"
              ? "Restore"
              : "Reset password"
        }
        destructive={confirm?.kind === "revoke"}
        pending={pending}
        onConfirm={handleConfirm}
      />
    </>
  );
}
