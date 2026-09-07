import type { BattleLogEntry, BattleSnapshot } from "./showdown-types";
import type { DuelRoll } from "./duel-types";

export type GamePhase = "lobby" | "intro" | "roundIntro" | "question" | "reveal" | "battle" | "finished";

// "speed" is kept here even though the speed round feature was removed —
// it's still a valid value in the Prisma QuestionTheme enum (any legacy rows
// stay representable) even though nothing creates or plays them anymore.
export type QuestionTheme = "trivia" | "ost" | "stats" | "speed";

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
  points: number;
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
  // Whether Yrud has armed the currently-live question as a trap — surfaced
  // to the admin console only (players never see this before reveal).
  trapActive: boolean;
}
