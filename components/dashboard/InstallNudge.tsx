"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";

const LEGACY_DISMISS_KEY = "cl-install-nudge-dismissed"; // v0 flag, cleared
const SESSION_DISMISS_KEY = "cl-install-nudge-hidden";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
};

// PWA install nudge (PWA tasks doc, Task 5). Visible on every visit
// until the app is installed (standalone); dismissing hides it for the
// current session only. iOS has no prompt API, so it gets a link to the
// illustrated walkthrough at /install — same fallback when Chrome hasn't
// offered beforeinstallprompt. A one-line hint used to sit here instead;
// it told you the answer but had nowhere to send you when it was wrong.
export function InstallNudge() {
  const [show, setShow] = useState(false);
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    localStorage.removeItem(LEGACY_DISMISS_KEY);
    if (sessionStorage.getItem(SESSION_DISMISS_KEY)) return;

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator &&
        (navigator as { standalone?: boolean }).standalone === true);
    if (isStandalone) return;

    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setShow(true);

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
    setShow(false);
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-accent-light bg-surface p-3">
      <Image
        src="/icon-192.png"
        alt=""
        className="size-9 rounded-md"
        width={36}
        height={36}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text-primary">
          Add CrikLedger to your home screen
        </p>
        {installEvent ? (
          <button
            type="button"
            onClick={install}
            className="mt-1 rounded-md bg-accent px-3 py-1 text-xs font-medium text-accent-foreground"
          >
            Install
          </button>
        ) : (
          <p className="text-xs text-text-secondary">
            {isIos
              ? "Share → Add to Home Screen · "
              : "Browser menu (⋮) → Add to Home screen · "}
            <Link
              href="/install"
              className="font-medium text-accent underline underline-offset-2"
            >
              Show me
            </Link>
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 p-2 text-text-muted"
      >
        <X size={16} />
      </button>
    </div>
  );
}
