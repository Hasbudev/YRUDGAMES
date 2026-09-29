// Rules of the Yrud Games 2 special manches — shared so the server scores
// and the clients explain/display with the exact same numbers.

// Manche 2 — the stat slider: how far the stopped value may be from the
// real maximum. Checked in order; beyond the last one scores nothing.
export const SLIDER_TIERS: { within: number; points: number; label: string }[] = [
  { within: 0, points: 6, label: "Valeur exacte" },
  { within: 3, points: 3, label: "À 3 près" },
  { within: 10, points: 1, label: "À 10 près" },
];

export function sliderPoints(value: number, answer: number): number {
  const distance = Math.abs(value - answer);
  return SLIDER_TIERS.find((t) => distance <= t.within)?.points ?? 0;
}

// Rudy's dirty tricks on the slider, fired from the admin console: how long
// each lasts on the players' screens.
export type SliderTrick = "speed" | "shake" | "hide";
export const SLIDER_TRICKS: { id: SliderTrick; label: string; durationMs: number }[] = [
  { id: "speed", label: "⚡ Accélérer le curseur", durationMs: 3000 },
  { id: "shake", label: "〰 Faire trembler", durationMs: 3000 },
  { id: "hide", label: "🙈 Cacher 1,5 s", durationMs: 1500 },
];

// How long the cursor takes to cross the whole range once (it bounces back
// and forth) — "assez rapide".
export const SLIDER_SWEEP_MS = 1400;

// Manche 1 — each clan picks one category by vote, in the order the admin
// sets (last clan in the standings first).
export interface CategoryDraft {
  categories: string[];
  // Clan ids, in picking order.
  order: string[];
  // Index into `order` of the clan voting now; === order.length once done.
  turn: number;
  assignments: Record<string, string>;
  // Current turn only: votes per category, and who has voted.
  voteCounts: Record<string, number>;
  voterIds: string[];
}

// Manche 3 — the hot-potato bomb. A clan holds it; only that clan answers
// the question, and its majority answer decides: right passes the bomb to
// the next clan, wrong keeps it and brings it one strike closer to going off.
export interface BombState {
  holderClan: string | null;
  bombNumber: number; // 1-based
  totalBombs: number;
  // 0 → 1 as the strikes pile up (drives the ticking speed / gauge).
  heat: number;
  penalty: number;
  // What happened on the question just revealed, for the reveal screen.
  lastOutcome?: {
    clan: string;
    correct: boolean;
    // Votes cast in that clan, and how many went to the answer it kept.
    votes: number;
    majorityVotes: number;
    passedTo?: string;
    exploded?: boolean;
  };
}

// How many wrong answers a bomb takes to go off (secret, drawn per bomb).
export const BOMB_STRIKES = { min: 1, max: 3 };

// Manche 4 — the manche's winner steals points from whoever they pick.
export interface StealState {
  amount: number;
  // Winners who still have to pick a victim.
  pendingIds: string[];
  done: { thiefId: string; victimId: string; amount: number }[];
}
