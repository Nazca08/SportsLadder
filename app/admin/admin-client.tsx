"use client";

import { formatTime, formatDate } from "@/lib/format";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminSetScore, adminResetForReReport } from "./actions";

type AdminMatch = {
  id: string;
  status: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  location: string | null;
  entrantAName: string;
  entrantBName: string | null;
  leagueLabel: string;
  sport: "tennis" | "pickleball";
};

function ScoreForm({ sport, onSubmit }: { sport: "tennis" | "pickleball"; onSubmit: (payload: any) => void }) {
  const [rounds, setRounds] = useState([{ a: "", b: "" }, { a: "", b: "" }]);
  const label = sport === "tennis" ? "Set" : "Game";

  function updateRound(i: number, field: "a" | "b", value: string) {
    setRounds((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }
  function addRound() {
    setRounds((prev) => [...prev, { a: "", b: "" }]);
  }

  function handleSubmit() {
    const filled = rounds.filter((r) => r.a !== "" && r.b !== "").map((r) => ({ a: Number(r.a), b: Number(r.b) }));
    onSubmit(sport === "tennis" ? { sport: "tennis", sets: filled } : { sport: "pickleball", games: filled });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-2">
        {rounds.map((r, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="text-chalk-dim text-xs">{label} {i + 1}</span>
            <input type="number" min="0" value={r.a} onChange={(e) => updateRound(i, "a", e.target.value)} className="w-12 bg-panel border border-white/10 rounded px-1 py-1 text-center text-sm" />
            <span className="text-chalk-dim">-</span>
            <input type="number" min="0" value={r.b} onChange={(e) => updateRound(i, "b", e.target.value)} className="w-12 bg-panel border border-white/10 rounded px-1 py-1 text-center text-sm" />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={addRound} className="text-ball text-xs font-display">+ Add another {label.toLowerCase()}</button>
        <button type="button" onClick={handleSubmit} className="bg-ball text-ink font-display text-xs font-semibold rounded px-3 py-1.5">Set final score</button>
      </div>
    </div>
  );
}

export function AdminClient({ matches }: { matches: AdminMatch[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function run(matchId: string, fn: () => Promise<void>) {
    setErrors((e) => ({ ...e, [matchId]: "" }));
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setErrors((prev) => ({ ...prev, [matchId]: e instanceof Error ? e.message : "Something went wrong." }));
      }
    });
  }

  const disputed = matches.filter((m) => m.status === "disputed");
  const scheduled = matches.filter((m) => m.status === "scheduled");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-lg font-semibold mb-3">Disputed ({disputed.length})</h2>
        {disputed.length === 0 && <p className="text-chalk-dim text-sm">Nothing disputed right now.</p>}
        {disputed.map((m) => (
          <div key={m.id} className="bg-panel border border-paddle/40 rounded-xl p-4 mb-3">
            <div className="text-chalk-dim text-xs mb-1">{m.leagueLabel}</div>
            <div className="text-sm font-medium mb-2">
              {m.entrantAName} vs {m.entrantBName ?? "\u2014"} &middot; {formatDate(m.scheduled_date)} {formatTime(m.scheduled_time)} &middot; {m.location}
            </div>
            <ScoreForm sport={m.sport} onSubmit={(payload) => run(m.id, () => adminSetScore(m.id, payload))} />
            <button
              onClick={() => run(m.id, () => adminResetForReReport(m.id))}
              disabled={pending}
              className="mt-2 text-chalk-dim text-xs underline"
            >
              Or reset and let the players report again themselves
            </button>
            {errors[m.id] && <div className="text-paddle text-xs mt-2">{errors[m.id]}</div>}
          </div>
        ))}
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold mb-3">Scheduled, awaiting a score ({scheduled.length})</h2>
        {scheduled.length === 0 && <p className="text-chalk-dim text-sm">Nothing scheduled.</p>}
        {scheduled.map((m) => (
          <div key={m.id} className="bg-panel border border-white/10 rounded-xl p-4 mb-3">
            <div className="text-chalk-dim text-xs mb-1">{m.leagueLabel}</div>
            <div className="text-sm font-medium mb-2">
              {m.entrantAName} vs {m.entrantBName ?? "\u2014"} &middot; {formatDate(m.scheduled_date)} {formatTime(m.scheduled_time)} &middot; {m.location}
            </div>
            <ScoreForm sport={m.sport} onSubmit={(payload) => run(m.id, () => adminSetScore(m.id, payload))} />
            {errors[m.id] && <div className="text-paddle text-xs mt-2">{errors[m.id]}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
