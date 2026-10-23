import Link from "next/link";

// Empty state for a filtered ledger page — the filter found nothing on
// this team's ledger. Server-renderable; shared by the admin section
// and the viewer branch of /pool.
export function LedgerEmptyFiltered({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface shadow-card p-4">
      <p className="text-sm text-text-muted">No {label.toLowerCase()} yet.</p>
      <Link
        href="/pool"
        className="flex h-10 items-center justify-center rounded-md border border-border bg-surface shadow-card text-sm font-medium text-accent"
      >
        Show all entries
      </Link>
    </div>
  );
}
