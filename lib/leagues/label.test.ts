import { describe, it, expect } from "vitest";
import { leagueLabel } from "@/lib/leagues/label";

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
