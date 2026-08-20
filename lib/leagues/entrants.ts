import type { SupabaseClient } from "@supabase/supabase-js";

/** Maps every entrant id (player or team) in a league season to a display name. */
export async function getEntrantNames(
  supabase: SupabaseClient,
  leagueSeasonId: string
): Promise<Map<string, string>> {
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("player_id, team_id")
    .eq("league_season_id", leagueSeasonId);

  const playerIds = (enrollments ?? []).map((e) => e.player_id).filter(Boolean) as string[];
  const teamIds = (enrollments ?? []).map((e) => e.team_id).filter(Boolean) as string[];

  const [{ data: profiles }, { data: teams }] = await Promise.all([
    playerIds.length
      ? supabase.from("profiles").select("id, full_name, display_name").in("id", playerIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string; display_name: string | null }[] }),
    teamIds.length
      ? supabase.from("teams").select("id, name").in("id", teamIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const map = new Map<string, string>();
  (profiles ?? []).forEach((p) => map.set(p.id, p.display_name || p.full_name));
  (teams ?? []).forEach((t) => map.set(t.id, t.name));
  return map;
}

/** Maps every player entrant in a league season to their avatar URL (teams don't have one). */
export async function getEntrantAvatars(
  supabase: SupabaseClient,
  leagueSeasonId: string
): Promise<Map<string, string | null>> {
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("player_id")
    .eq("league_season_id", leagueSeasonId);

  const playerIds = (enrollments ?? []).map((e) => e.player_id).filter(Boolean) as string[];
  if (playerIds.length === 0) return new Map();

  const { data: profiles } = await supabase.from("profiles").select("id, avatar_url").in("id", playerIds);
  return new Map((profiles ?? []).map((p) => [p.id, p.avatar_url ?? null]));
}

/** Returns the entrant id (player id, or team id) this user competes as in a league. Null if not enrolled. */
export async function getMyEntrantId(
  supabase: SupabaseClient,
  leagueSeasonId: string,
  userId: string
): Promise<string | null> {
  // limit(1) rather than maybeSingle(): maybeSingle errors when more than one
  // row matches, and that error surfaced as "You're not enrolled in this
  // league" for anyone holding a duplicate enrollment -- telling a player who
  // was in the league twice that they were not in it at all. A unique index
  // now prevents duplicates, but the lookup should not be the thing that
  // breaks if data ever gets messy again.
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("player_id")
    .eq("league_season_id", leagueSeasonId)
    .eq("player_id", userId)
    .limit(1);
  if (enrollments && enrollments.length > 0) return userId;

  const { data: teams } = await supabase
    .from("teams")
    .select("id")
    .eq("league_season_id", leagueSeasonId)
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .limit(1);

  return teams && teams.length > 0 ? (teams[0].id as string) : null;
}

/**
 * Given a match and a specific user, figures out which side of that match (if
 * either) that user competes as -- resolving through team membership for
 * doubles matches. Used to stop the reporting side from also confirming
 * their own score.
 */
export async function getEntrantIdForUserInMatch(
  supabase: SupabaseClient,
  match: { entrant_a_id: string; entrant_b_id: string | null },
  userId: string
): Promise<string | null> {
  if (match.entrant_a_id === userId || match.entrant_b_id === userId) return userId;

  const candidateIds = [match.entrant_a_id, match.entrant_b_id].filter(Boolean) as string[];
  if (candidateIds.length === 0) return null;

  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .in("id", candidateIds)
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .maybeSingle();

  return team ? team.id : null;
}

/**
 * Self-reported rating per entrant, for leagues that mix ratings in one ladder.
 * Singles only by design: a doubles team has two ratings and no single number
 * that honestly describes it, and open leagues are currently singles anyway.
 */
export async function getEntrantRatings(
  supabase: SupabaseClient,
  leagueSeasonId: string
): Promise<Map<string, string | null>> {
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("player_id")
    .eq("league_season_id", leagueSeasonId);

  const playerIds = (enrollments ?? []).map((e) => e.player_id).filter(Boolean) as string[];
  if (playerIds.length === 0) return new Map();

  const { data: profiles } = await supabase.from("profiles").select("id, rating").in("id", playerIds);
  return new Map((profiles ?? []).map((p) => [p.id, (p as any).rating ?? null]));
}
