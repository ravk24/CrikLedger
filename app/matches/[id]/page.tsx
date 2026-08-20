import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Crown } from "lucide-react";
import { ResultBadge } from "@/components/shared/ResultBadge";
import { FeeTable } from "@/components/matches/FeeTable";
import { CostBreakdownFooter } from "@/components/matches/CostBreakdownFooter";
import { MatchAdminActions } from "@/components/matches/MatchAdminActions";
import { MatchFeeCard } from "@/components/matches/MatchFeeCard";
import { DeleteScheduledMatch } from "@/components/matches/DeleteScheduledMatch";
import { Skeleton } from "@/components/ui/skeleton";
import { computeSlotShare } from "@/lib/bookings";
import { pool } from "@/lib/db";
import { formatDate, formatDateShort, formatRupees, formatWeekday } from "@/lib/format";
import { resolveGroundInfo } from "@/lib/grounds";
import { canWrite, isScopeSuperadmin } from "@/lib/roles";
import { getSessionAdmin } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase-server";
import { getTeamById, getTeamGrounds } from "@/lib/team";
import type { WizardInitial } from "@/components/wizard/wizardTypes";
import type { GroundBookingPublic, Match, MatchParticipantPublic } from "@/types";

type MatchPublicRow = Match & { updated_by_name: string | null };

async function buildAdminProps(match: MatchPublicRow) {
  const admin = await getSessionAdmin();
  if (!admin || admin.mustChangePassword) return null;

  // Admin rights are per TEAM, resolved against this match's own team —
  // being an admin somewhere is not being an admin here. canWrite also
  // refuses the megaadmin, who reads every match but edits none.
  if (!canWrite(admin, "team", match.team_id)) return null;
  const isSuperadmin = isScopeSuperadmin(admin, "team", match.team_id);

  // Recently-played first (kickoff §6 step 3), then alphabetical.
  const playersRes = await pool.query(
    `SELECT p.id, p.name, p.is_captain
     FROM players p
     LEFT JOIN (
       SELECT mp.player_id, MAX(m.match_date) AS last_played
       FROM match_participants mp
       JOIN matches m ON m.id = mp.match_id AND m.status = 'completed'
         AND mp.is_playing
       GROUP BY mp.player_id
     ) lp ON lp.player_id = p.id
     WHERE p.team_id = $1 AND p.is_active
     ORDER BY lp.last_played DESC NULLS LAST, p.name ASC`,
    [match.team_id],
  );
  const players = (
    playersRes.rows as { id: string; name: string; is_captain: boolean }[]
  ).map((p) => ({ id: p.id, name: p.name, is_captain: p.is_captain }));

  let initial: WizardInitial | undefined;
  if (match.status === "completed") {
    const rowsRes = await pool.query(
      `SELECT player_id, brought_car, shared_car, is_playing
       FROM match_participants WHERE match_id = $1`,
      [match.id],
    );
    const selected: string[] = [];
    const cars: string[] = [];
    const shared: string[] = [];
    for (const row of rowsRes.rows) {
      // Charge-only captain rows aren't attendance. Fees are not carried
      // back into the wizard at all any more — the server recomputes
      // every one of them on save.
      if (!row.is_playing) continue;
      selected.push(row.player_id);
      if (row.brought_car) cars.push(row.player_id);
      if (row.shared_car) shared.push(row.player_id);
    }
    const guestNames = match.guest_names ?? [];
    const guestCars = match.guest_cars ?? [];
    const guestShared = match.guest_shared_cars ?? [];
    initial = {
      result: match.result ?? "won",
      costs: {
        ground: String(Math.round(Number(match.ground_fee))),
        ball: String(Math.round(Number(match.ball_fee))),
        other: String(Math.round(Number(match.other_fee))),
        allowance: String(Math.round(Number(match.car_allowance_per_car))),
      },
      selected,
      cars,
      shared,
      guests: guestNames.map((name, i) => ({
        name,
        brought_car: guestCars[i] ?? false,
        shared_car: guestShared[i] ?? false,
      })),
    };
  }

  // Other match: the delete dialog quotes the pool-fronted ground fee
  // that returns when the match is removed (admin-only, pg path).
  let otherFee = 0;
  const otherFeeRes = await pool.query(
    `SELECT pe.amount FROM matches m
     JOIN pool_entries pe ON pe.id = m.other_fee_entry_id
     WHERE m.id = $1`,
    [match.id],
  );
  if (otherFeeRes.rows[0]) {
    otherFee = Math.abs(Number(otherFeeRes.rows[0].amount));
  }

  // Booking money is admin-only, so this stays in the pg code path:
  // the fee switch needs the pending amount (any admin), and the
  // cancel flow needs this match's per-slot share of the booking
  // credit, computed exactly as the server will deduct it on delete.
  let bookingShare = 0;
  let bookingFee = 0;
  let matchFee: { amountPending: number } | null = null;
  const bookingRes = await pool.query(
    `SELECT gb.amount_paid, gb.slots, gb.amount_pending,
            pe.amount AS cleared_amount
     FROM matches m
     JOIN ground_bookings gb ON gb.id = m.ground_booking_id
     LEFT JOIN pool_entries pe ON pe.id = gb.pending_cleared_entry_id
     WHERE m.id = $1`,
    [match.id],
  );
  const booking = bookingRes.rows[0];
  if (booking) {
    matchFee = { amountPending: Number(booking.amount_pending) };
    // Completion prefill: this match's slot share of everything the
    // opponent paid to book — paid + still-pending + cleared-pending
    // covers every clearing state (per-component shares, same rounding
    // convention as the delete quote below).
    const feeSlots = Number(booking.slots);
    bookingFee =
      computeSlotShare(Number(booking.amount_paid), feeSlots) +
      computeSlotShare(Number(booking.amount_pending), feeSlots) +
      (booking.cleared_amount
        ? computeSlotShare(Number(booking.cleared_amount), feeSlots)
        : 0);
    if (match.status === "scheduled" && isSuperadmin) {
      // Deleting also reverts the cleared-pending credit's slot share,
      // so the confirm dialog quotes the full pool deduction.
      const slots = Number(booking.slots);
      bookingShare =
        computeSlotShare(Number(booking.amount_paid), slots) +
        (booking.cleared_amount
          ? computeSlotShare(Number(booking.cleared_amount), slots)
          : 0);
    }
  }

  return {
    players,
    isSuperadmin,
    initial,
    bookingShare,
    bookingFee,
    otherFee,
    matchFee,
  };
}

