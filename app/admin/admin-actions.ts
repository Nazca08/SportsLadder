"use server";

import { requireAdmin } from "@/lib/admin/require-admin";
import { resolveTennisMatch, type SetScore } from "@/lib/scoring/tennis";
import { resolvePickleballMatch, type GameScore } from "@/lib/scoring/pickleball";
import { computePoints } from "@/lib/scoring/points";

type ScorePayload = { sport: "tennis"; sets: SetScore[] } | { sport: "pickleball"; games: GameScore[] };

/**
 * Admin directly sets a match's final score -- skips the normal
 * report-then-confirm flow entirely, since admin authority is the
 * resolution here, not another player's confirmation.
 */
export async function adminSetScore(matchId: string, payload: ScorePayload) {
  const { user, admin } = await requireAdmin();

  const { data: match } = await admin.from("matches").select("*").eq("id", matchId).single();
  if (!match) throw new Error("Match not found.");

  let scoreA: number;
  let scoreB: number;
  let winnerSide: "a" | "b";
  let roundsPlayed: { a: number; b: number }[];

  if (payload.sport === "tennis") {
    const result = resolveTennisMatch(payload.sets);
    if (!result.valid) throw new Error(result.error);
    scoreA = result.gamesA;
    scoreB = result.gamesB;
    winnerSide = result.winnerSide;
    roundsPlayed = result.sets;
  } else {
    const result = resolvePickleballMatch(payload.games);
    if (!result.valid) throw new Error(result.error);
    scoreA = result.scoreA;
    scoreB = result.scoreB;
    winnerSide = result.winnerSide;
    roundsPlayed = result.games;
  }

  const { pointsA, pointsB } = computePoints(scoreA, scoreB);
  const winnerEntrantId = winnerSide === "a" ? match.entrant_a_id : match.entrant_b_id;

  // Clear out any old/disputed result first, then write the admin-set one.
  await admin.from("match_results").delete().eq("match_id", matchId);

  const { error: insertError } = await admin.from("match_results").insert({
    match_id: matchId,
    sets: roundsPlayed,
    winner_entrant_id: winnerEntrantId,
    points_a: pointsA,
    points_b: pointsB,
    reported_by: user.id,
    confirmed_by: user.id,
  });
  if (insertError) throw insertError;

  const { error: statusError } = await admin.from("matches").update({ status: "completed" }).eq("id", matchId);
  if (statusError) throw statusError;
}

/** Resets a disputed match back to scheduled, clearing any result, so the players can report again themselves. */
export async function adminResetForReReport(matchId: string) {
  const { admin } = await requireAdmin();

  await admin.from("match_results").delete().eq("match_id", matchId);
  const { error } = await admin.from("matches").update({ status: "scheduled" }).eq("id", matchId);
  if (error) throw error;
}
