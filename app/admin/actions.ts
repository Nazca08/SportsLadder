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
    // Same rule the players' form uses. Without this the admin form validates
    // a Palmas single-set score against standard-set rules and rejects it.
    const { data: ls } = await admin
      .from("league_seasons")
      .select("league_templates(scoring_format)")
      .eq("id", match.league_season_id)
      .single();
    const tpl: any = Array.isArray((ls as any)?.league_templates)
      ? (ls as any).league_templates[0]
      : (ls as any)?.league_templates;
    const format = (tpl?.scoring_format ?? "standard") as "standard" | "single_set";

    const result = resolveTennisMatch(payload.sets, format);
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

// ---------------------------------------------------------------------------
// Player and enrollment management
// ---------------------------------------------------------------------------

/**
 * Corrects a player's self-reported rating.
 *
 * The rating seeds their score and sizes every match they play, so someone who
 * signed up as a 5.0 while playing like a 3.0 distorts awards for everyone they
 * meet until results catch up. Until now only the player could change it.
 */
export async function adminSetRating(playerId: string, rating: string) {
  const { admin } = await requireAdmin();

  const allowed = ["2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0", ""];
  if (!allowed.includes(rating)) throw new Error("That is not a valid rating.");

  const { error } = await admin
    .from("profiles")
    .update({ rating: rating === "" ? null : rating })
    .eq("id", playerId);
  if (error) throw error;
}

/**
 * Marks an enrollment paid or unpaid by hand.
 *
 * Needed whenever Stripe and the database disagree: a webhook that never
 * arrived, a comped entry, or a refund that should also revoke access.
 */
export async function adminSetPaid(enrollmentId: string, paid: boolean) {
  const { admin } = await requireAdmin();

  const { error } = await admin
    .from("enrollments")
    .update({ paid })
    .eq("id", enrollmentId);
  if (error) throw error;
}

/**
 * Removes a player from a league.
 *
 * Deletes the enrollment directly rather than calling leave_league, because
 * that function checks auth.uid() against the enrollment's owner and an admin
 * is by definition not the owner. Pending payment rows go with it; a real
 * payment survives, since payments.enrollment_id is ON DELETE SET NULL and the
 * row keeps its own record of who paid what.
 */
export async function adminRemoveFromLeague(enrollmentId: string) {
  const { admin } = await requireAdmin();

  await admin.from("payments").delete().eq("enrollment_id", enrollmentId).eq("status", "pending");

  const { error } = await admin.from("enrollments").delete().eq("id", enrollmentId);
  if (error) throw error;
}
