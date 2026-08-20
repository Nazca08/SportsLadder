/**
 * Zero-sum league scoring.
 *
 * Every match moves points from the loser to the winner. Nothing is created,
 * which is the whole point: under the old 20-point split the loser always
 * gained something, so playing five matches and losing all five still climbed
 * the ladder. Here it drops you five times.
 *
 * How much moves depends on how surprising the result was. A 2.0 beating a 5.0
 * is a large transfer; the same 5.0 beating that 2.0 barely registers, because
 * it was expected. Margin scales it further, so a thrashing counts for more
 * than a squeaker without letting margin dominate.
 */

/** Points in play per match, before the expectancy and margin adjustments. */
export const K_FACTOR = 50;

/** A player with no self-reported rating starts here. */
export const DEFAULT_SEED = 1000;

/** How much of the pot the margin can add, at most. A shutout swings 1.5x. */
const MARGIN_WEIGHT = 0.5;

/**
 * Starting score for a player, from their self-reported rating.
 * 3.5 is treated as the midpoint, and each half-step is worth 50 points, so a
 * 2.0 opens 300 behind a 5.0 -- roughly an 85/15 expectancy between them.
 */
export function seedFromRating(rating?: string | null): number {
  if (!rating) return DEFAULT_SEED;
  const numeric = Number(rating);
  if (!Number.isFinite(numeric)) return DEFAULT_SEED;
  return DEFAULT_SEED + (numeric - 3.5) * 100;
}

/**
 * Probability that A beats B, on the standard logistic curve. A 400-point gap
 * means the favourite is expected to win about 91% of the time.
 */
export function expectedScore(scoreA: number, scoreB: number): number {
  return 1 / (1 + Math.pow(10, (scoreB - scoreA) / 400));
}

/**
 * Margin multiplier from the aggregate games (tennis) or points (pickleball).
 * A dead-even scoreline gives 1.0; a shutout gives 1.5.
 */
export function marginMultiplier(gamesA: number, gamesB: number): number {
  const total = gamesA + gamesB;
  if (total <= 0) return 1;
  return 1 + MARGIN_WEIGHT * (Math.abs(gamesA - gamesB) / total);
}

/**
 * Points transferred from loser to winner for one match.
 *
 * Returned as a single positive number: the winner adds it, the loser
 * subtracts exactly the same, so the league total never moves.
 */
export function computeExchange(
  winnerScore: number,
  loserScore: number,
  winnerGames: number,
  loserGames: number
): number {
  const expected = expectedScore(winnerScore, loserScore);
  const margin = marginMultiplier(winnerGames, loserGames);
  const change = K_FACTOR * margin * (1 - expected);
  // Whole points only -- a ladder showing 1043.7 invites arguments that a
  // rounded number does not. Never zero, so every match visibly counts.
  return Math.max(1, Math.round(change));
}
