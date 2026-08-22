import { SITE_HOST } from "@/lib/site";

// Shared frame for every PNG the app hands to the share sheet (match
// sheet, ledger, player balances). Rendered by satori via next/og, which
// ignores CSS classes — every style in here must stay inline.

export const SHARE_WIDTH = 1080;

export const rupees = (n: number) =>
  Math.abs(Math.round(n)).toLocaleString("en-IN");

// "+₹1,200" / "−₹300" — ledger rows.
export const signedRupees = (n: number) =>
  `${n < 0 ? "−" : "+"}₹${rupees(n)}`;

// "₹1,200" / "−₹300" — balances.
export const balanceRupees = (n: number) =>
  `${n < 0 ? "−" : ""}₹${rupees(n)}`;

export const moneyColor = (n: number) => (n < 0 ? "#f87171" : "#4ade80");

type FrameProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: string;
};

export function ShareFrame({ title, subtitle, children, footer }: FrameProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0f172a",
        color: "#f8fafc",
        padding: 56,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", fontSize: 26, color: "#38bdf8", letterSpacing: 2 }}>
        CRIKLEDGER
      </div>
      <div style={{ display: "flex", fontSize: 52, fontWeight: 700, marginTop: 12 }}>
        {title}
      </div>
      {subtitle ? (
        <div style={{ display: "flex", fontSize: 26, color: "#94a3b8", marginTop: 8 }}>
          {subtitle}
        </div>
      ) : null}

      {children}

      {footer ? (
        <div style={{ display: "flex", marginTop: "auto", fontSize: 24, color: "#94a3b8" }}>
          {footer}
        </div>
      ) : null}
      {/* The image gets forwarded far past the team group — this is how
          someone who receives it can find the app. */}
      <div style={{ display: "flex", marginTop: 16, fontSize: 26, color: "#38bdf8" }}>
        {SITE_HOST}
      </div>
    </div>
  );
}

// Today, long form, pinned to IST like lib/format.
export function shareDate(): string {
  return new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

type BalanceRow = { id: string; name: string; is_active: boolean; balance: number };

// The "who owes what" list shared by the team and tournament balance
// images: one column up to 15 rows, two beyond. Rows arrive pre-sorted.
export function balanceImageHeight(rows: number): number {
  const half = rows > 15 ? Math.ceil(rows / 2) : rows;
  return Math.min(2200, Math.max(900, 420 + Math.max(half, 1) * 60));
}

export function BalanceRows({ players }: { players: BalanceRow[] }) {
  const twoColumns = players.length > 15;
  const half = twoColumns ? Math.ceil(players.length / 2) : players.length;
  const columns = twoColumns
    ? [players.slice(0, half), players.slice(half)]
    : [players];
  return (
    <div style={{ display: "flex", gap: 40, marginTop: 32 }}>
      {players.length === 0 ? (
        <div style={{ display: "flex", fontSize: 28, color: "#94a3b8" }}>
          No players yet.
        </div>
      ) : null}
      {columns.map((col, ci) => (
        <div key={ci} style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          {col.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                fontSize: twoColumns ? 24 : 28,
                padding: "12px 0",
                borderBottom: "1px solid #1e293b",
                color: p.is_active ? "#e2e8f0" : "#64748b",
              }}
            >
              <div style={{ display: "flex", overflow: "hidden", whiteSpace: "nowrap" }}>
                {p.name.slice(0, 28)}
                {p.is_active ? "" : " · Left"}
              </div>
              <div
                style={{
                  display: "flex",
                  flexShrink: 0,
                  fontWeight: 700,
                  color: p.is_active ? moneyColor(p.balance) : "#64748b",
                }}
              >
                {balanceRupees(p.balance)}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
