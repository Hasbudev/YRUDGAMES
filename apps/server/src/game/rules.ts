import type { RoundRules } from "@yrud/shared";
import { SLIDER_TIERS } from "@yrud/shared";
import type { InternalQuestion } from "./types";

function range(values: number[]): [number, number] {
  return [Math.min(...values), Math.max(...values)];
}

// Sums one manche's scoring up for the rules card. `timeLimitMsFor` is
// injected because the effective duration depends on the room's live
// overrides, not just on the question itself.
export function summarizeRound(
  questions: InternalQuestion[],
  roundIndex: number,
  timeLimitMsFor: (q: InternalQuestion) => number,
  timeLimitOverridden: boolean
): RoundRules | undefined {
  const inRound = questions.filter((q) => q.roundIndex === roundIndex);
  if (inRound.length === 0) return undefined;

  const timed = inRound.filter((q) => q.theme !== "ost");
  const specialRules: NonNullable<RoundRules["specialRules"]> = [];
  const categoryPoints = inRound.find((q) => q.metadata?.categoryPoints)?.metadata?.categoryPoints;
  if (categoryPoints) {
    specialRules.push(
      {
        icon: "🏳",
        label: "Chaque clan joue à son tour les questions de la catégorie qu'il a choisie",
        value: `+${categoryPoints.own} pts`,
        tone: "gain",
      },
      { icon: "👀", label: "Pendant ce temps, les autres clans regardent", value: "—", tone: "neutral" }
    );
  }
  if (inRound.some((q) => q.theme === "slider")) {
    for (const t of SLIDER_TIERS) specialRules.push({ icon: "🎯", label: t.label, value: `+${t.points} pts`, tone: "gain" });
  }
  const bomb = inRound.find((q) => q.metadata?.bomb)?.metadata?.bomb;
  if (bomb) {
    specialRules.push(
      {
        icon: "💣",
        label: "Seul le clan qui a la bombe répond, la majorité de ses votes décide",
        value: "+1 pt / bonne rép.",
        tone: "gain",
      },
      { icon: "✔", label: "Le clan vote juste : la bombe passe au clan suivant", value: "ouf", tone: "neutral" },
      {
        icon: "💥",
        label: `Le clan vote faux : la bombe reste et chauffe… à l'explosion (${bomb.count} bombes), chaque joueur du clan perd ${bomb.penalty} ÷ le nombre de votants`,
        value: `−${bomb.penalty} ÷ n`,
        tone: "loss",
      }
    );
  }
  const steal = inRound.find((q) => q.metadata?.steal)?.metadata?.steal;
  if (steal) {
    specialRules.push({
      icon: "🦹",
      label: "À chaque question, le premier à trouver vole des points au joueur de son choix",
      value: `${steal} pts`,
      tone: "bonus",
    });
  }
  const pointsOf = (q: InternalQuestion): number[] =>
    q.theme === "slider"
      ? SLIDER_TIERS.map((t) => t.points)
      : q.metadata?.categoryPoints
        ? [q.metadata.categoryPoints.own]
        : [q.points];
  const comboQuestion = inRound.find((q) => q.comboThreshold && q.comboBonus);

  return {
    roundIndex,
    roundLabel: inRound.find((q) => q.roundLabel)?.roundLabel,
    questionCount: inRound.length,
    points: range(inRound.flatMap(pointsOf)),
    wrongPoints: range(inRound.map((q) => q.wrongPoints)),
    blankPoints: range(inRound.map((q) => q.blankPoints ?? q.wrongPoints)),
    combo: comboQuestion
      ? { threshold: comboQuestion.comboThreshold!, bonus: comboQuestion.comboBonus! }
      : undefined,
    allCorrectCount: inRound.filter((q) => q.allCorrect).length,
    timeLimitSec:
      timed.length > 0
        ? range(
            timed.map((q) =>
              // A chasse-taupes is announced by its playing time, not its
              // clock (which runs a little longer for late hits).
              Math.round((q.theme === "whack" && q.metadata?.whack ? q.metadata.whack.durationMs : timeLimitMsFor(q)) / 1000)
            )
          )
        : null,
    timeLimitOverridden,
    minigame: inRound.some((q) => q.theme === "whack") ? "whack" : undefined,
    specialRules: specialRules.length ? specialRules : undefined,
    categories: categoryPoints
      ? [...new Set(inRound.map((q) => q.metadata?.category).filter((c): c is string => !!c))]
      : undefined,
  };
}
