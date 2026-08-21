/**
 * League points for a completed match.
 *
 *   gap     = opponent's rating - your rating      (positive: they are better)
 *   mult    = 1 + 0.15 * gap                       clamped 0.55 .. 1.45
 *   penalty = 12 - 5 * gap                         clamped 0 .. 22
 *
 *   Winner  = gamesWon * 2 * mult
 *   Loser   = gamesWon * 2 - penalty               capped at (winner - 1)
 *
 * Two points a game, scaled by who you played. The multiplier pays you more for
 * beating someone above your level and less for beating someone below it. The
 * penalty does the same job in reverse: nothing if you were badly outmatched,
 * up to 22 if you lost to someone well beneath you.
 *
 * The shape is deliberate. Playing is rewarded, because points accumulate --
 * but only through wins and through competing above your level. Losing
 * repeatedly to your own peers pays zero or less, so grinding matches cannot
 * carry someone up the table.
 */

export const POINTS_PER_GAME = 2;

/** Loss penalty when both players are the same rating. */
export const BASE_PENALTY = 12;

/** How much one rating point shifts the win multiplier. */
const MULT_PER_RATING = 0.15;
const MULT_MIN = 0.55;
const MULT_MAX = 1.45;

/** How much one rating point shifts the loss penalty. */
const PENALTY_PER_RATING = 5;
const PENALTY_MIN = 0;
const PENALTY_MAX = 22;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Parses a rating like "3.5". Unknown ratings are treated as equal to their opponent. */
export function ratingValue(rating?: string | null, fallback = 3.5): number {
  const n = Number(rating);
  return Number.isFinite(n) ? n : fallback;
}

export function winMultiplier(gap: number): number {
  return clamp(1 + MULT_PER_RATING * gap, MULT_MIN, MULT_MAX);
}

export function lossPenalty(gap: number): number {
  return clamp(BASE_PENALTY - PENALTY_PER_RATING * gap, PENALTY_MIN, PENALTY_MAX);
}

export function matchPoints(
  winnerGames: number,
  loserGames: number,
  winnerRating: number,
  loserRating: number
): { winner: number; loser: number } {
  const winner = Math.round(
    winnerGames * POINTS_PER_GAME * winMultiplier(loserRating - winnerRating)
  );

  const raw = Math.round(
    loserGames * POINTS_PER_GAME - lossPenalty(winnerRating - loserRating)
  );

  // Winning always pays more than losing. Without this a heavy underdog who
  // lost narrowly could out-earn the favourite who beat them, which reads as
  // broken however defensible the arithmetic.
  return { winner, loser: Math.min(raw, winner - 1) };
}
