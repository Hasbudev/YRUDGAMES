import { describe, expect, it } from "vitest";
import { computeBonusWinners, gradeSpeedAnswer, pickNextSpeedQuestion } from "./engine";
import type { InternalQuestion } from "../game/types";

const POOL: InternalQuestion[] = [
  { id: "s1", theme: "speed", prompt: "Q1", choices: ["a", "b"], correctIndex: 0, timeLimitMs: 0 },
  { id: "s2", theme: "speed", prompt: "Q2", choices: ["a", "b"], correctIndex: 1, timeLimitMs: 0 },
];

describe("speed round engine", () => {
  it("returns null for an empty pool", () => {
    expect(pickNextSpeedQuestion([], [])).toBeNull();
  });

  it("avoids repeating questions the player has already seen", () => {
    const picked = pickNextSpeedQuestion(POOL, ["s1"]);
    expect(picked?.id).toBe("s2");
  });

  it("wraps around once every question has been asked", () => {
    const picked = pickNextSpeedQuestion(POOL, ["s1", "s2"]);
    expect(["s1", "s2"]).toContain(picked?.id);
  });

  it("grades answers against the correct index", () => {
    expect(gradeSpeedAnswer(POOL[0], 0)).toBe(true);
    expect(gradeSpeedAnswer(POOL[0], 1)).toBe(false);
  });

  it("awards the bonus to the single top scorer", () => {
    const winners = computeBonusWinners([
      { playerId: "p1", correct: 5 },
      { playerId: "p2", correct: 3 },
    ]);
    expect(winners).toEqual(["p1"]);
  });

  it("splits the bonus across ties", () => {
    const winners = computeBonusWinners([
      { playerId: "p1", correct: 4 },
      { playerId: "p2", correct: 4 },
      { playerId: "p3", correct: 1 },
    ]);
    expect(winners.sort()).toEqual(["p1", "p2"]);
  });

  it("awards nobody if everyone scored zero", () => {
    const winners = computeBonusWinners([
      { playerId: "p1", correct: 0 },
      { playerId: "p2", correct: 0 },
    ]);
    expect(winners).toEqual([]);
  });
});
