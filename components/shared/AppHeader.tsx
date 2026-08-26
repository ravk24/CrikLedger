import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { getNavState } from "@/lib/nav";
import { AccountMenu } from "./AccountMenu";
import { CHROME_HEADER } from "@/lib/ui";

// Brand block: fully static, so it paints in the prerendered shell.
// The mark is served as-is from /logo.png (10 KB, already 64×64): with
// the optimizer on, `priority` put a High-priority preload of
// /_next/image?url=… — a function round-trip on a cold cache — into
// every page's <head> for a 32 px decoration that is never the LCP.
function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <Image src="/logo.png" alt="" width={32} height={32} unoptimized />
      <span className="text-[17px] font-semibold tracking-tight text-chrome-foreground">
        Crik<span className="text-chrome-accent">Ledger</span>
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
        className="rounded-full border border-chrome-border bg-chrome-elevated px-3 py-1 text-sm font-medium text-chrome-foreground"
      >
        Login
      </Link>
    );
  }

  return <AccountMenu nav={nav} />;
}

export function AppHeader() {
  return (
    <header className={CHROME_HEADER}>
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
