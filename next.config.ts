import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // The only images are /logo.png (10 KB, already 64×64) and the PWA
  // icons the browser fetches itself. With nothing left for the
  // optimizer to do, turning it off removes the /_next/image function
  // hop from every page that shows the mark.
  images: { unoptimized: true },
  // ExcelJS (the ledger export) is CommonJS with a `browser` field and
  // stream-heavy deps; leave it to Node's require rather than bundling
  // its browser build into the route.
  serverExternalPackages: ["exceljs"],
  // Dev-only: lets phones on the LAN load dev assets (has no effect on prod builds)
  allowedDevOrigins: ["192.168.29.175"],
};

export default nextConfig;
