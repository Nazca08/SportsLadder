/**
 * The 20-point split. Winner and loser split 20 points based on margin;
 * the loser always keeps at least 1, the winner always gets at least 11.
 * This runs server-side only (in a Supabase Edge Function / API route) --
 * never trust a client-submitted point value.
 */
export function computePoints(scoreA: number, scoreB: number): { pointsA: number; pointsB: number } {
  if (scoreA === scoreB) {
    throw new Error("Cannot compute points on a tie");
  }
  const winner = Math.max(scoreA, scoreB);
  const loser = Math.min(scoreA, scoreB);
  const total = winner + loser;

  let loserPoints = total === 0 ? 9 : Math.round(20 * (loser / total));
  loserPoints = Math.max(1, Math.min(9, loserPoints));
  const winnerPoints = 20 - loserPoints;

  return scoreA >= scoreB
    ? { pointsA: winnerPoints, pointsB: loserPoints }
    : { pointsA: loserPoints, pointsB: winnerPoints };
}
