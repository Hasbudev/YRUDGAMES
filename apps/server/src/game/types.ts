import type { GamePhase, QuestionMetadata, QuestionTheme } from "@yrud/shared";

export interface InternalPlayer {
  id: string;
  name: string;
  lives: number;
  eliminated: boolean;
}

export interface InternalQuestion {
  id: string;
  theme: QuestionTheme;
  prompt: string;
  choices: string[];
  correctIndex: number;
  metadata?: QuestionMetadata;
  mediaUrl?: string;
  timeLimitMs: number;
}

export interface GameState {
  phase: GamePhase;
  players: Record<string, InternalPlayer>;
  playerOrder: string[];
  questions: InternalQuestion[];
  questionIndex: number;
  questionStartedAt: number | null;
  answers: Record<string, number>;
  livesPerPlayer: number;
}