async function MatchDetailData({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [matchRes, participantsRes] = await Promise.all([
    supabaseServer
      .from("matches_public")
      .select("*")
      .eq("id", id)
      .maybeSingle(),
    supabaseServer
      .from("match_participants_public")
      .select("*")
      .eq("match_id", id),
  ]);

  const match = matchRes.data as MatchPublicRow | null;
  if (!match) notFound();

  // The team comes from the MATCH, never from the session — this page is
  // publicly link-readable (the WhatsApp sharing loop), so it must render
  // for a visitor who has no active team at all.
  const [team, grounds] = await Promise.all([
    getTeamById(match.team_id),
    getTeamGrounds(match.team_id),
  ]);

  const groundInfo = resolveGroundInfo(
    match.ground,
    match.venue ?? null,
    grounds,
    team.home_ground_name,
  );

  // Captain and booking are scoped by the match's own team; the
  // booking resolves by id (matches.ground_booking_id) — the old
  // opponent-name heuristic is gone.
  const [captainRes, bookingRes] = await Promise.all([
    supabaseServer
      .from("players_public")
      .select("name")
      .eq("team_id", match.team_id)
      .eq("is_captain", true)
      .maybeSingle(),
    match.ground_booking_id
      ? supabaseServer
          .from("ground_bookings_public")
          .select("team_name, captain, amount_pending, created_at")
          .eq("id", match.ground_booking_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const teamCaptain = (captainRes.data as { name: string } | null)?.name ?? null;

  const rawBooking = bookingRes.data as GroundBookingPublic | null;
  const booking: GroundBookingPublic | null = rawBooking
    ? { ...rawBooking, amount_pending: Number(rawBooking.amount_pending) }
    : null;

  const adminProps = await buildAdminProps(match);

  const participants = (participantsRes.data ?? []) as MatchParticipantPublic[];
  participants.sort((a, b) => a.player_name.localeCompare(b.player_name));

  const guestNames = match.guest_names ?? [];
  const guestCars = match.guest_cars ?? [];
  const guests = guestNames.map((name, i) => ({
    name,
    brought_car: guestCars[i] ?? false,
  }));
  const drivers = participants.filter((p) => p.is_playing && p.brought_car);
  const guestCarCount = guests.filter((g) => g.brought_car).length;
  const collectedTotal = participants.reduce(
    (sum, p) => sum + Number(p.fee_amount),
    0,
  );
  const captainRow =
    participants.find((p) => Number(p.guest_fee_share) !== 0) ?? null;
  const updatedStamp = match.updated_at ?? null;

  return (
    <>
      <section className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-text-primary">
            {team.short_name ?? team.display_name} vs {match.opponent}
          </h1>
          <ResultBadge match={match} />
        </div>
        <p className="text-sm text-text-secondary">
          {formatWeekday(match.match_date)}
          {" · "}
          {formatDate(match.match_date)}
        </p>
        {match.fee_paid_to && (
          <p className="text-xs text-text-muted">
            Ground fee paid to the{" "}
            {match.fee_paid_to === "owner" ? "ground owner" : "opponent"} —
            recouped from match fees on completion
          </p>
        )}
        {(teamCaptain || booking) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary">
            {teamCaptain && (
              <span className="inline-flex items-center gap-1">
                Captain: {teamCaptain}
                <Crown size={14} className="text-accent" />
              </span>
            )}
            {booking && (
              <>
                <span>Opponent Captain: {booking.captain}</span>
                {booking.amount_pending > 0 ? (
                  <span className="rounded-full bg-debit-light px-2 py-0.5 text-xs font-medium text-debit-foreground">
                    ₹{formatRupees(booking.amount_pending)} pending
                  </span>
                ) : (
                  <span className="rounded-full bg-credit-light px-2 py-0.5 text-xs font-medium text-credit-foreground">
                    Paid
                  </span>
                )}
              </>
            )}
          </div>
        )}
        <p className="mt-1 text-sm text-text-secondary">
          Ground: {groundInfo.label}
        </p>
      </section>

      {adminProps?.matchFee && (
        <MatchFeeCard
          matchId={match.id}
          opponent={match.opponent}
          matchDateLabel={formatDateShort(match.match_date)}
          amountPending={adminProps.matchFee.amountPending}
        />
      )}

      {adminProps && (
        <MatchAdminActions
          matchId={match.id}
          opponent={match.opponent}
          matchDate={String(match.match_date).slice(0, 10)}
          matchDateLabel={formatDateShort(match.match_date)}
          status={match.status}
          ground={match.ground}
          venue={match.venue ?? null}
          grounds={grounds}
          groundInfo={groundInfo}
          opponentCaptain={booking?.captain ?? null}
          feePending={adminProps.matchFee?.amountPending ?? 0}
          players={adminProps.players}
          isSuperadmin={adminProps.isSuperadmin}
          initial={adminProps.initial}
          initialGroundFee={
            adminProps.otherFee || adminProps.bookingFee || undefined
          }
        />
      )}

      {match.status === "scheduled" && adminProps?.isSuperadmin && (
        <DeleteScheduledMatch
          matchId={match.id}
          opponent={match.opponent}
          matchDateLabel={formatDateShort(match.match_date)}
          ground={match.ground === "away" ? "away" : "home"}
          bookingShare={adminProps.bookingShare}
          otherFee={adminProps.otherFee}
        />
      )}

      {match.status === "abandoned" && (
        <section className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm text-text-primary">
            Match abandoned{match.abandoned_reason ? ` — ${match.abandoned_reason}` : ""}.
          </p>
          <p className="mt-1 text-xs text-text-muted">
            No fees were charged for this match.
          </p>
        </section>
      )}

      {match.status === "scheduled" && (
        <section className="rounded-lg border border-scheduled-light bg-surface p-4">
          <p className="text-sm text-text-primary">
            Upcoming match — awaiting completion by an admin.
          </p>
        </section>
      )}

      {match.status === "completed" && (
        <>
          {drivers.length + guestCarCount > 0 && (
            <section className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                Cars
              </span>
              {drivers.map((d) => (
                <span
                  key={d.player_name}
                  className="rounded-full bg-accent-light px-2 py-0.5 text-xs font-medium text-accent"
                >
                  {d.player_name}
                </span>
              ))}
              {guests
                .filter((g) => g.brought_car)
                .map((g) => (
                  <span
                    key={`guest-car-${g.name}`}
                    className="rounded-full bg-low-light px-2 py-0.5 text-xs font-medium text-low-foreground"
                  >
                    {g.name} (guest)
                  </span>
                ))}
              <span className="text-xs text-text-muted">
                ₹{formatRupees(Number(match.car_allowance_per_car))} / car
              </span>
            </section>
          )}

          <FeeTable participants={participants} guests={guests} />
          <CostBreakdownFooter
            match={match}
            carCount={drivers.length + guestCarCount}
            collectedTotal={collectedTotal}
            guestFee={captainRow ? Number(captainRow.guest_fee_share) : 0}
            captainName={captainRow?.player_name ?? null}
          />
          {updatedStamp && (
            <p className="text-xs text-text-muted">
              Last updated
              {match.updated_by_name && ` by ${match.updated_by_name}`} on{" "}
              {formatDate(updatedStamp)}
            </p>
          )}
        </>
      )}
    </>
  );
}

export default function MatchDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="min-h-svh bg-background pb-16">
      <header className="sticky top-0 z-10 border-b border-border bg-surface">
        <div className="mx-auto flex max-w-md items-center gap-1 px-2 py-3">
          <Link
            href="/matches"
            className="flex min-h-11 items-center gap-1 px-2 text-sm font-medium text-text-secondary"
          >
            <ChevronLeft size={18} />
            Matches
          </Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
        <Suspense
          fallback={
            <>
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-64 rounded-lg" />
              <Skeleton className="h-32 rounded-lg" />
            </>
          }
        >
          <MatchDetailData params={params} />
        </Suspense>
      </main>
    </div>
  );
}
