export type StandingsRow = {
  entrantId: string;
  points: number;
  wins: number;
  losses: number;
  beatenEntrantIds: string[]; // ids of entrants this one has beaten
};

/**
 * Sorts standings by points desc, then applies the agreed tiebreaker:
 * fewest losses, then most wins, then best win by opponent's own final points.
 * This same function seeds both the season-ending bracket and orders the
 * annual championship's within-group seeding -- one rule, reused everywhere.
 */
export function rankStandings(rows: StandingsRow[]): StandingsRow[] {
  const pointsById = Object.fromEntries(rows.map((r) => [r.entrantId, r.points]));
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (a.losses !== b.losses) return a.losses - b.losses;
    if (b.wins !== a.wins) return b.wins - a.wins;
    const bestA = Math.max(0, ...a.beatenEntrantIds.map((id) => pointsById[id] ?? 0));
    const bestB = Math.max(0, ...b.beatenEntrantIds.map((id) => pointsById[id] ?? 0));
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
