export type PickleballResult =
  | { valid: true; winnerSide: "a" | "b"; scoreA: number; scoreB: number }
  | { valid: false; error: string };

export function resolvePickleballMatch(a: number, b: number): PickleballResult {
  if (a < 0 || b < 0) return { valid: false, error: "Scores can't be negative." };
  const max = Math.max(a, b);
  const min = Math.min(a, b);
  if (max < 11) return { valid: false, error: "Game isn't finished \u2014 no one has reached 11." };
  if (max - min < 2) return { valid: false, error: "Must win by 2." };
  return { valid: true, winnerSide: a > b ? "a" : "b", scoreA: a, scoreB: b };
}
