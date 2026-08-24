import { Suspense } from "react";
import { redirect } from "next/navigation";

// The Matches tab became the Schedule tab. Old links and bookmarks land
// on the new hub; per-match detail URLs (/matches/[mid]) are untouched.
// params is runtime data, so the redirect must run inside Suspense
// (Cache Components).
async function Redirector({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return redirect(`/tournaments/${id}/schedule`);
}

export default function LegacyTournamentMatches({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <Redirector params={params} />
    </Suspense>
  );
}
