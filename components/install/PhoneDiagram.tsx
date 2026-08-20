import type { InstallStepId } from "./steps";

// The only hand-drawn artwork in the app — everything else is a lucide
// icon or a file in /public. Drawn inline for three reasons: it must
// follow the theme (a PNG cannot), it costs no request on a phone that
// may be on 3G, and the service worker is network-first, so an image
// here would be the one asset that fails to draw offline.
//
// THEME RULE: no hex, ever. Strokes are `currentColor` and the colour
// comes from the wrapper's text-* class; fill-* utilities cover the rest.
//
// The thing being pointed at is marked with an accent RING or an accent
// BORDER — never with an accent-light fill. accent-light is pale indigo
// in light mode but SATURATED indigo in dark, so anything drawn on it is
// legible in only one of the two themes. Row highlights use accent at
// 12% fill instead (accent is the same hex in both themes, so a tint
// stays a tint), and a solid accent button labels in accent-foreground,
// which is white in both.
//
// Geometry is fixed at 132x244 (a phone at roughly 9:16.5). The <svg> is
// sized by class, not attributes, so it scales inside the 380px design
// viewport without a media query.

const VIEW_BOX = "0 0 132 244";

// Outer phone shell + screen area, shared by every frame. Every frame
// then draws INSIDE x:12..120, y:20..224.
function PhoneShell() {
  return (
    <>
      <rect
        x="1"
        y="1"
        width="130"
        height="242"
        rx="16"
        className="fill-surface"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* speaker slot */}
      <rect x="52" y="9" width="28" height="3" rx="1.5" fill="currentColor" />
    </>
  );
}

// A row of "text" — the placeholder lines that stand in for page copy.
function TextLine({
  x,
  y,
  width,
  opacity = 0.5,
}: {
  x: number;
  y: number;
  width: number;
  opacity?: number;
}) {
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height="4"
      rx="2"
      fill="currentColor"
      opacity={opacity}
    />
  );
}

// Chrome's ⋮ overflow button.
function OverflowDots({ x, y }: { x: number; y: number }) {
  return (
    <>
      <circle cx={x} cy={y - 5} r="1.6" fill="currentColor" />
      <circle cx={x} cy={y} r="1.6" fill="currentColor" />
      <circle cx={x} cy={y + 5} r="1.6" fill="currentColor" />
    </>
  );
}

// iOS Share glyph: a box with an arrow rising out of the top.
function ShareGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <path d={`M${x - 5} ${y - 1} v7 h10 v-7`} />
      <path d={`M${x} ${y + 3} v-10`} />
      <path d={`M${x - 3} ${y - 7} l3 -3 l3 3`} />
    </g>
  );
}

// The CrikLedger tile as it appears on a home screen — a rounded square
// with the wordmark's "C" suggested by an arc, tinted with the accent.
function AppTile({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width="22" height="22" rx="6" className="fill-accent" />
      <path
        d={`M${x + 15} ${y + 7} a5.5 5.5 0 1 0 0 8`}
        className="stroke-accent-foreground"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </g>
  );
}

// A blank home-screen tile (the neighbours our icon lands among).
function EmptyTile({ x, y }: { x: number; y: number }) {
  return (
    <rect
      x={x}
      y={y}
      width="22"
      height="22"
      rx="6"
      fill="currentColor"
      opacity="0.15"
    />
  );
}

function AndroidOpen() {
  return (
    <>
      <PhoneShell />
      {/* URL bar */}
      <rect
        x="12"
        y="22"
        width="108"
        height="16"
        rx="8"
        fill="currentColor"
        opacity="0.1"
      />
      <TextLine x={20} y={28} width={56} opacity={0.55} />
      {/* the ⋮ the reader is being sent to */}
      <g className="text-accent">
        <circle
          cx="110"
          cy="30"
          r="11"
          className="stroke-accent"
          strokeWidth="1.8"
          fill="none"
        />
        <OverflowDots x={110} y={30} />
      </g>
      {/* page content */}
      <TextLine x={20} y={54} width={64} opacity={0.6} />
      <rect
        x="20"
        y="66"
        width="92"
        height="40"
        rx="6"
        fill="currentColor"
        opacity="0.1"
      />
      <TextLine x={20} y={116} width={92} />
      <TextLine x={20} y={126} width={72} />
      <TextLine x={20} y={136} width={84} />
    </>
  );
}

