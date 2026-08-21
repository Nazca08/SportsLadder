export type StandingsRow = {
  entrantId: string;
  /** Season points. Same value as `earned`; kept for existing callers. */
  points: number;
  /** Always 0 now that everyone starts a season on nothing. */
  seed: number;
  /** Season points: the number players see and are ranked on. */
  earned: number;
  wins: number;
  losses: number;
  played: number;          // matches completed; 0 means unranked
  beatenEntrantIds: string[];
};

/**
 * Orders a league table.
 *
 * Ranked on total season points: games won, times two, minus five if you lost.
 * Entrants with no matches sit at the bottom regardless of anything else --
 * their zero is an absence of results, not a result.
 */
export function rankStandings(rows: StandingsRow[]): StandingsRow[] {
  const scoreById = Object.fromEntries(rows.map((r) => [r.entrantId, r.points]));
  return [...rows].sort((a, b) => {
    const aPlayed = a.played > 0;
    const bPlayed = b.played > 0;
    if (aPlayed !== bPlayed) return aPlayed ? -1 : 1;

    if (b.earned !== a.earned) return b.earned - a.earned;
    if (a.losses !== b.losses) return a.losses - b.losses;
    if (b.wins !== a.wins) return b.wins - a.wins;

    const bestA = Math.max(0, ...a.beatenEntrantIds.map((id) => scoreById[id] ?? 0));
    const bestB = Math.max(0, ...b.beatenEntrantIds.map((id) => scoreById[id] ?? 0));
    return bestB - bestA;
  });
}

/** Standard tournament seeding order (1v8, 4v5, 3v6, 2v7 for size 8, etc). */
export function seedPositions(size: number): number[] {
  let positions = [1, 2];
  while (positions.length < size) {
    const m = positions.length * 2 + 1;
    positions = positions.flatMap((p) => [p, m - p]);
  }
  return positions;
}

export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}
