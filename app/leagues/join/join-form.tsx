"use client";

import { useState, useTransition } from "react";
import { divisionOptions, SPORTS, LEVELS, AREAS, type Format, type Division } from "@/lib/leagues/divisions";
import { joinLeague, searchPlayers, type PlayerSearchResult } from "./actions";
import { leagueLabel } from "@/lib/leagues/label";

export type ClubLeague = {
  id: string;
  sport: string;
  format: string;
  division: string;
  level: string;
  area: string | null;
  name: string | null;
};

export function JoinLeagueForm({
  gender,
  clubLeagues = [],
}: {
  gender: "male" | "female";
  clubLeagues?: ClubLeague[];
}) {
  // When a club league is selected the five dropdowns are irrelevant -- the
  // league is taken whole from the stored row.
  const [clubId, setClubId] = useState("");
  const club = clubLeagues.find((c) => c.id === clubId) ?? null;
  const [sport, setSport] = useState<(typeof SPORTS)[number]>("tennis");
  const [format, setFormat] = useState<Format>("singles");
  const [division, setDivision] = useState<Division | "">("");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("4.0");
  const [area, setArea] = useState("");

  const [partnerQuery, setPartnerQuery] = useState("");
  const [partnerResults, setPartnerResults] = useState<PlayerSearchResult[]>([]);
  const [partner, setPartner] = useState<PlayerSearchResult | null>(null);
  const [searching, setSearching] = useState(false);

  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const opts = divisionOptions(gender, format);
  const effectiveDivision = division || opts[0][0];

  async function handlePartnerSearch(value: string) {
    setPartnerQuery(value);
    setPartner(null);
    if (value.trim().length < 2) {
      setPartnerResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await searchPlayers(value);
      setPartnerResults(results);
    } finally {
      setSearching(false);
    }
  }

  function handleSubmit(formData: FormData) {
    setError("");
    const needsPartner = club ? club.format === "doubles" : format === "doubles";

    if (!club && !area) {
      setError("Pick your area to continue.");
      return;
    }
    if (needsPartner && !partner) {
      setError("Search for and select a partner to continue.");
      return;
    }
    if (club) {
      formData.set("clubTemplateId", club.id);
    }
    formData.set("division", effectiveDivision);
    formData.set("area", area);
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
    <form action={handleSubmit} className="space-y-3">
      <input type="hidden" name="sport" value={sport} />
      <input type="hidden" name="format" value={format} />
      <input type="hidden" name="level" value={level} />

      {clubLeagues.length > 0 && (
        <div className="mb-4">
          <p className="text-chalk-dim text-xs mb-2">Club leagues</p>
          <div className="space-y-2">
            {clubLeagues.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => setClubId(clubId === c.id ? "" : c.id)}
                className={`w-full text-left rounded-lg px-3 py-2.5 text-sm border transition-colors ${
                  clubId === c.id
                    ? "border-ball bg-ball/10 text-chalk"
                    : "border-white/10 bg-court-deep text-chalk-dim hover:border-white/30"
                }`}
              >
                <span className="block font-semibold">{leagueLabel(c)}</span>
                <span className="block text-xs text-chalk-dim mt-0.5">
                  All ratings &middot; open to everyone
                </span>
              </button>
            ))}
          </div>
          <p className="text-chalk-dim text-xs mt-3">
            {club ? "Deselect to build a regular league instead." : "Or build your own below."}
          </p>
        </div>
      )}

      <div className={club ? "hidden" : "grid grid-cols-2 gap-2"}>
        <select
          value={sport}
          onChange={(e) => setSport(e.target.value as (typeof SPORTS)[number])}
          className="bg-court-deep border border-white/10 rounded-lg px-2 py-2 text-sm"
        >
          {SPORTS.map((s) => (
            <option key={s} value={s}>{s === "tennis" ? "Tennis" : "Pickleball"}</option>
          ))}
        </select>
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value as (typeof LEVELS)[number])}
          className="bg-court-deep border border-white/10 rounded-lg px-2 py-2 text-sm"
        >
          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      <select
        value={format}
        onChange={(e) => { setFormat(e.target.value as Format); setDivision(""); }}
        className={`w-full bg-court-deep border border-white/10 rounded-lg px-2 py-2 text-sm ${club ? "hidden" : ""}`}
      >
        <option value="singles">Singles</option>
        <option value="doubles">Doubles</option>
      </select>

      <select
        value={effectiveDivision}
        onChange={(e) => setDivision(e.target.value as Division)}
        className={`w-full bg-court-deep border border-white/10 rounded-lg px-2 py-2 text-sm ${club ? "hidden" : ""}`}
      >
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>

      <select
        value={area}
        onChange={(e) => setArea(e.target.value)}
        className={`w-full bg-court-deep border border-white/10 rounded-lg px-2 py-2 text-sm ${club ? "hidden" : ""}`}
      >
        <option value="">Area\u2026</option>
        {AREAS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
      </select>

      {(club ? club.format === "doubles" : format === "doubles") && (
        <div>
          <input
            placeholder="Search for your partner by name"
            value={partnerQuery}
            onChange={(e) => handlePartnerSearch(e.target.value)}
            className="w-full bg-court-deep border border-white/10 rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-chalk-dim text-xs mt-1">Your partner needs to have already signed up.</p>
          {searching && <p className="text-chalk-dim text-xs mt-1">Searching\u2026</p>}
          {partnerResults.length > 0 && !partner && (
            <div className="mt-2 space-y-1">
              {partnerResults.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => { setPartner(p); setPartnerQuery(p.full_name); setPartnerResults([]); }}
                  className="w-full text-left bg-court-deep border border-white/10 rounded-lg px-3 py-2 text-sm hover:border-ball"
                >
                  {p.full_name}
                </button>
              ))}
            </div>
          )}
          {partner && (
            <div className="mt-2 text-ball text-sm">Partner: {partner.full_name}</div>
          )}
        </div>
      )}

      {error && <div className="text-paddle text-xs">{error}</div>}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-ball text-ink font-display font-semibold rounded-lg py-3 disabled:opacity-50"
      >
        {pending ? "Joining\u2026" : club ? `Join ${club.name}` : "Join league"}
      </button>
    </form>
  );
}
