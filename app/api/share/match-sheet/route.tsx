import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { z } from "zod";

// Renders a match sheet as a PNG for the share sheet / WhatsApp.
//
// Touches NO database and NO cookies, which is how guest mode's
// "nothing is ever written" guarantee holds structurally rather than by
// discipline. It is also unauthenticated and CPU-heavy, so the payload
// is capped tightly here and it belongs on Feature 7's rate-limit list.
const rowSchema = z.object({
  name: z.string().trim().min(1).max(40),
  fee: z.number().finite(),
  broughtCar: z.boolean(),
});

const payloadSchema = z.object({
  team: z.string().trim().min(1).max(60),
  opponent: z.string().trim().min(1).max(60),
  venue: z.string().trim().max(80).optional(),
  date: z.string().trim().max(60),
  groundFee: z.number().finite(),
  ballFee: z.number().finite(),
  otherFee: z.number().finite(),
  perPlayerFee: z.number().finite(),
  totalCost: z.number().finite(),
  surplus: z.number().finite(),
  rows: z.array(rowSchema).min(1).max(30),
});

const rupees = (n: number) =>
  Math.abs(Math.round(n)).toLocaleString("en-IN");

export async function POST(req: NextRequest) {
  let data: z.infer<typeof payloadSchema>;
  try {
    data = payloadSchema.parse(await req.json());
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  // satori ignores CSS classes — every style here must be inline.
  const half = Math.ceil(data.rows.length / 2);
  const columns = [data.rows.slice(0, half), data.rows.slice(half)];

  // Height follows the roster: a fixed canvas leaves a two-player match
  // as mostly empty space, and crops a large squad.
  const height = Math.min(1600, Math.max(940, 560 + half * 56));

  return new ImageResponse(
    (
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

        <div style={{ display: "flex", fontSize: 56, fontWeight: 700, marginTop: 12 }}>
          {data.team} vs {data.opponent}
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#94a3b8", marginTop: 8 }}>
          {[data.venue, data.date].filter(Boolean).join(" · ")}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            backgroundColor: "#1e293b",
            borderRadius: 20,
            padding: "26px 0",
            marginTop: 32,
          }}
        >
          <div style={{ display: "flex", fontSize: 24, color: "#94a3b8" }}>
            Fee per player
          </div>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, marginTop: 4 }}>
            ₹{rupees(data.perPlayerFee)}
          </div>
        </div>

        <div style={{ display: "flex", gap: 40, marginTop: 32 }}>
          {columns.map((col, ci) => (
            <div key={ci} style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              {col.map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 26,
                    padding: "10px 0",
                    borderBottom: "1px solid #1e293b",
                  }}
                >
                  <div style={{ display: "flex", color: "#e2e8f0" }}>
                    {r.name}
                    {r.broughtCar ? " · car" : ""}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      color: r.fee < 0 ? "#4ade80" : "#f8fafc",
                    }}
                  >
                    {r.fee < 0 ? "+" : ""}₹{rupees(r.fee)}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", marginTop: "auto", fontSize: 24, color: "#94a3b8" }}>
          Ground ₹{rupees(data.groundFee)} · Balls ₹{rupees(data.ballFee)}
          {data.otherFee > 0 ? ` · Other ₹${rupees(data.otherFee)}` : ""} ·
          Total ₹{rupees(data.totalCost)}
          {data.surplus > 0 ? ` · Surplus ₹${rupees(data.surplus)}` : ""}
        </div>
      </div>
    ),
    { width: 1080, height },
  );
}
