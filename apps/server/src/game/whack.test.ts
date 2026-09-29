import { describe, expect, it } from "vitest";
import { MOLE_KINDS, RUDY_BOOST_MS, RUDY_BOOST_MULTIPLIER, WHACK_HOLES, whackSchedule, whackScore, type Mole } from "@yrud/shared";

describe("whackSchedule", () => {
  it("is the same board for the same seed", () => {
    expect(whackSchedule(42, 60_000)).toEqual(whackSchedule(42, 60_000));
    expect(whackSchedule(42, 60_000)).not.toEqual(whackSchedule(43, 60_000));
  });

  it("gets faster, never stacks two moles in one hole, and stays inside the game", () => {
    const moles = whackSchedule(7, 60_000);
    const firstThird = moles.filter((m) => m.appearAt < 20_000);
    const lastThird = moles.filter((m) => m.appearAt >= 40_000);
    expect(lastThird.length).toBeGreaterThan(firstThird.length * 1.5);
    const avgVisible = (ms: Mole[]) => ms.reduce((s, m) => s + m.hideAt - m.appearAt, 0) / ms.length;
    expect(avgVisible(lastThird)).toBeLessThan(avgVisible(firstThird));

    for (let hole = 0; hole < WHACK_HOLES; hole++) {
      const inHole = moles.filter((m) => m.hole === hole);
      for (let i = 1; i < inHole.length; i++) expect(inHole[i].appearAt).toBeGreaterThanOrEqual(inHole[i - 1].hideAt);
    }
    expect(moles.every((m) => m.hideAt <= 60_000)).toBe(true);
    expect(new Set(moles.map((m) => m.kind)).size).toBe(Object.keys(MOLE_KINDS).length);
  });
});

describe("whackScore", () => {
  const board: Mole[] = [
    { id: 0, hole: 0, kind: "taupiqueur", appearAt: 0, hideAt: 1000 },
    { id: 1, hole: 1, kind: "remysse", appearAt: 0, hideAt: 1000 },
    { id: 2, hole: 2, kind: "tchoupi", appearAt: 0, hideAt: 1000 },
    { id: 3, hole: 3, kind: "rudy", appearAt: 0, hideAt: 1000 },
    { id: 4, hole: 4, kind: "remysse", appearAt: 0, hideAt: 1000 },
    { id: 5, hole: 5, kind: "artymasion", appearAt: 0, hideAt: 1000 },
    { id: 6, hole: 6, kind: "tchoupi", appearAt: 0, hideAt: 1000 },
  ];

  it("adds each mole's points", () => {
    expect(whackScore(board, [{ moleId: 0, atMs: 100 }, { moleId: 1, atMs: 200 }, { moleId: 2, atMs: 300 }])).toBe(1);
    expect(whackScore(board, [{ moleId: 5, atMs: 100 }])).toBe(0);
  });

  it("Rudy boosts gains ×1.1 for 6.7 s, but not Tchoupi's loss", () => {
    expect(RUDY_BOOST_MULTIPLIER).toBe(1.1);
    // Remysse's 5 boosted: 5.5 → 6.
    expect(whackScore(board, [{ moleId: 3, atMs: 1000 }, { moleId: 4, atMs: 2000 }])).toBe(6);
    // Tchoupi's −5 is not boosted.
    expect(whackScore(board, [{ moleId: 3, atMs: 1000 }, { moleId: 6, atMs: 2000 }])).toBe(-5);
    expect(whackScore(board, [{ moleId: 3, atMs: 0 }, { moleId: 4, atMs: RUDY_BOOST_MS + 1 }])).toBe(5);
  });
});
