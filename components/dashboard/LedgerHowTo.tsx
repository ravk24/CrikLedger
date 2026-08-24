import { HowToUseCard, type HowToStep } from "@/components/dashboard/HowToUseCard";
import { pool } from "@/lib/db";
import type { SessionAdmin } from "@/lib/session";
import type { PlayerPublic } from "@/types";

// The Team Ledger onboarding checklist, rendered on the dashboard for
// the team's superadmin only: setting the captain is a superadmin
// action, and the captain-phone read must stay inside a
// superadmin-gated path (migration 43 — phone is view-absent by
// design). Viewers, plain members and the observing megaadmin see
// nothing, and no query runs for them.
//
// Two reminders on purpose — players first (the captain is picked from
// them), then the captain's number for the fee-collection message.
export async function LedgerHowTo({
  teamId,
  players,
  admin,
}: {
  teamId: string;
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

  const { rows } = await pool.query<{ captain_phone: string | null }>(
    `SELECT phone AS captain_phone FROM players
      WHERE team_id = $1 AND is_captain LIMIT 1`,
    [teamId],
  );
  const captainPhone = rows[0]?.captain_phone ?? null;

  const steps: HowToStep[] = [
    {
      label: "Add your players",
      sublabel: "See every player's balance right here",
      href: "/admin/players",
      done: players.length > 0,
    },
    {
      label: "Add your captain and phone number",
      sublabel: "The number goes on the fee-collection WhatsApp message",
      href: "/admin",
      done: players.some((p) => p.is_captain) && captainPhone !== null,
    },
  ];

  return <HowToUseCard title="How to use your Team Ledger" steps={steps} />;
}
