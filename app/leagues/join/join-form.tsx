"use client";

import { useState, useTransition } from "react";
import { divisionOptions, SPORTS, LEVELS, type Format, type Division } from "@/lib/leagues/divisions";
import { joinLeague, searchPlayers, type PlayerSearchResult } from "./actions";

export function JoinLeagueForm({ gender }: { gender: "male" | "female" }) {
  const [sport, setSport] = useState<(typeof SPORTS)[number]>("tennis");
  const [format, setFormat] = useState<Format>("singles");
  const [division, setDivision] = useState<Division | "">("");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("4.0");

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
    if (format === "doubles" && !partner) {
      setError("Search for and select a partner to continue.");
      return;
    }
    formData.set("division", effectiveDivision);
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

      <div className="grid grid-cols-2 gap-2">
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
        className="w-full bg-court-deep border border-white/10 rounded-lg px-2 py-2 text-sm"
      >
        <option value="singles">Singles</option>
        <option value="doubles">Doubles</option>
      </select>

      <select
        value={effectiveDivision}
        onChange={(e) => setDivision(e.target.value as Division)}
        className="w-full bg-court-deep border border-white/10 rounded-lg px-2 py-2 text-sm"
      >
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>

      {format === "doubles" && (
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
        {pending ? "Joining\u2026" : "Join league"}
      </button>
    </form>
  );
}
