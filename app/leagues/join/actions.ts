"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAuthedClient } from "@/lib/supabase/authed-client";
import { ensureLeagueSeason } from "@/lib/leagues/ensure-league-season";
import { createCheckoutUrl } from "@/lib/payments/checkout";
import { AREAS } from "@/lib/leagues/divisions";

/** Human-readable league name, used as the Stripe line item description. */
function describeLeague(sport: string, format: string, division: string, level: string, area: string) {
  const s = sport === "tennis" ? "Tennis" : "Pickleball";
  const f = format === "doubles" ? "Doubles" : "Singles";
  const d = division === "mixed" ? "Mixed" : division === "mens" ? "Men's" : "Women's";
  const a = AREAS.find(([code]) => code === area)?.[1] ?? area;
  return `${s} ${f} \u00b7 ${d} \u00b7 ${level} \u00b7 ${a}`;
}

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
  const area = String(formData.get("area"));
  const partnerId = formData.get("partnerId") ? String(formData.get("partnerId")) : null;

  if (!area) {
    throw new Error("Pick your area to continue.");
  }
  if (format === "doubles" && !partnerId) {
    throw new Error("Pick a partner to join a doubles league.");
  }

  const leagueSeasonId = await ensureLeagueSeason(sport, format, division, level, area);

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

  // The enrollment exists but is unpaid, so it grants no access yet. Send the
  // player to Stripe; the webhook flips `paid` when the payment clears.
  const checkoutUrl = await createCheckoutUrl(
    enrollmentId as string,
    format,
    describeLeague(sport, format, division, level, area),
    user.email ?? undefined
  );
  redirect(checkoutUrl);
}

/**
 * Restarts checkout for an enrollment that was created but never paid for --
 * the player closed the Stripe tab, or their card was declined.
 */
export async function resumeCheckout(enrollmentId: string) {
  const { supabase, user } = await getAuthedClient();
  if (!supabase || !user) redirect("/login");

  // RLS on enrollments limits this to the caller's own rows, so a player cannot
  // start a checkout for somebody else's enrollment.
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, paid, league_seasons(league_templates(sport, format, division, level, area))")
    .eq("id", enrollmentId)
    .single();

  if (!enrollment) throw new Error("Enrollment not found.");
  if (enrollment.paid) redirect(`/leagues/${enrollmentId}`);

  const ls: any = Array.isArray(enrollment.league_seasons)
    ? enrollment.league_seasons[0]
    : enrollment.league_seasons;
  const t: any = Array.isArray(ls?.league_templates) ? ls.league_templates[0] : ls?.league_templates;

  const checkoutUrl = await createCheckoutUrl(
    enrollmentId,
    t?.format ?? "singles",
    t ? describeLeague(t.sport, t.format, t.division, t.level, t.area) : "League entry",
    user.email ?? undefined
  );
  redirect(checkoutUrl);
}
