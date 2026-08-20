"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import type { PlayerRevealResult, PublicQuestion } from "@yrud/shared";
import { playCorrect, playWrong } from "@/lib/sfx";
import { OrnatePanel } from "./OrnatePanel";
import { ChoicePill, type ChoiceLetter } from "./ChoicePill";

// "speed" stays here for type completeness (PublicQuestion["theme"] still
// includes it for legacy rows) even though the speed round feature was
// removed and no live question can carry that theme anymore.
const THEME_LABEL: Record<PublicQuestion["theme"], string> = {
  trivia: "Quiz de Yrud",
  ost: "Devine la musique",
  stats: "Duel de stats",
  speed: "Manche rapide",
};

const CHOICE_LETTERS: ChoiceLetter[] = ["a", "b", "c", "d"];
const FALLBACK_LETTERS = ["A", "B", "C", "D", "E", "F"];

interface RevealCardProps {
  question: PublicQuestion;
  correctIndex: number;
  myResult?: PlayerRevealResult;
}

export function RevealCard({ question, correctIndex, myResult }: RevealCardProps) {
  const bannerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const correctRef = useRef<HTMLDivElement>(null);

  const answered = myResult != null && myResult.choiceIndex !== null;
  const won = myResult?.correct ?? false;
  const spectating = myResult === undefined;

  useEffect(() => {
    if (!spectating) {
      if (won) playCorrect();
      else playWrong();
    }
    if (bannerRef.current) {
      gsap.fromTo(
        bannerRef.current,
        { scale: 0.4, opacity: 0, y: -10 },
        { scale: 1, opacity: 1, y: 0, duration: 0.45, ease: "back.out(1.9)" }
      );
    }
    if (correctRef.current) {
      gsap.fromTo(
        correctRef.current,
        { filter: "drop-shadow(0 0 0 rgba(90,220,120,0))" },
        { filter: "drop-shadow(0 0 18px rgba(90,220,120,0.7))", duration: 0.5, delay: 0.15, ease: "power2.out" }
      );
    }
    if (!spectating && !won && cardRef.current) {
      gsap.fromTo(cardRef.current, { x: 0 }, { x: -10, duration: 0.05, repeat: 5, yoyo: true });
    }
  }, [won, spectating]);

  const isStats = question.theme === "stats" && question.choices.length === 2;
  const usesPillArt = !isStats && question.choices.length <= CHOICE_LETTERS.length;

  return (
    <OrnatePanel innerRef={cardRef} className="w-full max-w-2xl">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between text-xs">
          <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 font-semibold tracking-wide text-gold-bright uppercase">
            {THEME_LABEL[question.theme]}
          </span>
          <span className="text-ink-muted">
            Question {question.questionIndex + 1} sur {question.questionCount}
          </span>
        </div>

        <div
          ref={bannerRef}
          className={`self-center rounded-full px-6 py-2 text-center font-display text-lg font-black uppercase tracking-wide ${
            spectating
              ? "bg-void-deep/60 text-ink-muted"
              : won
                ? "bg-gold/20 text-gold-bright shadow-[0_0_24px_rgba(232,193,90,0.4)]"
                : "bg-crimson/20 text-crimson-bright shadow-[0_0_24px_rgba(217,88,74,0.35)]"
          }`}
        >
          {spectating ? "La bonne réponse était..." : won ? "✓ Bonne réponse !" : answered ? "✗ Mauvaise réponse..." : "⏱ Trop lent(e) !"}
        </div>

        <h2 className="font-display text-xl font-semibold text-ink">{question.prompt}</h2>

        {usesPillArt ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {question.choices.map((choice, i) => {
              const isCorrect = i === correctIndex;
              const isMyWrongPick = !spectating && !isCorrect && i === myResult?.choiceIndex;
              return (
                <div key={i} ref={isCorrect ? correctRef : undefined}>
                  <ChoicePill
                    letter={CHOICE_LETTERS[i]}
                    label={choice}
                    state={isCorrect ? "correct" : isMyWrongPick ? "wrong" : "locked"}
                    disabled
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className={isStats ? "grid grid-cols-2 items-stretch gap-4" : "grid grid-cols-1 gap-3 sm:grid-cols-2"}>
            {question.choices.map((choice, i) => {
              const isCorrect = i === correctIndex;
              const isMyWrongPick = !spectating && !isCorrect && i === myResult?.choiceIndex;
              return (
                <div
                  key={i}
                  ref={isCorrect ? correctRef : undefined}
                  className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                    isStats ? "flex-col justify-center py-8 text-center" : ""
                  } ${
                    isCorrect
                      ? "border-gold bg-gradient-to-r from-gold/25 to-gold/5"
                      : isMyWrongPick
                        ? "border-crimson bg-crimson/10"
                        : "border-border bg-void-deep/30 opacity-50"
                  }`}
                >
                  {!isStats && (
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                        isCorrect
                          ? "border-gold bg-gold text-void-deep"
                          : isMyWrongPick
                            ? "border-crimson bg-crimson text-white"
                            : "border-border-strong text-ink-muted"
                      }`}
                    >
                      {isCorrect ? "✓" : isMyWrongPick ? "✗" : (FALLBACK_LETTERS[i] ?? i + 1)}
                    </span>
                  )}
                  <span className={`font-medium ${isCorrect ? "text-gold-bright" : isMyWrongPick ? "text-crimson-bright" : "text-ink"}`}>
                    {choice}
                  </span>
                  {isStats && (
                    <span className={`text-lg font-bold ${isCorrect ? "text-gold-bright" : "text-ink-muted"}`}>
                      {isCorrect ? "✓" : ""}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!spectating && myResult && (
          <p className="text-center text-sm text-ink-muted">
            {myResult.eliminated
              ? "Tu perds ta dernière vie... éliminé(e) !"
              : !won
                ? "Tu perds une vie."
                : "Tu conserves toutes tes vies."}
          </p>
        )}
      </div>
    </OrnatePanel>
  );
}
