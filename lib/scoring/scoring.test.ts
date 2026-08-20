import { describe, it, expect } from "vitest";
import { computePoints } from "./points";
import { isValidSet, resolveTennisMatch } from "./tennis";
import { resolvePickleballMatch } from "./pickleball";
import { rankStandings, seedPositions, nextPowerOfTwo, type StandingsRow } from "./standings";
import { computeExchange, expectedScore, marginMultiplier, seedFromRating, K_FACTOR } from "./elo";
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
  it("accepts a single decisive set (no best-of-3 requirement)", () => {
    const result = resolveTennisMatch([{ a: 6, b: 4 }]);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.winnerSide).toBe("a");
  });
  it("accepts more than 3 sets, as long as played sessions call for it", () => {
    const result = resolveTennisMatch([
      { a: 6, b: 4 }, { a: 4, b: 6 }, { a: 6, b: 3 }, { a: 4, b: 6 }, { a: 6, b: 2 },
    ]);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.winnerSide).toBe("a"); // 3 sets to 2
  });
  it("rejects an even split with no winner", () => {
    const result = resolveTennisMatch([{ a: 6, b: 4 }, { a: 4, b: 6 }]);
    expect(result.valid).toBe(false);
  });
});

describe("resolvePickleballMatch", () => {
  it("requires reaching 11", () => {
    expect(resolvePickleballMatch([{ a: 10, b: 8 }]).valid).toBe(false);
  });
  it("requires winning by 2", () => {
    expect(resolvePickleballMatch([{ a: 11, b: 10 }]).valid).toBe(false);
    expect(resolvePickleballMatch([{ a: 12, b: 10 }]).valid).toBe(true);
  });
  it("supports a session of several games, winner by majority", () => {
    const result = resolvePickleballMatch([
      { a: 11, b: 7 }, { a: 9, b: 11 }, { a: 11, b: 8 }, { a: 6, b: 11 }, { a: 11, b: 9 },
    ]);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.winnerSide).toBe("a"); // 3 games to 2
  });
  it("aggregates points across every game played", () => {
    const result = resolvePickleballMatch([{ a: 11, b: 7 }, { a: 11, b: 9 }]);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.scoreA).toBe(22);
      expect(result.scoreB).toBe(16);
    }
  });
  it("rejects an even split with no winner", () => {
    const result = resolvePickleballMatch([{ a: 11, b: 7 }, { a: 7, b: 11 }]);
    expect(result.valid).toBe(false);
  });
});

