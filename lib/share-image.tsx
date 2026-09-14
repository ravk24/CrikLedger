import { SITE_HOST } from "@/lib/site";

// Shared frame for every PNG the app hands to the share sheet (match
// sheet, ledger, player balances). Rendered by satori via next/og, which
// ignores CSS classes — every style in here must stay inline.
//
// 720 px wide since 2026-08-26 (performance plan v2, D9): WhatsApp
// downscales anything wider, and satori + resvg cost scales with pixel
// count (720² is 44 % of 1080²). Every size below is the old 1080-space
// value × ⅔ — the picture is the same, just not rendered oversize.
// (A transform: scale() wrapper was tried first; satori drops nested
// <svg> and <img> under a transformed parent, so the constants moved.)

export const SHARE_WIDTH = 720;

// Eyebrow on every share image. Ravi 2026-09-14: carry the author's name
// so a forwarded picture credits him, like CopyrightBar does on screen.
export const SHARE_BRAND = "CrikLedger - by Ravi Kant";

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
  // Fund total shown as an amber pill under the title — the one number a
  // screengrab must not lose (team pool / tournament fund).
  highlight?: { label: string; amount: number };
  children: React.ReactNode;
  footer?: string;
};

export function ShareFrame({ title, subtitle, highlight, children, footer }: FrameProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0f172a",
        color: "#f8fafc",
        padding: 37,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", fontSize: 17, color: "#38bdf8", letterSpacing: 1 }}>
        {SHARE_BRAND}
      </div>
      <div style={{ display: "flex", fontSize: 35, fontWeight: 700, marginTop: 8 }}>
        {title}
      </div>
      {subtitle ? (
        <div style={{ display: "flex", fontSize: 17, color: "#94a3b8", marginTop: 5 }}>
          {subtitle}
        </div>
      ) : null}
      {highlight ? (
        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            alignItems: "center",
            gap: 8,
            marginTop: 12,
            padding: "6px 14px",
            borderRadius: 999,
            backgroundColor: "#facc15",
            color: "#0f172a",
          }}
        >
          {/* satori ignores textTransform, so uppercase in JS. */}
          <div style={{ display: "flex", fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>
            {highlight.label.toUpperCase()}
          </div>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 700 }}>
            {balanceRupees(highlight.amount)}
          </div>
        </div>
      ) : null}

      {children}

      {footer ? (
        <div style={{ display: "flex", marginTop: "auto", fontSize: 16, color: "#94a3b8" }}>
          {footer}
        </div>
      ) : null}
      {/* The image gets forwarded far past the team group — this is how
          someone who receives it can find the app. */}
      <div
        style={{
          display: "flex",
          // Without a footer this line is what pins to the bottom edge.
          marginTop: footer ? 11 : "auto",
          fontSize: 17,
          color: "#38bdf8",
        }}
      >
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
// The base covers frame chrome plus the ~50 px fund-total pill.
export function balanceImageHeight(rows: number): number {
  const half = rows > 15 ? Math.ceil(rows / 2) : rows;
  return Math.min(1467, Math.max(600, 330 + Math.max(half, 1) * 40));
}

export function BalanceRows({ players }: { players: BalanceRow[] }) {
  const twoColumns = players.length > 15;
  const half = twoColumns ? Math.ceil(players.length / 2) : players.length;
  const columns = twoColumns
    ? [players.slice(0, half), players.slice(half)]
    : [players];
  return (
    <div style={{ display: "flex", gap: 27, marginTop: 21 }}>
      {players.length === 0 ? (
        <div style={{ display: "flex", fontSize: 19, color: "#94a3b8" }}>
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
                gap: 11,
                fontSize: twoColumns ? 16 : 19,
                padding: "8px 0",
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
