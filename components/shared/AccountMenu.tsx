"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ChevronDown, Shield } from "lucide-react";
import type { NavState } from "@/lib/nav";

// The signed-in half of the header: name chip, team switcher (only when
// the account holds more than one), and the account actions. Server
// resolves everything, so there is no post-hydration pop.
//
// A hand-rolled disclosure, not Radix DropdownMenu: this component is in
// the (app) layout's import graph, so whatever it pulls in ships on
// EVERY page — legal pages and signed-out visitors included, who never
// see it. The Radix menu was ~31 KB gz (17 % of all client JS) for six
// links. Escape, outside-tap and item-select all close it; roles and
// aria-expanded keep it a proper menu for assistive tech.
export function AccountMenu({ nav }: { nav: NavState }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function switchTeam(slug: string) {
    setOpen(false);
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
    setOpen(false);
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

  const itemClass =
    "flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm text-text-primary outline-none hover:bg-surface-secondary focus-visible:bg-surface-secondary";
  const labelClass = "px-2 py-1.5 text-sm font-semibold text-text-primary";
  const separator = <div role="separator" className="-mx-1 my-1 h-px bg-border" />;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={busy || pending}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-7 items-center gap-1 rounded-full border border-chrome-border bg-chrome-elevated px-3 py-1 text-sm font-medium text-chrome-foreground disabled:opacity-60"
      >
        {nav.isMegaadmin && <Shield size={13} aria-hidden />}
        <span className="max-w-[9ch] truncate">{firstName}</span>
        <ChevronDown size={14} aria-hidden />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-md border border-border bg-surface p-1 shadow-md"
        >
          <div className={`${labelClass} flex flex-col gap-0.5`}>
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
          </div>

          {/* Only worth showing when there is something to switch between. */}
          {nav.teams.length > 1 && (
            <>
              {separator}
              <div className="px-2 py-1.5 text-xs text-text-secondary">
                Switch team
              </div>
              {nav.teams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="menuitem"
                  onClick={() => switchTeam(t.slug)}
                  className={`${itemClass} justify-between`}
                >
                  <span className="truncate">{t.name}</span>
                  {t.id === nav.activeTeamId && <Check size={14} aria-hidden />}
                </button>
              ))}
            </>
          )}

          {separator}
          {nav.hasTeamLedger && (
            <Link href="/admin" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
              Team admin
            </Link>
          )}
          {nav.isMegaadmin && (
            <Link href="/ops" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
              Operator console
            </Link>
          )}
          <Link href="/purchases" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            Purchases
          </Link>
          <Link href="/admin/password" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            Change password
          </Link>
          {separator}
          <button
            type="button"
            role="menuitem"
            onClick={logout}
            className={`${itemClass} text-debit`}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
