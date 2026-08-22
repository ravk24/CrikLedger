import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { RegisterSW } from "@/components/shared/RegisterSW";
import { CopyrightBar } from "@/components/shared/CopyrightBar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
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
  // Single value while the app is forced to light (see ThemeProvider below).
  themeColor: "#0f172a", // --color-chrome: the status bar continues the navy header
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        {/* Light only. The dark tokens and the theme switcher were removed
            2026-08-22; forcedTheme keeps any stale localStorage "theme" from
            adding a .dark class that no longer styles anything. */}
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          forcedTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <CopyrightBar />
          <RegisterSW />
        </ThemeProvider>
      </body>
    </html>
  );
}
