"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PhoneDiagram } from "./PhoneDiagram";
import { INSTALL_STEPS, PLATFORM_LABELS, type Platform } from "./steps";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
};

const PLATFORMS: Platform[] = ["android", "ios"];

/**
 * The Android/iOS install walkthrough — the whole of the Home page for a
 * visitor without a Ledger, and the whole of /install for everyone else.
 *
 * The two platform buttons are the control; the user-agent sniff below
 * only picks which one starts selected. That order matters: an iPhone
 * user reading over someone's shoulder on Android must still be able to
 * get at their own steps, so nothing here is ever hidden by detection.
 *
 * Detection mirrors components/dashboard/InstallNudge.tsx — same
 * standalone test, same beforeinstallprompt capture. Kept as two small
 * copies rather than a shared hook while there are only two callers.
 */
export function InstallGuide() {
  // "android" on the server AND on the first client render — the sniff
  // lands in the effect below, so there is nothing to mismatch.
  const [platform, setPlatform] = useState<Platform>("android");
  const [installed, setInstalled] = useState(false);
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) setPlatform("ios");

    setInstalled(
      window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in navigator &&
          (navigator as { standalone?: boolean }).standalone === true),
    );

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    setInstallEvent(null);
  }

  if (installed) {
    return (
      <section className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4">
        <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-credit" />
        <div>
          <p className="text-sm font-semibold text-text-primary">
            CrikLedger is installed
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            You are running it from your home screen already — nothing left
            to do.
          </p>
        </div>
      </section>
    );
  }

  const steps = INSTALL_STEPS[platform];

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
      <div>
        <h2 className="text-base font-semibold text-text-primary">
          Install CrikLedger on your phone
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          CrikLedger is a Progressive Web App (PWA). There is nothing to
          download from the Play Store or the App Store — add it to your home
          screen and it gets its own icon and opens full screen, just like any
          other app.
        </p>
      </div>

      {/* Pick your phone. Same 2-up segmented control as CreditSheet. */}
      <div>
        <p className="mb-2 text-xs font-medium text-text-secondary">
          Which phone do you have?
        </p>
        <div className="grid grid-cols-2 gap-2">
          {PLATFORMS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={platform === value}
              onClick={() => setPlatform(value)}
              className={cn(
                "h-11 rounded-md border text-sm font-medium",
                platform === value
                  ? "border-accent bg-accent-light text-accent"
                  : "border-border bg-surface text-text-secondary",
              )}
            >
              {PLATFORM_LABELS[value]}
            </button>
          ))}
        </div>
      </div>

      {/* Chrome only ever offers this on Android; when it has, the one-tap
          path beats four screenshots, so it goes above them. */}
      {platform === "android" && installEvent && (
        <div className="rounded-lg border border-accent-light bg-surface-secondary p-3">
          <p className="text-sm text-text-secondary">
            Your browser can do this for you in one tap.
          </p>
          <button
            type="button"
            onClick={install}
            className="mt-2 h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-foreground"
          >
            Install CrikLedger
          </button>
          <p className="mt-2 text-xs text-text-muted">
            Or follow the steps below by hand.
          </p>
        </div>
      )}

      <ol className="flex flex-col gap-5">
        {steps.map((step, i) => (
          <li key={step.id} className="flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-light text-xs font-bold text-accent">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary">
                  {step.title}
                </p>
                <p className="mt-0.5 text-sm text-text-secondary">
                  {step.body}
                </p>
              </div>
            </div>
            <PhoneDiagram step={step.id} alt={step.alt} />
          </li>
        ))}
      </ol>

      <p className="text-xs text-text-muted">
        Installing costs nothing and uses no extra storage worth speaking of —
        it is the same site, in its own window.
      </p>
    </section>
  );
}
