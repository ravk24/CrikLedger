import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { RegisterSW } from "@/components/shared/RegisterSW";
import { CopyrightBar } from "@/components/shared/CopyrightBar";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  // Absolute base for og:image / twitter:image — without it Next falls
  // back to VERCEL_URL (the per-deployment host), so a WhatsApp preview
  // could point at a preview deployment.
  metadataBase: new URL(SITE_URL),
  title: "CrikLedger",
  description: "CrikLedger — cricket team fund & match fee ledger",
  appleWebApp: {
    capable: true,
    title: "CrikLedger",
    statusBarStyle: "default",
  },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  // Single value: the app is light-only (the dark tokens and the theme
  // switcher were removed 2026-08-22; next-themes went with them on
  // 2026-08-26 — there is no .dark rule left for a stale class to hit).
  themeColor: "#0f172a", // --color-chrome: the status bar continues the navy header
  // Without viewport-fit=cover, env(safe-area-inset-*) is 0 on iOS and
  // the fixed tab bar sits under the home indicator in standalone mode
  // (globals.css pb-safe, lib/ui.ts FAB offset).
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        {children}
        <CopyrightBar />
        <RegisterSW />
      </body>
    </html>
  );
}