function AndroidMenu() {
  return (
    <>
      <PhoneShell />
      <rect
        x="12"
        y="22"
        width="108"
        height="16"
        rx="8"
        fill="currentColor"
        opacity="0.1"
      />
      <OverflowDots x={110} y={30} />
      {/* the dropped menu */}
      <rect
        x="44"
        y="44"
        width="76"
        height="96"
        rx="8"
        className="fill-surface"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <TextLine x={52} y={56} width={44} opacity={0.4} />
      <TextLine x={52} y={70} width={52} opacity={0.4} />
      {/* Add to Home screen — the row being pointed at */}
      <rect
        x="48"
        y="80"
        width="68"
        height="26"
        rx="6"
        className="fill-accent stroke-accent"
        fillOpacity="0.12"
        strokeWidth="1.4"
      />
      <TextLine x={54} y={87} width={54} opacity={0.85} />
      <TextLine x={54} y={96} width={36} opacity={0.6} />
      <TextLine x={52} y={116} width={48} opacity={0.4} />
      <TextLine x={52} y={128} width={40} opacity={0.4} />
    </>
  );
}

function AndroidConfirm() {
  return (
    <>
      <PhoneShell />
      <rect
        x="12"
        y="22"
        width="108"
        height="16"
        rx="8"
        fill="currentColor"
        opacity="0.1"
      />
      {/* dimmed page behind the dialog */}
      <TextLine x={20} y={50} width={80} opacity={0.15} />
      <TextLine x={20} y={60} width={64} opacity={0.15} />
      {/* the install dialog */}
      <rect
        x="16"
        y="86"
        width="100"
        height="76"
        rx="10"
        className="fill-surface"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <AppTile x={26} y={96} />
      <TextLine x={54} y={100} width={48} opacity={0.7} />
      <TextLine x={54} y={109} width={32} opacity={0.4} />
      <TextLine x={26} y={126} width={76} opacity={0.3} />
      {/* the Install button */}
      <rect x="66" y="138" width="40" height="16" rx="8" className="fill-accent" />
      <rect
        x="74"
        y="144"
        width="24"
        height="4"
        rx="2"
        className="fill-accent-foreground"
      />
    </>
  );
}

function IosOpen() {
  return (
    <>
      <PhoneShell />
      {/* Safari's URL bar sits at the TOP, its toolbar at the BOTTOM */}
      <rect
        x="12"
        y="22"
        width="108"
        height="14"
        rx="7"
        fill="currentColor"
        opacity="0.1"
      />
      <TextLine x={44} y={27} width={44} opacity={0.55} />
      <TextLine x={20} y={54} width={64} opacity={0.6} />
      <rect
        x="20"
        y="66"
        width="92"
        height="40"
        rx="6"
        fill="currentColor"
        opacity="0.1"
      />
      <TextLine x={20} y={116} width={92} />
      <TextLine x={20} y={126} width={72} />
      {/* bottom toolbar */}
      <path
        d="M8 196 h116"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.4"
      />
      <path
        d="M26 206 l-5 5 l5 5 M50 206 l5 5 l-5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.4"
      />
      {/* the Share button being pointed at */}
      <g className="text-accent">
        <circle
          cx="72"
          cy="211"
          r="12"
          className="stroke-accent"
          strokeWidth="1.8"
          fill="none"
        />
        <ShareGlyph x={72} y={212} />
      </g>
      <rect
        x="92"
        y="205"
        width="12"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        opacity="0.4"
      />
    </>
  );
}

