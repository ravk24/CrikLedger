"use client";

import { useEffect } from "react";

// Registers /sw.js and keeps an installed app on the current build.
//
// - Registration waits for the window `load` event so it never competes
//   with hydration and the first RSC stream on a slow phone.
// - The worker is asked to check for a new version every time the app
//   comes back to the foreground; a PWA that is never fully closed would
//   otherwise run stale client JS (old fee-preview logic, say) for days.
//   Money is never stale — every page streams fresh data — but logic can
//   be, and that is what this closes.
// - When a NEW worker takes over an already-controlled page, the page
//   reloads to pick up the matching chunks — unless a sheet or wizard is
//   open, in which case the reload waits for the next return to the
//   foreground so it can never eat a half-filled form. The first-ever
//   install (no previous controller) never reloads.
export function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const sw = navigator.serviceWorker;
    const hadController = !!sw.controller;
    let reloadPending = false;
    let registration: ServiceWorkerRegistration | null = null;

    const formInProgress = () =>
      !!document.querySelector('[role="dialog"]') ||
      !!document.querySelector(".fixed[data-wizard]");

    const maybeReload = () => {
      if (!reloadPending || formInProgress()) return;
      reloadPending = false;
      window.location.reload();
    };

    const onControllerChange = () => {
      if (!hadController) return; // first install: the page already matches
      reloadPending = true;
      maybeReload();
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      maybeReload();
      void registration?.update().catch(() => {});
    };

    const register = () => {
      sw.register("/sw.js")
        .then((r) => {
          registration = r;
        })
        .catch(() => {});
    };

    sw.addEventListener("controllerchange", onControllerChange);
    document.addEventListener("visibilitychange", onVisible);
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => {
      sw.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("load", register);
    };
  }, []);
  return null;
}
