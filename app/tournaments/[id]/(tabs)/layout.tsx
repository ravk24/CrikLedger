import { TournamentTabBarGate } from "@/components/tournaments/TournamentTabBarGate";

// Shared frame for the tournament mini-app's four tab pages. Layouts
// don't re-render on sibling navigation, so the bar — and its resolved
// admin state — mounts once per tournament visit instead of flashing
// the fallback shell on every tab tap. Deliberately sync and
// params-free: awaiting params here would pull runtime data into the
// static shell (Cache Components); the Gate's own Suspense keeps the
// cookie/DB lookup out of it. Detail pages (matches/[mid],
// players/[pid]) live outside this group on purpose — back-link
// headers, no bar.
export default function TournamentTabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <TournamentTabBarGate />
    </>
  );
}
