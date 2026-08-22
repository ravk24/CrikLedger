"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ChevronDown, Shield } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NavState } from "@/lib/nav";

// The signed-in half of the header: name chip, team switcher (only when
// the account holds more than one), and the account actions. Server
// resolves everything, so there is no post-hydration pop.
export function AccountMenu({ nav }: { nav: NavState }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function switchTeam(slug: string) {
    setBusy(true);
    try {
      await fetch("/api/session/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      // refresh(), not push(): the active team changes what every server
      // component renders, and the URL is unchanged (no /[team]/ yet).
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  const firstName = (nav.accountName ?? "").split(" ")[0] || "Account";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={busy || pending}
          className="flex min-h-7 items-center gap-1 rounded-full bg-scheduled-light px-3 py-1 text-sm font-medium text-scheduled-foreground disabled:opacity-60"
        >
          {nav.isMegaadmin && <Shield size={13} aria-hidden />}
          <span className="max-w-[9ch] truncate">{firstName}</span>
          <ChevronDown size={14} aria-hidden />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" collisionPadding={8} className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate">{nav.accountName}</span>
          {nav.activeTeamName && (
            <span className="text-xs font-normal text-text-secondary">
              {nav.activeTeamName}
            </span>
          )}
          {nav.isMegaadmin && (
            <span className="text-xs font-normal text-text-secondary">
              Platform operator · read-only
            </span>
          )}
        </DropdownMenuLabel>

        {/* Only worth showing when there is something to switch between. */}
        {nav.teams.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-text-secondary">
              Switch team
            </DropdownMenuLabel>
            {nav.teams.map((t) => (
              <DropdownMenuItem
                key={t.id}
                onSelect={() => switchTeam(t.slug)}
                className="flex items-center justify-between gap-2"
              >
                <span className="truncate">{t.name}</span>
                {t.id === nav.activeTeamId && <Check size={14} aria-hidden />}
              </DropdownMenuItem>
            ))}
          </>
        )}

        <DropdownMenuSeparator />
        {nav.hasTeamLedger && (
          <DropdownMenuItem asChild>
            <Link href="/admin">Team admin</Link>
          </DropdownMenuItem>
        )}
        {nav.isMegaadmin && (
          <DropdownMenuItem asChild>
            <Link href="/ops">Operator console</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/purchases">Purchases</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/admin/password">Change password</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout} className="text-debit">
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
