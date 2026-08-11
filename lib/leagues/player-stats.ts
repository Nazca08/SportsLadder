import type { SupabaseClient } from "@supabase/supabase-js";

export type OpponentRecord = { opponentId: string; opponentName: string; wins: number; losses: number };
export type LevelRecord = { level: string; wins: number; losses: number };
export type PlayerStats = {
  overallWins: number;
  overallLosses: number;
  byLevel: LevelRecord[];
  byOpponent: OpponentRecord[];
};

const EMPTY_STATS: PlayerStats = { overallWins: 0, overallLosses: 0, byLevel: [], byOpponent: [] };

/**
 * Pulls together a player's full match history across every league they've
 * ever played in (not just one) -- their overall record, broken down by the
 * skill level of the league each match was in, and head-to-head against
 * every opponent they've faced.
 */
export async function computePlayerStats(supabase: SupabaseClient, userId: string): Promise<PlayerStats> {
  const { data: teams } = await supabase
    .from("teams")
    .select("id")
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`);
  const entrantIds = [userId, ...(teams ?? []).map((t) => t.id)];

  const orFilter = `entrant_a_id.in.(${entrantIds.join(",")}),entrant_b_id.in.(${entrantIds.join(",")})`;
  const { data: matches } = await supabase
    .from("matches")
    .select("id, entrant_a_id, entrant_b_id, league_season_id, status")
    .eq("status", "completed")
    .or(orFilter);

  if (!matches || matches.length === 0) return EMPTY_STATS;

  const matchIds = matches.map((m) => m.id);
  const { data: results } = await supabase.from("match_results").select("*").in("match_id", matchIds);
  const resultByMatch = new Map((results ?? []).map((r) => [r.match_id, r]));

  const leagueSeasonIds = Array.from(new Set(matches.map((m) => m.league_season_id)));
  const { data: leagueSeasons } = await supabase
    .from("league_seasons")
    .select("id, league_templates(level)")
    .in("id", leagueSeasonIds);
  const levelBySeasonId = new Map(
    (leagueSeasons ?? []).map((ls: any) => {
      const template = Array.isArray(ls.league_templates) ? ls.league_templates[0] : ls.league_templates;
      return [ls.id, template?.level ?? "?"];
    })
  );

  const opponentIds = new Set<string>();
  const playedMatches = matches
    .map((m) => {
      const result = resultByMatch.get(m.id);
      if (!result) return null;
      const myEntrant = entrantIds.includes(m.entrant_a_id) ? m.entrant_a_id : m.entrant_b_id;
      const opponentEntrant = myEntrant === m.entrant_a_id ? m.entrant_b_id : m.entrant_a_id;
      if (!opponentEntrant) return null;
      opponentIds.add(opponentEntrant);
      const won = result.winner_entrant_id === myEntrant;
      const level = levelBySeasonId.get(m.league_season_id) ?? "?";
      return { opponentEntrant, won, level };
    })
    .filter((x): x is { opponentEntrant: string; won: boolean; level: string } => x !== null);

  const opponentIdList = Array.from(opponentIds);
  const [{ data: opponentProfiles }, { data: opponentTeams }] = await Promise.all([
    opponentIdList.length
      ? supabase.from("profiles").select("id, full_name, display_name").in("id", opponentIdList)
      : Promise.resolve({ data: [] as any[] }),
    opponentIdList.length
      ? supabase.from("teams").select("id, name").in("id", opponentIdList)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const nameById = new Map<string, string>();
  (opponentProfiles ?? []).forEach((p: any) => nameById.set(p.id, p.display_name || p.full_name));
  (opponentTeams ?? []).forEach((t: any) => nameById.set(t.id, t.name));

  let overallWins = 0;
  let overallLosses = 0;
  const levelMap = new Map<string, LevelRecord>();
  const opponentMap = new Map<string, OpponentRecord>();

  for (const pm of playedMatches) {
    if (pm.won) overallWins++;
    else overallLosses++;

    if (!levelMap.has(pm.level)) levelMap.set(pm.level, { level: pm.level, wins: 0, losses: 0 });
    const levelRow = levelMap.get(pm.level)!;
    if (pm.won) levelRow.wins++;
    else levelRow.losses++;

    if (!opponentMap.has(pm.opponentEntrant)) {
      opponentMap.set(pm.opponentEntrant, {
        opponentId: pm.opponentEntrant,
        opponentName: nameById.get(pm.opponentEntrant) ?? "Unknown",
        wins: 0,
        losses: 0,
      });
    }
    const oppRow = opponentMap.get(pm.opponentEntrant)!;
    if (pm.won) oppRow.wins++;
    else oppRow.losses++;
  }

  return {
    overallWins,
    overallLosses,
    byLevel: Array.from(levelMap.values()).sort((a, b) => a.level.localeCompare(b.level)),
    byOpponent: Array.from(opponentMap.values()).sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses)),
  };
}
