import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Landing point for links Supabase emails out -- password recovery today, and
 * signup confirmation if that is ever pointed here too.
 *
 * The link carries a one-time `code`. Exchanging it here sets the session
 * cookie, which is what lets the reset page call updateUser() as the right
 * person. Without this route the recovery link lands on a page with no
 * session and the reset silently fails.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  // Only ever a path on this site. Taking an absolute URL from the query
  // string would let a crafted link bounce a freshly-authenticated user to
  // somebody else's domain.
  const nextParam = url.searchParams.get("next") ?? "/reset-password";
  const next = nextParam.startsWith("/") ? nextParam : "/reset-password";

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=That+link+is+missing+its+code.", url.origin)
    );
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Almost always an expired or already-used link.
    return NextResponse.redirect(
      new URL("/forgot-password?error=That+link+has+expired.+Request+a+new+one.", url.origin)
    );
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
