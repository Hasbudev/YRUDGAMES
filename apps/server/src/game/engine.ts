import type { RevealResult } from "@yrud/shared";
import type { GameState, InternalPlayer, InternalQuestion } from "./types";

export function createInitialState(
  questions: InternalQuestion[],
  livesPerPlayer: number
): GameState {
  return {
    phase: "lobby",
    players: {},
    playerOrder: [],
    questions,
    questionIndex: -1,
    questionStartedAt: null,
    answers: {},
    livesPerPlayer,
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
    lives: state.livesPerPlayer,
    eliminated: false,
  };
  return {
    ...state,
    players: { ...state.players, [player.id]: newPlayer },
    playerOrder: [...state.playerOrder, player.id],
  };
}

export function startGame(state: GameState, now: number): GameState {
  if (state.phase !== "lobby") return state;
  if (state.questions.length === 0) return state;
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
  const player = state.players[playerId];
  if (!player || player.eliminated) return state;
  if (playerId in state.answers) return state;
  return {
    ...state,
    answers: { ...state.answers, [playerId]: choiceIndex },
  };
}

export function reveal(state: GameState): { state: GameState; result: RevealResult } {
  const question = state.questions[state.questionIndex];
  const players: Record<string, InternalPlayer> = { ...state.players };
  const results: RevealResult["results"] = [];

  for (const playerId of state.playerOrder) {
    const player = players[playerId];
    if (player.eliminated) continue;

    const choiceIndex = state.answers[playerId] ?? null;
    const correct = choiceIndex === question.correctIndex;
    let lives = player.lives;
    let eliminated: boolean = player.eliminated;

    if (!correct) {
      lives = Math.max(0, lives - 1);
      eliminated = lives === 0;
    }

    players[playerId] = { ...player, lives, eliminated };
    results.push({ playerId, choiceIndex, correct, livesRemaining: lives, eliminated });
  }

  return {
    state: { ...state, phase: "reveal", players },
    result: { correctIndex: question.correctIndex, results },
  };
}

export function advance(state: GameState, now: number): GameState {
  if (state.phase !== "reveal") return state;
  const nextIndex = state.questionIndex + 1;
  const alivePlayers = state.playerOrder.filter((id) => !state.players[id].eliminated);

  if (nextIndex >= state.questions.length || alivePlayers.length <= 1) {
    return { ...state, phase: "finished" };
  }

  return {
    ...state,
    phase: "question",
    questionIndex: nextIndex,
    questionStartedAt: now,
    answers: {},
  };
}

export function currentQuestion(state: GameState): InternalQuestion | undefined {
  return state.questions[state.questionIndex];
}

export function winners(state: GameState): string[] {
  return state.playerOrder.filter((id) => !state.players[id].eliminated);
}
