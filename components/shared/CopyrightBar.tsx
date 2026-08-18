import { Copyright } from "lucide-react";

// Global sticky footer — rendered once in the root layout, below every
// other fixed bottom bar (TabBar and pool running-total sit on top of it).
export function CopyrightBar() {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface pb-safe">
      <p className="mx-auto flex h-6 max-w-md items-center justify-center gap-1 text-[10px] font-medium uppercase tracking-wider text-text-muted">
        Copyright <Copyright size={10} aria-label="copyright" /> Ravi Kant —
        Destroyer &amp; Economist
      </p>
    </footer>
  );
}
