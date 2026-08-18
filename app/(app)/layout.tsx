import { AppHeader } from "@/components/shared/AppHeader";
import { AppTabBarGate } from "@/components/shared/AppTabBarGate";

// The five-tab shell. Everything reachable from the tab bar lives in
// this route group; URLs are unchanged (route groups do not appear in
// the path). Outside it, on purpose: /matches/[id] and
// /tournaments/[id]/** (their own chrome), /admin/**, /ops/**, /login
// and /signup.
//
// A LAYOUT rather than a per-page <AppShell> component, because a layout
// does not re-render on sibling navigation: the tab bar's Suspense
// boundary resolves once when you enter the group, so the fallback
// never flashes on a tab tap. A per-page component would re-suspend on
// every navigation — the flicker the whole design forbids.
//
// This body must stay SYNC, params-free and cookie-free. Every dynamic
// read lives inside AppHeader's and AppTabBarGate's own <Suspense>; a
// cookie read out here fails the build under cacheComponents.
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-svh bg-background pb-28">
      <AppHeader />
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
        {children}
      </main>
      <AppTabBarGate />
    </div>
  );
}
