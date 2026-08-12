"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) return setError(signInError.message);
    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <a
          href="/"
          className="inline-block mb-4 text-chalk-dim text-xs hover:text-chalk transition-colors"
        >
          &larr; Back to RallyRank.club
        </a>
        <div className="bg-panel border border-white/10 rounded-2xl p-8">
        <a href="/" className="font-display text-2xl font-bold mb-1 block hover:text-ball transition-colors">
          RALLY<span className="text-ball">RANK</span><span className="text-chalk-dim">.club</span>
        </a>
        <p className="text-chalk-dim text-sm mb-6">Log in.</p>
        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-court-deep border border-white/10 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-court-deep border border-white/10 rounded-lg px-3 py-2 text-sm"
          />
          {error && <div className="text-paddle text-xs">{error}</div>}
          <button
            type="button"
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-ball text-ink font-display font-semibold rounded-lg py-3 disabled:opacity-50"
          >
            {loading ? "Logging in\u2026" : "Log in"}
          </button>
        </form>
        <p className="text-chalk-dim text-xs mt-4">
          No account yet? <a href="/signup" className="text-ball">Sign up</a>
        </p>
        </div>
      </div>
    </main>
  );
}
