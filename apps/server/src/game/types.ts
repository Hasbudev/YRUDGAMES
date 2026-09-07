import type { GamePhase, QuestionMetadata, QuestionTheme } from "@yrud/shared";

export interface InternalPlayer {
  id: string;
  name: string;
  points: number;
  // Consecutive correct answers (trap-adjusted) — drives comboThreshold/
  // comboBonus. Resets to 0 on anything that isn't a scoring answer.
  streak: number;
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
  points: number;
  roundIndex: number;
  roundLabel?: string;
  wrongPoints: number;
  blankPoints?: number;
  comboThreshold?: number;
  comboBonus?: number;
  // Joke/gotcha question — every choice scores as correct; only a blank
  // (via blankPoints) can lose points.
  allCorrect?: boolean;
}

export interface GameState {
  phase: GamePhase;
  players: Record<string, InternalPlayer>;
  playerOrder: string[];
  questions: InternalQuestion[];
  questionIndex: number;
  questionStartedAt: number | null;
  answers: Record<string, number>;
  // Yrud arms this live, before revealing the current question — everyone
  // who picked the real correct answer scores nothing, everyone who picked
  // wrong scores the point instead. Single-use: cleared the moment the
  // question it applied to is revealed.
  trapActive: boolean;
}
