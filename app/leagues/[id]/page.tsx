import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyEntrantId, getEntrantNames, getEntrantAvatars, getEntrantIdForUserInMatch } from "@/lib/leagues/entrants";
import { computeLeagueStandings } from "@/lib/leagues/standings";
import { SignOutButton } from "@/components/sign-out-button";
import { LeaveLeagueButton } from "@/components/leave-league-button";
import { AREAS } from "@/lib/leagues/divisions";
import { LeagueClient } from "./league-client";

const areaName = (code?: string) => AREAS.find(([c]) => c === code)?.[1] ?? code;

function leagueLabel(t: { sport: string; format: string; division: string; level: string; area?: string }) {
  const sport = t.sport === "tennis" ? "Tennis" : "Pickleball";
  const format = t.format === "doubles" ? "Doubles" : "Singles";
  const division = t.division === "mixed" ? "Mixed" : t.division === "mens" ? "Men's" : "Women's";
  const area = areaName(t.area);
  return `${sport} ${format} \u00b7 ${division} \u00b7 ${t.level}${area ? ` \u00b7 ${area}` : ""}`;
}

export default async function LeaguePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("league_season_id")
    .eq("id", params.id)
    .single();
  if (!enrollment) notFound();

  const leagueSeasonId = enrollment.league_season_id as string;

  const { data: leagueSeason } = await supabase
    .from("league_seasons")
    .select("id, league_templates(sport, format, division, level, area)")
    .eq("id", leagueSeasonId)
    .single();
  if (!leagueSeason) notFound();

  const template = Array.isArray(leagueSeason.league_templates)
    ? leagueSeason.league_templates[0]
    : leagueSeason.league_templates;

  const myEntrantId = await getMyEntrantId(supabase, leagueSeasonId, user.id);
  const entrantNames = await getEntrantNames(supabase, leagueSeasonId);
  const entrantAvatars = await getEntrantAvatars(supabase, leagueSeasonId);
  const standings = await computeLeagueStandings(supabase, leagueSeasonId);

  const { data: allMatches } = await supabase
    .from("matches")
    .select("*")
    .eq("league_season_id", leagueSeasonId)
    .eq("context", "league")
    .neq("status", "cancelled")
    .neq("status", "declined");

  const matches = allMatches ?? [];
  const completedIds = matches.filter((m) => m.status === "completed" || m.status === "scheduled").map((m) => m.id);
  const { data: results } = completedIds.length
    ? await supabase.from("match_results").select("*").in("match_id", completedIds)
    : { data: [] as any[] };

  // Figure out which entrant (player or team) reported each result, so the
  // client can tell "you're waiting on the other side" apart from "you need
  // to confirm this" -- without this, the reporting side sees a Confirm
  // button that errors when clicked, which is confusing rather than helpful.
  const matchById = new Map(matches.map((m) => [m.id, m]));
  const resultsWithReporterEntrant = await Promise.all(
    (results ?? []).map(async (r) => {
      const match = matchById.get(r.match_id);
      const reporterEntrantId = match ? await getEntrantIdForUserInMatch(supabase, match, r.reported_by) : null;
      return { ...r, reporter_entrant_id: reporterEntrantId };
    })
  );
  const resultsByMatch = new Map(resultsWithReporterEntrant.map((r) => [r.match_id, r]));

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h1 className="font-display text-2xl font-bold">{template ? leagueLabel(template as any) : "League"}</h1>
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-chalk-dim text-sm hover:text-chalk">&larr; All leagues</a>
          <a href="/settings" className="text-chalk-dim text-sm hover:text-chalk">Settings</a>
          <LeaveLeagueButton enrollmentId={params.id} />
          <SignOutButton />
        </div>
      </div>
      <LeagueClient
        leagueSeasonId={leagueSeasonId}
        sport={(template as any)?.sport ?? "tennis"}
        myEntrantId={myEntrantId}
        entrantNames={Object.fromEntries(entrantNames)}
        entrantAvatars={Object.fromEntries(entrantAvatars)}
        standings={standings}
        matches={matches}
        resultsByMatch={Object.fromEntries(resultsByMatch)}
      />
    </main>
  );
}
