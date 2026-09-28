import { describe, expect, it } from "vitest";
import { summarizeRound } from "./rules";
import type { InternalQuestion } from "./types";

function q(over: Partial<InternalQuestion>): InternalQuestion {
  return {
    id: "q",
    theme: "trivia",
    prompt: "?",
    choices: ["a", "b"],
    correctIndex: 0,
    timeLimitMs: 20000,
    points: 1,
    roundIndex: 1,
    wrongPoints: 0,
    ...over,
  };
}

describe("summarizeRound", () => {
  it("returns undefined for a manche with no question", () => {
    expect(summarizeRound([q({})], 9, (x) => x.timeLimitMs, false)).toBeUndefined();
  });

  it("summarizes points, penalties, combo and time across the manche's questions only", () => {
    const questions = [
      q({ id: "a", points: 1, wrongPoints: -1, roundLabel: "Géographe", comboThreshold: 3, comboBonus: 2 }),
      q({ id: "b", points: 3, wrongPoints: -2, blankPoints: -3, timeLimitMs: 30000 }),
      q({ id: "other", roundIndex: 2, points: 9 }),
    ];
    const rules = summarizeRound(questions, 1, (x) => x.timeLimitMs, false)!;
    expect(rules.roundLabel).toBe("Géographe");
    expect(rules.questionCount).toBe(2);
    expect(rules.points).toEqual([1, 3]);
    expect(rules.wrongPoints).toEqual([-2, -1]);
    expect(rules.blankPoints).toEqual([-3, -1]); // "a" has no blankPoints, falls back to its wrongPoints
    expect(rules.combo).toEqual({ threshold: 3, bonus: 2 });
    expect(rules.timeLimitSec).toEqual([20, 30]);
    expect(rules.timeLimitOverridden).toBe(false);
  });

  it("uses the injected effective duration and ignores untimed blind tests", () => {
    const questions = [q({ id: "a" }), q({ id: "b", theme: "ost" })];
    expect(summarizeRound(questions, 1, () => 45000, true)!.timeLimitSec).toEqual([45, 45]);
    expect(summarizeRound([q({ theme: "ost" })], 1, () => 45000, false)!.timeLimitSec).toBeNull();
  });
});
