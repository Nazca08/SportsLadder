"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAuthedClient } from "@/lib/supabase/authed-client";
import { ensureLeagueSeason, ensureLeagueSeasonForTemplate } from "@/lib/leagues/ensure-league-season";
import { createCheckoutUrl } from "@/lib/payments/checkout";
import { leagueLabel } from "@/lib/leagues/label";


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

  const partnerId = formData.get("partnerId") ? String(formData.get("partnerId")) : null;

  // A named club league is picked whole, so its sport/format/etc come from the
  // stored row rather than from dropdowns the player never saw.
  const clubTemplateId = formData.get("clubTemplateId")
    ? String(formData.get("clubTemplateId"))
    : null;

  let sport: string;
  let format: string;
  let division: string;
  let level: string;
  let area: string;
  let template: Record<string, any> | null = null;
  let leagueSeasonId: string;

  if (clubTemplateId) {
    const { data: row } = await supabase
      .from("league_templates")
      .select("sport, format, division, level, area, name")
      .eq("id", clubTemplateId)
      .single();
    if (!row) throw new Error("That league no longer exists.");

    template = row;
    sport = String(row.sport);
    format = String(row.format);
    division = String(row.division);
    level = String(row.level);
    area = String(row.area);

    if (format === "doubles" && !partnerId) {
      throw new Error("Pick a partner to join a doubles league.");
    }

    // Save the rating on the profile so it follows the player everywhere,
    // rather than being trapped in this one enrollment.
    const myRating = formData.get("myRating") ? String(formData.get("myRating")) : "";
    if (myRating) {
      await supabase.from("profiles").update({ rating: myRating }).eq("id", user.id);
    }

    leagueSeasonId = await ensureLeagueSeasonForTemplate(clubTemplateId);
  } else {
    sport = String(formData.get("sport"));
    format = String(formData.get("format"));
    division = String(formData.get("division"));
    level = String(formData.get("level"));
    area = String(formData.get("area"));

    if (!area) {
      throw new Error("Pick your area to continue.");
    }
    if (format === "doubles" && !partnerId) {
      throw new Error("Pick a partner to join a doubles league.");
    }

    template = { sport, format, division, level, area, name: null };
    leagueSeasonId = await ensureLeagueSeason(sport, format, division, level, area);
  }

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
    leagueLabel(template as any),
    user.email ?? undefined
  );
  redirect(checkoutUrl);
}

/**
 * Form-action wrapper around resumeCheckout.
 *
 * The enrollment id travels in the form body rather than being closed over by
 * an inline server action. Closing over it makes Next.js encrypt the bound
 * argument, which fails at runtime with "Cipher job failed" -- reading it back
 * out of FormData sidesteps that machinery entirely.
 */
export async function resumeCheckoutFromForm(formData: FormData) {
  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  if (!enrollmentId) throw new Error("Missing enrollment id.");
  await resumeCheckout(enrollmentId);
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
    .select("id, paid, league_seasons(league_templates(sport, format, division, level, area, name))")
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
    t ? leagueLabel(t) : "League entry",
    user.email ?? undefined
  );
  redirect(checkoutUrl);
}
