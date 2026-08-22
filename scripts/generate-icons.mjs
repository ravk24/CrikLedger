// Generates every app icon + the splash from the brand masters.
//
// Committed and repeatable on purpose: the masters are flat PNGs with no
// layered source, so "how did we get icon-192" should be answerable by
// reading this file rather than by remembering what someone exported.
//
// The masters are RGB with NO alpha — the icon's surround is pure black
// and the splash's is white. Dropped in as-is, the icon renders as a
// black square on a light home screen. Rather than guess the badge's
// corner radius (it is a squircle, not a circular radius — the curve
// runs ~230px on a ~1100px side), we FLOOD FILL the surround inward from
// the border. That reproduces the real silhouette exactly, whatever its
// shape, and stops at the first pixel that is not background.
//
// Usage: node scripts/generate-icons.mjs [outDirOverride]
//   with no argument it writes to public/ and app/ in place.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "Project Details", "cric_ledger", "Support_imgs");
const ICON = join(SRC, "crikledger-icon.png");
const SPLASH = join(SRC, "crikledger-splash.png");

// Passed a directory => write everything there instead (for review).
const override = process.argv[2] ? resolve(process.argv[2]) : null;
const out = (rel) => {
  const p = override ? join(override, rel.replace(/[\\/]/g, "_")) : join(ROOT, rel);
  mkdirSync(dirname(p), { recursive: true });
  return p;
};

/**
 * Cut the flat surround away to transparency and crop to the artwork.
 *
 * @param file    master PNG
 * @param isBg    (r,g,b) => boolean — what counts as surround
 */
async function liftArtwork(file, isBg) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const at = (x, y) => (y * W + x) * C;

  // Flood fill inward from every border pixel. Only surround connected to
  // the edge is removed, so a black pixel INSIDE the artwork survives.
  const bg = new Uint8Array(W * H);
  const stack = [];
  const push = (x, y) => {
    const k = y * W + x;
    if (bg[k]) return;
    const i = at(x, y);
    if (!isBg(data[i], data[i + 1], data[i + 2])) return;
    bg[k] = 1;
    stack.push(x, y);
  };
  for (let x = 0; x < W; x++) {
    push(x, 0);
    push(x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    push(0, y);
    push(W - 1, y);
  }
  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    if (x > 0) push(x - 1, y);
    if (x < W - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < H - 1) push(x, y + 1);
  }

  // Alpha from the mask, and the artwork's bounding box.
  let minX = W, minY = H, maxX = 0, maxY = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = y * W + x;
      if (bg[k]) {
        data[at(x, y) + 3] = 0;
      } else {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const lifted = sharp(data, { raw: { width: W, height: H, channels: C } })
    .extract({
      left: minX,
      top: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    })
    .png();

  return { buffer: await lifted.toBuffer(), box: { minX, minY, maxX, maxY } };
}

// The icon's surround is pure black; the badge's own darkest navy is far
// lighter than this threshold, so nothing of the art is keyed out.
const blackBg = (r, g, b) => r < 40 && g < 40 && b < 40;
// The splash sits on white.
const whiteBg = (r, g, b) => r > 235 && g > 235 && b > 235;

const square = (buf, size) =>
  sharp(buf)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ palette: true, quality: 90, compressionLevel: 9, effort: 10 })
    .toBuffer();

async function main() {
  const icon = await liftArtwork(ICON, blackBg);
  const splash = await liftArtwork(SPLASH, whiteBg);
  console.log("icon artwork box  :", icon.box);
  console.log("splash artwork box:", splash.box);

  // Transparent-cornered icons, every size the app references.
  const targets = [
    ["public/icon-512.png", 512],
    ["public/logo.png", 128], // same art; rendered at 16-64px in the header
    ["public/icon-192.png", 192],
    ["public/apple-touch-icon.png", 180],
    ["app/icon.png", 64],
  ];
  for (const [rel, size] of targets) {
    writeFileSync(out(rel), await square(icon.buffer, size));
    console.log("wrote", rel, size + "px");
  }

  // Maskable is the exception: Android crops it to its own shape, so it
  // must be FULL BLEED with the art inside the ~80% safe zone. Padding
  // colour is sampled from the badge so the bleed is invisible.
  const { data: px } = await sharp(icon.buffer)
    .resize(8, 8, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const navy = { r: px[0], g: px[1], b: px[2] };
  const SAFE = 410; // 80% of 512
  const inner = await sharp(icon.buffer)
    .resize(SAFE, SAFE, { fit: "contain", background: { ...navy, alpha: 0 } })
    .toBuffer();
  writeFileSync(
    out("public/icon-512-maskable.png"),
    await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 4,
        background: { ...navy, alpha: 1 },
      },
    })
      .composite([{ input: inner, gravity: "centre" }])
      .png({ palette: true, quality: 90, compressionLevel: 9, effort: 10 })
      .toBuffer(),
  );
  console.log("wrote public/icon-512-maskable.png 512px (bleed rgb", navy, ")");

  // The splash asset is no longer shipped (nothing references it); the
  // master is still lifted above so the review dir shows it.
  void splash;
}

main();