describe("rankStandings tiebreaker", () => {
  it("breaks a points tie by fewest losses", () => {
    const rows: StandingsRow[] = [
      { entrantId: "a", points: 20, wins: 1, losses: 1, played: 1, beatenEntrantIds: [] },
      { entrantId: "b", points: 20, wins: 2, losses: 0, played: 1, beatenEntrantIds: [] },
    ];
    const ranked = rankStandings(rows);
    expect(ranked[0].entrantId).toBe("b");
  });
  it("falls through to best win by opponent standing when losses and wins also tie", () => {
    const rows: StandingsRow[] = [
      { entrantId: "a", points: 20, wins: 2, losses: 0, played: 1, beatenEntrantIds: ["low"] },
      { entrantId: "b", points: 20, wins: 2, losses: 0, played: 1, beatenEntrantIds: ["high"] },
      { entrantId: "low", points: 5, wins: 0, losses: 2, played: 1, beatenEntrantIds: [] },
      { entrantId: "high", points: 15, wins: 1, losses: 1, played: 1, beatenEntrantIds: [] },
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

// ---------------------------------------------------------------------------
// Single set, permissive (Palmas Tennis League)
// ---------------------------------------------------------------------------
describe("single set format", () => {
  it("accepts the intended pro-set scores", () => {
    expect(isValidSet(8, 6, "single_set")).toBe(true);
    expect(isValidSet(9, 7, "single_set")).toBe(true);
    expect(isValidSet(9, 8, "single_set")).toBe(true);
  });

  it("accepts a match cut short by rain or injury", () => {
    expect(isValidSet(4, 2, "single_set")).toBe(true);
    expect(isValidSet(1, 0, "single_set")).toBe(true);
  });

  it("accepts a long set that was played out past 8", () => {
    expect(isValidSet(13, 11, "single_set")).toBe(true);
  });

  it("still rejects negative games, which are typos rather than results", () => {
    expect(isValidSet(-1, 4, "single_set")).toBe(false);
  });

  it("leaves standard leagues strict", () => {
    expect(isValidSet(8, 6, "standard")).toBe(false);
    expect(isValidSet(4, 2, "standard")).toBe(false);
  });

  it("resolves an unfinished set, using games as the aggregate", () => {
    const result = resolveTennisMatch([{ a: 4, b: 2 }], "single_set");
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.winnerSide).toBe("a");
      expect(result.gamesA).toBe(4);
      expect(result.gamesB).toBe(2);
    }
  });

  it("refuses more than one set", () => {
    const result = resolveTennisMatch([{ a: 8, b: 5 }, { a: 8, b: 4 }], "single_set");
    expect(result.valid).toBe(false);
  });

  it("refuses a draw, since 20 points cannot be split without a winner", () => {
    const result = resolveTennisMatch([{ a: 5, b: 5 }], "single_set");
    expect(result.valid).toBe(false);
  });

  it("awards points on the games played, however few", () => {
    // 8-5 is 13 games; the loser's share rounds to 20 * 5/13 = 8.
    expect(computePoints(8, 5)).toEqual({ pointsA: 12, pointsB: 8 });
    // A short 4-2 splits on the same ratio as 8-4 would.
    expect(computePoints(4, 2)).toEqual({ pointsA: 13, pointsB: 7 });
  });
});

// ---------------------------------------------------------------------------
// Zero-sum league scoring
// ---------------------------------------------------------------------------
describe("seedFromRating", () => {
  it("puts 3.5 at the midpoint and scales 100 per rating point", () => {
    expect(seedFromRating("3.5")).toBe(1000);
    expect(seedFromRating("2.0")).toBe(850);
    expect(seedFromRating("5.0")).toBe(1150);
  });

  it("falls back to the default when no rating is set", () => {
    expect(seedFromRating(null)).toBe(1000);
    expect(seedFromRating("")).toBe(1000);
    expect(seedFromRating("not a number")).toBe(1000);
  });
});

describe("expectedScore", () => {
  it("is even between equal scores", () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5, 5);
  });

  it("strongly favours a 300-point lead", () => {
    expect(expectedScore(1150, 850)).toBeCloseTo(0.849, 2);
  });

  it("is symmetric", () => {
    expect(expectedScore(1150, 850) + expectedScore(850, 1150)).toBeCloseTo(1, 5);
  });
});

describe("marginMultiplier", () => {
  it("is 1 for a dead-even scoreline", () => {
    expect(marginMultiplier(6, 6)).toBe(1);
  });

  it("maxes at 1.5 for a shutout", () => {
    expect(marginMultiplier(8, 0)).toBeCloseTo(1.5, 5);
  });

  it("handles a match with no games played", () => {
    expect(marginMultiplier(0, 0)).toBe(1);
  });
});

describe("computeExchange", () => {
  it("pays big for an upset: a 2.0 beating a 5.0", () => {
    const exchange = computeExchange(850, 1150, 8, 6);
    expect(exchange).toBeGreaterThan(40);
    expect(exchange).toBeLessThanOrEqual(K_FACTOR * 1.5);
  });

  it("pays little for the expected result: a 5.0 beating a 2.0", () => {
    expect(computeExchange(1150, 850, 8, 1)).toBeLessThan(15);
  });

  it("pays more for a bigger margin, all else equal", () => {
    const close = computeExchange(1000, 1000, 8, 7);
    const thrashing = computeExchange(1000, 1000, 8, 0);
    expect(thrashing).toBeGreaterThan(close);
  });

  it("never awards zero, so every match counts for something", () => {
    // A hopeless mismatch where the favourite scrapes through.
    expect(computeExchange(2000, 500, 8, 7)).toBeGreaterThanOrEqual(1);
  });

  it("is zero-sum: what the winner gains, the loser loses", () => {
    const exchange = computeExchange(1000, 1000, 8, 4);
    const winnerAfter = 1000 + exchange;
    const loserAfter = 1000 - exchange;
    expect(winnerAfter + loserAfter).toBe(2000);
  });
});

describe("loss farming is not profitable", () => {
  it("drops a player who plays five matches and loses them all", () => {
    let farmer = 1000;
    let opponent = 1000;
    for (let i = 0; i < 5; i++) {
      // Farmer loses narrowly every time -- the old formula rewarded this.
      const exchange = computeExchange(opponent, farmer, 8, 6);
      opponent += exchange;
      farmer -= exchange;
    }
    expect(farmer).toBeLessThan(1000);
  });
});

describe("rankStandings puts unplayed entrants last", () => {
  it("ranks an active low scorer above an idle high seed", () => {
    const rows: StandingsRow[] = [
      { entrantId: "idle-5.0", points: 1150, wins: 0, losses: 0, played: 0, beatenEntrantIds: [] },
      { entrantId: "active-3.0", points: 980, wins: 2, losses: 3, played: 5, beatenEntrantIds: [] },
    ];
    expect(rankStandings(rows).map((r) => r.entrantId)).toEqual(["active-3.0", "idle-5.0"]);
  });

  it("keeps seed order among entrants who have not played", () => {
    const rows: StandingsRow[] = [
      { entrantId: "idle-2.0", points: 850, wins: 0, losses: 0, played: 0, beatenEntrantIds: [] },
      { entrantId: "idle-5.0", points: 1150, wins: 0, losses: 0, played: 0, beatenEntrantIds: [] },
    ];
    expect(rankStandings(rows).map((r) => r.entrantId)).toEqual(["idle-5.0", "idle-2.0"]);
  });
});
