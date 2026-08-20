import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Landing point for links Supabase emails out: password recovery, and signup
 * confirmation if that is ever pointed here too.
 *
 * Supabase sends one of two shapes depending on project settings and on which
 * flow generated the link, so both are handled:
 *
 *   ?code=...                    PKCE. Exchanged for a session. Requires the
 *                                code verifier cookie, which only exists in the
 *                                browser that requested the reset.
 *   ?token_hash=...&type=recovery  A one-time token verified server-side. Works
 *                                even when the link is opened on a different
 *                                device from the one that asked for it -- which
 *                                is common, since people request on a laptop and
 *                                open the mail on a phone.
 *
 * Handling only the first is why a reset opened on another device silently
 * fails.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  // Only ever a path on this site. An absolute URL from the query string would
  // let a crafted link bounce a freshly-authenticated user to another domain.
  const nextParam = url.searchParams.get("next") ?? "/reset-password";
  const next = nextParam.startsWith("/") ? nextParam : "/reset-password";

  const supabase = createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    console.error("auth/callback: code exchange failed", error.message);
  }

  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: (type as any) ?? "recovery",
    });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    console.error("auth/callback: token verification failed", error.message);
  }

  if (!code && !tokenHash) {
    return NextResponse.redirect(
      new URL("/login?error=That+link+was+missing+its+token.", url.origin)
    );
  }

  // Reached only when a token was present but rejected: expired, already used,
  // or opened in a different browser from the one that requested it.
  return NextResponse.redirect(
    new URL("/forgot-password?error=That+link+has+expired+or+was+already+used.+Request+a+new+one.", url.origin)
  );
}
