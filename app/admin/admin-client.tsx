"use client";

import { formatTime, formatDate } from "@/lib/format";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminSetScore, adminResetForReReport, adminSetRating, adminSetPaid, adminRemoveFromLeague } from "./actions";

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
  scoringFormat?: "standard" | "single_set";
};

type RosterEntry = {
  enrollmentId: string;
  entrantId: string;
  playerId: string | null;
  name: string;
  rating: string | null;
  paid: boolean;
  joined: string;
};

type StandingEntry = {
  entrantId: string;
  name: string;
  earned: number;
  wins: number;
  losses: number;
  played: number;
};

type AdminLeague = {
  leagueSeasonId: string;
  label: string;
  scoringFormat: string;
  roster: RosterEntry[];
  standings: StandingEntry[];
  matchesPlayed: number;
};

type AdminPlayer = {
  id: string;
  name: string;
  rating: string | null;
  isAdmin: boolean;
  leagues: { enrollmentId: string; label: string; paid: boolean }[];
};

type HistoryRow = {
  id: string;
  leagueLabel: string;
  date: string | null;
  time: string | null;
  location: string;
  entrantAName: string;
  entrantBName: string | null;
  score: string;
  winnerName: string | null;
};

const RATINGS = ["2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0"];

function ScoreForm({ sport, onSubmit, scoringFormat = "standard" }: { sport: "tennis" | "pickleball"; onSubmit: (payload: any) => void; scoringFormat?: "standard" | "single_set" }) {
  // A single-set league is one row. Offering "Set 2" invites an entry the
  // validator will reject.
  const singleSet = sport === "tennis" && scoringFormat === "single_set";
  const [rounds, setRounds] = useState(singleSet ? [{ a: "", b: "" }] : [{ a: "", b: "" }, { a: "", b: "" }]);
  const label = sport === "tennis" ? (singleSet ? "Games" : "Set") : "Game";

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
            <span className="text-chalk-dim text-xs">{singleSet ? label : `${label} ${i + 1}`}</span>
            <input type="number" min="0" value={r.a} onChange={(e) => updateRound(i, "a", e.target.value)} className="w-12 bg-panel border border-white/10 rounded px-1 py-1 text-center text-sm" />
            <span className="text-chalk-dim">-</span>
            <input type="number" min="0" value={r.b} onChange={(e) => updateRound(i, "b", e.target.value)} className="w-12 bg-panel border border-white/10 rounded px-1 py-1 text-center text-sm" />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        {!singleSet && <button type="button" onClick={addRound} className="text-ball text-xs font-display">+ Add another {label.toLowerCase()}</button>}
        <button type="button" onClick={handleSubmit} className="bg-ball text-ink font-display text-xs font-semibold rounded px-3 py-1.5">Set final score</button>
      </div>
    </div>
  );
}

