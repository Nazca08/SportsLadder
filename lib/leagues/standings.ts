import type { SupabaseClient } from "@supabase/supabase-js";
import { rankStandings, type StandingsRow } from "@/lib/scoring/standings";
import { computeExchange, seedFromRating } from "@/lib/scoring/elo";

export type LeagueStandings = {
  rows: StandingsRow[];
  /** Points won/lost per match, so the match list can show what each one moved. */
  deltaByMatch: Record<string, { a: number; b: number }>;
};

/**
 * Replays every completed match in order and returns the resulting table.
 *
 * Order matters here in a way it did not before: under a running sum the total
 * was the same whichever order you added the matches in, but a zero-sum
 * exchange depends on what each player's score was AT THE TIME, so matches are
 * processed oldest first.
 *
 * Nothing is stored. The table is derived from match history on every read,
 * which means a corrected or deleted result cannot leave a stale score behind.
 */
export async function computeLeagueStandings(
  supabase: SupabaseClient,
  leagueSeasonId: string
): Promise<LeagueStandings> {
  const { data: matches } = await supabase
    .from("matches")
    .select("id, entrant_a_id, entrant_b_id, status, created_at")
    .eq("league_season_id", leagueSeasonId)
    .eq("status", "completed");

  const matchIds = (matches ?? []).map((m) => m.id);
  const { data: results } = matchIds.length
    ? await supabase
        .from("match_results")
        .select("match_id, winner_entrant_id, sets, created_at")
        .in("match_id", matchIds)
    : { data: [] as any[] };

  const resultByMatch = new Map((results ?? []).map((r) => [r.match_id, r]));

  // Seed every entrant from their self-reported rating. Teams and players
  // without one start at the default.
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("player_id, team_id")
    .eq("league_season_id", leagueSeasonId);

  const playerIds = (enrollments ?? []).map((e) => e.player_id).filter(Boolean) as string[];
  const { data: profiles } = playerIds.length
    ? await supabase.from("profiles").select("id, rating").in("id", playerIds)
    : { data: [] as { id: string; rating: string | null }[] };
  const ratingById = new Map((profiles ?? []).map((p) => [p.id, (p as any).rating ?? null]));

  const rowsByEntrant = new Map<string, StandingsRow>();

  function getRow(id: string): StandingsRow {
    if (!rowsByEntrant.has(id)) {
      rowsByEntrant.set(id, {
        entrantId: id,
        points: seedFromRating(ratingById.get(id)),
        wins: 0,
        losses: 0,
        played: 0,
        beatenEntrantIds: [],
      });
    }
    return rowsByEntrant.get(id)!;
  }

  (enrollments ?? []).forEach((e) => {
    const id = e.player_id ?? e.team_id;
    if (id) getRow(id);
  });

  // Oldest first. Result time is preferred over match creation time: a match
  // arranged weeks ago but played today should count as today.
  const ordered = [...(matches ?? [])].sort((m1, m2) => {
    const t1 = resultByMatch.get(m1.id)?.created_at ?? m1.created_at;
    const t2 = resultByMatch.get(m2.id)?.created_at ?? m2.created_at;
    return String(t1).localeCompare(String(t2));
  });

  const deltaByMatch: Record<string, { a: number; b: number }> = {};

  ordered.forEach((m) => {
    const result = resultByMatch.get(m.id);
    if (!result || !m.entrant_b_id) return;

    const rowA = getRow(m.entrant_a_id);
    const rowB = getRow(m.entrant_b_id);

    const sets = (result.sets ?? []) as { a: number; b: number }[];
    const gamesA = sets.reduce((sum, s) => sum + (s.a ?? 0), 0);
    const gamesB = sets.reduce((sum, s) => sum + (s.b ?? 0), 0);

    const aWon = result.winner_entrant_id === m.entrant_a_id;
    const winner = aWon ? rowA : rowB;
    const loser = aWon ? rowB : rowA;
    const winnerGames = aWon ? gamesA : gamesB;
    const loserGames = aWon ? gamesB : gamesA;

    const exchange = computeExchange(winner.points, loser.points, winnerGames, loserGames);

    winner.points += exchange;
    loser.points -= exchange;
    winner.wins++;
    loser.losses++;
    winner.played++;
    loser.played++;
    winner.beatenEntrantIds.push(loser.entrantId);

    deltaByMatch[m.id] = aWon ? { a: exchange, b: -exchange } : { a: -exchange, b: exchange };
  });

  return { rows: rankStandings(Array.from(rowsByEntrant.values())), deltaByMatch };
}
