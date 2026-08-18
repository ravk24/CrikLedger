// The single ceiling rule for money. The match fee and the common-debit
// share must never round differently — both go through ceilRupees.

export function ceilRupees(amount: number): number {
  return Math.ceil(amount);
}

export type CeilSplitResult = {
  share: number;
  players: number;
  recovered: number;
  surplus: number;
};

// Common-debit split: CEIL(expense / active player count) per active player.
// Rounding always favors the pool — recovered >= expense.
export function ceilSplit(expense: number, activePlayerCount: number): CeilSplitResult {
  if (activePlayerCount === 0) {
    throw new Error("NO_PLAYERS");
  }
  const share = ceilRupees(expense / activePlayerCount);
  const recovered = share * activePlayerCount;
  return {
    share,
    players: activePlayerCount,
    recovered,
    surplus: recovered - expense,
  };
}
