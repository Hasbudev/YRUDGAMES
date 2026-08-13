import { describe, expect, it } from "vitest";
import {
  addPlayer,
  advance,
  createInitialState,
  currentQuestion,
  reveal,
  startGame,
  submitAnswer,
  winners,
} from "./engine";
import type { InternalQuestion } from "./types";

const QUESTIONS: InternalQuestion[] = [
  { id: "q1", theme: "trivia", prompt: "Q1", choices: ["a", "b"], correctIndex: 0, timeLimitMs: 10000 },
  { id: "q2", theme: "trivia", prompt: "Q2", choices: ["a", "b"], correctIndex: 1, timeLimitMs: 10000 },
];

function twoPlayerLobby() {
  let state = createInitialState(QUESTIONS, 1); // 1 life so a single miss eliminates
  state = addPlayer(state, { id: "p1", name: "Alice" });
  state = addPlayer(state, { id: "p2", name: "Bob" });
  return state;
}

describe("quiz engine", () => {
  it("adds players only in lobby phase", () => {
    let state = twoPlayerLobby();
    expect(Object.keys(state.players)).toEqual(["p1", "p2"]);

    state = startGame(state, 1000);
    state = addPlayer(state, { id: "p3", name: "Late" });
    expect(state.players.p3).toBeUndefined();
  });

  it("starts the game and exposes the first question", () => {
    let state = twoPlayerLobby();
    state = startGame(state, 1000);
    expect(state.phase).toBe("question");
    expect(currentQuestion(state)?.id).toBe("q1");
  });

  it("records one answer per player and ignores duplicates/late answers", () => {
    let state = twoPlayerLobby();
    state = startGame(state, 1000);
    state = submitAnswer(state, "p1", 0);
    state = submitAnswer(state, "p1", 1); // duplicate, ignored
    expect(state.answers.p1).toBe(0);
  });

  it("decrements lives on wrong answers and eliminates at 0 lives", () => {
    let state = twoPlayerLobby();
    state = startGame(state, 1000);
    state = submitAnswer(state, "p1", 0); // correct
    state = submitAnswer(state, "p2", 1); // wrong

    const { state: afterReveal, result } = reveal(state);
    expect(afterReveal.players.p1.lives).toBe(1);
    expect(afterReveal.players.p1.eliminated).toBe(false);
    expect(afterReveal.players.p2.lives).toBe(0);
    expect(afterReveal.players.p2.eliminated).toBe(true);

    const p2Result = result.results.find((r) => r.playerId === "p2");
    expect(p2Result?.correct).toBe(false);
    expect(p2Result?.eliminated).toBe(true);
  });

  it("treats a missing answer as wrong", () => {
    let state = twoPlayerLobby();
    state = startGame(state, 1000);
    state = submitAnswer(state, "p1", 0); // p2 never answers

    const { result } = reveal(state);
    const p2Result = result.results.find((r) => r.playerId === "p2");
    expect(p2Result?.choiceIndex).toBeNull();
    expect(p2Result?.correct).toBe(false);
  });

  it("finishes the game once only one player remains alive", () => {
    let state = twoPlayerLobby();
    state = startGame(state, 1000);
    state = submitAnswer(state, "p1", 0);
    state = submitAnswer(state, "p2", 1); // wrong, eliminated

    const { state: revealed } = reveal(state);
    const finalState = advance(revealed, 2000);

    expect(finalState.phase).toBe("finished");
    expect(winners(finalState)).toEqual(["p1"]);
  });

  it("advances to the next question when multiple players remain", () => {
    let state = createInitialState(QUESTIONS, 3);
    state = addPlayer(state, { id: "p1", name: "Alice" });
    state = addPlayer(state, { id: "p2", name: "Bob" });
    state = startGame(state, 1000);
    state = submitAnswer(state, "p1", 0);
    state = submitAnswer(state, "p2", 1); // wrong but survives (3 lives)

    const { state: revealed } = reveal(state);
    const nextState = advance(revealed, 2000);

    expect(nextState.phase).toBe("question");
    expect(currentQuestion(nextState)?.id).toBe("q2");
    expect(nextState.answers).toEqual({});
  });
});
