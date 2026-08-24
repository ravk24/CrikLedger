import { HowToUseCard, type HowToStep } from "@/components/dashboard/HowToUseCard";

// The Tournament onboarding checklist, rendered on a tournament's own
// Home tab (never on the app Home). Props-driven: the tab already holds
// the roster and the admin-gated captain-phone read, so this component
// touches neither the session nor the database.
//
// Two reminders on purpose — players first (the captain is picked from
// them), then the captain's number for the dues-settlement message.
export function TournamentHowTo({
  tournamentId,
  hasPlayers,
  hasCaptainPhone,
}: {
  tournamentId: string;
  hasPlayers: boolean;
  hasCaptainPhone: boolean;
}) {
  const adminHref = `/tournaments/${tournamentId}/admin`;
  const steps: HowToStep[] = [
    {
      label: "Add tournament players",
      sublabel: "See every player's balance right here",
      href: adminHref,
      done: hasPlayers,
    },
    {
      label: "Add the tournament captain and phone number",
      sublabel: "The number goes on the dues-settlement message",
      href: adminHref,
      done: hasCaptainPhone,
    },
  ];

  return <HowToUseCard title="How to use your Tournament" steps={steps} />;
}
