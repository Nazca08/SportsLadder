import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computePlayerStats } from "@/lib/leagues/player-stats";
import { SignOutButton } from "@/components/sign-out-button";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, display_name, phone, avatar_url, gender, rating")
    .eq("id", user.id)
    .single();

  const stats = await computePlayerStats(supabase, user.id);

  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="font-display text-2xl font-bold">Settings</h1>
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-chalk-dim text-sm hover:text-chalk">&larr; Dashboard</a>
          <SignOutButton />
        </div>
      </div>
      <SettingsClient
        userId={user.id}
        email={user.email ?? ""}
        profile={{
          fullName: profile?.full_name ?? "",
          displayName: profile?.display_name ?? "",
          phone: profile?.phone ?? "",
          avatarUrl: profile?.avatar_url ?? "",
          rating: profile?.rating ?? "",
        }}
        stats={stats}
      />
    </main>
  );
}
