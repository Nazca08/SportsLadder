export type StandingsRow = {
  entrantId: string;
  points: number;          // the running league score (zero-sum, seeded from rating)
  wins: number;
  losses: number;
  played: number;          // matches completed; 0 means unranked
  beatenEntrantIds: string[];
};

/**
 * Orders a league table.
 *
 * Players who have not played yet sit at the bottom regardless of their seed:
 * a 4.0 who signed up and never turned up should not outrank a 3.0 who has
 * been grinding all season. Among them, seed order still applies, so the group
 * is not arbitrary.
 *
 * Within the played group: score, then fewest losses, then most wins, then the
 * best single win measured by that opponent's own final score. The same
 * function seeds the season-ending bracket and the annual championship groups,
 * so one rule governs everywhere.
 */
export function rankStandings(rows: StandingsRow[]): StandingsRow[] {
  const scoreById = Object.fromEntries(rows.map((r) => [r.entrantId, r.points]));
  return [...rows].sort((a, b) => {
    const aPlayed = a.played > 0;
    const bPlayed = b.played > 0;
    if (aPlayed !== bPlayed) return aPlayed ? -1 : 1;

    if (b.points !== a.points) return b.points - a.points;
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
