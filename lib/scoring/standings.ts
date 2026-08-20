export type StandingsRow = {
  entrantId: string;
  /**
   * Internal strength score, seeded from the player's self-reported rating.
   * Never shown: it drives how much each match is worth, nothing else. A
   * player who has not played yet sits at their seed, which is not a score
   * they earned and should not be presented as one.
   */
  points: number;
  /** Where this entrant started, so `points - seed` is what they actually earned. */
  seed: number;
  /** Points earned this season. This is the number players see and are ranked on. */
  earned: number;
  wins: number;
  losses: number;
  played: number;          // matches completed; 0 means unranked
  beatenEntrantIds: string[];
};

/**
 * Orders a league table.
 *
 * Ranked on points EARNED, not on the internal score. That keeps the order and
 * the displayed number in agreement -- a table sorted by a figure the player
 * cannot see is just confusing -- and it stops a high self-rating from being
 * worth anything on its own. Claiming 5.0 sizes your matches; it does not put
 * you above someone who has actually won something.
 *
 * Entrants with no matches sit at the bottom regardless, since nobody has
 * earned anything yet and their seed is not an achievement.
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
