"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

/**
 * useSearchParams forces client-side rendering, which Next.js refuses to
 * prerender unless it sits inside a Suspense boundary. The page shell below
 * provides one; this inner component does the work.
 */
function ForgotPasswordForm() {
  const supabase = createClient();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(params.get("error") ?? "");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim()) return setError("Enter the email you signed up with.");

    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      // Via the callback route so the one-time code becomes a real session
      // before the reset form loads.
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);

    // Deliberately not surfacing "no such account". Distinguishing a real
    // address from an unknown one here would turn this form into a way to test
    // whether somebody has an account.
    if (resetError && !/rate|limit/i.test(resetError.message)) {
      setSent(true);
      return;
    }
    if (resetError) return setError(resetError.message);
    setSent(true);
  }

  if (sent) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-panel border border-white/10 rounded-2xl p-8">
          <h1 className="font-display text-2xl font-bold mb-1">Check your email</h1>
          <p className="text-chalk-dim text-sm">
            If an account exists for {email}, a reset link is on its way. It expires in an
            hour.
          </p>
          <a
            href="/login"
            className="mt-6 block w-full bg-ball text-ink font-display font-semibold rounded-lg py-3 text-center"
          >
            Back to log in
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <a
          href="/login"
          className="inline-block mb-4 text-chalk-dim text-xs hover:text-chalk transition-colors"
        >
          &larr; Back to log in
        </a>
        <div className="bg-panel border border-white/10 rounded-2xl p-8">
          <h1 className="font-display text-2xl font-bold mb-1">Reset your password</h1>
          <p className="text-chalk-dim text-sm mb-6">
            Enter your email and we&apos;ll send you a link to set a new one.
          </p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-court-deep border border-white/10 rounded-lg px-3 py-2 text-sm"
            />
            {error && <div className="text-paddle text-xs">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ball text-ink font-display font-semibold rounded-lg py-3 disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center p-6">
          <p className="text-chalk-dim text-sm">Loading…</p>
        </main>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  );
}
