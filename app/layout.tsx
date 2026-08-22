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
  themeColor: "#4f46e5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        {/* Dark theme is intentionally disabled, not removed: the `.dark`
            tokens in globals.css and components/theme-switcher.tsx are kept.
            `forcedTheme` also overrides any stored localStorage "theme". To
            re-enable, drop forcedTheme, set defaultTheme="system",
            enableSystem, and render <ThemeSwitcher /> in AppHeader again. */}
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
