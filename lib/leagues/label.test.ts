import { describe, it, expect } from "vitest";
import { leagueLabel, areaName, areaShortName } from "@/lib/leagues/label";
import { AREAS } from "@/lib/leagues/divisions";

describe("named league labels", () => {
  const base = { name: "Palmas Tennis League", sport: "tennis", level: "open", area: "palmas-del-mar-pr" };
  it("names every division, so leagues in one city are told apart", () => {
    expect(leagueLabel({ ...base, division: "mens", format: "singles" })).toContain("Men's Singles");
    expect(leagueLabel({ ...base, division: "womens", format: "doubles" })).toContain("Women's Doubles");
    expect(leagueLabel({ ...base, division: "mixed", format: "doubles" })).toContain("Mixed Doubles");
  });
  it("does not leave two doubles leagues reading the same", () => {
    const mens = leagueLabel({ ...base, division: "mens", format: "doubles" });
    const mixed = leagueLabel({ ...base, division: "mixed", format: "doubles" });
    expect(mens).not.toBe(mixed);
  });
});

describe("every city has a name", () => {
  // Belmont, Provo and Heber City were added to AREAS but not to the label
  // maps, so they showed as "belmont-nc" both in league names and as the
  // default place to meet for a match. Adding a city is now two edits that
  // this test insists on.
  it.each(AREAS)("%s reads as a place, not a code", (code) => {
    expect(areaName(code)).not.toBe(code);
    expect(areaShortName(code)).not.toBe(code);
  });
});
