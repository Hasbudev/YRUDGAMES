// The end-of-event recap — "le clou du spectacle" after the final battle
// (or after the quiz alone, if a session never reaches one). Computed once
// server-side when the game finishes and handed to every client verbatim.
export interface StandingEntry {
  playerId: string;
  name: string;
  avatarId: string;
  placement: number; // 1 = winner(s); ties share a placement (co-survivors)
  correctAnswers: number;
}

export interface EventSummary {
  standings: StandingEntry[];
  totalQuestions: number;
  duelRecord: { yrudWins: number; opponentWins: number };
  tauntCount: number;
  prankCount: number;
  finalBattleWinnerName: string | null;
}
