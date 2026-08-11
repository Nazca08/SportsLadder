"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createOffer, cancelMatch, acceptOffer, sendChallenge, respondChallenge,
  reportScore, confirmScore, disputeScore,
} from "./actions";

type Match = {
  id: string;
  entrant_a_id: string;
  entrant_b_id: string | null;
  status: string;
  match_type: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  location: string | null;
  created_by: string;
};
type MatchResult = {
  match_id: string;
  sets: { a: number; b: number }[];
  points_a: number;
  points_b: number;
  reported_by: string;
  confirmed_by: string | null;
  reporter_entrant_id: string | null;
};
type StandingsRow = { entrantId: string; points: number; wins: number; losses: number };

type Props = {
  leagueSeasonId: string;
  sport: "tennis" | "pickleball";
  myEntrantId: string | null;
  entrantNames: Record<string, string>;
  entrantAvatars: Record<string, string | null>;
  standings: StandingsRow[];
  matches: Match[];
  resultsByMatch: Record<string, MatchResult>;
};

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt={name} className="w-8 h-8 rounded-full object-cover shrink-0" />;
  }
  return (
    <div className="w-8 h-8 rounded-full bg-ball text-ink flex items-center justify-center text-xs font-display font-bold shrink-0">
      {initials(name)}
    </div>
  );
}

function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  function run(fn: () => Promise<void>) {
    setError("");
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }
  return { run, pending, error };
}

