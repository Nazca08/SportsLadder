"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState<"male" | "female">("female");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Enter your name to continue.");
    if (!email.trim()) return setError("Enter your email to continue.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");

    setError("");
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // read by the handle_new_user() trigger to create the profiles row --
        // see supabase/migrations/0002_profile_trigger.sql
        data: { full_name: name.trim(), gender },
      },
    });

    setLoading(false);
    if (signUpError || !data.user) {
      return setError(signUpError?.message ?? "Something went wrong creating your account.");
    }

    // If email confirmation is on (Supabase's default), there's no session yet --
    // the profile row still gets created by the trigger, but the user has to
    // confirm their email before they can log in.
    if (!data.session) {
      setCheckEmail(true);
      return;
    }

    router.push("/dashboard");
  }

  if (checkEmail) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-panel border border-white/10 rounded-2xl p-8 text-center">
          <h1 className="font-display text-xl font-semibold mb-2">Check your email</h1>
          <p className="text-chalk-dim text-sm">
            We sent a confirmation link to {email}. Click it, then come back and log in.
          </p>
          <a
            href="/login"
            className="mt-6 block w-full bg-ball text-ink font-display font-semibold rounded-lg py-3"
          >
            Go to log in
          </a>
          <a
            href="/"
            className="mt-3 inline-block text-chalk-dim text-xs hover:text-chalk transition-colors"
          >
            &larr; Back to StringLine
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <a
          href="/"
          className="inline-block mb-4 text-chalk-dim text-xs hover:text-chalk transition-colors"
        >
          &larr; Back to StringLine
        </a>
        <div className="bg-panel border border-white/10 rounded-2xl p-8">
        <a href="/" className="font-display text-2xl font-bold mb-1 block hover:text-ball transition-colors">
          STRINGLINE
        </a>
        <p className="text-chalk-dim text-sm mb-6">Create your account.</p>
        <form onSubmit={handleSignup} className="space-y-3">
          <input
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-court-deep border border-white/10 rounded-lg px-3 py-2 text-sm"
          />
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
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as "male" | "female")}
            className="w-full bg-court-deep border border-white/10 rounded-lg px-3 py-2 text-sm"
          >
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
          {error && <div className="text-paddle text-xs">{error}</div>}
          <button
            type="button"
            onClick={handleSignup}
            disabled={loading}
            className="w-full bg-ball text-ink font-display font-semibold rounded-lg py-3 disabled:opacity-50"
          >
            {loading ? "Creating account\u2026" : "Sign up"}
          </button>
        </form>
        <p className="text-chalk-dim text-xs mt-4">
          Already have an account? <a href="/login" className="text-ball">Log in</a>
        </p>
        </div>
      </div>
    </main>
  );
}
