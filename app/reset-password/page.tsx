"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  // The callback route should have exchanged the emailed code for a session
  // before sending us here. Landing without one means the link was stale or
  // opened out of order, and there is no point showing the form.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setHasSession(Boolean(data.user));
      setChecking(false);
    });
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Those two passwords don't match.");

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) return setError(updateError.message);
    router.push("/dashboard");
  }

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <p className="text-chalk-dim text-sm">Checking your link…</p>
      </main>
    );
  }

  if (!hasSession) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-panel border border-white/10 rounded-2xl p-8">
          <h1 className="font-display text-2xl font-bold mb-1">This link has expired</h1>
          <p className="text-chalk-dim text-sm">
            Reset links last an hour and can only be used once.
          </p>
          <a
            href="/forgot-password"
            className="mt-6 block w-full bg-ball text-ink font-display font-semibold rounded-lg py-3 text-center"
          >
            Send a new link
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-panel border border-white/10 rounded-2xl p-8">
        <h1 className="font-display text-2xl font-bold mb-1">Set a new password</h1>
        <p className="text-chalk-dim text-sm mb-6">
          You&apos;ll be logged in straight after.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            placeholder="New password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-court-deep border border-white/10 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="password"
            placeholder="Confirm new password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full bg-court-deep border border-white/10 rounded-lg px-3 py-2 text-sm"
          />
          {error && <div className="text-paddle text-xs">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ball text-ink font-display font-semibold rounded-lg py-3 disabled:opacity-50"
          >
            {loading ? "Saving…" : "Save password"}
          </button>
        </form>
      </div>
    </main>
  );
}
