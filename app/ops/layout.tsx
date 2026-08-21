// Bare wrapper only. The operator chrome deliberately does NOT live
// here: notFound() inside a page replaces the page slot but keeps the
// layout, so a team superadmin who guessed the URL would still get the
// operator header around a 404 — i.e. proof the console exists. Each
// page renders <OpsChrome> itself, after its guard has passed; the
// chrome owns the <main> frame.
//
// Sync, params-free and cookie-free, like the (app) layout. No tab bar
// on purpose; the global CopyrightBar (root layout) is the footer.
export default function OpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-svh bg-background pb-10">{children}</div>;
}
