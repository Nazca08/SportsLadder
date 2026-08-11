import { createClient as createBareClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createClient as createSSRClient } from "@/lib/supabase/server";

/**
 * Returns a Supabase client with the user's access token explicitly attached
 * as the Authorization header, plus the authenticated user object.
 *
 * Why this exists: the normal SSR client (lib/supabase/server.ts) is supposed
 * to attach the session's access token to every request automatically. In
 * testing, auth.getUser() and RPC calls through that client correctly
 * resolved the user's identity server-side, but writes through the same
 * client (via .insert()) were being evaluated by RLS as if no identity were
 * attached at all -- confirmed via direct comparison against a manual SQL
 * reproduction using the exact same values, which succeeded. Rather than
 * rely on whatever automatic wiring isn't carrying through correctly inside
 * Server Actions, this builds a plain client and sets the Authorization
 * header by hand from the current session, removing any ambiguity.
 */
export async function getAuthedClient(): Promise<{ supabase: SupabaseClient<any> | null; user: User | null }> {
  const ssr = createSSRClient();
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) return { supabase: null, user: null };

  const { data: { session } } = await ssr.auth.getSession();
  if (!session) return { supabase: null, user: null };

  const supabase = createBareClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${session.access_token}` } },
      auth: { persistSession: false },
    }
  );

  return { supabase, user };
}
