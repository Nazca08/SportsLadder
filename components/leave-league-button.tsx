"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { leaveLeague } from "@/app/leagues/[id]/actions";

export function LeaveLeagueButton({ enrollmentId }: { enrollmentId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function handleLeave() {
    setError("");
    startTransition(async () => {
      try {
        await leaveLeague(enrollmentId);
        router.push("/dashboard");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
        setConfirming(false);
      }
    });
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-2 text-xs">
        <span className="text-paddle">Leave this league?</span>
        <button onClick={handleLeave} disabled={pending} className="text-paddle underline">
          {pending ? "Leaving\u2026" : "Confirm"}
        </button>
        <button onClick={() => setConfirming(false)} className="text-chalk-dim underline">Cancel</button>
      </span>
    );
  }

  return (
    <span>
      <button onClick={() => setConfirming(true)} className="text-chalk-dim text-sm hover:text-paddle">
        Leave league
      </button>
      {error && <div className="text-paddle text-xs mt-1">{error}</div>}
    </span>
  );
}
