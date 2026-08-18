"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import type { NavState } from "@/lib/nav";

// Re-links returning users whose session cookie outlived local analytics
// state. Previously this rode along with PublicHeader's /api/auth/me
// fetch; now the props are server-resolved and this component exists
// only to run the effect — it renders nothing.
export function AnalyticsIdentify({ nav }: { nav: NavState }) {
  const id = nav.accountId;
  const name = nav.accountName;
  const team = nav.activeTeamName;
  const mega = nav.isMegaadmin;

  useEffect(() => {
    if (!id) return;
    // No-op when the distinct id is unchanged.
    posthog.identify(id, { name, active_team: team, is_megaadmin: mega });
  }, [id, name, team, mega]);

  return null;
}
