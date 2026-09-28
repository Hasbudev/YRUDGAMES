"use client";

import { useEffect, useState } from "react";
import type { GamePhase, RoundRules } from "@yrud/shared";
import { penaltyLabel, rangeLabel, secondsLabel, signed } from "@/lib/roundRules";

const PRESETS = [10, 15, 20, 30, 45, 60];

interface RoundControlsProps {
  rules: RoundRules;
  phase: GamePhase;
  // seconds null = back to each question's own duration.
  onSetTimeLimit: (seconds: number | null) => void;
}

// The admin's read on the manche the game is in (or about to start), and the
// one place to set how long its questions last. Best used at the manche's
// intro — a change never touches a question that's already live.
export function RoundControls({ rules, phase, onSetTimeLimit }: RoundControlsProps) {
  const current = rules.timeLimitSec && rules.timeLimitSec[0] === rules.timeLimitSec[1] ? rules.timeLimitSec[0] : null;
  const [draft, setDraft] = useState<number | "">(current ?? "");

  // Follow the server (manche change, or another admin tab) unless mid-edit
  // would matter — the draft is cheap to retype, a stale one is worse.
  useEffect(() => {
    setDraft(current ?? "");
  }, [rules.roundIndex, current]);

  const timed = rules.timeLimitSec !== null;
  const draftValid = draft !== "" && draft >= 5 && draft <= 300;

  return (
    <div className="panel-ornate w-full rounded-2xl p-4">
      <p className="mb-2 pl-5 font-display text-sm font-semibold text-gold-bright">
        Manche {rules.roundIndex}
        {rules.roundLabel ? ` · ${rules.roundLabel}` : ""}
      </p>

      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-border bg-void-deep/60 px-2 py-0.5 text-ink-muted">
          {rules.questionCount} question{rules.questionCount === 1 ? "" : "s"}
        </span>
        <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-emerald-300">
          {rangeLabel(rules.points)}
        </span>
        <span className="rounded-full border border-crimson/40 bg-crimson/10 px-2 py-0.5 text-crimson-bright">
          faux : {penaltyLabel(rules.wrongPoints)}
        </span>
        <span className="rounded-full border border-border bg-void-deep/60 px-2 py-0.5 text-ink-muted">
          sans réponse : {penaltyLabel(rules.blankPoints)}
        </span>
        {rules.allCorrectCount > 0 && (
          <span className="rounded-full border border-border bg-void-deep/60 px-2 py-0.5 text-ink-muted">
            🎁 {rules.allCorrectCount} question blague (toutes les réponses comptent)
          </span>
        )}
        {rules.combo && (
          <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-gold-bright">
            🔥 combo ×{rules.combo.threshold} : {signed(rules.combo.bonus)}
          </span>
        )}
      </div>

      {timed ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-ink-muted">
            Temps par question :{" "}
            <span className="font-bold text-gold-bright">{secondsLabel(rules.timeLimitSec)}</span>{" "}
            {rules.timeLimitOverridden ? "(réglé par toi pour cette manche)" : "(valeur propre à chaque question)"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSetTimeLimit(s)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors ${
                  rules.timeLimitOverridden && current === s
                    ? "border-gold bg-gold text-void-deep"
                    : "border-border text-ink-muted hover:border-border-strong hover:text-ink"
                }`}
              >
                {s} s
              </button>
            ))}
            <input
              type="number"
              min={5}
              max={300}
              value={draft}
              onChange={(e) => setDraft(e.target.value === "" ? "" : Number(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && draftValid && onSetTimeLimit(Number(draft))}
              aria-label="Durée en secondes"
              className="w-20 rounded-lg border border-border bg-void-deep/60 px-2 py-1 text-sm text-ink focus:border-gold focus:outline-none"
            />
            <button
              type="button"
              onClick={() => onSetTimeLimit(Number(draft))}
              disabled={!draftValid}
              className="btn-gold"
            >
              Appliquer
            </button>
            {rules.timeLimitOverridden && (
              <button
                type="button"
                onClick={() => onSetTimeLimit(null)}
                className="rounded-lg border border-border px-2.5 py-1 text-xs text-ink-muted hover:border-border-strong"
              >
                Remettre celui des questions
              </button>
            )}
          </div>
          {phase === "question" && (
            <p className="text-[11px] text-ink-muted">Ne change pas la question en cours — dès la suivante.</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-ink-muted">Blind test : pas de chrono, tu révèles la réponse quand tu veux.</p>
      )}
    </div>
  );
}
