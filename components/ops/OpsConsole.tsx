"use client";

import { startTransition, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  ChevronRight,
  Copy,
  Search,
  Trophy,
} from "lucide-react";
import { SheetShell } from "@/components/shared/SheetShell";
import { Money } from "@/components/shared/Money";
import { formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OpsAccount } from "@/app/api/ops/accounts/route";

export type GrantRow = {
  account_id: string;
  username: string;
  name: string;
  team_name: string;
  first_at: string;
  total: number; // credits granted (tournament) / 1 (ledger)
  used: number; // credits consumed
};

export type OpsStats = {
  credits: number;
  ledger_users: number;
  superadmins: number;
  admins: number;
  money: number;
};

type Product = "team_ledger" | "tournament_credit";

type Props = {
  ledger: GrantRow[];
  tournament: GrantRow[];
  stats: OpsStats;
  prices: { team_ledger: number; tournament_credit: number };
};

type Reveal = {
  username: string;
  teamName: string;
  tempPassword: string | null;
};

const PRODUCT_COPY: Record<
  Product,
  { title: string; cta: string; description: string; empty: string }
> = {
  team_ledger: {
    title: "Ledger users",
    cta: "Grant Ledger",
    description:
      "A verified payment becomes a Ledger for the customer's team. Pick their existing account — only a first-time customer needs a new user id.",
    empty: "No Ledger has been granted yet.",
  },
  tournament_credit: {
    title: "Tournament users",
    cta: "Add tournament credit",
    description:
      "One credit hosts one tournament. Grant again for a repeat purchase — credits stack on the customer's existing account.",
    empty: "No tournament credit has been granted yet.",
  },
};

const inputClass =
  "h-11 w-full rounded-md border border-border bg-surface-secondary px-3 text-base text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

// The operator's whole console: three tiles, each opening a sheet. The
// two product sheets carry the grant form AND the holder list; rows
// link to the account page for password reset / suspend.
export function OpsConsole({ ledger, tournament, stats, prices }: Props) {
  const [open, setOpen] = useState<Product | "stats" | null>(null);

  const tiles = [
    {
      key: "team_ledger" as const,
      label: "Ledger Users",
      value: ledger.length,
      icon: BookOpen,
      iconClass: "bg-credit-light text-credit-foreground",
    },
    {
      key: "tournament_credit" as const,
      label: "Tournament Users",
      value: tournament.length,
      icon: Trophy,
      iconClass: "bg-low-light text-low-foreground",
    },
    {
      key: "stats" as const,
      label: "Statistics",
      value: null,
      icon: BarChart3,
      iconClass: "bg-accent-light text-accent",
    },
  ];

  return (
    <>
      <section className="grid grid-cols-2 gap-3">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setOpen(t.key)}
              className="flex min-h-28 flex-col items-start justify-between gap-2 rounded-lg border border-border bg-surface shadow-card p-4 text-left text-text-primary"
            >
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-md",
                  t.iconClass,
                )}
              >
                <Icon size={18} />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-semibold">{t.label}</span>
                {t.value !== null && (
                  <span className="text-xs text-text-muted">
                    {t.value} {t.value === 1 ? "user" : "users"}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </section>

      <GrantSheet
        product="team_ledger"
        open={open === "team_ledger"}
        onClose={() => setOpen(null)}
        rows={ledger}
        price={prices.team_ledger}
      />
      <GrantSheet
        product="tournament_credit"
        open={open === "tournament_credit"}
        onClose={() => setOpen(null)}
        rows={tournament}
        price={prices.tournament_credit}
      />

      <SheetShell
        open={open === "stats"}
        onOpenChange={(o) => !o && setOpen(null)}
        title="Statistics"
        description="Platform totals, counted from grants and memberships."
      >
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Tournaments hosted" value={stats.credits} />
          <Stat label="Ledger users" value={stats.ledger_users} />
          <Stat label="Superadmins" value={stats.superadmins} />
          <Stat label="Admins" value={stats.admins} />
          <div className="col-span-2 flex flex-col gap-0.5 rounded-lg border border-accent bg-accent-light/40 p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-accent">
              Money earned till now
            </span>
            <Money
              amount={stats.money}
              variant="neutral"
              className="text-[28px] font-bold leading-8"
            />
            <span className="text-xs text-text-secondary">
              ₹{prices.team_ledger} × {stats.ledger_users} Ledger
              {stats.ledger_users === 1 ? "" : "s"} + ₹{prices.tournament_credit} ×{" "}
              {stats.credits} tournament {stats.credits === 1 ? "credit" : "credits"}
              {stats.money !==
              prices.team_ledger * stats.ledger_users +
                prices.tournament_credit * stats.credits
                ? " · pre-console grants counted at ₹0"
                : ""}
            </span>
          </div>
        </div>
      </SheetShell>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-h-20 flex-col justify-center gap-0.5 rounded-lg border border-border bg-surface shadow-card p-4">
      <span className="text-2xl font-bold tabular-nums text-text-primary">
        {value}
      </span>
      <span className="text-xs font-medium text-text-secondary">{label}</span>
    </div>
  );
}

