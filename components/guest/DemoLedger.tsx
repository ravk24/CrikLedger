import { formatRupees } from "@/lib/format";
import { DEMO_LEDGER, DEMO_POOL_BALANCE, DEMO_TEAM } from "@/lib/demo/fixtures";

// The Ledger tab for anyone without a Team Ledger: a worked example, so
// the product explains itself before it asks for money.
//
// Reads lib/demo/fixtures.ts, never the database — a stranger must not
// be shown a paying team's money, and this way they structurally cannot
// be. View only: there is nothing to click, and no upsell after the
// rows — the sample is the argument.
export function DemoLedger() {
  return (
    <>
      <div>
        <h1 className="text-xl font-bold text-text-primary">Ledger</h1>
        <p className="mt-0.5 text-xs text-text-muted">
          Sample · this is how the {DEMO_TEAM.name} pool would look.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-surface p-4 text-center">
        <p className="text-xs text-text-secondary">Pool balance</p>
        <p className="text-3xl font-bold text-text-primary">
          ₹{formatRupees(DEMO_POOL_BALANCE)}
        </p>
      </section>

      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
        {DEMO_LEDGER.map((row) => (
          <li key={row.id} className="flex items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">
                {row.title}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                {new Date(row.entry_date).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
                {row.detail ? ` · ${row.detail}` : ""}
              </p>
            </div>
            <p
              className={
                row.amount < 0
                  ? "shrink-0 text-sm font-semibold text-debit"
                  : "shrink-0 text-sm font-semibold text-credit"
              }
            >
              {row.amount < 0 ? "−" : "+"}₹{formatRupees(row.amount)}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
