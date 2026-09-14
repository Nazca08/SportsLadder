import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InviteShare } from "@/components/invite-share";
import { SignOutButton } from "@/components/sign-out-button";

export const dynamic = "force-dynamic";

export default async function InvitePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, display_name, referral_code")
    .eq("id", user.id)
    .single();

  // Anyone who signed up through this person's link. Created by a trigger, so
  // it is already accurate for people who joined before this page existed.
  const { data: referred } = await supabase
    .from("profiles")
    .select("id, full_name, display_name")
    .eq("referred_by", user.id);

  const code = profile?.referral_code ?? "";
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rallyrank.club";
  const url = code ? `${base.replace(/\/$/, "")}/?ref=${code}` : base;
  const name = profile?.display_name || profile?.full_name || "A player";
  const count = referred?.length ?? 0;

  return (
    <main className="min-h-screen p-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <a href="/dashboard" className="text-chalk-dim text-sm hover:text-chalk">
          &larr; All leagues
        </a>
        <SignOutButton />
      </div>

      <h1 className="font-display text-2xl font-bold mb-1">Invite someone to play</h1>
      <p className="text-chalk-dim text-sm mb-6">
        A league is only as good as the people in it. Send this to anyone who plays &mdash;
        it opens the RallyRank page and explains how it works.
      </p>

      <div className="bg-panel border border-white/10 rounded-2xl p-5 mb-6">
        <InviteShare url={url} name={name} />
      </div>

      <div className="bg-panel border border-white/10 rounded-2xl p-5">
        <p className="font-display text-sm tracking-[0.15em] uppercase text-chalk-dim mb-2">
          Joined through you
        </p>
        {count === 0 ? (
          <p className="text-chalk-dim text-sm">
            Nobody yet. Anyone who signs up from your link shows up here.
          </p>
        ) : (
          <>
            <p className="font-score text-2xl text-ball mb-2">{count}</p>
            <div className="space-y-1">
              {(referred ?? []).map((p: any) => (
                <p key={p.id} className="text-sm">
                  {p.display_name || p.full_name}
                </p>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
