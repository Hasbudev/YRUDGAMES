import type { QuestionRecord } from "./api";

// The special-manche settings of a question, as short lines for the admin's
// question list and review — the parts `choices` alone don't show (a
// slider's answer, a free-text question's accepted answers...).
export function questionExtras(q: QuestionRecord): string[] {
  const m = q.metadata;
  if (!m) return [];
  const lines: string[] = [];
  if (m.slider) {
    lines.push(`🎯 Réponse : ${q.correctIndex} — curseur ${m.slider.low}–${m.slider.high} (${m.slider.pokemon}, ${m.slider.stat})`);
  }
  if (m.whack) lines.push(`🔨 Chasse-taupes — ${Math.round(m.whack.durationMs / 1000)} s de jeu`);
  if (m.acceptedAnswers?.length) lines.push(`✍ Réponse libre — acceptées : ${m.acceptedAnswers.join(", ")}`);
  if (m.category) {
    const pts = m.categoryPoints ? ` (+${m.categoryPoints.own} pour le clan qui l'a choisie, +${m.categoryPoints.other} sinon)` : "";
    lines.push(`🏳 Catégorie : ${m.category}${pts}`);
  }
  if (m.bomb) lines.push(`💣 Bombe active : ${m.bomb.count} bombes, −${m.bomb.penalty} pts au clan`);
  if (m.steal) lines.push(`🦹 Fin de manche : le vainqueur vole ${m.steal} pts`);
  return lines;
}
