"use client";

import type { PublicQuestion } from "@yrud/shared";
import { TimerBar } from "./TimerBar";
import { OstPlayer } from "./OstQuestionCard";

interface QuestionCardProps {
  question: PublicQuestion;
  disabled: boolean;
  selectedIndex: number | null;
  onAnswer: (choiceIndex: number) => void;
}

const THEME_LABEL: Record<PublicQuestion["theme"], string> = {
  trivia: "Quiz de Yrud",
  ost: "Devine la musique",
  stats: "Duel de stats",
  speed: "Manche rapide",
};

const CHOICE_LETTERS = ["A", "B", "C", "D", "E", "F"];

export function QuestionCard({ question, disabled, selectedIndex, onAnswer }: QuestionCardProps) {
  const isStats = question.theme === "stats" && question.choices.length === 2;

  return (
    <div className="panel animate-scene-enter relative flex w-full max-w-2xl flex-col gap-4 overflow-hidden rounded-2xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-gold/10 to-transparent" />
      <div className="relative flex items-center justify-between text-xs">
        <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 font-semibold tracking-wide text-gold-bright uppercase shadow-[0_0_10px_rgba(232,193,90,0.25)]">
          {THEME_LABEL[question.theme]}
        </span>
        <span className="text-ink-muted">
          Question {question.questionIndex + 1} sur {question.questionCount}
        </span>
      </div>
      <TimerBar startedAt={question.startedAt} timeLimitMs={question.timeLimitMs} />
      <h2 className="font-display text-xl font-semibold text-ink">{question.prompt}</h2>

      {question.theme === "ost" && <OstPlayer notes={question.metadata?.notes} mediaUrl={question.mediaUrl} />}

      {isStats ? (
        <div className="grid grid-cols-2 items-stretch gap-4">
          {question.choices.map((choice, i) => (
            <button
              key={i}
              disabled={disabled}
              onClick={() => onAnswer(i)}
              className={`group flex flex-col items-center justify-center gap-2 rounded-xl border-2 px-4 py-8 text-center transition-all duration-150 disabled:cursor-not-allowed ${
                selectedIndex === i
                  ? "border-gold bg-gradient-to-b from-gold/20 to-gold/5 shadow-[0_0_24px_rgba(232,193,90,0.4)]"
                  : "border-border bg-gradient-to-b from-void-deep/60 to-void-deep/20 hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-[0_8px_24px_rgba(232,193,90,0.15)] disabled:hover:translate-y-0"
              } ${disabled && selectedIndex !== i ? "opacity-40" : ""}`}
            >
              <span className="font-display text-xl font-bold text-ink">{choice}</span>
              {question.metadata?.stat && (
                <span className="text-xs uppercase tracking-wide text-ink-muted">
                  Meilleure {question.metadata.stat} ?
                </span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {question.choices.map((choice, i) => (
            <button
              key={i}
              disabled={disabled}
              onClick={() => onAnswer(i)}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium text-ink transition-all duration-150 disabled:cursor-not-allowed ${
                selectedIndex === i
                  ? "border-gold bg-gradient-to-r from-gold/20 to-gold/5 shadow-[0_0_20px_rgba(232,193,90,0.35)]"
                  : "border-border bg-gradient-to-r from-void-deep/60 to-void-deep/30 hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-[0_6px_18px_rgba(232,193,90,0.12)] disabled:hover:translate-y-0"
              } ${disabled && selectedIndex !== i ? "opacity-40" : ""}`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                  selectedIndex === i ? "border-gold bg-gold text-void-deep" : "border-border-strong text-ink-muted"
                }`}
              >
                {CHOICE_LETTERS[i] ?? i + 1}
              </span>
              {choice}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
