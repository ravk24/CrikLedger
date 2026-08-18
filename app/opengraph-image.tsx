import { ImageResponse } from "next/og";

// The social card, generated rather than exported.
//
// It used to be two byte-identical 423 KB PNGs (opengraph-image.png and
// twitter-image.png) with the wordmark baked into the pixels — which is
// exactly why the CricLedger -> CrikLedger rename could not reach them.
// Rendering it here means the name lives in code and can never drift
// from the app again. Next serves the Twitter card from this too, so the
// duplicate file is gone as well.
//
// Same next/og pattern as app/api/share/match-sheet/route.tsx.

export const alt = "CrikLedger — cricket team fund & match fee ledger";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Wordmark palette (public/wordmark-*.svg): navy + green, split across
// the two halves of the name.
const NAVY = "#1e3a6e";
const GREEN = "#2e7d32";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 132, fontWeight: 900 }}>
          <span style={{ color: NAVY }}>Crik</span>
          <span style={{ color: GREEN }}>Ledger</span>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 4,
            fontSize: 34,
            letterSpacing: 2,
            color: NAVY,
          }}
        >
          Every Rupee. Accounted.
        </div>

        {/* Echoes the swoosh under the wordmark in the SVG. */}
        <div
          style={{
            display: "flex",
            width: 620,
            height: 8,
            marginTop: 36,
            borderRadius: 4,
            backgroundColor: GREEN,
          }}
        />

        <div
          style={{
            display: "flex",
            marginTop: 44,
            fontSize: 30,
            color: "#5b6472",
          }}
        >
          Match fees, car allowances and the team pool — worked out for you.
        </div>
      </div>
    ),
    size,
  );
}
