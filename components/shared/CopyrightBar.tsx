// Global sticky footer — rendered once in the root layout, below every
// other fixed bottom bar (TabBar and pool running-total sit on top of it).
export function CopyrightBar() {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-10 border-t border-chrome-border bg-chrome pb-safe">
      <p className="mx-auto flex h-6 max-w-md items-center justify-center text-[10px] font-medium uppercase tracking-wider text-chrome-muted">
        © 2026 CrikLedger · Built by Ravi Kant
      </p>
    </footer>
  );
}
