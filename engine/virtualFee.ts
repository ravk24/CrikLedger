// Virtual match fee — a FUN, after-match calculator. Nothing here
// touches the ledger or the database; it just answers "who should have
// paid what, given how much game each of us actually got".
//
// Model (Ravi's spec): fixed charges for the top batting positions come
// off the match fee first; the remainder splits 50/50 into a batting
// and a bowling per-ball pool, each spread over overs × 6 balls. The
// variable part of every fee is floored to a whole rupee.

export type VirtualBatsman = {
  name: string;
  ballsFaced: number;
};

export type VirtualBowler = {
  name: string;
  ballsBowled: number;
};

export type VirtualFeeInput = {
  matchFee: number;
  overs: number;
  positionCharges: number[]; // index = batting position − 1; absent → 0
  batsmen: VirtualBatsman[]; // in batting order
  bowlers: VirtualBowler[];
};

export type VirtualBatsmanFee = {
  name: string;
  position: number; // 1-based
  fixedCharge: number;
  ballsFaced: number;
  ballsFee: number; // floor(ballsFaced × battingPool / totalBalls)
  total: number; // fixedCharge + ballsFee
};

export type VirtualBowlerFee = {
  name: string;
  ballsBowled: number;
  fee: number; // floor(ballsBowled × bowlingPool / totalBalls)
};

export type VirtualFeeResult = {
  totalBalls: number;
  fixedTotal: number;
  remainder: number; // matchFee − fixedTotal
  battingPool: number; // remainder / 2
  bowlingPool: number; // remainder / 2
  batsmen: VirtualBatsmanFee[];
  bowlers: VirtualBowlerFee[];
  // Combined per player (trimmed-name match), in order of first
  // appearance — a player who bats and bowls gets one summed row.
  totals: { name: string; amount: number }[];
};

function floorRupees(amount: number): number {
  return Math.floor(amount);
}

export function virtualFee(input: VirtualFeeInput): VirtualFeeResult {
  if (input.overs <= 0) {
    throw new Error("NO_BALLS");
  }
  if (input.matchFee < 0) {
    throw new Error("NEGATIVE_FEE");
  }
  if (
    input.batsmen.some((b) => b.ballsFaced < 0) ||
    input.bowlers.some((b) => b.ballsBowled < 0)
  ) {
    throw new Error("NEGATIVE_BALLS");
  }

  const totalBalls = input.overs * 6;
  const fixedTotal = input.batsmen.reduce(
    (sum, _, i) => sum + (input.positionCharges[i] ?? 0),
    0,
  );
  // A fee below the occupied positions' fixed charges would drive the
  // per-ball pools negative (and flooring negatives inflates them).
  if (fixedTotal > input.matchFee) {
    throw new Error("FEE_BELOW_FIXED");
  }
  const remainder = input.matchFee - fixedTotal;
  const battingPool = remainder / 2;
  const bowlingPool = remainder / 2;

  const batsmen: VirtualBatsmanFee[] = input.batsmen.map((b, i) => {
    const fixedCharge = input.positionCharges[i] ?? 0;
    const ballsFee = floorRupees((b.ballsFaced * battingPool) / totalBalls);
    return {
      name: b.name,
      position: i + 1,
      fixedCharge,
      ballsFaced: b.ballsFaced,
      ballsFee,
      total: fixedCharge + ballsFee,
    };
  });

  const bowlers: VirtualBowlerFee[] = input.bowlers.map((b) => ({
    name: b.name,
    ballsBowled: b.ballsBowled,
    fee: floorRupees((b.ballsBowled * bowlingPool) / totalBalls),
  }));

  const totals: { name: string; amount: number }[] = [];
  const byName = new Map<string, { name: string; amount: number }>();
  for (const row of [
    ...batsmen.map((b) => ({ name: b.name, amount: b.total })),
    ...bowlers.map((b) => ({ name: b.name, amount: b.fee })),
  ]) {
    const key = row.name.trim();
    const existing = byName.get(key);
    if (existing) {
      existing.amount += row.amount;
    } else {
      const entry = { name: key, amount: row.amount };
      byName.set(key, entry);
      totals.push(entry);
    }
  }

  return {
    totalBalls,
    fixedTotal,
    remainder,
    battingPool,
    bowlingPool,
    batsmen,
    bowlers,
    totals,
  };
}
