import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import { AREAS } from "@/lib/leagues/divisions";

const areaName = (code?: string) => AREAS.find(([c]) => c === code)?.[1] ?? code;

function leagueLabel(t: { sport: string; format: string; division: string; level: string; area?: string }) {
  const sport = t.sport === "tennis" ? "Tennis" : "Pickleball";
  const format = t.format === "doubles" ? "Doubles" : "Singles";
  const division = t.division === "mixed" ? "Mixed" : t.division === "mens" ? "Men's" : "Women's";
  const area = areaName(t.area);
  return `${sport} ${format} \u00b7 ${division} \u00b7 ${t.level}${area ? ` \u00b7 ${area}` : ""}`;
}

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name, is_admin").eq("id", user.id).single();

  // Enrollments where I'm the direct player...
  const { data: directEnrollments } = await supabase
    .from("enrollments")
    .select("id, league_seasons(id, league_templates(sport, format, division, level, area))")
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
        .select("id, league_seasons(id, league_templates(sport, format, division, level, area))")
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

      <div className="space-y-2">
        {enrollments.map((e: any) => {
          const template = Array.isArray(e.league_seasons?.league_templates)
            ? e.league_seasons.league_templates[0]
            : e.league_seasons?.league_templates;
          return (
            <a
              key={e.id}
              href={`/leagues/${e.id}`}
              className="block bg-panel border border-white/10 rounded-xl px-4 py-3 hover:border-ball transition"
            >
              {template ? leagueLabel(template) : "League"}
            </a>
          );
        })}
      </div>
    </main>
  );
}
