import type { BattleSnapshot } from "./showdown-types";
import type { DuelRoll } from "./duel-types";

export type GamePhase = "lobby" | "question" | "reveal" | "speed" | "battle" | "finished";

export type QuestionTheme = "trivia" | "ost" | "stats" | "speed";

// A tiny synthesized melody (Web Audio oscillator notes) standing in for a
// real OST clip until Rudy provides licensed audio via Question.mediaUrl.
export interface MelodyNote {
  freq: number;
  durationMs: number;
}

export interface QuestionMetadata {
  notes?: MelodyNote[]; // ost theme
  stat?: string; // stats theme, e.g. "Speed"
}

export interface PublicPlayer {
  id: string;
  name: string;
  lives: number;
  maxLives: number;
  avatarId: string;
  eliminated: boolean;
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
}

export interface PlayerRevealResult {
  playerId: string;
  choiceIndex: number | null;
  correct: boolean;
  livesRemaining: number;
  eliminated: boolean;
}

export interface RevealResult {
  correctIndex: number;
  results: PlayerRevealResult[];
}

export interface SpeedRoundScoreEntry {
  playerId: string;
  correct: number;
}

export interface SpeedRoundSnapshot {
  endsAt: number;
  scoreboard: SpeedRoundScoreEntry[];
}

export interface SpeedRoundEndedPayload {
  scoreboard: SpeedRoundScoreEntry[];
  bonusWinnerIds: string[];
}

export interface ArenaSnapshot {
  phase: GamePhase;
  players: PublicPlayer[];
  question?: PublicQuestion;
  lastReveal?: RevealResult;
  // Who has answered the current question — never includes what they chose.
  answeredPlayerIds: string[];
  speedRound?: SpeedRoundSnapshot;
  lastSpeedRoundResult?: SpeedRoundEndedPayload;
  battle?: BattleSnapshot;
  lastBattleSnapshot?: BattleSnapshot;
  battlePlan?: string;
  // Lets a client that (re)connects mid-duel resync instead of missing the
  // spectacle entirely — only present while the duel is still rolling.
  activeDuel?: { opponentId: string; rollLog: DuelRoll[] };
}

// A single speed-round question sent to one player at a time via the pull loop.
export interface SpeedQuestion {
  id: string;
  prompt: string;
  choices: string[];
}
