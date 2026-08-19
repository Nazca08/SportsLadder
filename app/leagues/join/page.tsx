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

  // Named club leagues are created by migration, not by players, so they are
  // listed rather than built from dropdowns.
  const { data: clubLeagues } = await supabase
    .from("league_templates")
    .select("id, sport, format, division, level, area, name")
    .not("name", "is", null)
    .order("name");

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
        Pick a sport, format, and level. If that exact league doesn&apos;t exist yet, you&apos;ll be the first one in it.
      </p>
      <JoinLeagueForm clubLeagues={clubLeagues ?? []} initialRating={profile?.rating ?? ""} gender={(profile?.gender as "male" | "female") ?? "female"} />
    </main>
  );
}
