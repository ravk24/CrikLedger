import Link from "next/link";
import { Lock } from "lucide-react";
import type { Verdict } from "@/lib/access";

// What a visitor sees instead of a team's private page.
//
// A panel, NOT a 404 and NOT a redirect. A shared link that a member
// opens while signed out should say "sign in", not look broken — and
// the app's whole design is grey-don't-hide, so this renders inside the
// normal shell with the header and tab bar intact.
//
// It says nothing about the team beyond the fact that it exists, which
// the Teams directory already makes public.
export function AccessGate({
  verdict,
  what = "this page",
  next,
}: {
  verdict: Extract<Verdict, { ok: false }>;
  what?: string;
  next?: string;
}) {
  const signIn = verdict.reason === "anonymous";
  const noTeam = verdict.reason === "no-team";

  return (
    <section className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface shadow-card p-6 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-surface-secondary text-text-muted">
        <Lock size={20} />
      </span>

      <h2 className="text-base font-semibold text-text-primary">
        {signIn
          ? `Sign in to see ${what}`
          : noTeam
            ? "No team on this account yet"
            : "You don't have access to this team"}
      </h2>

      <p className="max-w-xs text-sm text-text-secondary">
        {signIn
          ? "This is a paid team space. Members can sign in to view it."
          : noTeam
            ? "Get the Team Ledger to set your team up — players, matches and the pool."
            : "Ask the team's superadmin to add you, or switch to a team you belong to."}
      </p>

      {signIn ? (
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="flex h-11 w-full max-w-xs items-center justify-center rounded-md bg-accent text-sm font-medium text-accent-foreground"
        >
          Sign in
        </Link>
      ) : noTeam ? (
        <Link
          href="/purchases"
          className="flex h-11 w-full max-w-xs items-center justify-center rounded-md bg-accent text-sm font-medium text-accent-foreground"
        >
          See what&apos;s available
        </Link>
      ) : null}
    </section>
  );
}
