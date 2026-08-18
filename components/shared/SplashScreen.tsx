"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const SPLASH_KEY = "cl-splash-shown";
const HOLD_MS = 1500;
const FADE_MS = 300;

// Page-order v1: the app icon holds for ~1.5s on the theme background at app
// start, then fades into the app. Shown once per browser session; on a
// same-session hard reload it hides as soon as React hydrates.
export function SplashScreen() {
  const [phase, setPhase] = useState<"hold" | "fade" | "gone">("hold");

  useEffect(() => {
    if (sessionStorage.getItem(SPLASH_KEY)) {
      setPhase("gone");
      return;
    }
    sessionStorage.setItem(SPLASH_KEY, "1");
    const fade = setTimeout(() => setPhase("fade"), HOLD_MS);
    const gone = setTimeout(() => setPhase("gone"), HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(fade);
      clearTimeout(gone);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity duration-300 ${
        phase === "fade" ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* The splash art carries the wordmark and tagline, and its corners
          are transparent (scripts/generate-icons.mjs lifts them), so it sits
          on either theme background without a white or black box. */}
      <Image src="/splash.png" alt="" width={200} height={200} priority />
    </div>
  );
}
