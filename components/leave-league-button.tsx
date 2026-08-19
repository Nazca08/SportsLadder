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
      const result = await leaveLeague(enrollmentId);
      if (result?.error) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      router.push("/dashboard");
    });
  }

  return (
    // Column layout with a width cap: the old version let a long error string
    // stretch across the header and shove the surrounding links out of place.
    <span className="inline-flex flex-col items-start gap-1 max-w-xs">
      {confirming ? (
        <span className="flex items-center gap-2 text-xs">
          <span className="text-paddle">Leave this league?</span>
          <button onClick={handleLeave} disabled={pending} className="text-paddle underline">
            {pending ? "Leaving…" : "Confirm"}
          </button>
          <button onClick={() => setConfirming(false)} className="text-chalk-dim underline">
            Cancel
          </button>
        </span>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="text-chalk-dim text-sm hover:text-paddle"
        >
          Leave league
        </button>
      )}
      {error && <span className="text-paddle text-xs leading-snug">{error}</span>}
    </span>
  );
}
