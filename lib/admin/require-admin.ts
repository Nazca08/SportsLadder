import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { User } from "@supabase/supabase-js";

/**
 * Checks admin status using the user's own authenticated session (so we know
 * for certain who's asking), then hands back the service-role client for
 * the actual privileged reads/writes -- admin actions touch other people's
 * data across every league, which regular RLS policies correctly don't
 * allow, so this is the same "verify with the real session, then act with
 * elevated privileges" pattern used for league-template creation.
 */
export async function requireAdmin(): Promise<{ user: User; admin: ReturnType<typeof createAdminClient> }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) throw new Error("Not authorized.");

  return { user, admin: createAdminClient() };
}
