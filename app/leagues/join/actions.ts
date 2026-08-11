"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAuthedClient } from "@/lib/supabase/authed-client";
import { ensureLeagueSeason } from "@/lib/leagues/ensure-league-season";

export type PlayerSearchResult = { id: string; full_name: string };

/** Search other players by name, for picking a doubles partner. */
export async function searchPlayers(query: string): Promise<PlayerSearchResult[]> {
  if (query.trim().length < 2) return [];
  const { supabase, user } = await getAuthedClient();
  if (!supabase || !user) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .ilike("full_name", `%${query.trim()}%`)
    .neq("id", user.id)
    .limit(8);

  if (error) throw error;
  return data ?? [];
}

export async function joinLeague(formData: FormData) {
  const { supabase, user } = await getAuthedClient();
  if (!supabase || !user) redirect("/login");

  const sport = String(formData.get("sport"));
  const format = String(formData.get("format"));
  const division = String(formData.get("division"));
  const level = String(formData.get("level"));
  const partnerId = formData.get("partnerId") ? String(formData.get("partnerId")) : null;

  if (format === "doubles" && !partnerId) {
    throw new Error("Pick a partner to join a doubles league.");
  }

  const leagueSeasonId = await ensureLeagueSeason(sport, format, division, level);

  let entrantId: string;
  if (format === "doubles") {
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    const { data: partner } = await supabase.from("profiles").select("full_name").eq("id", partnerId!).single();

    const { data: teamId, error: teamError } = await supabase.rpc("create_team", {
      p_league_season_id: leagueSeasonId,
      p_name: `${profile?.full_name ?? "You"} & ${partner?.full_name ?? "Partner"}`,
      p_player1_id: user.id,
      p_player2_id: partnerId!,
    });
    if (teamError) throw teamError;
    entrantId = teamId as string;
  } else {
    entrantId = user.id;
  }

  const { data: enrollmentId, error: enrollError } = await supabase.rpc("create_enrollment", {
    p_league_season_id: leagueSeasonId,
    p_player_id: format === "doubles" ? null : user.id,
    p_team_id: format === "doubles" ? entrantId : null,
    p_paid: false,
  });
  if (enrollError) throw enrollError;

  revalidatePath("/dashboard");
  redirect(`/leagues/${enrollmentId}`);
}
