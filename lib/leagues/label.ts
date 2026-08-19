/**
 * One place that turns a league_templates row into a human label.
 *
 * This used to be copy-pasted into the dashboard, the league page and the admin
 * page. Named club leagues gave it a branch, and three near-identical copies of
 * a branching function is how they drift apart.
 */
export type LeagueTemplateLike = {
  sport: string;
  format: string;
  division: string;
  level: string;
  area?: string | null;
  name?: string | null;
} | null;

const AREA_NAMES: Record<string, string> = {
  "dallas-tx": "Dallas, Texas",
  "utah-valley-ut": "Utah Valley, Utah",
  "palmas-del-mar-pr": "Palmas Del Mar, Puerto Rico",
  "minneapolis-mn": "Minneapolis, Minnesota",
  "raleigh-nc": "Raleigh, North Carolina",
};

export function areaName(code?: string | null): string {
  if (!code) return "";
  return AREA_NAMES[code] ?? code;
}

/**
 * Just the place, without the state or territory. Used where the area is a
 * suggested match location rather than a market label -- "Palmas Del Mar"
 * reads like somewhere you would play; "Palmas Del Mar, Puerto Rico" does not.
 */
const AREA_SHORT: Record<string, string> = {
  "dallas-tx": "Dallas",
  "utah-valley-ut": "Utah Valley",
  "palmas-del-mar-pr": "Palmas Del Mar",
  "minneapolis-mn": "Minneapolis",
  "raleigh-nc": "Raleigh",
};

export function areaShortName(code?: string | null): string {
  if (!code) return "";
  return AREA_SHORT[code] ?? AREA_NAMES[code] ?? code;
}

function divisionWord(division: string): string {
  if (division === "mixed") return "Mixed";
  if (division === "mens") return "Men's";
  if (division === "womens") return "Women's";
  return "Open";
}

export function leagueLabel(t: LeagueTemplateLike): string {
  if (!t) return "League";

  const format = t.format === "doubles" ? "Doubles" : "Singles";

  // A named club league is identified by its name, not by its combination --
  // "all ratings, everyone" is the point of it, so spelling out division and
  // level would be noise.
  if (t.name) {
    // 'open' division means everybody together, which needs no qualifier. Any
    // other division is a real distinction and has to be visible.
    const qualifier =
      t.division === "open" ? format : `${divisionWord(t.division)} ${format}`;
    return `${t.name} \u00b7 ${qualifier}`;
  }

  const sport = t.sport === "tennis" ? "Tennis" : "Pickleball";
  const parts = [`${sport} ${format}`, divisionWord(t.division), t.level];
  const area = areaName(t.area);
  if (area) parts.push(area);
  return parts.join(" \u00b7 ");
}
