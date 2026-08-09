import { createClient } from "@supabase/supabase-js";

/**
 * Uses the service role key -- bypasses Row Level Security entirely.
 * NEVER import this into a "use client" component or expose it to the
 * browser. Only for server-side code that needs to write to config-level
 * tables (league_templates, seasons, league_seasons) that regular users
 * aren't granted INSERT policies on.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
