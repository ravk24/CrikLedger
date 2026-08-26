import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // A stable identity so a re-deploy or a changed start_url never
    // registers as a second app on the home screen.
    id: "/",
    scope: "/",
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
    // Long-press shortcuts on the installed icon: the two screens a
    // member opens most.
    shortcuts: [
      {
        name: "Team fund",
        short_name: "Fund",
        url: "/pool",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Schedule",
        short_name: "Schedule",
        url: "/schedule",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
