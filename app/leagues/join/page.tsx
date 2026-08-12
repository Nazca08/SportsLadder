import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import { JoinLeagueForm } from "./join-form";

export default async function JoinLeaguePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("gender")
    .eq("id", user.id)
    .single();

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
      <p className="text-chalk-dim text-sm mb-6">
        Pick a sport, format, and level. If that exact league doesn&apos;t exist yet, you&apos;ll be the first one in it.
      </p>
      <JoinLeagueForm gender={(profile?.gender as "male" | "female") ?? "female"} />
    </main>
  );
}
