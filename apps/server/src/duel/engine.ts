import type { DuelActor, DuelRoll } from "@yrud/shared";

// Yrud is a known Medicham enjoyer; the challenger fields an Arboliva.
// Accuracy values here are intentionally tuned for the mini-game's pacing,
// not lifted from the real move data (Zen Headbutt/Leaf Storm are both 90%
// in-game) — the client shows these exact numbers on the Précision badges
// rather than the real accuracies, since they're what actually governs this
// fight.
const MOVES: Record<DuelActor, { move: string; accuracy: number }> = {
  yrud: { move: "Zen Headbutt", accuracy: 0.8 },
  opponent: { move: "Leaf Storm", accuracy: 0.7 },
};

// Sudden-death on the first miss made the tension bar meaningless (an
// abstract "vibes" meter with no real stakes tied to it). Three strikes per
// side gives the fight actual shape — a miss costs a "life" and the bar can
// show real remaining chances per side instead of a fuzzy shared gauge.
const MISSES_TO_LOSE = 3;

export type DuelState =
  | { opponentId: string; phase: "rolling"; rollLog: DuelRoll[] }
  | { opponentId: string; phase: "resolved"; rollLog: DuelRoll[]; winner: DuelActor };

export function startDuel(opponentId: string): DuelState {
  return { opponentId, phase: "rolling", rollLog: [] };
}

// Yrud opens per the brief ("Yrud tape des Zen Headbutt, l'oppo des Leaf
// Storm") — turns alternate strictly, no player input, server-owned RNG.
export function nextActor(state: DuelState): DuelActor {
  return state.rollLog.length % 2 === 0 ? "yrud" : "opponent";
}

export function missCount(rollLog: DuelRoll[], actor: DuelActor): number {
  return rollLog.filter((r) => r.actor === actor && !r.hit).length;
}

export function advanceDuel(state: DuelState, rng: () => number = Math.random): DuelState {
  if (state.phase !== "rolling") return state;

  const actor = nextActor(state);
  const { move, accuracy } = MOVES[actor];
  const hit = rng() < accuracy;
  const roll: DuelRoll = { actor, move, accuracy, hit };
  const rollLog = [...state.rollLog, roll];

  if (!hit && missCount(rollLog, actor) >= MISSES_TO_LOSE) {
    // Whoever hit their third miss loses — the other actor wins.
    const winner: DuelActor = actor === "yrud" ? "opponent" : "yrud";
    return { ...state, rollLog, phase: "resolved", winner };
  }
  return { ...state, rollLog };
}
