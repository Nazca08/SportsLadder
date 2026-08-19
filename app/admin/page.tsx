import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/require-admin";
import { SignOutButton } from "@/components/sign-out-button";
import { AdminClient } from "./admin-client";
import { leagueLabel } from "@/lib/leagues/label";


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
      <p className="text-chalk-dim text-sm mb-6">Every scheduled or disputed match, across every league.</p>
      <AdminClient matches={preparedMatches} />
    </main>
  );
}
