export type SetScore = { a: number; b: number };

/**
 * How a tennis league scores a match.
 *   standard      - conventional sets (6-0..6-4, 7-5, 7-6), any number of them
 *   single_set    - one set, any score accepted
 *   best_of_3_avg - up to three sets, any score accepted
 *   two_sets_to_6 - two sets to 6. At one set all the match goes to whoever won
 *                   more games, which is how a split is settled in practice and
 *                   costs nothing here, since the scoring already runs on games.
 */
export type TennisFormat = "standard" | "single_set" | "best_of_3_avg" | "two_sets_to_6";

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

  // Permissive formats accept whatever was actually played. Matches get cut
  // short by rain, injury and daylight, and a validator that rejects 4-2 just
  // means the result never gets recorded.
  if (format === "single_set" || format === "best_of_3_avg" || format === "two_sets_to_6") {
    return true;
  }

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
  if (format === "best_of_3_avg" && sets.length > 3) {
    return { valid: false, error: "This league plays best of three \u2014 enter at most three sets." };
  }

  // Two sets, plus a third line when a deciding tiebreak was played.
  if (format === "two_sets_to_6" && sets.length > 3) {
    return {
      valid: false,
      error: "This league plays two sets \u2014 enter at most two, plus a deciding tiebreak.",
    };
  }

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

  // A two-set match splits one set each often enough that it needs a rule
  // rather than an error. Total games decides it.
  if (format === "two_sets_to_6" && setsWonA === setsWonB) {
    const totalA = sets.reduce((sum, s) => sum + s.a, 0);
    const totalB = sets.reduce((sum, s) => sum + s.b, 0);
    if (totalA === totalB) {
      return {
        valid: false,
        error: "One set all and level on games \u2014 play a tiebreak and add it as a third line.",
      };
    }
    return {
      valid: true,
      winnerSide: totalA > totalB ? "a" : "b",
      gamesA: totalA,
      gamesB: totalB,
      sets,
    };
  }

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
