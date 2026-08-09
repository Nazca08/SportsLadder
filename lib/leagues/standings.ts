import type { SupabaseClient } from "@supabase/supabase-js";
import { rankStandings, type StandingsRow } from "@/lib/scoring/standings";

export async function computeLeagueStandings(
  supabase: SupabaseClient,
  leagueSeasonId: string
): Promise<StandingsRow[]> {
  const { data: matches } = await supabase
    .from("matches")
    .select("id, entrant_a_id, entrant_b_id, status")
    .eq("league_season_id", leagueSeasonId)
    .eq("status", "completed");

  const matchIds = (matches ?? []).map((m) => m.id);
  const { data: results } = matchIds.length
    ? await supabase
        .from("match_results")
        .select("match_id, winner_entrant_id, points_a, points_b")
        .in("match_id", matchIds)
    : { data: [] as { match_id: string; winner_entrant_id: string; points_a: number; points_b: number }[] };

  const resultByMatch = new Map((results ?? []).map((r) => [r.match_id, r]));
  const rowsByEntrant = new Map<string, StandingsRow>();

  function getRow(id: string): StandingsRow {
    if (!rowsByEntrant.has(id)) {
      rowsByEntrant.set(id, { entrantId: id, points: 0, wins: 0, losses: 0, beatenEntrantIds: [] });
    }
    return rowsByEntrant.get(id)!;
  }

  (matches ?? []).forEach((m) => {
    const result = resultByMatch.get(m.id);
    if (!result || !m.entrant_b_id) return;
    const rowA = getRow(m.entrant_a_id);
    const rowB = getRow(m.entrant_b_id);
    rowA.points += result.points_a;
    rowB.points += result.points_b;
    if (result.winner_entrant_id === m.entrant_a_id) {
      rowA.wins++;
      rowB.losses++;
      rowA.beatenEntrantIds.push(m.entrant_b_id);
    } else {
      rowB.wins++;
      rowA.losses++;
      rowB.beatenEntrantIds.push(m.entrant_a_id);
    }
  });

  // Make sure everyone enrolled shows up in standings, even at 0-0.
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("player_id, team_id")
    .eq("league_season_id", leagueSeasonId);
  (enrollments ?? []).forEach((e) => {
    const id = e.player_id ?? e.team_id;
    if (id) getRow(id);
  });

  return rankStandings(Array.from(rowsByEntrant.values()));
}
