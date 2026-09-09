import { Suspense } from "react";
import Link from "next/link";
import { CalendarDays, Home, Settings, Undo2, Wallet } from "lucide-react";
import { isViewer } from "@/lib/roles";
import { getSessionAdmin } from "@/lib/session";
import { TournamentTabBar } from "./TournamentTabBar";

async function Gate() {
  const admin = await getSessionAdmin();
  // The bar has no tournament id (it lives in the layout), so this is
  // the account-level gate; the Admin page itself re-checks canWrite for
  // the tournament's own scope. The shared viewer login is greyed here
  // rather than sent to a page that would only bounce it.
  return (
    <TournamentTabBar
      isAdmin={!!admin && !admin.mustChangePassword && !isViewer(admin)}
    />
  );
}

// Static placeholder for the prerendered shell — same geometry as the
// real bar but no hooks (usePathname is runtime data under Cache
// Components, so the hook-reading bar must stream in via Suspense).
function TabBarShell() {
  // Same 5 slots/order as the real bar (Home, Schedule, Admin, Ledger,
  // Tournaments) so the streamed bar replaces this one with zero width
  // jump. The Tournaments href is static — no pathname, no cookies —
  // so it can be a real Link even in the prerendered shell.
  const tabs = [
    { label: "Home", icon: Home, href: null },
    { label: "Schedule", icon: CalendarDays, href: null },
    { label: "Admin", icon: Settings, href: null },
    { label: "Ledger", icon: Wallet, href: null },
    { label: "Tournaments", icon: Undo2, href: "/tournaments" },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-[calc(24px+env(safe-area-inset-bottom))] z-10 border-t border-border bg-surface">
      <div className="mx-auto flex max-w-md">
        {tabs.map(({ label, icon: Icon, href }) => {
          const inner = (
            <>
              <Icon size={20} strokeWidth={2} />
              <span className="whitespace-nowrap text-center text-[11px] font-semibold leading-tight">
                {label}
              </span>
            </>
          );
          const className =
            "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-text-muted";
          return href ? (
            <Link key={label} href={href} className={className}>
              {inner}
            </Link>
          ) : (
            <div key={label} className={className}>
              {inner}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

// The bar needs runtime data twice over (pathname for hrefs, cookies
// for the admin tab), so it streams — but the fallback IS a bar, so
// the shell never lacks one (V2.1 rule). Hosted by the (tabs) route
// group layout: layouts survive sibling navigation, so the fallback
// shows on first load only, never on tab taps.
export function TournamentTabBarGate() {
  return (
    <Suspense fallback={<TabBarShell />}>
      <Gate />
    </Suspense>
  );
}
