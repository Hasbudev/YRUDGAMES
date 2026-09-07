import { describe, expect, it } from "vitest";
import {
  addPlayer,
  advance,
  confirmRoundIntro,
  createInitialState,
  currentQuestion,
  enterIntro,
  reveal,
  setTrap,
  startGame,
  submitAnswer,
  winners,
} from "./engine";
import type { InternalQuestion } from "./types";

const QUESTIONS: InternalQuestion[] = [
  { id: "q1", theme: "trivia", prompt: "Q1", choices: ["a", "b"], correctIndex: 0, timeLimitMs: 10000, points: 1, roundIndex: 0, wrongPoints: 0 },
  { id: "q2", theme: "trivia", prompt: "Q2", choices: ["a", "b"], correctIndex: 1, timeLimitMs: 10000, points: 1, roundIndex: 0, wrongPoints: 0 },
];

function twoPlayerLobby() {
  let state = createInitialState(QUESTIONS);
  state = addPlayer(state, { id: "p1", name: "Alice" });
  state = addPlayer(state, { id: "p2", name: "Bob" });
  return state;
}

// Shorthand for tests that don't care about the intro beat itself — lobby
// straight through to the first question live.
function beginQuiz(state: ReturnType<typeof twoPlayerLobby>, now: number) {
  return startGame(enterIntro(state), now);
}

