import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import { JoinLeagueForm } from "./join-form";
import { PROMO_CODE, PROMO_BLURB } from "@/lib/payments/checkout";

export default async function JoinLeaguePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("gender, rating")
    .eq("id", user.id)
    .single();

  // The catalogue. Leagues are a fixed list now, created by migration rather
  // than conjured from dropdown choices, so the page lists what exists.
  const { data: leagues } = await supabase
    .from("league_templates")
    .select("id, sport, format, division, level, area, name")
    .not("name", "is", null)
    .order("name");

  // Leagues this player is already in, so they are shown as joined rather than
  // offered again and rejected by the unique index.
  const { data: mine } = await supabase
    .from("enrollments")
    .select("league_seasons(league_template_id)")
    .eq("player_id", user.id);
  const joinedTemplateIds = (mine ?? [])
    .map((row: any) =>
      Array.isArray(row.league_seasons)
        ? row.league_seasons[0]?.league_template_id
        : row.league_seasons?.league_template_id
    )
    .filter(Boolean) as string[];

  return (
    <main className="min-h-screen p-8 max-w-lg mx-auto">
      <a
        href="/dashboard"
        className="inline-block mb-4 text-chalk-dim text-sm hover:text-chalk transition-colors"
      >
        &larr; Back to dashboard
      </a>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl font-bold">Join a league</h1>
        <SignOutButton />
      </div>
      <div className="mt-4 mb-5 rounded-lg border border-ball/40 bg-ball/10 p-3 text-center">
        <p className="text-xs text-chalk-dim">
          Use code{" "}
          <span className="font-score font-bold tracking-wider text-ball">{PROMO_CODE}</span>{" "}
          at checkout &mdash; leagues are {PROMO_BLURB}.
        </p>
      </div>
      <p className="text-chalk-dim text-sm mb-6">
        Pick your city and sport, then choose from the leagues running there.
      </p>
      <JoinLeagueForm leagues={leagues ?? []} joinedTemplateIds={joinedTemplateIds} />
    </main>
  );
}
