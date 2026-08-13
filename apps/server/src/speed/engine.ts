import type { InternalQuestion } from "../game/types";

export interface SpeedScoreEntry {
  playerId: string;
  correct: number;
}

// Each player pulls their own next question at their own pace — pick one
// they haven't seen yet; once they've exhausted the pool, wrap around rather
// than stall them for the rest of the 60 seconds.
export function pickNextSpeedQuestion(
  pool: InternalQuestion[],
  askedIds: string[]
): InternalQuestion | null {
  if (pool.length === 0) return null;
  const unasked = pool.filter((q) => !askedIds.includes(q.id));
  const candidates = unasked.length > 0 ? unasked : pool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function gradeSpeedAnswer(question: InternalQuestion, choiceIndex: number): boolean {
  return choiceIndex === question.correctIndex;
}

// Everyone tied for the top (non-zero) correct count gets the bonus.
export function computeBonusWinners(scoreboard: SpeedScoreEntry[]): string[] {
  const max = Math.max(0, ...scoreboard.map((s) => s.correct));
  if (max === 0) return [];
  return scoreboard.filter((s) => s.correct === max).map((s) => s.playerId);
}