function GrantSheet({
  product,
  open,
  onClose,
  rows,
  price,
}: {
  product: Product;
  open: boolean;
  onClose: () => void;
  rows: GrantRow[];
  price: number;
}) {
  const router = useRouter();
  const copy = PRODUCT_COPY[product];
  // Existing account is the default path: one login per person, every
  // purchase stacks on it. "New account" is the first-time-customer
  // exception and is the only path that mints a password.
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [accounts, setAccounts] = useState<OpsAccount[] | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<OpsAccount | null>(null);
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [copied, setCopied] = useState(false);

  // The directory loads once per open; the list is tens of rows, so
  // filtering happens here.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setAccounts(null);
    fetch("/api/ops/accounts")
      .then((r) => r.json())
      .then((body) => {
        if (!cancelled) setAccounts(body.success ? body.data : []);
      })
      .catch(() => {
        if (!cancelled) setAccounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const needle = query.trim().toLowerCase();
  const matches = (accounts ?? []).filter(
    (a) =>
      !needle ||
      a.username.includes(needle) ||
      a.name.toLowerCase().includes(needle) ||
      (a.email ?? "").toLowerCase().includes(needle),
  );
  const clash =
    mode === "new" && username.length >= 3
      ? (accounts ?? []).find((a) => a.username === username) ?? null
      : null;
  const ledgerHeld =
    mode === "existing" && product === "team_ledger" && !!selected?.has_ledger;
  const canSubmit =
    !pending &&
    (mode === "existing"
      ? !!selected && !ledgerHeld
      : username.length >= 3 && name.trim().length > 0 && !clash);

  const targetUsername = mode === "existing" ? selected?.username ?? "" : username;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/ops/grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product,
          username: targetUsername,
          ...(mode === "new" ? { name: name.trim() } : {}),
        }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Could not grant — try again.");
        return;
      }
      // Shown ONCE — never stored or logged in plaintext.
      setReveal({
        username: body.data.username,
        teamName: body.data.team_name,
        tempPassword: body.data.temp_password,
      });
      setUsername("");
      setName("");
      setSelected(null);
      setQuery("");
      // Refresh the directory so the new account / new holding shows.
      fetch("/api/ops/accounts")
        .then((r) => r.json())
        .then((b) => b.success && setAccounts(b.data))
        .catch(() => {});
      startTransition(() => router.refresh());
    } catch {
      setError("Could not reach the server — check your connection.");
    } finally {
      setPending(false);
    }
  }

  async function copyPassword() {
    if (!reveal?.tempPassword) return;
    try {
      await navigator.clipboard.writeText(reveal.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — the password is still on screen
    }
  }

  return (
    <SheetShell
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setError(null);
          setReveal(null);
        }
      }}
      title={copy.title}
      description={copy.description}
    >
      <div className="flex flex-col gap-4">
        {reveal && (
          <section className="rounded-lg border border-accent bg-accent-light/40 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-accent">
              {reveal.tempPassword
                ? `Temporary password for ${reveal.username}`
                : `Granted to ${reveal.username}`}
            </p>
            {reveal.tempPassword ? (
              <>
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
                  Shown once. Send it over WhatsApp — their first sign-in
                  forces a new password. Team: {reveal.teamName}.
                </p>
              </>
            ) : (
              <p className="mt-1 text-xs text-text-secondary">
                Existing account — no new password. Team: {reveal.teamName}.
              </p>
            )}
            <button
              type="button"
              onClick={() => setReveal(null)}
              className="mt-1 text-xs font-medium text-accent"
            >
              Dismiss
            </button>
          </section>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div
            role="radiogroup"
            aria-label="Account"
            className="grid grid-cols-2 gap-1 rounded-md bg-surface-secondary p-1"
          >
            {(
              [
                ["existing", "Existing account"],
                ["new", "New account"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={mode === value}
                onClick={() => {
                  setMode(value);
                  setError(null);
                }}
                className={cn(
                  "h-9 rounded-sm text-sm font-medium",
                  mode === value
                    ? "bg-surface text-text-primary shadow-card"
                    : "text-text-secondary",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "existing" ? (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-text-secondary">
                  Find the customer
                </span>
                <span className="relative">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setSelected(null);
                    }}
                    placeholder="User id, name or email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    className={cn(inputClass, "pl-9")}
                  />
                </span>
              </label>

              {selected ? (
                <AccountRow
                  account={selected}
                  selected
                  onClick={() => setSelected(null)}
                />
              ) : accounts === null ? (
                <p className="text-xs text-text-muted">Loading accounts…</p>
              ) : matches.length === 0 ? (
                <p className="text-xs text-text-muted">
                  {accounts.length === 0
                    ? "No customer accounts yet — use New account."
                    : "No account matches. First-time customer? Use New account."}
                </p>
              ) : (
                <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border">
                  {matches.map((a) => (
                    <li key={a.id}>
                      <AccountRow account={a} onClick={() => setSelected(a)} />
                    </li>
                  ))}
                </ul>
              )}

              {ledgerHeld && (
                <p className="text-xs text-low-foreground">
                  {selected?.username} already holds a Ledger for{" "}
                  {selected?.team_name ?? "their team"}.
                </p>
              )}
            </>
          ) : (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-text-secondary">
                  New user id
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) =>
                    setUsername(
                      e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                    )
                  }
                  placeholder="e.g. rahul_sharma"
                  required
                  minLength={3}
                  maxLength={32}
                  autoCapitalize="none"
                  autoCorrect="off"
                  className={inputClass}
                />
              </label>
              {clash && (
                <p className="text-xs text-low-foreground">
                  {clash.username} already exists ({clash.name}) — switch to
                  Existing account so the purchase lands on that login.
                </p>
              )}
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-text-secondary">
                  Name
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Rahul Sharma"
                  required
                  maxLength={80}
                  className={inputClass}
                />
              </label>
              <p className="text-xs text-text-muted">
                A one-time password is generated for a new account. Share it
                on WhatsApp; their first sign-in replaces it.
              </p>
            </>
          )}

          {error && <p className="text-sm text-debit">{error}</p>}
          <button
            type="submit"
            disabled={!canSubmit}
            className="h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground disabled:opacity-60"
          >
            {pending
              ? "Granting…"
              : mode === "existing"
                ? selected
                  ? `${copy.cta} to ${selected.username} (₹${price})`
                  : `${copy.cta} (₹${price})`
                : `Create account + ${copy.cta.toLowerCase()} (₹${price})`}
          </button>
        </form>

        <section className="flex flex-col gap-2">
          <h3 className="px-1 text-[11px] font-medium uppercase tracking-wider text-text-muted">
            {copy.title} · {rows.length}
          </h3>
          {rows.length === 0 ? (
            <p className="rounded-lg border border-border bg-surface shadow-card p-4 text-sm text-text-muted">
              {copy.empty}
            </p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface shadow-card">
              {rows.map((r) => (
                <li key={r.account_id}>
                  <Link
                    href={`/ops/accounts/${r.account_id}`}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text-primary">
                        {r.name}{" "}
                        <span className="font-normal text-text-muted">
                          · {r.username}
                        </span>
                      </p>
                      <p className="mt-0.5 truncate text-xs text-text-muted">
                        {r.team_name} · since {formatDateShort(r.first_at)}
                        {product === "tournament_credit" &&
                          ` · ${r.used}/${r.total} credits used`}
                      </p>
                    </div>
                    <ChevronRight size={16} className="shrink-0 text-text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </SheetShell>
  );
}


// One customer in the picker: who they are, which team they own, and
// what they already hold — so the operator can see a repeat purchase
// landing in the right place before tapping Grant.
function AccountRow({
  account,
  selected = false,
  onClick,
}: {
  account: OpsAccount;
  selected?: boolean;
  onClick: () => void;
}) {
  const holdings = [
    account.has_ledger ? "Ledger" : null,
    account.credits_total > 0
      ? `${account.credits_total} credit${account.credits_total === 1 ? "" : "s"} (${account.credits_unused} unused)`
      : null,
  ].filter(Boolean);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center justify-between gap-2 px-3 py-2 text-left",
        selected
          ? "rounded-md border border-accent bg-accent-light/40"
          : "bg-surface",
      )}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-text-primary">
          {account.name}{" "}
          <span className="font-normal text-text-muted">· {account.username}</span>
        </span>
        <span className="block truncate text-xs text-text-secondary">
          {account.team_name ?? "No team yet"}
          {holdings.length > 0 ? ` · ${holdings.join(" · ")}` : " · nothing yet"}
        </span>
      </span>
      <span className="shrink-0 text-xs font-medium text-accent">
        {selected ? "Change" : "Select"}
      </span>
    </button>
  );
}
