import { HowToUseCard, type HowToStep } from "@/components/dashboard/HowToUseCard";
import { pool } from "@/lib/db";
import type { SessionAdmin } from "@/lib/session";
import type { PlayerPublic } from "@/types";

// The Team Ledger onboarding checklist, rendered on the dashboard for
// the team's superadmin only: rename team and set captain are
// superadmin actions, and the captain-phone read must stay inside a
// superadmin-gated path (migration 43 — phone is view-absent by
// design). Viewers, plain members and the observing megaadmin see
// nothing, and no query runs for them.
export async function LedgerHowTo({
  team,
  players,
  admin,
}: {
  team: { id: string; display_name: string };
  players: PlayerPublic[];
  admin: SessionAdmin | null;
}) {
  if (
    !admin ||
    admin.mustChangePassword ||
    admin.activeTeamRole !== "superadmin"
  ) {
    return null;
  }

  const { rows } = await pool.query<{
    captain_phone: string | null;
    has_match: boolean;
  }>(
    `SELECT
       (SELECT phone FROM players
         WHERE team_id = $1 AND is_captain LIMIT 1) AS captain_phone,
       EXISTS (SELECT 1 FROM matches WHERE team_id = $1) AS has_match`,
    [team.id],
  );
  const captainPhone = rows[0]?.captain_phone ?? null;
  const hasMatch = rows[0]?.has_match ?? false;

  const steps: HowToStep[] = [
    {
      label: "Name your team",
      sublabel: "Replace the placeholder name from your admin console",
      href: "/admin",
      // Exact match against the placeholder the grant writes
      // (app/api/ops/grants) — a deliberate "<name>'s team" rename
      // counts as done, which is harmless.
      done: team.display_name !== `${admin.name}'s team`,
    },
    {
      label: "Add your players",
      sublabel: "Every fee and balance hangs off a player",
      href: "/admin/players",
      done: players.length > 0,
    },
    {
      label: "Set your captain and phone",
      sublabel: "The number goes on the fee-collection WhatsApp message",
      href: "/admin",
      done: players.some((p) => p.is_captain) && captainPhone !== null,
    },
    {
      label: "Schedule your first match",
      sublabel: "Fees and car allowances are worked out per match",
      href: "/schedule",
      done: hasMatch,
    },
  ];

  return <HowToUseCard title="How to use your Team Ledger" steps={steps} />;
}