function IosShareSheet() {
  return (
    <>
      <PhoneShell />
      <TextLine x={20} y={34} width={72} opacity={0.15} />
      <TextLine x={20} y={44} width={56} opacity={0.15} />
      {/* the share sheet slid up from the bottom */}
      <path
        d="M8 78 h116 v150 a12 12 0 0 1 -12 12 h-92 a12 12 0 0 1 -12 -12 z"
        className="fill-surface"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="56"
        y="84"
        width="20"
        height="3"
        rx="1.5"
        fill="currentColor"
        opacity="0.4"
      />
      {/* app row */}
      <circle cx="28" cy="106" r="9" fill="currentColor" opacity="0.15" />
      <circle cx="52" cy="106" r="9" fill="currentColor" opacity="0.15" />
      <circle cx="76" cy="106" r="9" fill="currentColor" opacity="0.15" />
      <circle cx="100" cy="106" r="9" fill="currentColor" opacity="0.15" />
      {/* action rows */}
      <TextLine x={20} y={128} width={52} opacity={0.35} />
      <TextLine x={20} y={144} width={44} opacity={0.35} />
      {/* Add to Home Screen — the row being pointed at */}
      <rect
        x="14"
        y="156"
        width="104"
        height="24"
        rx="6"
        className="fill-accent stroke-accent"
        fillOpacity="0.12"
        strokeWidth="1.4"
      />
      <TextLine x={20} y={166} width={62} opacity={0.85} />
      <g
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      >
        <rect x="98" y="163" width="12" height="12" rx="3" />
        <path d="M104 166 v6 M101 169 h6" />
      </g>
      <TextLine x={20} y={192} width={48} opacity={0.35} />
      <TextLine x={20} y={208} width={56} opacity={0.35} />
    </>
  );
}

function IosConfirm() {
  return (
    <>
      <PhoneShell />
      {/* the "Add to Home Screen" confirmation panel */}
      <rect
        x="10"
        y="60"
        width="112"
        height="96"
        rx="10"
        className="fill-surface"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* Cancel (left) / Add (right) header */}
      <TextLine x={18} y={70} width={22} opacity={0.4} />
      <rect x="90" y="64" width="24" height="14" rx="7" className="fill-accent" />
      <rect
        x="96"
        y="69"
        width="12"
        height="4"
        rx="2"
        className="fill-accent-foreground"
      />
      <path
        d="M10 86 h112"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.3"
      />
      <AppTile x={20} y={96} />
      <rect
        x="50"
        y="98"
        width="60"
        height="16"
        rx="4"
        fill="currentColor"
        opacity="0.1"
      />
      <TextLine x={56} y={104} width={40} opacity={0.6} />
      <TextLine x={20} y={130} width={92} opacity={0.25} />
      <TextLine x={20} y={140} width={68} opacity={0.25} />
    </>
  );
}

// Shared by both platforms: the payoff frame.
function HomeScreen() {
  return (
    <>
      <PhoneShell />
      <EmptyTile x={20} y={40} />
      <EmptyTile x={55} y={40} />
      <EmptyTile x={90} y={40} />
      <EmptyTile x={20} y={78} />
      {/* the freshly added CrikLedger icon */}
      <AppTile x={55} y={78} />
      <rect
        x="52"
        y="104"
        width="28"
        height="4"
        rx="2"
        className="fill-accent"
      />
      <EmptyTile x={90} y={78} />
      <EmptyTile x={20} y={116} />
      <EmptyTile x={55} y={116} />
      <EmptyTile x={90} y={116} />
      {/* dock */}
      <rect
        x="14"
        y="188"
        width="104"
        height="40"
        rx="14"
        fill="currentColor"
        opacity="0.1"
      />
      <EmptyTile x={24} y={197} />
      <EmptyTile x={55} y={197} />
      <EmptyTile x={86} y={197} />
    </>
  );
}

const FRAMES: Record<InstallStepId, () => React.JSX.Element> = {
  "android-open": AndroidOpen,
  "android-menu": AndroidMenu,
  "android-confirm": AndroidConfirm,
  "android-done": HomeScreen,
  "ios-open": IosOpen,
  "ios-share": IosShareSheet,
  "ios-confirm": IosConfirm,
  "ios-done": HomeScreen,
};

/**
 * One illustrated phone frame for one install step.
 *
 * `alt` is what a screen reader hears — the step's own text already says
 * what to do, so keep this to what the PICTURE shows ("Chrome with the
 * three-dot menu button circled"), not a repeat of the instruction.
 */
export function PhoneDiagram({
  step,
  alt,
}: {
  step: InstallStepId;
  alt: string;
}) {
  const Frame = FRAMES[step];

  return (
    <div className="flex justify-center rounded-lg border border-border bg-surface-secondary p-3">
      <svg
        viewBox={VIEW_BOX}
        role="img"
        aria-label={alt}
        className="h-44 w-auto text-text-muted"
      >
        <Frame />
      </svg>
    </div>
  );
}
