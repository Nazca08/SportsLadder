import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/require-admin";
import { SignOutButton } from "@/components/sign-out-button";
import { AdminClient } from "./admin-client";
import { leagueLabel } from "@/lib/leagues/label";
import { computeLeagueStandings } from "@/lib/leagues/standings";


export default async function AdminPage() {
  let admin;
  try {
    ({ admin } = await requireAdmin());
  } catch {
    redirect("/dashboard");
  }

  const { data: matches } = await admin
    .from("matches")
    .select("*")
    .in("status", ["scheduled", "disputed"])
    .eq("context", "league")
    .order("scheduled_date", { ascending: true });

  const rows = matches ?? [];

  // League label per match -- resolved once per distinct league_season_id.
  const leagueSeasonIds = Array.from(new Set(rows.map((m) => m.league_season_id).filter(Boolean)));
  const { data: leagueSeasons } = leagueSeasonIds.length
    ? await admin.from("league_seasons").select("id, league_templates(sport, format, division, level, area, name)").in("id", leagueSeasonIds)
    : { data: [] as any[] };
  const leagueLabelBySeasonId = new Map(
    (leagueSeasons ?? []).map((ls: any) => {
      const t = Array.isArray(ls.league_templates) ? ls.league_templates[0] : ls.league_templates;
      return [ls.id, leagueLabel(t)];
    })
  );

  // Entrant names, resolved globally -- an entrant id (player or team) is
  // unique across the whole database, no league scoping needed for this.
  const entrantIds = Array.from(new Set(rows.flatMap((m) => [m.entrant_a_id, m.entrant_b_id]).filter(Boolean)));
  const [{ data: profiles }, { data: teams }] = await Promise.all([
    entrantIds.length ? admin.from("profiles").select("id, full_name, display_name").in("id", entrantIds) : Promise.resolve({ data: [] as any[] }),
    entrantIds.length ? admin.from("teams").select("id, name").in("id", entrantIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const nameById = new Map<string, string>();
  (profiles ?? []).forEach((p: any) => nameById.set(p.id, p.display_name || p.full_name));
  (teams ?? []).forEach((t: any) => nameById.set(t.id, t.name));

  // Sport per match, needed for the score form (tennis sets vs pickleball games).
  const sportBySeasonId = new Map(
    (leagueSeasons ?? []).map((ls: any) => {
      const t = Array.isArray(ls.league_templates) ? ls.league_templates[0] : ls.league_templates;
      return [ls.id, t?.sport === "pickleball" ? "pickleball" : "tennis"];
    })
  );

  // ---------------------------------------------------------------------
  // Leagues, rosters and history
  // ---------------------------------------------------------------------
  const { data: allSeasons } = await admin
    .from("league_seasons")
    .select("id, league_templates(id, sport, format, division, level, area, name, scoring_format)");

  const { data: allEnrollments } = await admin
    .from("enrollments")
    .select("id, league_season_id, player_id, team_id, paid, created_at");

  const { data: allProfiles } = await admin
    .from("profiles")
    .select("id, full_name, display_name, rating, is_admin, gender");

  const { data: completed } = await admin
    .from("matches")
    .select("id, league_season_id, entrant_a_id, entrant_b_id, scheduled_date, scheduled_time, location, created_at")
    .eq("status", "completed")
    .eq("context", "league")
    .order("scheduled_date", { ascending: false });

  const completedIds = (completed ?? []).map((m) => m.id);
  const { data: completedResults } = completedIds.length
    ? await admin.from("match_results").select("match_id, sets, winner_entrant_id").in("match_id", completedIds)
    : { data: [] as any[] };
  const resultByMatch = new Map((completedResults ?? []).map((r) => [r.match_id, r]));

  const profileById = new Map((allProfiles ?? []).map((p: any) => [p.id, p]));
  const nameOf = (id: string | null) => {
    if (!id) return null;
    const p: any = profileById.get(id);
    if (p) return p.display_name || p.full_name;
    return nameById.get(id) ?? "Unknown";
  };

  const templateOf = (seasonId: string) => {
    const ls: any = (allSeasons ?? []).find((x: any) => x.id === seasonId);
    if (!ls) return null;
    return Array.isArray(ls.league_templates) ? ls.league_templates[0] : ls.league_templates;
  };

  // One row per league season, with its roster and a live standings snapshot.
  const preparedLeagues = await Promise.all(
    (allSeasons ?? []).map(async (ls: any) => {
      const template = Array.isArray(ls.league_templates) ? ls.league_templates[0] : ls.league_templates;
      const roster = (allEnrollments ?? [])
        .filter((e) => e.league_season_id === ls.id)
        .map((e) => {
          const entrantId = (e.player_id ?? e.team_id) as string;
          const profile: any = e.player_id ? profileById.get(e.player_id) : null;
          return {
            enrollmentId: e.id as string,
            entrantId,
            playerId: (e.player_id ?? null) as string | null,
            name: nameOf(entrantId) ?? "Unknown",
            rating: (profile?.rating ?? null) as string | null,
            paid: Boolean(e.paid),
            joined: (e.created_at ?? "").slice(0, 10),
          };
        });

      const { rows: standings } = await computeLeagueStandings(admin as any, ls.id);
      const standingRows = standings.map((r) => ({
        entrantId: r.entrantId,
        name: nameOf(r.entrantId) ?? "Unknown",
        earned: r.earned,
        wins: r.wins,
        losses: r.losses,
        played: r.played,
      }));

      return {
        leagueSeasonId: ls.id as string,
        label: leagueLabel(template),
        scoringFormat: (template?.scoring_format ?? "standard") as string,
        roster,
        standings: standingRows,
        matchesPlayed: (completed ?? []).filter((m) => m.league_season_id === ls.id).length,
      };
    })
  );

  const preparedHistory = (completed ?? []).map((m) => {
    const result: any = resultByMatch.get(m.id);
    const sets = (result?.sets ?? []) as { a: number; b: number }[];
    return {
      id: m.id as string,
      leagueLabel: leagueLabel(templateOf(m.league_season_id)),
      date: m.scheduled_date as string | null,
      time: m.scheduled_time as string | null,
      location: (m.location ?? "") as string,
      entrantAName: nameOf(m.entrant_a_id) ?? "Unknown",
      entrantBName: nameOf(m.entrant_b_id),
      score: sets.map((x) => `${x.a}-${x.b}`).join(", "),
      winnerName: nameOf(result?.winner_entrant_id ?? null),
    };
  });

  const preparedPlayers = (allProfiles ?? []).map((p: any) => ({
    id: p.id as string,
    name: (p.display_name || p.full_name) as string,
    rating: (p.rating ?? null) as string | null,
    isAdmin: Boolean(p.is_admin),
    leagues: (allEnrollments ?? [])
      .filter((e) => e.player_id === p.id)
      .map((e) => ({
        enrollmentId: e.id as string,
        label: leagueLabel(templateOf(e.league_season_id)),
        paid: Boolean(e.paid),
      })),
  }));

  const preparedMatches = rows.map((m) => ({
    id: m.id,
    status: m.status,
    scheduled_date: m.scheduled_date,
    scheduled_time: m.scheduled_time,
    location: m.location,
    entrantAName: nameById.get(m.entrant_a_id) ?? "Unknown",
    entrantBName: m.entrant_b_id ? nameById.get(m.entrant_b_id) ?? "Unknown" : null,
    leagueLabel: leagueLabelBySeasonId.get(m.league_season_id) ?? "Unknown league",
    sport: (sportBySeasonId.get(m.league_season_id) ?? "tennis") as "tennis" | "pickleball",
    scoringFormat: ((templateOf(m.league_season_id)?.scoring_format ?? "standard") as "standard" | "single_set"),
  }));

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h1 className="font-display text-2xl font-bold">Admin</h1>
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-chalk-dim text-sm hover:text-chalk">&larr; Dashboard</a>
          <SignOutButton />
        </div>
      </div>
      <p className="text-chalk-dim text-sm mb-6">Everything, across every league.</p>
      <AdminClient
        matches={preparedMatches}
        leagues={preparedLeagues}
        players={preparedPlayers}
        history={preparedHistory}
      />
    </main>
  );
}
