import type { RevealResult } from "@yrud/shared";
import { sliderPoints } from "@yrud/shared";
import type { GameState, InternalPlayer, InternalQuestion } from "./types";

export function createInitialState(questions: InternalQuestion[]): GameState {
  return {
    phase: "lobby",
    players: {},
    playerOrder: [],
    questions,
    questionIndex: -1,
    questionStartedAt: null,
    answers: {},
    trapActive: false,
  };
}

export function addPlayer(
  state: GameState,
  player: { id: string; name: string }
): GameState {
  if (state.phase !== "lobby") return state;
  if (state.players[player.id]) return state;
  const newPlayer: InternalPlayer = {
    id: player.id,
    name: player.name,
    points: 0,
    streak: 0,
  };
  return {
    ...state,
    players: { ...state.players, [player.id]: newPlayer },
    playerOrder: [...state.playerOrder, player.id],
  };
}

// Lobby -> intro: Yrud's arrogant cold-open plays before any question (or
// its timer) exists, purely as a client-side dialogue overlay — nothing in
// GameState needs to track which line is showing.
export function enterIntro(state: GameState): GameState {
  if (state.phase !== "lobby") return state;
  if (state.questions.length === 0) return state;
  return { ...state, phase: "intro" };
}

// Intro -> question: the real "go" moment — this is the only place a
// question's timer clock actually starts, so it must stay gated behind the
// admin explicitly dismissing the intro, not fire the moment the lobby ends.
export function startGame(state: GameState, now: number): GameState {
  if (state.phase !== "intro") return state;
  return {
    ...state,
    phase: "question",
    questionIndex: 0,
    questionStartedAt: now,
    answers: {},
  };
}

export function submitAnswer(
  state: GameState,
  playerId: string,
  choiceIndex: number
): GameState {
  if (state.phase !== "question") return state;
  if (!state.players[playerId]) return state;
  if (playerId in state.answers) return state;
  return {
    ...state,
    answers: { ...state.answers, [playerId]: choiceIndex },
  };
}

// Shared by the main sequence's reveal() below and eventRoom's blind-test
// reveal (which bypasses this module's GameState entirely, since a blind
// test is a side pool, not a step in the main question list) — every
// answerable question scores the same way regardless of which flow it's
// running through.
export function scoreAnswer(
  player: InternalPlayer,
  choiceIndex: number | null,
  question: InternalQuestion,
  trap: boolean
): { points: number; streak: number; correct: boolean } {
  const answered = choiceIndex !== null;

  // Stat slider: the "choice" is the value the player stopped the cursor on,
  // scored by how close it is to the real maximum (correctIndex). No trap.
  if (question.theme === "slider") {
    const gain = answered ? sliderPoints(choiceIndex, question.correctIndex) : 0;
    if (gain > 0) return { points: player.points + gain, streak: player.streak + 1, correct: true };
    const penalty = answered ? question.wrongPoints : (question.blankPoints ?? question.wrongPoints);
    return { points: Math.max(0, player.points + penalty), streak: 0, correct: false };
  }

  // A joke/gotcha question where every choice is correct — only a blank
  // can miss out (via blankPoints below). Takes priority over trap, which
  // doesn't make sense combined with a question that has no wrong pick.
  const rawCorrect = answered && (question.allCorrect || choiceIndex === question.correctIndex);
  // A trap question inverts who scores — the whole point is that picking
  // the "right" answer is the wrong move this time. A blank isn't a
  // "wrong pick" though, so trap never turns a non-answer into a win.
  const correct = answered && trap && !question.allCorrect ? !rawCorrect : rawCorrect;

  if (correct) {
    const streak = player.streak + 1;
    let points = player.points + question.points;
    if (question.comboThreshold && question.comboBonus && streak % question.comboThreshold === 0) {
      points += question.comboBonus;
    }
    return { points, streak, correct: true };
  }

  const penalty = answered ? question.wrongPoints : (question.blankPoints ?? question.wrongPoints);
  return { points: Math.max(0, player.points + penalty), streak: 0, correct: false };
}

