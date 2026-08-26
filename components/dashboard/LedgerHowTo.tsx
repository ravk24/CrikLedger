import { HowToUseCard, type HowToStep } from "@/components/dashboard/HowToUseCard";
import type { PlayerPublic } from "@/types";

// The Team Ledger onboarding checklist, rendered on the dashboard for
// the team's superadmin only: setting the captain is a superadmin
// action, and the captain-phone read must stay inside a
// superadmin-gated path (migration 43 — phone is view-absent by
// design). The dashboard applies that gate and fetches the phone in
// its own Promise.all — this component used to query it itself, which
// made it a third serial round trip on the most-visited page.
//
// Two reminders on purpose — players first (the captain is picked from
// them), then the captain's number for the fee-collection message.
export function LedgerHowTo({
  players,
  captainPhone,
}: {
  players: PlayerPublic[];
  captainPhone: string | null;
}) {
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
