"use client";

import { useState, useTransition } from "react";
import { joinLeague, searchPlayers, type PlayerSearchResult } from "./actions";
import { leagueLabel } from "@/lib/leagues/label";
import { LeagueBadge, FormatChip } from "@/components/league-badge";
import { AREAS } from "@/lib/leagues/divisions";

export type CatalogueLeague = {
  id: string;
  sport: string;
  format: string;
  division: string;
  level: string;
  area: string | null;
  name: string | null;
};

const SPORTS: [string, string][] = [
  ["tennis", "Tennis"],
  ["pickleball", "Pickleball"],
];

/**
 * Pick a league in three steps: city, sport, then the leagues that exist there.
 *
 * This replaces a five-dropdown form that asked for gender and rating and then
 * conjured a league from the combination. That produced leagues of one: two
 * people who both play in Dallas would land in separate 3.5 and 4.0 ladders and
 * never meet. Leagues are now a fixed list, so choosing one means choosing from
 * what actually exists.
 */
export function JoinLeagueForm({
  leagues = [],
  joinedTemplateIds = [],
}: {
  leagues?: CatalogueLeague[];
  /** Leagues this player is already in, shown as joined rather than offered again. */
  joinedTemplateIds?: string[];
}) {
  const [area, setArea] = useState("");
  const [sport, setSport] = useState("");
  const [selectedId, setSelectedId] = useState("");

  const [partnerQuery, setPartnerQuery] = useState("");
  const [partnerResults, setPartnerResults] = useState<PlayerSearchResult[]>([]);
  const [partner, setPartner] = useState<PlayerSearchResult | null>(null);
  const [searching, setSearching] = useState(false);

  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  // Only cities that actually hold leagues are offered, so nobody picks one and
  // finds it empty.
  const citiesWithLeagues = AREAS.filter(([code]) => leagues.some((l) => l.area === code));

  const sportsHere = SPORTS.filter(([s]) =>
    leagues.some((l) => l.area === area && l.sport === s)
  );

  const visible = leagues.filter((l) => l.area === area && l.sport === sport);
  const selected = visible.find((l) => l.id === selectedId) ?? null;
  const needsPartner = selected?.format === "doubles";

  async function handlePartnerSearch(value: string) {
    setPartnerQuery(value);
    setPartner(null);
    if (value.trim().length < 2) {
      setPartnerResults([]);
      return;
    }
    setSearching(true);
    try {
      setPartnerResults(await searchPlayers(value));
    } finally {
      setSearching(false);
    }
  }

  function handleSubmit(formData: FormData) {
    setError("");
    if (!selected) {
      setError("Pick a league to continue.");
      return;
    }
    if (needsPartner && !partner) {
      setError("Search for and select a partner to continue.");
      return;
    }
    formData.set("clubTemplateId", selected.id);
    if (partner) formData.set("partnerId", partner.id);
    startTransition(async () => {
      try {
        await joinLeague(formData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-chalk-dim text-xs mb-1">Where do you play?</label>
        <select
          value={area}
          onChange={(e) => {
            setArea(e.target.value);
            setSport("");
            setSelectedId("");
          }}
          className="w-full bg-court-deep border border-white/10 rounded-lg px-2 py-2 text-sm"
        >
          <option value="" disabled>
            Choose a city…
          </option>
          {citiesWithLeagues.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {area && (
        <div>
          <label className="block text-chalk-dim text-xs mb-1">Which sport?</label>
          <div className="flex gap-2">
            {sportsHere.map(([code, name]) => (
              <button
                type="button"
                key={code}
                onClick={() => {
                  setSport(code);
                  setSelectedId("");
                }}
                className={`flex-1 rounded-lg px-3 py-2.5 text-sm border transition-colors ${
                  sport === code
                    ? "border-ball bg-ball/10 text-chalk"
                    : "border-white/10 bg-court-deep text-chalk-dim hover:border-white/30"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {area && sport && (
        <div>
          <label className="block text-chalk-dim text-xs mb-2">
            {visible.length === 1 ? "One league here" : `${visible.length} leagues here`}
          </label>
          <div className="space-y-2">
            {visible.map((l) => {
              const already = joinedTemplateIds.includes(l.id);
              return (
                <button
                  type="button"
                  key={l.id}
                  disabled={already}
                  onClick={() => setSelectedId(selectedId === l.id ? "" : l.id)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 border transition-colors ${
                    already
                      ? "border-white/5 bg-court-deep/50 text-chalk-dim cursor-default"
                      : selectedId === l.id
                        ? "border-ball bg-ball/10 text-chalk"
                        : "border-white/10 bg-court-deep text-chalk-dim hover:border-white/30"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <LeagueBadge sport={l.sport} division={l.division} format={l.format} area={l.area} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold">{leagueLabel(l)}</span>
                      <span className="block text-xs text-chalk-dim mt-0.5">
                        {already ? "You're already in this one" : "All ratings, one ladder"}
                      </span>
                    </span>
                    <FormatChip format={l.format} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {needsPartner && (
        <div>
          <input
            placeholder="Search for your partner by name"
            value={partnerQuery}
            onChange={(e) => handlePartnerSearch(e.target.value)}
            className="w-full bg-court-deep border border-white/10 rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-chalk-dim text-xs mt-1">
            Your partner needs to have already signed up.
          </p>
          {searching && <p className="text-chalk-dim text-xs mt-1">Searching…</p>}
          {partnerResults.length > 0 && !partner && (
            <div className="mt-2 space-y-1">
              {partnerResults.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => {
                    setPartner(p);
                    setPartnerQuery(p.full_name);
                    setPartnerResults([]);
                  }}
                  className="w-full text-left bg-court-deep border border-white/10 rounded-lg px-3 py-2 text-sm hover:border-ball"
                >
                  {p.full_name}
                </button>
              ))}
            </div>
          )}
          {partner && <div className="mt-2 text-ball text-sm">Partner: {partner.full_name}</div>}
        </div>
      )}

      {error && <div className="text-paddle text-xs">{error}</div>}

      {selected && (
        <button
          type="submit"
          disabled={pending}
          className="w-full bg-ball text-ink font-display font-semibold rounded-lg py-3 disabled:opacity-50"
        >
          {pending ? "Joining…" : `Join ${leagueLabel(selected)}`}
        </button>
      )}
    </form>
  );
}
