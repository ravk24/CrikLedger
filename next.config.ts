import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Dev-only: lets phones on the LAN load dev assets (has no effect on prod builds)
  allowedDevOrigins: ["192.168.29.175"],
  // Reverse proxy for PostHog so ad blockers don't drop analytics events.
  // Kept out of proxy.ts on purpose — its matcher would run the JWT check on ingest.
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://us-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  // PostHog API requests can carry trailing slashes
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
