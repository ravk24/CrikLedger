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
