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
 * Determines a best-of-3 match winner from played sets, and returns the
 * aggregate games across every set played (not just the deciding set) --
 * that aggregate feeds computePoints() so the full match is reflected,
 * not just the final set.
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
  if (setsWonA < 2 && setsWonB < 2) {
    return { valid: false, error: "Match isn't finished \u2014 no one has won 2 sets." };
  }
  const gamesA = sets.reduce((sum, s) => sum + s.a, 0);
  const gamesB = sets.reduce((sum, s) => sum + s.b, 0);
  return { valid: true, winnerSide: setsWonA > setsWonB ? "a" : "b", gamesA, gamesB, sets };
}
