import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { z } from "zod";
import { SHARE_WIDTH } from "@/lib/share-image";
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
  isCaptain: z.boolean().default(false),
  isViceCaptain: z.boolean().default(false),
  isGuest: z.boolean().default(false),
});

const payloadSchema = z.object({
  team: z.string().trim().min(1).max(60),
  opponent: z.string().trim().min(1).max(60),
  venue: z.string().trim().max(80).optional(),
  date: z.string().trim().max(60),
  groundFee: z.number().finite(),
  ballFee: z.number().finite(),
  otherFee: z.number().finite(),
  // Footer figures, straight from engine/calc.ts: "Per head" is the base
  // share plus the car share. Anyone who made their own way is visible
  // from their row, so the image does not spell that out (Ravi
  // 2026-08-25); the on-screen previews still do.
  perPlayerFee: z.number().finite().optional(),
  carSharePerSharer: z.number().finite().default(0),
  sharerCount: z.number().int().nonnegative().optional(),
  carAllowancePerCar: z.number().finite().default(0),
  carCount: z.number().int().nonnegative().default(0),
  totalCost: z.number().finite(), // cash + cars
  surplus: z.number().finite(), // collected − cash costs
  rows: z.array(rowSchema).min(1).max(30),
});

// satori has no icon runtime, so the car mark is drawn inline. Same
// glyph as lucide-react's <Car>, which is what the app shows on screen.
function CarMark() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#38bdf8"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ marginLeft: 5 }}
    >
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <path d="M9 17h6" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  );
}

// Crown + gold "C", the same mark components/shared/CaptainMark draws
// on screen (lucide <Crown> path, app/globals.css gold tokens).
function CaptainMark() {
  return (
    <div style={{ display: "flex", alignItems: "center", marginLeft: 5 }}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ca8a04"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
        <path d="M5 21h14" />
      </svg>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 16,
          height: 16,
          borderRadius: 8,
          marginLeft: 3,
          backgroundColor: "#fef08a",
          color: "#713f12",
          fontSize: 9,
          fontWeight: 700,
        }}
      >
        C
      </div>
    </div>
  );
}

// Medal + silver "VC", the same mark components/shared/ViceCaptainMark
// draws on screen (lucide <Medal> path, app/globals.css silver tokens).
// The medal stroke is one step lighter than the --color-silver token:
// #6b7280 vanishes against the navy card.
function ViceCaptainMark() {
  return (
    <div style={{ display: "flex", alignItems: "center", marginLeft: 5 }}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#9ca3af"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15" />
        <path d="M11 12 5.12 2.2" />
        <path d="m13 12 5.88-9.8" />
        <path d="M8 7h8" />
        <circle cx="12" cy="17" r="5" />
        <path d="M12 18v-2h-.5" />
      </svg>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 16,
          minWidth: 16,
          padding: "0 4px",
          borderRadius: 8,
          marginLeft: 3,
          backgroundColor: "#e5e7eb",
          color: "#374151",
          fontSize: 8,
          fontWeight: 700,
        }}
      >
        VC
      </div>
    </div>
  );
}

// A guest is "an added person": lucide <UserRoundPlus> in the footer's
// muted slate. No word after the name — "(guest)" read badly in the
// group (Ravi 2026-09-14).
function GuestMark() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#94a3b8"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ marginLeft: 5 }}
    >
      <path d="M2 21a8 8 0 0 1 13.292-6" />
      <circle cx="10" cy="8" r="5" />
      <path d="M19 16v6" />
      <path d="M22 19h-6" />
    </svg>
  );
}

const rupees = (n: number) =>
  Math.abs(Math.round(n)).toLocaleString("en-IN");
// "₹5" to pay; "gets ₹53" when the team owes them. Never a bare sign —
// "+₹53" read as "pays 53 more" (lib/format.ts formatFee, inlined
// because satori renders this file without the app's helpers).
const fee = (n: number) => (n < 0 ? `gets ₹${rupees(n)}` : `₹${rupees(n)}`);

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
  // as mostly empty space, and crops a large squad. 720-space, like
  // lib/share-image.tsx (the old 1080 formula × ⅔).
  const height = Math.min(1067, Math.max(507, 253 + half * 37));

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
          padding: 37,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 17, color: "#38bdf8", letterSpacing: 1 }}>
          CRIKLEDGER
        </div>

        <div style={{ display: "flex", fontSize: 37, fontWeight: 700, marginTop: 8 }}>
          {data.team} vs {data.opponent}
        </div>
        <div style={{ display: "flex", fontSize: 17, color: "#94a3b8", marginTop: 5 }}>
          {[data.venue, data.date].filter(Boolean).join(" · ")}
        </div>

        <div style={{ display: "flex", gap: 27, marginTop: 21 }}>
          {columns.map((col, ci) => (
            <div key={ci} style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              {col.map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 17,
                    padding: "7px 0",
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
                    {r.isCaptain ? <CaptainMark /> : null}
                    {r.isViceCaptain ? <ViceCaptainMark /> : null}
                    {r.broughtCar ? <CarMark /> : null}
                    {r.isGuest ? <GuestMark /> : null}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      color: r.fee < 0 ? "#4ade80" : "#f8fafc",
                    }}
                  >
                    {fee(r.fee)}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", marginTop: "auto", fontSize: 16, color: "#94a3b8" }}>
          Ground ₹{rupees(data.groundFee)} · Balls ₹{rupees(data.ballFee)}
          {data.otherFee > 0 ? ` · Other ₹${rupees(data.otherFee)}` : ""}
          {data.carCount > 0 && data.carAllowancePerCar > 0
            ? ` · Cars ${data.carCount} × ₹${rupees(data.carAllowancePerCar)}`
            : ""}{" "}
          · Total ₹{rupees(data.totalCost)}
          {data.perPlayerFee !== undefined
            ? ` · Per head ₹${rupees(data.perPlayerFee + data.carSharePerSharer)}`
            : ""}
          {data.surplus > 0 ? ` · Surplus ₹${rupees(data.surplus)}` : ""}
        </div>

        {/* The image gets forwarded far past the team group — this is how
            someone who receives it can find the app. */}
        <div
          style={{
            display: "flex",
            marginTop: 11,
            fontSize: 17,
            color: "#38bdf8",
          }}
        >
          {SITE_HOST}
        </div>
      </div>
    ),
    { width: SHARE_WIDTH, height },
  );
}
