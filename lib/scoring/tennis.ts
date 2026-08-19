export type SetScore = { a: number; b: number };

/**
 * How a tennis league scores a match.
 *   standard   - conventional sets (6-0..6-4, 7-5, 7-6), any number of them
 *   single_set - one set, any score accepted
 */
export type TennisFormat = "standard" | "single_set";

export type TennisResult =
  | { valid: true; winnerSide: "a" | "b"; gamesA: number; gamesB: number; sets: SetScore[] }
  | { valid: false; error: string };

/**
 * Standard set: won 6-0..6-4, or 7-5, or 7-6 (tiebreak).
 *
 * Single set: anything non-negative. Rain and injuries end real matches at
 * scores no rulebook describes, and refusing them means the result never gets
 * recorded -- worse for the standings than an unusual-looking score.
 */
export function isValidSet(a: number, b: number, format: TennisFormat = "standard"): boolean {
  if (a < 0 || b < 0) return false;

  if (format === "single_set") return true;

  const max = Math.max(a, b);
  const min = Math.min(a, b);
  if (max < 6) return false;
  if (max === 6) return min <= 4;
  if (max === 7) return min === 5 || min === 6;
  return false;
}

/**
 * Determines the match winner from however many sets were actually played --
 * not locked to best-of-3. Whoever won more sets wins the match; an even
 * split isn't allowed, since there'd be no winner to award points to.
 * Returns the aggregate games across every set played (not just a "deciding"
 * set) -- that aggregate feeds computePoints() so the full match is
 * reflected.
 */
export function resolveTennisMatch(
  sets: SetScore[],
  format: TennisFormat = "standard"
): TennisResult {
  if (sets.length === 0) {
    return { valid: false, error: "Enter at least one set." };
  }

  // The set IS the match in this format, so extra rows are a misunderstanding
  // rather than a longer match.
  if (format === "single_set" && sets.length !== 1) {
    return { valid: false, error: "This league plays one set \u2014 enter a single score." };
  }

  for (const s of sets) {
    if (!isValidSet(s.a, s.b, format)) {
      return { valid: false, error: `Invalid set score: ${s.a}-${s.b}` };
    }
  }
  const setsWonA = sets.filter((s) => s.a > s.b).length;
  const setsWonB = sets.filter((s) => s.b > s.a).length;
  if (setsWonA === setsWonB) {
    // The only rule left in single_set. Points are a split of 20 between a
    // winner and a loser, so a drawn score has nobody to award them to.
    return {
      valid: false,
      error:
        format === "single_set"
          ? "A match needs a winner \u2014 an even score can\u2019t be scored."
          : "Sets played must produce a winner \u2014 add another set to break the tie.",
    };
  }
  const gamesA = sets.reduce((sum, s) => sum + s.a, 0);
  const gamesB = sets.reduce((sum, s) => sum + s.b, 0);
  return { valid: true, winnerSide: setsWonA > setsWonB ? "a" : "b", gamesA, gamesB, sets };
}