// Everyone still in the event answers every question — nobody is ever
// knocked out, so this always covers the full roster.
// `pointsFor` lets the room change what a correct answer is worth per player,
// and `isParticipant` leave some players out of the question entirely —
// manche 1, where only one clan plays each question: the others' points and
// streaks don't move, and they get no result line (they were watching).
export function reveal(
  state: GameState,
  pointsFor?: (playerId: string) => number | undefined,
  isParticipant?: (playerId: string) => boolean
): { state: GameState; result: RevealResult } {
  const question = state.questions[state.questionIndex];
  const players: Record<string, InternalPlayer> = { ...state.players };
  const results: RevealResult["results"] = [];
  const trap = state.trapActive;

  for (const playerId of state.playerOrder) {
    if (isParticipant && !isParticipant(playerId)) continue;
    const player = players[playerId];
    const choiceIndex = state.answers[playerId] ?? null;
    const worth = pointsFor?.(playerId);
    const scored = worth === undefined ? question : { ...question, points: worth };
    const { points, streak, correct } = scoreAnswer(player, choiceIndex, scored, trap);

    players[playerId] = { ...player, points, streak };
    results.push({ playerId, choiceIndex, correct, points, delta: points - player.points });
  }

  return {
    state: { ...state, phase: "reveal", players, trapActive: false },
    result: { correctIndex: question.correctIndex, results, trap, allCorrect: question.allCorrect ?? false },
  };
}

// Reveal for a question scored outside the choice/answer model (the
// chasse-taupes): each player's points move by exactly `scores[id]` (never
// below 0 in total). No choice, no trap, and a minigame doesn't count toward
// an answer streak.
export function revealScores(state: GameState, scores: Record<string, number>): { state: GameState; result: RevealResult } {
  const players: Record<string, InternalPlayer> = { ...state.players };
  const results: RevealResult["results"] = [];
  for (const playerId of state.playerOrder) {
    const player = players[playerId];
    const score = scores[playerId] ?? 0;
    const points = Math.max(0, player.points + score);
    players[playerId] = { ...player, points, streak: 0 };
    results.push({ playerId, choiceIndex: null, correct: score > 0, points, delta: points - player.points });
  }
  return {
    state: { ...state, phase: "reveal", players, trapActive: false },
    result: { correctIndex: -1, results, trap: false, allCorrect: false },
  };
}

// Abandons the live question with no scoring (no points, no penalties, no
// streak change) and moves on exactly like advance() would after a reveal —
// including the manche-crossing pause. The answers already in are dropped.
export function skipQuestion(state: GameState, now: number): GameState {
  if (state.phase !== "question") return state;
  return advance({ ...state, phase: "reveal", answers: {}, trapActive: false }, now);
}

export function advance(state: GameState, now: number): GameState {
  if (state.phase !== "reveal") return state;
  const nextIndex = state.questionIndex + 1;

  if (nextIndex >= state.questions.length) {
    return { ...state, phase: "finished" };
  }

  const currentRound = state.questions[state.questionIndex]?.roundIndex;
  const nextRound = state.questions[nextIndex].roundIndex;
  if (nextRound !== currentRound) {
    // Crossing into a new manche — Yrud introduces it (client-driven dialogue,
    // dismissed by the admin) before the next question's timer exists at
    // all, same reasoning as the lobby -> intro pause before question 1.
    // questionIndex moves now so the upcoming round's info is already
    // visible (e.g. the admin console's "current manche" badge), but
    // questionStartedAt/answers are untouched until confirmRoundIntro.
    return { ...state, phase: "roundIntro", questionIndex: nextIndex };
  }

  return {
    ...state,
    phase: "question",
    questionIndex: nextIndex,
    questionStartedAt: now,
    answers: {},
    trapActive: false,
  };
}

// roundIntro -> question: the admin dismisses Yrud's per-manche cold-open —
// this is the only place a new manche's first question's timer starts.
export function confirmRoundIntro(state: GameState, now: number): GameState {
  if (state.phase !== "roundIntro") return state;
  return {
    ...state,
    phase: "question",
    questionStartedAt: now,
    answers: {},
    trapActive: false,
  };
}

export function setTrap(state: GameState, active: boolean): GameState {
  return { ...state, trapActive: active };
}

export function currentQuestion(state: GameState): InternalQuestion | undefined {
  return state.questions[state.questionIndex];
}

// Highest point total at the end of the event — ties share the win.
export function winners(state: GameState): string[] {
  if (state.playerOrder.length === 0) return [];
  const max = Math.max(...state.playerOrder.map((id) => state.players[id].points));
  return state.playerOrder.filter((id) => state.players[id].points === max);
}
