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

/**
 * Why this returns `{ error }` instead of throwing.
 *
 * Next.js redacts any error thrown out of a server action in production and
 * replaces it with a digest. Every real cause -- a missing column because a
 * migration has not been run, an RLS refusal, a duplicate enrollment -- arrived
 * on screen as the same meaningless string, which turned every bug report into
 * a guessing game. Returning the message keeps it intact.
 *
 * `redirect()` is deliberately called outside the try/catch: it works by
 * throwing, so catching it would swallow the successful path.
 */
export type JoinResult = { error: string };

function describe(e: unknown): string {
  if (e && typeof e === "object") {
    const err = e as Record<string, any>;
    // A PostgrestError. `message` alone is often "" or a bare code, so the
    // details and hint travel with it.
    if (err.message || err.code) {
      const parts = [err.message, err.details, err.hint].filter(Boolean);
      const text = parts.join(" — ") || "Database error";
      return err.code ? `${text} (${err.code})` : text;
    }
  }
  if (e instanceof Error) return e.message;
  return "Something went wrong.";
}

export async function joinLeague(formData: FormData): Promise<JoinResult | void> {
  const { supabase, user } = await getAuthedClient();
  if (!supabase || !user) redirect("/login");

  let checkoutUrl: string;

  try {
    const partnerId = formData.get("partnerId") ? String(formData.get("partnerId")) : null;

    // A named club league is picked whole, so its sport/format/etc come from the
    // stored row rather than from dropdowns the player never saw.
    const clubTemplateId = formData.get("clubTemplateId")
      ? String(formData.get("clubTemplateId"))
      : null;

    let format: string;
    let template: Record<string, any> | null = null;
    let leagueSeasonId: string;

    if (clubTemplateId) {
      const { data: row, error: templateError } = await supabase
        .from("league_templates")
        .select("sport, format, division, level, area, name")
        .eq("id", clubTemplateId)
        .maybeSingle();
      if (templateError) return { error: describe(templateError) };
      if (!row) return { error: "That league no longer exists." };

      template = row;
      format = String(row.format);

      if (format === "doubles" && !partnerId) {
        return { error: "Pick a partner to join a doubles league." };
      }

      // Save the rating on the profile so it follows the player everywhere,
      // rather than being trapped in this one enrollment.
      const myRating = formData.get("myRating") ? String(formData.get("myRating")) : "";
      if (myRating) {
        await supabase.from("profiles").update({ rating: myRating }).eq("id", user.id);
      }

      leagueSeasonId = await ensureLeagueSeasonForTemplate(clubTemplateId);
    } else {
      const sport = String(formData.get("sport"));
      format = String(formData.get("format"));
      const division = String(formData.get("division"));
      const level = String(formData.get("level"));
      const area = String(formData.get("area"));

      if (!area) return { error: "Pick your area to continue." };
      if (format === "doubles" && !partnerId) {
        return { error: "Pick a partner to join a doubles league." };
      }

      template = { sport, format, division, level, area, name: null };
      leagueSeasonId = await ensureLeagueSeason(sport, format, division, level, area);
    }

    let entrantId: string;
    if (format === "doubles") {
      // A team of one is not a team. Without this the RPC would be handed a
      // null second player and fail somewhere far less legible.
      if (!partnerId) return { error: "Pick a partner to join a doubles league." };
      if (partnerId === user.id) {
        return { error: "You cannot pair with yourself. Pick a different partner." };
      }

      const { data: profile } = await supabase
        .from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      const { data: partner } = await supabase
        .from("profiles").select("full_name").eq("id", partnerId).maybeSingle();
      if (!partner) {
        return { error: "That partner no longer has an account. Search again." };
      }

      const { data: teamId, error: teamError } = await supabase.rpc("create_team", {
        p_league_season_id: leagueSeasonId,
        p_name: `${profile?.full_name ?? "You"} & ${partner.full_name ?? "Partner"}`,
        p_player1_id: user.id,
        p_player2_id: partnerId,
      });
      if (teamError) return { error: `Could not create the team: ${describe(teamError)}` };
      if (!teamId) return { error: "Could not create the team." };
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
    if (enrollError) return { error: `Could not join the league: ${describe(enrollError)}` };
    if (!enrollmentId) return { error: "Could not join the league." };

    revalidatePath("/dashboard");

    // The enrollment exists but is unpaid, so it grants no access yet. Send the
    // player to Stripe; the webhook flips `paid` when the payment clears.
    checkoutUrl = await createCheckoutUrl(
      enrollmentId as string,
      format,
      leagueLabel(template as any),
      user.email ?? undefined,
      user.id
    );
  } catch (e) {
    return { error: describe(e) };
  }

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
  // Set when somebody chooses to cover their partner's share as well.
  await resumeCheckout(enrollmentId, formData.get("coverPartner") === "1");
}

/**
 * Restarts checkout for an enrollment that was created but never paid for --
 * the player closed the Stripe tab, or their card was declined.
 */
export async function resumeCheckout(enrollmentId: string, coverPartner = false) {
  const { supabase, user } = await getAuthedClient();
  if (!supabase || !user) redirect("/login");

  // RLS on enrollments limits this to the caller's own rows, so a player cannot
  // start a checkout for somebody else's enrollment.
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, paid, team_id, league_seasons(league_templates(sport, format, division, level, area, name))")
    .eq("id", enrollmentId)
    .single();

  if (!enrollment) throw new Error("Enrollment not found.");
  if (enrollment.paid) redirect(`/leagues/${enrollmentId}`);

  // Guards against a second charge. In doubles the enrollment stays unpaid
  // until both halves are in, so "not paid" is not the same as "you have not
  // paid" -- without this, the partner who paid first could be charged again
  // just by reloading the page.
  const { data: alreadyPaid } = await supabase
    .from("payments")
    .select("id")
    .eq("enrollment_id", enrollmentId)
    .eq("player_id", user.id)
    .eq("status", "paid")
    .maybeSingle();
  if (alreadyPaid) redirect(`/leagues/${enrollmentId}`);

  const ls: any = Array.isArray(enrollment.league_seasons)
    ? enrollment.league_seasons[0]
    : enrollment.league_seasons;
  const t: any = Array.isArray(ls?.league_templates) ? ls.league_templates[0] : ls?.league_templates;

  // Who else this payment should settle. Only ever the other half of a doubles
  // pair, and only if they have not already paid.
  let covers: string[] = [];
  if (coverPartner && (enrollment as any).team_id) {
    const { data: team } = await supabase
      .from("teams")
      .select("player1_id, player2_id")
      .eq("id", (enrollment as any).team_id)
      .maybeSingle();
    const partnerId =
      team?.player1_id === user.id ? team?.player2_id : team?.player1_id;
    if (partnerId) {
      const { data: partnerPaid } = await supabase
        .from("payments")
        .select("id")
        .eq("enrollment_id", enrollmentId)
        .eq("player_id", partnerId)
        .eq("status", "paid")
        .maybeSingle();
      if (!partnerPaid) covers = [partnerId as string];
    }
  }

  const checkoutUrl = await createCheckoutUrl(
    enrollmentId,
    t?.format ?? "singles",
    t ? leagueLabel(t) : "League entry",
    user.email ?? undefined,
    user.id,
    covers
  );
  redirect(checkoutUrl);
}
