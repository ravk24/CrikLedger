import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CrikLedger",
    short_name: "CrikLedger",
    description: "CrikLedger — cricket team fund & match fee ledger",
    start_url: "/",
    display: "standalone",
    background_color: "#eef2f7", // --color-background
    theme_color: "#0f172a", // --color-chrome
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
