import { HowToUseCard, type HowToStep } from "@/components/dashboard/HowToUseCard";
import { pool } from "@/lib/db";
import { hasEntitlement } from "@/lib/entitlements";
import { canWrite, isMegaadmin } from "@/lib/roles";
import { getSessionAdmin } from "@/lib/session";

// The Tournament onboarding checklist. Self-contained on purpose: it
// renders on the dashboard AND inside HomeIntro (a tournament-only
// buyer has no Team Ledger, so Home shows the intro), and
// getSessionAdmin() is React.cache()d so the second call is free.
// "Done" is any-tournament semantics — the card teaches the flow once;
// the newest tournament's id deep-links the later steps.
export async function TournamentHowTo() {
  const admin = await getSessionAdmin();
  if (
    !admin ||
    admin.mustChangePassword ||
    isMegaadmin(admin) || // the operator is entitled to everything
    !hasEntitlement(admin, "tournament_credit") ||
    !admin.activeTeamId ||
    !canWrite(admin, "team", admin.activeTeamId)
  ) {
    return null;
  }

  const { rows } = await pool.query<{
    latest_id: string | null;
    has_players: boolean;
    has_captain_phone: boolean;
    has_matches: boolean;
  }>(
    `SELECT
       (SELECT t.id FROM tournaments t WHERE t.team_id = $1
         ORDER BY t.created_at DESC LIMIT 1) AS latest_id,
       EXISTS (SELECT 1 FROM tournament_players tp
                 JOIN tournaments t ON t.id = tp.tournament_id
                WHERE t.team_id = $1) AS has_players,
       EXISTS (SELECT 1 FROM tournament_players tp
                 JOIN tournaments t ON t.id = tp.tournament_id
                WHERE t.team_id = $1 AND tp.is_captain
                  AND tp.phone IS NOT NULL) AS has_captain_phone,
       EXISTS (SELECT 1 FROM tournament_matches tm
                 JOIN tournaments t ON t.id = tm.tournament_id
                WHERE t.team_id = $1) AS has_matches`,
    [admin.activeTeamId],
  );
  const flags = rows[0];
  const latest = flags?.latest_id ?? null;
  const adminHref = latest ? `/tournaments/${latest}/admin` : "/tournaments";

  const steps: HowToStep[] = [
    {
      label: "Create your tournament",
      sublabel: "Uses one credit — its players and ledger stay separate",
      href: "/tournaments",
      done: latest !== null,
    },
    {
      label: "Add tournament players",
      sublabel: "Build the roster from the tournament's Admin tab",
      href: adminHref,
      done: flags?.has_players ?? false,
    },
    {
      label: "Set the tournament captain and phone",
      sublabel: "The number goes on the dues-settlement message",
      href: adminHref,
      done: flags?.has_captain_phone ?? false,
    },
    {
      label: "Schedule a tournament match",
      sublabel: "Record who played — fees settle when the tournament ends",
      href: latest ? `/tournaments/${latest}/schedule` : "/tournaments",
      done: flags?.has_matches ?? false,
    },
  ];

  return <HowToUseCard title="How to use your Tournament" steps={steps} />;
}
