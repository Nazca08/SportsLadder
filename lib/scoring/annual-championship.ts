export type SeasonStanding = { entrantId: string; entrantName: string };
export type SeasonQualifiers = { seasonName: string; standings: SeasonStanding[] };

export type ChampionshipSlot = {
  seasonName: string;
  role: "champion" | "runner_up";
  entrantId: string | null;
  entrantName: string | null;
  standingRank: number | null;
  substituted: boolean;
  naturalEntrantName: string | undefined;
};

/**
 * Resolves the 8 annual championship slots (champion + runner-up from each
 * of 4 seasons). If a natural qualifier is unavailable, or already claimed a
 * slot by winning a different season, the next-best finisher from that same
 * season's standings steps up -- processed season by season, champion slot
 * before runner-up slot, so repeat winners cascade correctly.
 */
export function resolveAnnualEntrants(
  seasons: SeasonQualifiers[],
  unavailableEntrantIds: Set<string>
): ChampionshipSlot[] {
  const claimed = new Set<string>();
  const slots: ChampionshipSlot[] = [];

  for (const season of seasons) {
    (["champion", "runner_up"] as const).forEach((role, ri) => {
      const targetRank = ri + 1;
      let rank = targetRank;
      let found: SeasonStanding | null = null;

      while (rank <= season.standings.length) {
        const candidate = season.standings[rank - 1];
        if (!claimed.has(candidate.entrantId) && !unavailableEntrantIds.has(candidate.entrantId)) {
          found = candidate;
          break;
        }
        rank++;
      }

      const naturalEntrantName = season.standings[targetRank - 1]?.entrantName;
      if (found) {
        claimed.add(found.entrantId);
        slots.push({
          seasonName: season.seasonName,
          role,
          entrantId: found.entrantId,
          entrantName: found.entrantName,
          standingRank: rank,
          substituted: rank !== targetRank,
          naturalEntrantName,
        });
      } else {
        slots.push({
          seasonName: season.seasonName,
          role,
          entrantId: null,
          entrantName: null,
          standingRank: null,
          substituted: true,
          naturalEntrantName,
        });
      }
    });
  }

  return slots;
}
