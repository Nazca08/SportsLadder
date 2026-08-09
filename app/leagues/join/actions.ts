"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureLeagueSeason } from "@/lib/leagues/ensure-league-season";

export type PlayerSearchResult = { id: string; full_name: string };

/** Search other players by name, for picking a doubles partner. */
export async function searchPlayers(query: string): Promise<PlayerSearchResult[]> {
  if (query.trim().length < 2) return [];
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

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
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // TEMPORARY DIAGNOSTIC -- remove once the RLS issue is resolved.
  const { data: whoAmI, error: whoAmIError } = await supabase.rpc("debug_whoami");
  console.log("DEBUG joinLeague -- getUser().id:", user.id, "| Postgres auth.uid():", whoAmI, "| rpc error:", whoAmIError);

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

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .insert({
        league_season_id: leagueSeasonId,
        name: `${profile?.full_name ?? "You"} & ${partner?.full_name ?? "Partner"}`,
        player1_id: user.id,
        player2_id: partnerId!,
      })
      .select("id")
      .single();
    if (teamError) throw teamError;
    entrantId = team.id;
  } else {
    entrantId = user.id;
  }

  // TEMPORARY DIAGNOSTIC -- second check, right before the insert that fails,
  // to see if identity has changed since the first check at the top.
  const { data: whoAmI2, error: whoAmI2Error } = await supabase.rpc("debug_whoami");
  console.log("DEBUG joinLeague (right before insert) -- user.id:", user.id, "| Postgres auth.uid():", whoAmI2, "| rpc error:", whoAmI2Error);

  const insertPayload = {
    league_season_id: leagueSeasonId,
    player_id: format === "doubles" ? null : user.id,
    team_id: format === "doubles" ? entrantId : null,
    // Real Stripe checkout is a follow-up integration -- nothing in the UI
    // gates on `paid` yet, so this stays false rather than faking a payment.
    paid: false,
  };
  console.log("DEBUG joinLeague -- exact insert payload:", JSON.stringify(insertPayload), "| format value:", JSON.stringify(format), "| typeof format:", typeof format);

  const { data: enrollment, error: enrollError } = await supabase
    .from("enrollments")
    .insert(insertPayload)
    .select("id")
    .single();
  if (enrollError) throw enrollError;

  revalidatePath("/dashboard");
  redirect(`/leagues/${enrollment.id}`);
}
