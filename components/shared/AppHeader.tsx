import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { getNavState } from "@/lib/nav";
import { AccountMenu } from "./AccountMenu";

// Brand block: fully static, so it paints in the prerendered shell.
function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <Image src="/logo.png" alt="" width={32} height={32} priority />
      <span className="text-[17px] font-semibold tracking-tight text-text-primary">
        Crik<span className="text-accent">Ledger</span>
      </span>
    </Link>
  );
}

// The only part that needs the session. Server-rendered, so the
// signed-in state arrives with the HTML instead of popping in after a
// client fetch — this replaces the old PublicHeader's /api/auth/me
// useEffect, and with it the "Welcome, {name}" banner that appeared a
// beat after every page load (the name now lives in the chip).
async function HeaderAccount() {
  const nav = await getNavState();

  if (!nav.signedIn) {
    return (
      <Link
        href="/login"
        className="rounded-full border border-border bg-surface-secondary px-3 py-1 text-sm font-medium text-text-primary"
      >
        Login
      </Link>
    );
  }

  return <AccountMenu nav={nav} />;
}

export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
        <Brand />
        <div className="flex items-center gap-1">
          {/* Fixed-footprint fallback so nothing reflows when the
              account chip streams in. */}
          <Suspense
            fallback={<div className="h-7 w-16" aria-hidden />}
          >
            <HeaderAccount />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
