import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import { AREAS } from "@/lib/leagues/divisions";
import { leagueLabel, areaName } from "@/lib/leagues/label";
import { LeagueBadge, FormatChip } from "@/components/league-badge";



export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name, is_admin").eq("id", user.id).single();

  // Enrollments where I'm the direct player...
  const { data: directEnrollments } = await supabase
    .from("enrollments")
    .select("id, league_seasons(id, league_templates(sport, format, division, level, area, name))")
    .eq("player_id", user.id);

  // ...plus enrollments through a doubles team I'm on.
  const { data: myTeams } = await supabase
    .from("teams")
    .select("id")
    .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`);
  const teamIds = (myTeams ?? []).map((t) => t.id);

  const { data: teamEnrollments } = teamIds.length
    ? await supabase
        .from("enrollments")
        .select("id, league_seasons(id, league_templates(sport, format, division, level, area, name))")
        .in("team_id", teamIds)
    : { data: [] as any[] };

  const enrollments = [...(directEnrollments ?? []), ...(teamEnrollments ?? [])];

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-display text-2xl font-bold">Welcome, {profile?.full_name ?? "player"}.</h1>
        <div className="flex items-center gap-4">
          {profile?.is_admin && <a href="/admin" className="text-ball text-sm hover:opacity-80">Admin</a>}
          <a href="/settings" className="text-chalk-dim text-sm hover:text-chalk">Settings</a>
          <SignOutButton />
        </div>
      </div>

      <div className="flex items-center justify-between mt-8 mb-3">
        <h2 className="font-display text-lg font-semibold">Your leagues</h2>
        <a href="/leagues/join" className="bg-ball text-ink font-display text-sm font-semibold rounded-lg px-3 py-2">
          Join a league
        </a>
      </div>

      {enrollments.length === 0 && (
        <p className="text-chalk-dim text-sm">You&apos;re not enrolled in any leagues yet.</p>
      )}

      {/* Grouped by city, in the order the city picker uses. Someone playing in
          two markets was previously handed one flat list in whatever order the
          database returned, which is no order at all. */}
      {(() => {
        const rows = enrollments.map((e: any) => {
          const template = Array.isArray(e.league_seasons?.league_templates)
            ? e.league_seasons.league_templates[0]
            : e.league_seasons?.league_templates;
          return { id: e.id as string, template };
        });

        // AREAS first so cities appear in a stable, deliberate order; anything
        // with an unrecognised area falls to the end rather than vanishing.
        const order = AREAS.map(([code]) => code);
        const cities = Array.from(
          new Set(rows.map((r) => r.template?.area ?? ""))
        ).sort((a, b) => {
          const ia = order.indexOf(a);
          const ib = order.indexOf(b);
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        });

        return (
          <div className="space-y-6">
            {cities.map((city) => (
              <div key={city}>
                <h2 className="font-display text-sm tracking-[0.15em] text-chalk-dim uppercase mb-2">
                  {areaName(city) || "Other"}
                </h2>
                <div className="space-y-2">
                  {rows
                    .filter((r) => (r.template?.area ?? "") === city)
                    // Tennis before pickleball, singles before doubles, so the
                    // same league always sits in the same place week to week.
                    .sort((a, b) =>
                      (a.template?.sport ?? "").localeCompare(b.template?.sport ?? "") ||
                      (a.template?.format ?? "").localeCompare(b.template?.format ?? "") ||
                      (a.template?.division ?? "").localeCompare(b.template?.division ?? "")
                    )
                    .map(({ id, template }) => (
                      <a
                        key={id}
                        href={`/leagues/${id}`}
                        className="flex items-center gap-3 bg-panel border border-white/10 rounded-xl px-4 py-3 hover:border-ball transition"
                      >
                        <LeagueBadge
                          sport={template?.sport ?? "tennis"}
                          division={template?.division ?? "mixed"}
                          format={template?.format ?? "singles"}
                          area={template?.area}
                        />
                        <span className="flex-1 min-w-0">
                          {template ? leagueLabel(template) : "League"}
                        </span>
                        <FormatChip format={template?.format ?? "singles"} />
                      </a>
                    ))}
                </div>
              </div>
            ))}
          </div>
        );
      })()}
    </main>
  );
}
