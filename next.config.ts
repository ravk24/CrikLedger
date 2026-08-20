import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Dev-only: lets phones on the LAN load dev assets (has no effect on prod builds)
  allowedDevOrigins: ["192.168.29.175"],
};

export default nextConfig;
