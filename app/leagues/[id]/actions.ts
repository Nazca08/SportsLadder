"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthedClient } from "@/lib/supabase/authed-client";
import { getMyEntrantId, getEntrantIdForUserInMatch } from "@/lib/leagues/entrants";
import { resolveTennisMatch, type SetScore } from "@/lib/scoring/tennis";
import { resolvePickleballMatch, type GameScore } from "@/lib/scoring/pickleball";
import { computePoints } from "@/lib/scoring/points";

async function requireUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return { supabase, user };
}

export async function createOffer(leagueSeasonId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const entrantId = await getMyEntrantId(supabase, leagueSeasonId, user.id);
  if (!entrantId) throw new Error("You're not enrolled in this league.");

  const { error } = await supabase.from("matches").insert({
    league_season_id: leagueSeasonId,
    context: "league",
    match_type: "offer",
    entrant_a_id: entrantId,
    status: "open",
    scheduled_date: String(formData.get("date")),
    scheduled_time: String(formData.get("time")),
    location: String(formData.get("location")),
    created_by: user.id,
  });
  if (error) throw error;
}

export async function cancelMatch(matchId: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("matches")
    .update({ status: "cancelled" })
    .eq("id", matchId)
    .eq("created_by", user.id);
  if (error) throw error;
}

export async function acceptOffer(matchId: string) {
  const { supabase, user } = await requireUser();
  const { data: match } = await supabase.from("matches").select("*").eq("id", matchId).single();
  if (!match) throw new Error("Offer not found.");
  if (match.status !== "open") throw new Error("This offer isn't open anymore.");

  const entrantId = await getMyEntrantId(supabase, match.league_season_id, user.id);
  if (!entrantId) throw new Error("You're not enrolled in this league.");
  if (entrantId === match.entrant_a_id) throw new Error("You can't accept your own offer.");

  const { error } = await supabase
    .from("matches")
    .update({ entrant_b_id: entrantId, status: "scheduled" })
    .eq("id", matchId)
    .eq("status", "open");
  if (error) throw error;
}

export async function sendChallenge(leagueSeasonId: string, opponentEntrantId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const entrantId = await getMyEntrantId(supabase, leagueSeasonId, user.id);
  if (!entrantId) throw new Error("You're not enrolled in this league.");
  if (entrantId === opponentEntrantId) throw new Error("You can't challenge yourself.");

  const { error } = await supabase.from("matches").insert({
    league_season_id: leagueSeasonId,
    context: "league",
    match_type: "challenge",
    entrant_a_id: entrantId,
    entrant_b_id: opponentEntrantId,
    status: "pending",
    scheduled_date: String(formData.get("date")),
    scheduled_time: String(formData.get("time")),
    location: String(formData.get("location")),
    created_by: user.id,
  });
  if (error) throw error;
}

export async function respondChallenge(matchId: string, accept: boolean) {
  const { supabase, user } = await requireUser();
  const { data: match } = await supabase.from("matches").select("*").eq("id", matchId).single();
  if (!match) throw new Error("Challenge not found.");

  const entrantId = await getMyEntrantId(supabase, match.league_season_id, user.id);
  if (entrantId !== match.entrant_b_id) throw new Error("This challenge isn't addressed to you.");

  const { error } = await supabase
    .from("matches")
    .update({ status: accept ? "scheduled" : "declined" })
    .eq("id", matchId)
    .eq("status", "pending");
  if (error) throw error;
}

type ScorePayload = { sport: "tennis"; sets: SetScore[] } | { sport: "pickleball"; games: GameScore[] };

/** Either side reports a score. Stays unconfirmed until the opponent confirms (see confirmScore). */
export async function reportScore(matchId: string, payload: ScorePayload) {
  const { supabase, user } = await requireUser();
  const { data: match } = await supabase.from("matches").select("*").eq("id", matchId).single();
  if (!match) throw new Error("Match not found.");
  if (match.status !== "scheduled") throw new Error("This match isn't ready to be scored.");

  const entrantId = await getEntrantIdForUserInMatch(supabase, match, user.id);
  if (!entrantId) throw new Error("You're not a participant in this match.");

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

  const { error } = await supabase.from("match_results").insert({
    match_id: matchId,
    sets: roundsPlayed,
    winner_entrant_id: winnerEntrantId,
    points_a: pointsA,
    points_b: pointsB,
    reported_by: user.id,
  });
  if (error) throw error;
}

/** The non-reporting side confirms the score, which finalizes the match and applies points to standings. */
export async function confirmScore(matchId: string) {
  const { supabase, user } = await requireUser();
  const { data: match } = await supabase.from("matches").select("*").eq("id", matchId).single();
  if (!match) throw new Error("Match not found.");

  const { data: result } = await supabase.from("match_results").select("*").eq("match_id", matchId).single();
  if (!result) throw new Error("No score has been reported yet.");
  if (result.confirmed_by) throw new Error("This score is already confirmed.");

  const myEntrantId = await getEntrantIdForUserInMatch(supabase, match, user.id);
  const reporterEntrantId = await getEntrantIdForUserInMatch(supabase, match, result.reported_by);
  if (!myEntrantId) throw new Error("You're not a participant in this match.");
  if (myEntrantId === reporterEntrantId) throw new Error("The reporting side can't also confirm the score.");

  const { error: e1 } = await supabase
    .from("match_results")
    .update({ confirmed_by: user.id })
    .eq("match_id", matchId);
  if (e1) throw e1;

  const { error: e2 } = await supabase.from("matches").update({ status: "completed" }).eq("id", matchId);
  if (e2) throw e2;
}

/** Rejects a reported score so it can be re-entered, instead of confirming a wrong one. */
export async function disputeScore(matchId: string) {
  const { supabase, user } = await requireUser();
  const { data: match } = await supabase.from("matches").select("*").eq("id", matchId).single();
  if (!match) throw new Error("Match not found.");

  const myEntrantId = await getEntrantIdForUserInMatch(supabase, match, user.id);
  if (!myEntrantId) throw new Error("You're not a participant in this match.");

  const { error: deleteError } = await supabase.from("match_results").delete().eq("match_id", matchId);
  if (deleteError) throw deleteError;

  // Marked disputed (not just reset to scheduled) so an admin can find it and
  // step in -- see app/admin for resolving disputes.
  const { error: statusError } = await supabase.from("matches").update({ status: "disputed" }).eq("id", matchId);
  if (statusError) throw statusError;
}

/** Leaves a league. For a doubles enrollment, this removes the whole team's spot -- see leave_league() for the ownership check. */
export async function leaveLeague(enrollmentId: string) {
  const { supabase, user } = await getAuthedClient();
  if (!supabase || !user) throw new Error("Not signed in.");

  const { error } = await supabase.rpc("leave_league", { p_enrollment_id: enrollmentId });
  if (error) throw error;
}
