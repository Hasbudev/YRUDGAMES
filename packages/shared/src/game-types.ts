import type { BattleLogEntry, BattleSnapshot } from "./showdown-types";
import type { DuelRoll } from "./duel-types";
import type { BombState, CategoryDraft, StealState } from "./specialRounds";

export type GamePhase = "lobby" | "intro" | "roundIntro" | "question" | "reveal" | "battle" | "finished";

// "speed" is kept here even though the speed round feature was removed —
// it's still a valid value in the Prisma QuestionTheme enum (any legacy rows
// stay representable) even though nothing creates or plays them anymore.
// "whack" is the chasse-taupes minigame: no choices, players tap moles for
// points until the clock runs out (see whack.ts).
// "slider" is the stat cursor (manche 2): the player stops a moving cursor
// on the stat's maximum; correctIndex holds that maximum.
export type QuestionTheme = "trivia" | "ost" | "stats" | "speed" | "whack" | "slider";

// A tiny synthesized melody (Web Audio oscillator notes) standing in for a
// real OST clip until Rudy provides licensed audio via Question.mediaUrl.
export interface MelodyNote {
  freq: number;
  durationMs: number;
}

export interface QuestionMetadata {
  notes?: MelodyNote[]; // ost theme — synthesized fallback when no audioFile
  stat?: string; // stats theme, e.g. "Speed"
  // ost theme — blind test clip, a filename under apps/web/public/blindtest
  // (e.g. "1ZoneZero.wav"), served as a static asset.
  audioFile?: string;
  // Free-text question (no choices to pick from): the answers that count as
  // correct, compared ignoring case/accents/small typos. Server-only — it's
  // stripped before the question reaches any client, which gets `freeText`
  // instead.
  acceptedAnswers?: string[];
  freeText?: boolean;
  // whack theme — how long the game lasts, plus the board's seed, which the
  // server only picks (and adds) when the game actually starts.
  whack?: { durationMs: number; seed?: number };
  // Manche 1 — the question's category. Only the clan that picked it
  // answers (the others watch); a right answer is worth categoryPoints.own.
  // `other` is kept for older banks and unused.
  category?: string;
  categoryPoints?: { own: number; other: number };
  // slider theme — what to show and the range the cursor sweeps.
  slider?: { pokemon: string; species: string; stat: string; low: number; high: number };
  // Manche 3 — the hot-potato bomb runs during these questions.
  bomb?: { count: number; penalty: number };
  // Manche 4 — after this question, whoever got it right first steals this
  // many points from a player of their choice.
  steal?: number;
}

export interface PublicPlayer {
  id: string;
  name: string;
  points: number;
  clan: string;
  connected: boolean;
}

// Sent to clients while a question is live — correctIndex is withheld until reveal.
export interface PublicQuestion {
  id: string;
  theme: QuestionTheme;
  prompt: string;
  choices: string[];
  metadata?: QuestionMetadata;
  mediaUrl?: string;
  timeLimitMs: number;
  startedAt: number;
  // The server's clock when this was sent — lets a client line its own
  // clock up with startedAt (the chasse-taupes board needs ms precision).
  serverNow: number;
  questionIndex: number;
  questionCount: number;
  points: number;
  roundIndex: number;
  roundLabel?: string;
}

export interface PlayerRevealResult {
  playerId: string;
  choiceIndex: number | null;
  // Already trap-adjusted — this is "did they score", not "did they pick
  // the literal correct answer". On a trap question those two disagree.
  correct: boolean;
  // The player's new total after this question.
  points: number;
  // What this one question changed (+2, -1, +3 with a combo bonus, 0...) —
  // already floor-clamped, so it's the real movement, not the raw rule value.
  // Drives the live ranking's "+2" chips and rank-change arrows.
  delta: number;
}

export interface RevealResult {
  correctIndex: number;
  results: PlayerRevealResult[];
  // Whether Yrud armed this question as a trap — lets the reveal UI explain
  // why "correct" picks scored nothing.
  trap: boolean;
  // Joke/gotcha question — every choice scored as correct. Lets the reveal
  // UI highlight all choices instead of just correctIndex.
  allCorrect: boolean;
}

// How one manche scores, summed up from its questions — the rules card Yrud
// presents before the manche starts, and the admin's at-a-glance summary.
// Ranges are [min, max] because questions inside a manche can differ.
export interface RoundRules {
  roundIndex: number;
  roundLabel?: string;
  questionCount: number;
  points: [number, number]; // per correct answer
  wrongPoints: [number, number]; // [worst, best], always <= 0
  blankPoints: [number, number]; // no answer at all (falls back to wrongPoints)
  // First combo found in the manche, if any: every `threshold`-th correct
  // answer in a row awards `bonus` on top.
  combo?: { threshold: number; bonus: number };
  allCorrectCount: number; // "joke" questions where every pick scores
  // Seconds to answer, [min, max]; null when the manche has no timed
  // question (blind tests are revealed by hand, never on a clock).
  timeLimitSec: [number, number] | null;
  // True when the admin set this manche's duration live, overriding
  // whatever each question carries.
  timeLimitOverridden: boolean;
  // Set when the manche is the chasse-taupes: the rules card shows the mole
  // table instead of per-answer points.
  minigame?: "whack";
  // Manche 1 — the categories the clans pick from, if this manche has them.
  categories?: string[];
  // Extra lines for the special manches (categories, slider, bomb, steal).
  specialRules?: { icon: string; label: string; value: string; tone: "gain" | "loss" | "neutral" | "bonus" }[];
}

export interface ArenaSnapshot {
  phase: GamePhase;
  players: PublicPlayer[];
  question?: PublicQuestion;
  lastReveal?: RevealResult;
  // Who has answered the current question — never includes what they chose.
  answeredPlayerIds: string[];
  // Who has clicked all the way through Yrud's current cold-open (the
  // opening intro, or a per-manche roundIntro) — advisory only, so the
  // admin can see who's still reading before hitting "C'est parti !"
  // without being blocked by someone who dropped off mid-monologue.
  // Always empty outside the intro/roundIntro phases.
  introSeenPlayerIds: string[];
  battle?: BattleSnapshot;
  lastBattleSnapshot?: BattleSnapshot;
  // Full combat log accumulated so far — lets a client that (re)connects
  // mid-battle (or opens the admin console late) resync the log feed instead
  // of only seeing entries broadcast after it connected.
  battleLog?: BattleLogEntry[];
  battlePlan?: string;
  // Lets a client that (re)connects mid-duel resync instead of missing the
  // spectacle entirely — only present while the duel is still rolling.
  activeDuel?: { opponentId: string; rollLog: DuelRoll[] };
  // Scoring rules of the manche the game is in (or about to start) — absent
  // once the quiz is over.
  roundRules?: RoundRules;
  categoryDraft?: CategoryDraft;
  // Manche 1 — the clan whose turn it is (only its players may answer the
  // live question; everyone else watches). Absent outside that manche.
  answeringClan?: string;
  bomb?: BombState;
  steal?: StealState;
  // Whether Yrud has armed the currently-live question as a trap — surfaced
  // to the admin console only (players never see this before reveal).
  trapActive: boolean;
}
