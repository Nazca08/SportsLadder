export type GameScore = { a: number; b: number };

export type PickleballResult =
  | { valid: true; winnerSide: "a" | "b"; scoreA: number; scoreB: number; games: GameScore[] }
  | { valid: false; error: string };

/** A single game is valid if won to 11+, by a margin of at least 2. */
export function isValidGame(a: number, b: number): boolean {
  if (a < 0 || b < 0) return false;
  const max = Math.max(a, b);
  const min = Math.min(a, b);
  if (max < 11) return false;
  if (max - min < 2) return false;
  return true;
}

/**
 * Determines the match winner from however many games were actually played
 * (a session could be 1 game or 5) -- whoever won more games wins the match.
 * An even split isn't allowed. Returns the aggregate points across every
 * game played, which feeds computePoints() so the full session is reflected.
 */
export function resolvePickleballMatch(games: GameScore[]): PickleballResult {
  if (games.length === 0) {
    return { valid: false, error: "Enter at least one game." };
  }
  for (const g of games) {
    if (!isValidGame(g.a, g.b)) {
      return { valid: false, error: `Invalid game score: ${g.a}-${g.b}` };
    }
  }
  const gamesWonA = games.filter((g) => g.a > g.b).length;
  const gamesWonB = games.filter((g) => g.b > g.a).length;
  if (gamesWonA === gamesWonB) {
    return { valid: false, error: "Games played must produce a winner \u2014 add another game to break the tie." };
  }
  const scoreA = games.reduce((sum, g) => sum + g.a, 0);
  const scoreB = games.reduce((sum, g) => sum + g.b, 0);
  return { valid: true, winnerSide: gamesWonA > gamesWonB ? "a" : "b", scoreA, scoreB, games };
}
