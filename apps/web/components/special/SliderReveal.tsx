"use client";

import { useEffect } from "react";
import { sliderPoints, type PlayerRevealResult, type PublicQuestion } from "@yrud/shared";
import { playCorrect, playWrong } from "@/lib/sfx";
import { OrnatePanel } from "@/components/quiz/OrnatePanel";

interface SliderRevealProps {
  question: PublicQuestion;
  answer: number;
  myResult?: PlayerRevealResult;
}

export function SliderReveal({ question, answer, myResult }: SliderRevealProps) {
  const mine = myResult?.choiceIndex ?? null;
  const gain = mine === null ? 0 : sliderPoints(mine, answer);
  const slider = question.metadata?.slider;

  useEffect(() => {
    if (!myResult) return;
    if (gain > 0) playCorrect();
    else playWrong();
  }, [myResult, gain]);

  return (
    <OrnatePanel className="w-full max-w-2xl">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-ink-muted">
          {slider ? `${slider.stat} max de ${slider.pokemon}` : question.prompt}
        </p>
        <p className="font-display text-glow-gold text-6xl font-black tabular-nums text-gold-bright">{answer}</p>
        {myResult && (
          <p className="font-display text-lg text-ink">
            {mine === null ? "Tu n'as pas arrêté le curseur..." : `Toi : ${mine} (écart ${Math.abs(mine - answer)})`}
            {" → "}
            <b className={gain > 0 ? "text-emerald-300" : "text-crimson-bright"}>+{gain} pt{gain === 1 ? "" : "s"}</b>
          </p>
        )}
      </div>
    </OrnatePanel>
  );
}
