export type SetScore = { a: number; b: number };

export type TennisResult =
  | { valid: true; winnerSide: "a" | "b"; gamesA: number; gamesB: number; sets: SetScore[] }
  | { valid: false; error: string };

/** A single set is valid if won 6-0..6-4, or 7-5, or 7-6 (tiebreak). */
export function isValidSet(a: number, b: number): boolean {
  if (a < 0 || b < 0) return false;
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
export function resolveTennisMatch(sets: SetScore[]): TennisResult {
  if (sets.length === 0) {
    return { valid: false, error: "Enter at least one set." };
  }
  for (const s of sets) {
    if (!isValidSet(s.a, s.b)) {
      return { valid: false, error: `Invalid set score: ${s.a}-${s.b}` };
    }
  }
  const setsWonA = sets.filter((s) => s.a > s.b).length;
  const setsWonB = sets.filter((s) => s.b > s.a).length;
  if (setsWonA === setsWonB) {
    return { valid: false, error: "Sets played must produce a winner \u2014 add another set to break the tie." };
  }
  const gamesA = sets.reduce((sum, s) => sum + s.a, 0);
  const gamesB = sets.reduce((sum, s) => sum + s.b, 0);
  return { valid: true, winnerSide: setsWonA > setsWonB ? "a" : "b", gamesA, gamesB, sets };
}