function ScoreForm({
  sport,
  onSubmit,
}: {
  sport: "tennis" | "pickleball";
  onSubmit: (payload: any) => void;
}) {
  const [rounds, setRounds] = useState([{ a: "", b: "" }, { a: "", b: "" }]);
  const label = sport === "tennis" ? "Set" : "Game";

  function updateRound(i: number, field: "a" | "b", value: string) {
    setRounds((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }
  function addRound() {
    setRounds((prev) => [...prev, { a: "", b: "" }]);
  }
  function removeRound(i: number) {
    setRounds((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }
  function handleSubmit() {
    const filled = rounds
      .filter((r) => r.a !== "" && r.b !== "")
      .map((r) => ({ a: Number(r.a), b: Number(r.b) }));
    onSubmit(sport === "tennis" ? { sport: "tennis", sets: filled } : { sport: "pickleball", games: filled });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-2">
        {rounds.map((r, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="text-chalk-dim text-xs">{label} {i + 1}</span>
            <input type="number" min="0" value={r.a} onChange={(e) => updateRound(i, "a", e.target.value)} className="w-12 bg-court-deep border border-white/10 rounded px-1 py-1 text-center text-sm" />
            <span className="text-chalk-dim">-</span>
            <input type="number" min="0" value={r.b} onChange={(e) => updateRound(i, "b", e.target.value)} className="w-12 bg-court-deep border border-white/10 rounded px-1 py-1 text-center text-sm" />
            {rounds.length > 1 && (
              <button type="button" onClick={() => removeRound(i)} className="text-chalk-dim text-xs px-1" aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}>
                &times;
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={addRound} className="text-ball text-xs font-display">
          + Add another {label.toLowerCase()}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="bg-ball text-ink font-display text-xs font-semibold rounded px-3 py-1.5"
        >
          Submit score
        </button>
      </div>
    </div>
  );
}

export function LeagueClient({ leagueSeasonId, sport, myEntrantId, entrantNames, entrantAvatars, standings, matches, resultsByMatch }: Props) {
  const [tab, setTab] = useState<"rankings" | "offers" | "challenges" | "matches">("rankings");
  const name = (id: string) => entrantNames[id] ?? "Unknown";

  return (
    <div>
      <div className="flex gap-1 border-b border-white/10 mb-4 mt-4">
        {(["rankings", "offers", "challenges", "matches"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 font-display text-sm border-b-2 ${tab === t ? "border-ball text-chalk" : "border-transparent text-chalk-dim"}`}>
            {t === "rankings" ? "Rankings" : t === "offers" ? "Offers" : t === "challenges" ? "Challenges" : "My Matches"}
          </button>
        ))}
      </div>

      {tab === "rankings" && <RankingsTab standings={standings} name={name} myEntrantId={myEntrantId} />}
      {tab === "offers" && <OffersTab leagueSeasonId={leagueSeasonId} matches={matches} name={name} avatar={(id: string) => entrantAvatars[id] ?? null} myEntrantId={myEntrantId} />}
      {tab === "challenges" && <ChallengesTab leagueSeasonId={leagueSeasonId} matches={matches} standings={standings} name={name} avatar={(id: string) => entrantAvatars[id] ?? null} myEntrantId={myEntrantId} />}
      {tab === "matches" && <MatchesTab sport={sport} matches={matches} resultsByMatch={resultsByMatch} name={name} myEntrantId={myEntrantId} />}
    </div>
  );
}

function RankingsTab({ standings, name, myEntrantId }: { standings: StandingsRow[]; name: (id: string) => string; myEntrantId: string | null }) {
  return (
    <div className="space-y-2">
      {standings.length === 0 && <p className="text-chalk-dim text-sm">No one enrolled yet.</p>}
      {standings.map((row, i) => (
        <div key={row.entrantId} className="flex items-center gap-4 bg-court-deep rounded-xl px-4 py-3 border border-white/10">
          <span className="font-score text-chalk-dim w-6 text-center">{i + 1}</span>
          <div className="flex-1">
            <div className="text-chalk font-medium">
              {name(row.entrantId)} {row.entrantId === myEntrantId && <span className="text-ball text-xs font-display ml-1">YOU</span>}
            </div>
            <div className="text-chalk-dim text-xs">{row.wins}-{row.losses}</div>
          </div>
          <div className="font-score font-bold text-lg">{row.points}</div>
        </div>
      ))}
    </div>
  );
}

function OffersTab({ leagueSeasonId, matches, name, avatar, myEntrantId }: { leagueSeasonId: string; matches: Match[]; name: (id: string) => string; avatar: (id: string) => string | null; myEntrantId: string | null }) {
  const { run, pending, error } = useAction();
  const [showForm, setShowForm] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const open = matches.filter((m) => m.status === "open");
  const mine = open.filter((m) => m.entrant_a_id === myEntrantId);
  const others = open.filter((m) => m.entrant_a_id !== myEntrantId);

  function submitOffer(formData: FormData) {
    run(() => createOffer(leagueSeasonId, formData));
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-display font-semibold">Offers</h3>
        <button onClick={() => setShowForm((s) => !s)} className="bg-ball text-ink font-display text-sm font-semibold px-3 py-2 rounded-lg">Offer a time</button>
      </div>
      {showForm && (
        <form action={submitOffer} className="bg-court-deep border border-white/10 rounded-xl p-4 mb-4 grid sm:grid-cols-3 gap-3">
          <input name="date" type="date" required className="bg-panel border border-white/10 rounded-lg px-2 py-2 text-sm" />
          <input name="time" type="time" required className="bg-panel border border-white/10 rounded-lg px-2 py-2 text-sm" />
          <input name="location" placeholder="Location" required className="bg-panel border border-white/10 rounded-lg px-2 py-2 text-sm" />
          <button type="submit" disabled={pending} className="sm:col-span-3 bg-ball text-ink font-display font-semibold rounded-lg py-2 text-sm">Post offer</button>
        </form>
      )}
      {error && <div className="text-paddle text-xs mb-3">{error}</div>}

      <button onClick={() => setCollapsed((c) => !c)} className="text-chalk-dim text-xs font-display uppercase mb-2">
        {collapsed ? "\u25b8" : "\u25be"} Your offers {mine.length > 0 && `(${mine.length})`}
      </button>
      {!collapsed && (
        <div className="space-y-2 mb-4">
          {mine.length === 0 && <p className="text-chalk-dim text-sm">You haven&apos;t posted an offer.</p>}
          {mine.map((m) => (
            <div key={m.id} className="flex items-center gap-4 bg-court-deep rounded-xl px-4 py-3 border border-white/10 flex-wrap">
              <div className="flex-1 text-sm">{m.scheduled_date} {m.scheduled_time} &middot; {m.location}</div>
              <button onClick={() => run(() => cancelMatch(m.id))} className="text-chalk-dim text-xs border border-white/10 rounded-lg px-3 py-1.5">Cancel</button>
            </div>
          ))}
        </div>
      )}

      <h4 className="text-chalk-dim text-xs font-display uppercase mb-2">Offers from others</h4>
      <div className="space-y-2">
        {others.length === 0 && <p className="text-chalk-dim text-sm">Nothing open right now.</p>}
        {others.map((m) => (
          <div key={m.id} className="flex items-center gap-4 bg-court-deep rounded-xl px-4 py-3 border border-white/10 flex-wrap">
            <Avatar name={name(m.entrant_a_id)} avatarUrl={avatar(m.entrant_a_id)} />
            <div className="flex-1 text-sm">{name(m.entrant_a_id)} &middot; {m.scheduled_date} {m.scheduled_time} &middot; {m.location}</div>
            <button onClick={() => run(() => acceptOffer(m.id))} className="bg-ball text-ink font-display text-xs font-semibold rounded-lg px-3 py-1.5">Accept</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChallengesTab({ leagueSeasonId, matches, standings, name, avatar, myEntrantId }: { leagueSeasonId: string; matches: Match[]; standings: StandingsRow[]; name: (id: string) => string; avatar: (id: string) => string | null; myEntrantId: string | null }) {
  const { run, pending, error } = useAction();
  const [opponentId, setOpponentId] = useState("");

  const incoming = matches.filter((m) => m.status === "pending" && m.entrant_b_id === myEntrantId);
  const sent = matches.filter((m) => m.status === "pending" && m.entrant_a_id === myEntrantId);

  function submitChallenge(formData: FormData) {
    if (!opponentId) return;
    run(() => sendChallenge(leagueSeasonId, opponentId, formData));
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display font-semibold mb-3">Challenge a player</h3>
        <form action={submitChallenge} className="bg-court-deep border border-white/10 rounded-xl p-4 grid sm:grid-cols-4 gap-3">
          <select value={opponentId} onChange={(e) => setOpponentId(e.target.value)} className="bg-panel border border-white/10 rounded-lg px-2 py-2 text-sm">
            <option value="">Opponent\u2026</option>
            {standings.filter((s) => s.entrantId !== myEntrantId).map((s) => (
              <option key={s.entrantId} value={s.entrantId}>{name(s.entrantId)}</option>
            ))}
          </select>
          <input name="date" type="date" required className="bg-panel border border-white/10 rounded-lg px-2 py-2 text-sm" />
          <input name="time" type="time" required className="bg-panel border border-white/10 rounded-lg px-2 py-2 text-sm" />
          <input name="location" placeholder="Location" required className="bg-panel border border-white/10 rounded-lg px-2 py-2 text-sm" />
          <button type="submit" disabled={pending || !opponentId} className="sm:col-span-4 bg-paddle font-display text-sm font-semibold rounded-lg py-2">Send challenge</button>
        </form>
        {error && <div className="text-paddle text-xs mt-2">{error}</div>}
      </div>

      <div>
        <h4 className="text-chalk-dim text-xs font-display uppercase mb-2">Incoming</h4>
        {incoming.length === 0 && <p className="text-chalk-dim text-sm">Nothing incoming.</p>}
        {incoming.map((m) => (
          <div key={m.id} className="flex items-center gap-4 bg-court-deep rounded-xl px-4 py-3 border border-white/10 mb-2 flex-wrap">
            <Avatar name={name(m.entrant_a_id)} avatarUrl={avatar(m.entrant_a_id)} />
            <div className="flex-1 text-sm">{name(m.entrant_a_id)} challenged you &middot; {m.scheduled_date} {m.scheduled_time}</div>
            <button onClick={() => run(() => respondChallenge(m.id, true))} className="bg-ball text-ink rounded-lg px-3 py-1.5 text-xs font-display font-semibold">Accept</button>
            <button onClick={() => run(() => respondChallenge(m.id, false))} className="border border-white/10 rounded-lg px-3 py-1.5 text-xs">Decline</button>
          </div>
        ))}
      </div>

      <div>
        <h4 className="text-chalk-dim text-xs font-display uppercase mb-2">Sent</h4>
        {sent.length === 0 && <p className="text-chalk-dim text-sm">Nothing pending.</p>}
        {sent.map((m) => (
          <div key={m.id} className="flex items-center gap-4 bg-court-deep rounded-xl px-4 py-3 border border-white/10 mb-2 flex-wrap">
            <div className="flex-1 text-sm">Waiting on {m.entrant_b_id ? name(m.entrant_b_id) : "\u2014"}</div>
            <button onClick={() => run(() => cancelMatch(m.id))} className="text-chalk-dim text-xs border border-white/10 rounded-lg px-3 py-1.5">Withdraw</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchesTab({ sport, matches, resultsByMatch, name, myEntrantId }: { sport: "tennis" | "pickleball"; matches: Match[]; resultsByMatch: Record<string, MatchResult>; name: (id: string) => string; myEntrantId: string | null }) {
  const { run, error } = useAction();

  const scheduled = matches.filter((m) => m.status === "scheduled" && (m.entrant_a_id === myEntrantId || m.entrant_b_id === myEntrantId));
  const disputed = matches.filter((m) => m.status === "disputed" && (m.entrant_a_id === myEntrantId || m.entrant_b_id === myEntrantId));
  const completed = matches.filter((m) => m.status === "completed" && (m.entrant_a_id === myEntrantId || m.entrant_b_id === myEntrantId));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display font-semibold mb-3">Scheduled</h3>
        {error && <div className="text-paddle text-xs mb-2">{error}</div>}
        {scheduled.length === 0 && <p className="text-chalk-dim text-sm">Nothing scheduled.</p>}
        {scheduled.map((m) => {
          const result = resultsByMatch[m.id];
          return (
            <div key={m.id} className="bg-court-deep border border-white/10 rounded-xl p-4 mb-3">
              <div className="text-chalk-dim text-xs mb-2">
                {name(m.entrant_a_id)} vs {m.entrant_b_id ? name(m.entrant_b_id) : "\u2014"} &middot; {m.scheduled_date} {m.scheduled_time} &middot; {m.location}
              </div>
              {!result && (
                <ScoreForm sport={sport} onSubmit={(payload) => run(() => reportScore(m.id, payload))} />
              )}
              {result && !result.confirmed_by && result.reporter_entrant_id === myEntrantId && (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm">Sent: {result.sets.map((s) => `${s.a}-${s.b}`).join(", ")}</span>
                  <span className="text-chalk-dim text-xs">
                    Waiting on {m.entrant_a_id === myEntrantId && m.entrant_b_id ? name(m.entrant_b_id) : name(m.entrant_a_id)} to confirm.
                  </span>
                </div>
              )}
              {result && !result.confirmed_by && result.reporter_entrant_id !== myEntrantId && (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm">Reported: {result.sets.map((s) => `${s.a}-${s.b}`).join(", ")}</span>
                  <button onClick={() => run(() => confirmScore(m.id))} className="bg-ball text-ink font-display text-xs font-semibold rounded px-3 py-1.5">Confirm</button>
                  <button onClick={() => run(() => disputeScore(m.id))} className="border border-white/10 rounded px-3 py-1.5 text-xs">Dispute</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {disputed.length > 0 && (
        <div>
          <h3 className="font-display font-semibold mb-3">Disputed</h3>
          {disputed.map((m) => (
            <div key={m.id} className="bg-court-deep border border-paddle/40 rounded-xl p-4 mb-3 text-sm">
              {name(m.entrant_a_id)} vs {m.entrant_b_id ? name(m.entrant_b_id) : "\u2014"} &middot; {m.scheduled_date} {m.scheduled_time}
              <div className="text-chalk-dim text-xs mt-1">Waiting on an admin to resolve this one.</div>
            </div>
          ))}
        </div>
      )}

      <div>
        <h3 className="font-display font-semibold mb-3">Match history</h3>
        {completed.length === 0 && <p className="text-chalk-dim text-sm">No completed matches yet.</p>}
        {completed.map((m) => {
          const result = resultsByMatch[m.id];
          return (
            <div key={m.id} className="flex items-center gap-4 bg-court-deep rounded-xl px-4 py-3 border border-white/10 mb-2 flex-wrap">
              <div className="flex-1 text-sm">
                {name(m.entrant_a_id)} vs {m.entrant_b_id ? name(m.entrant_b_id) : "\u2014"}
                {result && <span className="font-score ml-2">{result.sets.map((s) => `${s.a}-${s.b}`).join(", ")}</span>}
              </div>
              {result && <div className="text-xs font-score text-chalk-dim">+{result.points_a} / +{result.points_b} pts</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
