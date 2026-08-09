import { describe, it, expect } from "vitest";
import { computePoints } from "./points";
import { isValidSet, resolveTennisMatch } from "./tennis";
import { resolvePickleballMatch } from "./pickleball";
import { rankStandings, seedPositions, nextPowerOfTwo, type StandingsRow } from "./standings";
import { resolveAnnualEntrants, type SeasonQualifiers } from "./annual-championship";

describe("computePoints", () => {
  it("throws on a tie", () => {
    expect(() => computePoints(6, 6)).toThrow();
  });
  it("gives the loser at least 1 and the winner at least 11", () => {
    const { pointsA, pointsB } = computePoints(6, 0);
    expect(pointsB).toBeGreaterThanOrEqual(1);
    expect(pointsA).toBeGreaterThanOrEqual(11);
    expect(pointsA + pointsB).toBe(20);
  });
  it("gives a closer match a closer split", () => {
    const blowout = computePoints(6, 0);
    const close = computePoints(7, 6);
    expect(close.pointsB).toBeGreaterThan(blowout.pointsB);
  });
});

describe("tennis set validation", () => {
  it("accepts standard set scores", () => {
    expect(isValidSet(6, 4)).toBe(true);
    expect(isValidSet(7, 5)).toBe(true);
    expect(isValidSet(7, 6)).toBe(true);
  });
  it("rejects invalid set scores", () => {
    expect(isValidSet(6, 5)).toBe(false); // must be 7-5, not 6-5
    expect(isValidSet(5, 4)).toBe(false); // not enough games
    expect(isValidSet(8, 6)).toBe(false); // not a real set score
  });
});

describe("resolveTennisMatch", () => {
  it("determines the winner by sets, not aggregate games", () => {
    // A wins the first set big, B wins the next two narrowly -- B should win the match
    const result = resolveTennisMatch([
      { a: 6, b: 0 },
      { a: 4, b: 6 },
      { a: 4, b: 6 },
    ]);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.winnerSide).toBe("b");
  });
  it("sums games across all sets played for the points input", () => {
    const result = resolveTennisMatch([
      { a: 6, b: 4 },
      { a: 3, b: 6 },
      { a: 6, b: 2 },
    ]);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.gamesA).toBe(15);
      expect(result.gamesB).toBe(12);
    }
  });
  it("rejects an unfinished match", () => {
    const result = resolveTennisMatch([{ a: 6, b: 4 }]);
    expect(result.valid).toBe(false);
  });
});

describe("resolvePickleballMatch", () => {
  it("requires reaching 11", () => {
    expect(resolvePickleballMatch(10, 8).valid).toBe(false);
  });
  it("requires winning by 2", () => {
    expect(resolvePickleballMatch(11, 10).valid).toBe(false);
    expect(resolvePickleballMatch(12, 10).valid).toBe(true);
  });
});

describe("rankStandings tiebreaker", () => {
  it("breaks a points tie by fewest losses", () => {
    const rows: StandingsRow[] = [
      { entrantId: "a", points: 20, wins: 1, losses: 1, beatenEntrantIds: [] },
      { entrantId: "b", points: 20, wins: 2, losses: 0, beatenEntrantIds: [] },
    ];
    const ranked = rankStandings(rows);
    expect(ranked[0].entrantId).toBe("b");
  });
  it("falls through to best win by opponent standing when losses and wins also tie", () => {
    const rows: StandingsRow[] = [
      { entrantId: "a", points: 20, wins: 2, losses: 0, beatenEntrantIds: ["low"] },
      { entrantId: "b", points: 20, wins: 2, losses: 0, beatenEntrantIds: ["high"] },
      { entrantId: "low", points: 5, wins: 0, losses: 2, beatenEntrantIds: [] },
      { entrantId: "high", points: 15, wins: 1, losses: 1, beatenEntrantIds: [] },
    ];
    const ranked = rankStandings(rows);
    // "b" beat the higher-standing opponent, so b should rank above a
    expect(ranked.findIndex((r) => r.entrantId === "b")).toBeLessThan(
      ranked.findIndex((r) => r.entrantId === "a")
    );
  });
});

describe("bracket seeding", () => {
  it("computes the next power of two", () => {
    expect(nextPowerOfTwo(5)).toBe(8);
    expect(nextPowerOfTwo(8)).toBe(8);
    expect(nextPowerOfTwo(9)).toBe(16);
  });
  it("produces standard seeding pairs for size 8", () => {
    expect(seedPositions(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
});

describe("resolveAnnualEntrants substitution", () => {
  const seasons: SeasonQualifiers[] = [
    {
      seasonName: "Winter 2026",
      standings: [
        { entrantId: "jordan", entrantName: "Jordan Alvarez" },
        { entrantId: "sam", entrantName: "Sam Okafor" },
        { entrantId: "leo", entrantName: "Leo Fischer" },
      ],
    },
    {
      seasonName: "Spring 2026",
      standings: [
        { entrantId: "sam", entrantName: "Sam Okafor" },
        { entrantId: "leo", entrantName: "Leo Fischer" },
        { entrantId: "jordan", entrantName: "Jordan Alvarez" },
      ],
    },
    {
      seasonName: "Summer 2026",
      // Jordan (already champion of Winter 2026) wins again here --
      // should cascade to the next available finisher.
      standings: [
        { entrantId: "jordan", entrantName: "Jordan Alvarez" },
        { entrantId: "marcus", entrantName: "Marcus Webb" },
        { entrantId: "diego", entrantName: "Diego Santos" },
      ],
    },
  ];

  it("gives every slot a distinct entrant", () => {
    const slots = resolveAnnualEntrants(seasons, new Set());
    const filled = slots.filter((s) => s.entrantId).map((s) => s.entrantId);
    expect(new Set(filled).size).toBe(filled.length);
  });

  it("cascades a repeat winner to the next-best finisher in that season", () => {
    const slots = resolveAnnualEntrants(seasons, new Set());
    const summerChampionSlot = slots.find((s) => s.seasonName === "Summer 2026" && s.role === "champion");
    // Jordan already claimed a slot from Winter 2026, so Summer's champion slot
    // should fall to Marcus (rank 2), and be marked as a substitution.
    expect(summerChampionSlot?.entrantId).toBe("marcus");
    expect(summerChampionSlot?.substituted).toBe(true);
  });

  it("skips a marked-unavailable entrant", () => {
    const slots = resolveAnnualEntrants(seasons, new Set(["sam"]));
    const winterRunnerUpSlot = slots.find((s) => s.seasonName === "Winter 2026" && s.role === "runner_up");
    // Sam was the natural runner-up of Winter 2026 but is marked unavailable,
    // so it should fall to Leo (rank 3).
    expect(winterRunnerUpSlot?.entrantId).toBe("leo");
    expect(winterRunnerUpSlot?.substituted).toBe(true);
  });
});
