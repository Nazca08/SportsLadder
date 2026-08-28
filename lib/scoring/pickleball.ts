export type GameScore = { a: number; b: number };

/**
 * How a pickleball league scores a match.
 *   standard      - every game won to 11+ by two, any number of games
 *   best_of_3_avg - up to three games, any score accepted
 */
export type PickleballFormat = "standard" | "best_of_3_avg";

export type PickleballResult =
  | { valid: true; winnerSide: "a" | "b"; scoreA: number; scoreB: number; games: GameScore[] }
  | { valid: false; error: string };

/**
 * A single game is valid if won to 11+, by a margin of at least 2.
 *
 * best_of_3_avg accepts anything non-negative: games get abandoned partway and
 * the result still needs recording.
 */
export function isValidGame(a: number, b: number, format: PickleballFormat = "standard"): boolean {
  if (a < 0 || b < 0) return false;
  if (format === "best_of_3_avg") return true;
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
export function resolvePickleballMatch(
  games: GameScore[],
  format: PickleballFormat = "standard"
): PickleballResult {
  if (games.length === 0) {
    return { valid: false, error: "Enter at least one game." };
  }
  if (format === "best_of_3_avg" && games.length > 3) {
    return { valid: false, error: "This league plays best of three \u2014 enter at most three games." };
  }
  for (const g of games) {
    if (!isValidGame(g.a, g.b, format)) {
      return { valid: false, error: `Invalid game score: ${g.a}-${g.b}. Games run to 11, win by 2.` };
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
