// Bare wrapper only. The OpsHeader deliberately does NOT live here:
// notFound() inside a page replaces the page slot but keeps the layout,
// so a team superadmin who guessed the URL would still get the operator
// header and its nav around a 404 — i.e. proof the console exists.
// Each page renders <OpsHeader /> itself, after its guard has passed.
//
// Sync, params-free and cookie-free, like the (app) layout.
export default function OpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-svh bg-background pb-10">
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
        {children}
      </main>
    </div>
  );
}
