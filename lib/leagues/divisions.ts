export type Gender = "male" | "female";
export type Format = "singles" | "doubles";
export type Division = "mens" | "womens" | "mixed";

/**
 * Mixed is now offered for singles as well as doubles.
 *
 * In doubles it means a man and a woman on the same side. In singles it means
 * one draw that men and women both enter -- a different thing wearing the same
 * name, but the one clubs use.
 */
export function divisionOptions(gender: Gender, format: Format): [Division, string][] {
  const own: [Division, string] = gender === "male" ? ["mens", "Men's"] : ["womens", "Women's"];
  return [own, ["mixed", "Mixed"]];
}

export const SPORTS = ["tennis", "pickleball"] as const;
export const LEVELS = ["2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0"] as const;

/**
 * Sentinel used by named club leagues that span every rating and mix men and
 * women. Deliberately NOT in LEVELS or divisionOptions -- it must never show up
 * as a pickable option in the ordinary rating-scoped sign-up flow.
 */
export const OPEN = "open";

/** The only markets RallyRank.club currently operates in. */
export const AREAS: [string, string][] = [
  ["dallas-tx", "Dallas, Texas"],
  ["utah-valley-ut", "Utah Valley, Utah"],
  ["palmas-del-mar-pr", "Palmas Del Mar, Puerto Rico"],
  ["minneapolis-mn", "Minneapolis, Minnesota"],
  ["raleigh-nc", "Raleigh, North Carolina"],
];
