import type { DuelActor, DuelRoll } from "@yrud/shared";

const MOVES: Record<DuelActor, { move: string; accuracy: number }> = {
  yrud: { move: "Hydro Pump", accuracy: 0.8 },
  opponent: { move: "Focus Blast", accuracy: 0.7 },
};

export type DuelState =
  | { opponentId: string; phase: "rolling"; rollLog: DuelRoll[] }
  | { opponentId: string; phase: "resolved"; rollLog: DuelRoll[]; winner: DuelActor };

export function startDuel(opponentId: string): DuelState {
  return { opponentId, phase: "rolling", rollLog: [] };
}

// Yrud opens per the brief ("Yrud tape des Hydro Pump, l'oppo des Focus
// Blast") — turns alternate strictly, no player input, server-owned RNG.
export function nextActor(state: DuelState): DuelActor {
  return state.rollLog.length % 2 === 0 ? "yrud" : "opponent";
}

export function advanceDuel(state: DuelState, rng: () => number = Math.random): DuelState {
  if (state.phase !== "rolling") return state;

  const actor = nextActor(state);
  const { move, accuracy } = MOVES[actor];
  const hit = rng() < accuracy;
  const roll: DuelRoll = { actor, move, accuracy, hit };
  const rollLog = [...state.rollLog, roll];

  if (!hit) {
    // Whoever's shot missed loses — the other actor wins.
    const winner: DuelActor = actor === "yrud" ? "opponent" : "yrud";
    return { ...state, rollLog, phase: "resolved", winner };
  }
  return { ...state, rollLog };
}
