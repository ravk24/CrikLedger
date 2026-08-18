import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { RegisterSW } from "@/components/shared/RegisterSW";
import { CopyrightBar } from "@/components/shared/CopyrightBar";
import { SplashScreen } from "@/components/shared/SplashScreen";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "CricLedger",
  description: "CricLedger — cricket team fund & match fee ledger",
  appleWebApp: {
    capable: true,
    title: "CricLedger",
    statusBarStyle: "default",
  },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#4f46e5" },
    { media: "(prefers-color-scheme: dark)", color: "#17181b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SplashScreen />
          {children}
          <CopyrightBar />
          <RegisterSW />
        </ThemeProvider>
      </body>
    </html>
  );
}
