"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Crown, ShieldCheck, Trophy, UserPlus, Users } from "lucide-react";

type Props = {
  name: string;
  teamName: string;
  adminCount: number;
  creditsLeft: number;
};

// What a superadmin can do, in their own words, plus the one setting
// that is theirs alone: the team's name. Every team is provisioned with
// a placeholder ("<name>'s team"), so this is where it gets a real one.
export function PrivilegesCard({ name, teamName, adminCount, creditsLeft }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(teamName);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = value.trim();
  const dirty = trimmed !== teamName && trimmed.length >= 2;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/sa/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: trimmed }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Could not save — try again.");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    } catch {
      setError("Could not reach the server — check your connection.");
    } finally {
      setPending(false);
    }
  }

  const rules = [
    {
      icon: UserPlus,
      text: (
        <>
          You can invite up to <strong>2 admins</strong> ({adminCount}/2 in
          use). Admins can add and edit ledger entries, matches and players —
          only you can delete them, or remove an admin.
        </>
      ),
    },
    {
      icon: Crown,
      text: <>You choose the team&apos;s captain and vice-captain.</>,
    },
    {
      icon: Users,
      text: (
        <>
          Guest fees are charged to the <strong>captain&apos;s balance</strong>.
          Settling up with guests happens offline and is the captain&apos;s
          responsibility.
        </>
      ),
    },
    {
      icon: Trophy,
      text: (
        <>
          Tournament credits left: <strong>{creditsLeft}</strong> — one credit
          hosts one tournament.
        </>
      ),
    },
    {
      icon: ShieldCheck,
      text: (
        <>
          Your password is yours alone. If you lose it, the operator can only
          issue a one-time reset.
        </>
      ),
    },
  ];

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
          Your privileges
        </p>
        <h2 className="mt-1 text-lg font-bold text-text-primary">
          Welcome, {name}
        </h2>
        <p className="text-xs text-text-secondary">Superadmin · {teamName}</p>
      </div>

      <form onSubmit={save} className="flex flex-col gap-1">
        <label
          htmlFor="team-name"
          className="text-xs font-medium text-text-secondary"
        >
          Your team name
        </label>
        <div className="flex gap-2">
          <input
            id="team-name"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={60}
            className="h-11 min-w-0 flex-1 rounded-md border border-border bg-surface-secondary px-3 text-base text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            type="submit"
            disabled={!dirty || pending}
            className="flex h-11 shrink-0 items-center gap-1 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground disabled:opacity-50"
          >
            {saved ? (
              <>
                <Check size={16} /> Saved
              </>
            ) : pending ? (
              "Saving…"
            ) : (
              "Save"
            )}
          </button>
        </div>
        <p className="text-xs text-text-muted">
          Shown in the header, on shared images and on player statements.
        </p>
        {error && <p className="text-sm text-debit">{error}</p>}
      </form>

      <ul className="flex flex-col gap-2.5">
        {rules.map(({ icon: Icon, text }, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary">
            <Icon size={16} className="mt-0.5 shrink-0 text-accent" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