describe("quiz engine", () => {
  it("adds players only in lobby phase", () => {
    let state = twoPlayerLobby();
    expect(Object.keys(state.players)).toEqual(["p1", "p2"]);

    state = beginQuiz(state, 1000);
    state = addPlayer(state, { id: "p3", name: "Late" });
    expect(state.players.p3).toBeUndefined();
  });

  it("moves lobby -> intro -> question, and startGame is a no-op straight from lobby", () => {
    let state = twoPlayerLobby();
    expect(startGame(state, 1000).phase).toBe("lobby"); // no intro yet, refuses to start

    state = enterIntro(state);
    expect(state.phase).toBe("intro");
    expect(currentQuestion(state)).toBeUndefined(); // no question/timer during the cold-open

    state = beginQuiz(state, 1000);
    expect(state.phase).toBe("question");
    expect(currentQuestion(state)?.id).toBe("q1");
    expect(state.questionStartedAt).toBe(1000);
  });

  it("records one answer per player and ignores duplicates/late answers", () => {
    let state = twoPlayerLobby();
    state = beginQuiz(state, 1000);
    state = submitAnswer(state, "p1", 0);
    state = submitAnswer(state, "p1", 1); // duplicate, ignored
    expect(state.answers.p1).toBe(0);
  });

  it("awards a point for a correct answer and nothing for a wrong one — nobody is eliminated", () => {
    let state = twoPlayerLobby();
    state = beginQuiz(state, 1000);
    state = submitAnswer(state, "p1", 0); // correct
    state = submitAnswer(state, "p2", 1); // wrong

    const { state: afterReveal, result } = reveal(state);
    expect(afterReveal.players.p1.points).toBe(1);
    expect(afterReveal.players.p2.points).toBe(0);
    expect(Object.keys(afterReveal.players)).toEqual(["p1", "p2"]); // both still around

    const p2Result = result.results.find((r) => r.playerId === "p2");
    expect(p2Result?.correct).toBe(false);
    expect(p2Result?.points).toBe(0);
  });

  it("treats a missing answer as wrong", () => {
    let state = twoPlayerLobby();
    state = beginQuiz(state, 1000);
    state = submitAnswer(state, "p1", 0); // p2 never answers

    const { result } = reveal(state);
    const p2Result = result.results.find((r) => r.playerId === "p2");
    expect(p2Result?.choiceIndex).toBeNull();
    expect(p2Result?.correct).toBe(false);
  });

  it("awards a question's own point value, not always 1", () => {
    const heavyQuestions: InternalQuestion[] = [
      { id: "h1", theme: "trivia", prompt: "Worth 5", choices: ["a", "b"], correctIndex: 0, timeLimitMs: 10000, points: 5, roundIndex: 0, wrongPoints: 0 },
    ];
    let state = createInitialState(heavyQuestions);
    state = addPlayer(state, { id: "p1", name: "Alice" });
    state = beginQuiz(state, 1000);
    state = submitAnswer(state, "p1", 0);
    const { state: afterReveal, result } = reveal(state);
    expect(afterReveal.players.p1.points).toBe(5);
    expect(result.results[0].points).toBe(5);
  });

  it("a trap question inverts scoring and is consumed after one reveal", () => {
    let state = twoPlayerLobby();
    state = beginQuiz(state, 1000);
    state = setTrap(state, true);
    state = submitAnswer(state, "p1", 0); // picks the real correct answer
    state = submitAnswer(state, "p2", 1); // picks wrong

    const { state: afterReveal, result } = reveal(state);
    expect(result.trap).toBe(true);
    expect(afterReveal.players.p1.points).toBe(0); // picked right, scored nothing
    expect(afterReveal.players.p2.points).toBe(1); // picked wrong, scored the point
    expect(afterReveal.trapActive).toBe(false); // single-use
  });

  it("applies a wrong-answer penalty and a separate blank penalty when configured", () => {
    const penalizedQuestions: InternalQuestion[] = [
      {
        id: "p1q",
        theme: "trivia",
        prompt: "Worth 5, -5 wrong, blank is free",
        choices: ["a", "b"],
        correctIndex: 0,
        timeLimitMs: 10000,
        points: 5,
        roundIndex: 0,
        wrongPoints: -5,
        blankPoints: 0,
      },
    ];
    let state = createInitialState(penalizedQuestions);
    state = addPlayer(state, { id: "p1", name: "Alice" }); // will pick wrong
    state = addPlayer(state, { id: "p2", name: "Bob" }); // will not answer
    state = beginQuiz(state, 1000);
    state = submitAnswer(state, "p1", 1);
    const { result } = reveal(state);
    expect(result.results.find((r) => r.playerId === "p1")?.points).toBe(0); // 0 - 5, clamped at 0
    expect(result.results.find((r) => r.playerId === "p2")?.points).toBe(0); // blank = +0, not the -5 wrong penalty
  });

  it("awards a combo bonus every Nth correct answer in a row, and resets the streak on a miss", () => {
    const comboQuestions: InternalQuestion[] = Array.from({ length: 3 }, (_, i) => ({
      id: `c${i}`,
      theme: "trivia" as const,
      prompt: `Q${i}`,
      choices: ["a", "b"],
      correctIndex: 0,
      timeLimitMs: 10000,
      points: 3,
      roundIndex: 0,
      wrongPoints: -1,
      comboThreshold: 2,
      comboBonus: 6,
    }));
    let state = createInitialState(comboQuestions);
    state = addPlayer(state, { id: "p1", name: "Alice" });
    state = beginQuiz(state, 1000);

    state = submitAnswer(state, "p1", 0); // correct #1, streak 1, no bonus yet
    let revealed = reveal(state);
    expect(revealed.result.results[0].points).toBe(3);
    state = advance(revealed.state, 2000);

    state = submitAnswer(state, "p1", 0); // correct #2, streak 2 -> combo bonus
    revealed = reveal(state);
    expect(revealed.result.results[0].points).toBe(3 + 3 + 6);
  });

  it("an allCorrect question scores any pick as correct, and only penalizes a blank", () => {
    const jokeQuestions: InternalQuestion[] = [
      {
        id: "joke1",
        theme: "trivia",
        prompt: "Toutes les réponses sont bonnes",
        choices: ["a", "b", "c", "d"],
        correctIndex: 0, // meaningless when allCorrect is set
        timeLimitMs: 10000,
        points: 20,
        roundIndex: 5,
        wrongPoints: 0,
        blankPoints: -2,
        allCorrect: true,
      },
    ];
    let state = createInitialState(jokeQuestions);
    state = addPlayer(state, { id: "p1", name: "Alice" }); // will pick the "correct" index
    state = addPlayer(state, { id: "p2", name: "Bob" }); // will pick a different index
    state = addPlayer(state, { id: "p3", name: "Carol" }); // won't answer
    state = beginQuiz(state, 1000);
    state = submitAnswer(state, "p1", 0);
    state = submitAnswer(state, "p2", 3);

    const { result } = reveal(state);
    expect(result.allCorrect).toBe(true);
    expect(result.results.find((r) => r.playerId === "p1")?.points).toBe(20);
    expect(result.results.find((r) => r.playerId === "p2")?.points).toBe(20);
    expect(result.results.find((r) => r.playerId === "p2")?.correct).toBe(true);
    expect(result.results.find((r) => r.playerId === "p3")?.points).toBe(0); // 0 - 2, clamped at 0
    expect(result.results.find((r) => r.playerId === "p3")?.correct).toBe(false);
  });

  it("pauses on roundIntro when advancing crosses into a new manche, and confirmRoundIntro starts its timer", () => {
    const twoRoundQuestions: InternalQuestion[] = [
      { id: "r1q1", theme: "trivia", prompt: "R1Q1", choices: ["a", "b"], correctIndex: 0, timeLimitMs: 10000, points: 1, roundIndex: 1, wrongPoints: 0 },
      { id: "r2q1", theme: "trivia", prompt: "R2Q1", choices: ["a", "b"], correctIndex: 0, timeLimitMs: 10000, points: 1, roundIndex: 2, wrongPoints: 0 },
    ];
    let state = createInitialState(twoRoundQuestions);
    state = addPlayer(state, { id: "p1", name: "Alice" });
    state = beginQuiz(state, 1000);
    state = submitAnswer(state, "p1", 0);
    const { state: revealed } = reveal(state);

    // Crossing from round 1 into round 2 pauses on roundIntro instead of
    // jumping straight to the question — no timer started yet.
    state = advance(revealed, 2000);
    expect(state.phase).toBe("roundIntro");
    expect(currentQuestion(state)?.id).toBe("r2q1"); // upcoming question already visible
    expect(state.questionStartedAt).toBe(1000); // untouched — still round 1's old value, not overwritten

    // Only confirmRoundIntro actually starts round 2's question/timer.
    state = confirmRoundIntro(state, 3000);
    expect(state.phase).toBe("question");
    expect(state.questionStartedAt).toBe(3000);
    expect(state.answers).toEqual({});
  });

  it("confirmRoundIntro is a no-op outside the roundIntro phase", () => {
    let state = twoPlayerLobby();
    state = beginQuiz(state, 1000);
    const unchanged = confirmRoundIntro(state, 5000);
    expect(unchanged).toBe(state);
  });

  it("keeps playing every question regardless of how many players score zero", () => {
    let state = twoPlayerLobby();
    state = beginQuiz(state, 1000);
    state = submitAnswer(state, "p1", 1); // wrong
    state = submitAnswer(state, "p2", 1); // wrong

    const { state: revealed } = reveal(state);
    const nextState = advance(revealed, 2000);

    expect(nextState.phase).toBe("question");
    expect(currentQuestion(nextState)?.id).toBe("q2");
    expect(nextState.answers).toEqual({});
  });

  it("finishes once the question set runs out and ranks by points, ties included", () => {
    let state = twoPlayerLobby();
    state = beginQuiz(state, 1000);
    state = submitAnswer(state, "p1", 0);
    state = submitAnswer(state, "p2", 1); // wrong
    let { state: revealed } = reveal(state);
    state = advance(revealed, 2000);

    state = submitAnswer(state, "p1", 0); // wrong (q2's correct index is 1)
    state = submitAnswer(state, "p2", 1); // correct
    ({ state: revealed } = reveal(state));
    const finalState = advance(revealed, 3000);

    expect(finalState.phase).toBe("finished");
    // p1: correct, wrong = 1pt. p2: wrong, correct = 1pt. Tied for 1st.
    expect(winners(finalState).sort()).toEqual(["p1", "p2"]);
  });
});
