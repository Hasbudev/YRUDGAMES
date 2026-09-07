"use client";

import Image from "next/image";
import type { PublicQuestion } from "@yrud/shared";
import { TimerBar } from "./TimerBar";
import { OstPlayer } from "./OstQuestionCard";
import { LocalBlindTestPlayer } from "./LocalBlindTestPlayer";
import { OrnatePanel } from "./OrnatePanel";
import { ChoicePill, type ChoiceLetter } from "./ChoicePill";

interface QuestionCardProps {
  question: PublicQuestion;
  disabled: boolean;
  selectedIndex: number | null;
  onAnswer: (choiceIndex: number) => void;
}

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

export function QuestionCard({ question, disabled, selectedIndex, onAnswer }: QuestionCardProps) {
  const isStats = question.theme === "stats" && question.choices.length === 2;
  const usesPillArt = !isStats && question.choices.length <= CHOICE_LETTERS.length;

  return (
    <OrnatePanel className="animate-scene-enter w-full max-w-2xl">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between text-xs">
          <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 font-semibold tracking-wide text-gold-bright uppercase shadow-[0_0_10px_rgba(232,193,90,0.25)]">
            {THEME_LABEL[question.theme]}
          </span>
          <span className="text-ink-muted">
            Question {question.questionIndex + 1} sur {question.questionCount} · vaut {question.points} pt
            {question.points === 1 ? "" : "s"}
          </span>
        </div>
        {/* Blind test has no deadline — Yrud decides live when to reveal —
            so showing a countdown that doesn't actually do anything would
            just be misleading. */}
        {question.theme !== "ost" && <TimerBar startedAt={question.startedAt} timeLimitMs={question.timeLimitMs} />}
        <h2 className="font-display text-xl font-semibold text-ink">{question.prompt}</h2>

        {question.theme !== "ost" && question.mediaUrl && (
          <div className="relative mx-auto h-56 w-full max-w-md overflow-hidden rounded-xl border border-gold/25 bg-void-deep/40 sm:h-72">
            <Image
              src={question.mediaUrl}
              alt=""
              fill
              sizes="(max-width: 640px) 90vw, 448px"
              className="object-contain"
              // Local /public paths go through Next's normal image
              // optimizer fine; an admin-pasted external URL almost
              // certainly isn't in next.config's allowed image domains, so
              // skip optimization for those instead of erroring.
              unoptimized={!question.mediaUrl.startsWith("/")}
            />
          </div>
        )}

        {question.theme === "ost" &&
          (question.metadata?.audioFile ? (
            <LocalBlindTestPlayer key={question.id} audioFile={question.metadata.audioFile} />
          ) : (
            <OstPlayer notes={question.metadata?.notes} mediaUrl={question.mediaUrl} />
          ))}

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
        ) : usesPillArt ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {question.choices.map((choice, i) => (
              <ChoicePill
                key={i}
                letter={CHOICE_LETTERS[i]}
                label={choice}
                state={selectedIndex === i ? "confirmed" : disabled ? "locked" : "idle"}
                disabled={disabled}
                onClick={() => onAnswer(i)}
              />
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
                  {FALLBACK_LETTERS[i] ?? i + 1}
                </span>
                {choice}
              </button>
            ))}
          </div>
        )}
      </div>
    </OrnatePanel>
  );
}
