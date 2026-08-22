import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { z } from "zod";
import { SITE_HOST } from "@/lib/site";

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
  // Accepted for compatibility but no longer drawn: the base-fee /
  // car-share headline confused readers, the per-person rows are the
  // only numbers that matter on the shared sheet.
  perPlayerFee: z.number().finite().optional(),
  carSharePerSharer: z.number().finite().optional(),
  sharerCount: z.number().int().nonnegative().optional(),
  totalCost: z.number().finite(),
  surplus: z.number().finite(),
  rows: z.array(rowSchema).min(1).max(30),
  captainNote: z.string().trim().max(80).optional(),
});

// satori has no icon runtime, so the car mark is drawn inline. Same
// glyph as lucide-react's <Car>, which is what the app shows on screen.
function CarMark() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#38bdf8"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ marginLeft: 8 }}
    >
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <path d="M9 17h6" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  );
}

const rupees = (n: number) =>
  Math.abs(Math.round(n)).toLocaleString("en-IN");

// The route is unauthenticated (the guest sample has no session), and
// rendering a PNG is CPU-heavy, so each client gets a small bucket per
// minute. In-memory is enough: a function instance serves one region,
// and the worst case of a cold instance is a fresh bucket.
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const buckets = new Map<string, { count: number; resetAt: number }>();

function rateLimited(req: NextRequest): boolean {
  const key = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT;
}

export async function POST(req: NextRequest) {
  if (rateLimited(req)) {
    return new Response("Too many requests", {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }
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
  const height = Math.min(1600, Math.max(760, 380 + half * 56));

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
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      color: "#e2e8f0",
                    }}
                  >
                    {r.name}
                    {r.broughtCar ? <CarMark /> : null}
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

        {data.captainNote ? (
          <div style={{ display: "flex", marginTop: 20, fontSize: 24, color: "#94a3b8" }}>
            {data.captainNote}
          </div>
        ) : null}

        <div style={{ display: "flex", marginTop: "auto", fontSize: 24, color: "#94a3b8" }}>
          Ground ₹{rupees(data.groundFee)} · Balls ₹{rupees(data.ballFee)}
          {data.otherFee > 0 ? ` · Other ₹${rupees(data.otherFee)}` : ""} ·
          Total ₹{rupees(data.totalCost)}
          {data.surplus > 0 ? ` · Surplus ₹${rupees(data.surplus)}` : ""}
        </div>

        {/* The image gets forwarded far past the team group — this is how
            someone who receives it can find the app. */}
        <div
          style={{
            display: "flex",
            marginTop: 16,
            fontSize: 26,
            color: "#38bdf8",
          }}
        >
          {SITE_HOST}
        </div>
      </div>
    ),
    { width: 1080, height },
  );
}