export function AdminClient({
  matches,
  leagues,
  players,
  history,
}: {
  matches: AdminMatch[];
  leagues: AdminLeague[];
  players: AdminPlayer[];
  history: HistoryRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"matches" | "leagues" | "players" | "history">("matches");
  const [openLeague, setOpenLeague] = useState<string>("");
  const [historyLeague, setHistoryLeague] = useState<string>("");

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

  const TABS = [
    ["matches", `Matches (${disputed.length + scheduled.length})`],
    ["leagues", `Leagues (${leagues.length})`],
    ["players", `Players (${players.length})`],
    ["history", `History (${history.length})`],
  ] as const;

  const shownHistory = historyLeague
    ? history.filter((h) => h.leagueLabel === historyLeague)
    : history;

  return (
    <div>
      <div className="flex gap-4 border-b border-white/10 mb-6 flex-wrap">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`pb-2 text-sm font-display transition-colors ${
              tab === key ? "text-chalk border-b-2 border-ball" : "text-chalk-dim hover:text-chalk"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "matches" && (
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
            <ScoreForm sport={m.sport} scoringFormat={m.scoringFormat} onSubmit={(payload) => run(m.id, () => adminSetScore(m.id, payload))} />
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
            <ScoreForm sport={m.sport} scoringFormat={m.scoringFormat} onSubmit={(payload) => run(m.id, () => adminSetScore(m.id, payload))} />
            {errors[m.id] && <div className="text-paddle text-xs mt-2">{errors[m.id]}</div>}
          </div>
        ))}
      </div>
        </div>
      )}

      {tab === "leagues" && (
        <div className="space-y-3">
          {leagues.length === 0 && <p className="text-chalk-dim text-sm">No leagues yet.</p>}
          {leagues.map((lg) => (
            <div key={lg.leagueSeasonId} className="bg-panel border border-white/10 rounded-xl">
              <button
                onClick={() => setOpenLeague(openLeague === lg.leagueSeasonId ? "" : lg.leagueSeasonId)}
                className="w-full text-left p-4 flex items-center justify-between gap-3"
              >
                <span>
                  <span className="block text-sm font-medium">{lg.label}</span>
                  <span className="block text-chalk-dim text-xs mt-0.5">
                    {lg.roster.length} {lg.roster.length === 1 ? "player" : "players"} &middot;{" "}
                    {lg.matchesPlayed} played &middot; {lg.scoringFormat === "single_set" ? "single set" : "standard sets"}
                  </span>
                </span>
                <span className="text-chalk-dim text-xs">{openLeague === lg.leagueSeasonId ? "Hide" : "Open"}</span>
              </button>

              {openLeague === lg.leagueSeasonId && (
                <div className="border-t border-white/10 p-4 space-y-5">
                  <div>
                    <h3 className="text-chalk-dim text-xs font-display uppercase mb-2">Standings</h3>
                    {lg.standings.filter((r) => r.played > 0).length === 0 && (
                      <p className="text-chalk-dim text-sm">No matches played yet.</p>
                    )}
                    {lg.standings.filter((r) => r.played > 0).map((r, i) => (
                      <div key={r.entrantId} className="flex items-center gap-3 text-sm py-1">
                        <span className="font-score text-chalk-dim w-5">{i + 1}</span>
                        <span className="flex-1">{r.name}</span>
                        <span className="text-chalk-dim text-xs">{r.wins}-{r.losses}</span>
                        <span className="font-score w-12 text-right">{r.earned > 0 ? "+" : ""}{r.earned}</span>
                      </div>
                    ))}
                  </div>

                  <div>
                    <h3 className="text-chalk-dim text-xs font-display uppercase mb-2">Roster</h3>
                    {lg.roster.map((r) => (
                      <div key={r.enrollmentId} className="flex items-center gap-3 text-sm py-1.5 flex-wrap">
                        <span className="flex-1 min-w-[8rem]">
                          {r.name}
                          {r.rating && <span className="text-chalk-dim text-xs ml-2">{r.rating}</span>}
                        </span>
                        <span className="text-chalk-dim text-xs">joined {r.joined}</span>
                        <button
                          onClick={() => run(r.enrollmentId, () => adminSetPaid(r.enrollmentId, !r.paid))}
                          disabled={pending}
                          className={`text-xs rounded px-2 py-1 border ${
                            r.paid ? "border-ball/40 text-ball" : "border-paddle/40 text-paddle"
                          }`}
                        >
                          {r.paid ? "Paid" : "Unpaid"}
                        </button>
                        <button
                          onClick={() => run(r.enrollmentId, () => adminRemoveFromLeague(r.enrollmentId))}
                          disabled={pending}
                          className="text-chalk-dim text-xs underline hover:text-paddle"
                        >
                          Remove
                        </button>
                        {errors[r.enrollmentId] && (
                          <span className="text-paddle text-xs w-full">{errors[r.enrollmentId]}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "players" && (
        <div className="space-y-2">
          {players.map((p) => (
            <div key={p.id} className="bg-panel border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-medium flex-1 min-w-[8rem]">
                  {p.name}
                  {p.isAdmin && <span className="text-ball text-xs font-display ml-2">ADMIN</span>}
                </span>
                <label className="text-chalk-dim text-xs">Rating</label>
                <select
                  defaultValue={p.rating ?? ""}
                  onChange={(e) => run(p.id, () => adminSetRating(p.id, e.target.value))}
                  disabled={pending}
                  className="bg-court-deep border border-white/10 rounded px-2 py-1 text-xs"
                >
                  <option value="">Not set</option>
                  {RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {p.leagues.length > 0 && (
                <div className="mt-2 text-chalk-dim text-xs">
                  {p.leagues.map((l) => (
                    <span key={l.enrollmentId} className="inline-block mr-3">
                      {l.label} {l.paid ? "" : <span className="text-paddle">(unpaid)</span>}
                    </span>
                  ))}
                </div>
              )}
              {p.leagues.length === 0 && (
                <div className="mt-2 text-chalk-dim text-xs">Not in any league.</div>
              )}
              {errors[p.id] && <div className="text-paddle text-xs mt-2">{errors[p.id]}</div>}
            </div>
          ))}
        </div>
      )}

      {tab === "history" && (
        <div>
          <select
            value={historyLeague}
            onChange={(e) => setHistoryLeague(e.target.value)}
            className="bg-court-deep border border-white/10 rounded-lg px-2 py-2 text-sm mb-4"
          >
            <option value="">All leagues</option>
            {Array.from(new Set(history.map((h) => h.leagueLabel))).map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>

          {shownHistory.length === 0 && <p className="text-chalk-dim text-sm">No completed matches yet.</p>}
          {shownHistory.map((h) => (
            <div key={h.id} className="bg-panel border border-white/10 rounded-xl p-4 mb-2">
              <div className="text-chalk-dim text-xs mb-1">{h.leagueLabel}</div>
              <div className="text-sm">
                {h.entrantAName} vs {h.entrantBName ?? "\u2014"}
                {h.score && <span className="font-score ml-2">{h.score}</span>}
              </div>
              <div className="text-chalk-dim text-xs mt-1">
                {formatDate(h.date)} {formatTime(h.time)}
                {h.location && ` \u00b7 ${h.location}`}
                {h.winnerName && ` \u00b7 won by ${h.winnerName}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
