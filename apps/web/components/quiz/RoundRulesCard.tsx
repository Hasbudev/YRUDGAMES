"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import type { RoundRules } from "@yrud/shared";
import { penaltyLabel, rangeLabel, secondsLabel, signed } from "@/lib/roundRules";
import { OrnatePanel } from "./OrnatePanel";
import { WhackLegend } from "@/components/whack/WhackLegend";

interface RuleRowProps {
  icon: string;
  label: string;
  value: string;
  tone: "gain" | "loss" | "neutral" | "bonus";
}

const TONE: Record<RuleRowProps["tone"], string> = {
  gain: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  loss: "border-crimson/50 bg-crimson/10 text-crimson-bright",
  neutral: "border-border bg-void-deep/50 text-ink-muted",
  bonus: "border-gold/50 bg-gold/10 text-gold-bright",
};

function RuleRow({ icon, label, value, tone }: RuleRowProps) {
  return (
    <li data-rule className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-void-deep/60 text-lg">
        {icon}
      </span>
      <span className="flex-1 text-sm text-ink sm:text-base">{label}</span>
      <span
        className={`rounded-lg border px-3 py-1 text-right font-display text-sm font-black tabular-nums sm:text-lg ${TONE[tone]}`}
      >
        {value}
      </span>
    </li>
  );
}

// What one manche is worth, presented as a card — shown by Yrud right after
// his monologue, before the manche's first question. Everything comes from
// the manche's own questions (see game/rules.ts), so it can't drift from
// what actually gets scored.
export function RoundRulesCard({ rules }: { rules: RoundRules }) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!listRef.current) return;
    gsap.fromTo(
      listRef.current.querySelectorAll("[data-rule]"),
      { opacity: 0, x: -24 },
      { opacity: 1, x: 0, duration: 0.4, stagger: 0.12, delay: 0.2, ease: "power2.out" }
    );
  }, []);

  const blankSameAsWrong =
    rules.blankPoints[0] === rules.wrongPoints[0] && rules.blankPoints[1] === rules.wrongPoints[1];

  return (
    <OrnatePanel className="w-full max-w-xl">
      <div className="flex flex-col gap-5">
        <div className="text-center">
          <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-gold-dim">
            Manche {rules.roundIndex}
          </p>
          {rules.roundLabel && (
            <h2 className="font-display text-glow-gold text-2xl font-black text-gold-bright sm:text-3xl">
              {rules.roundLabel}
            </h2>
          )}
          <p className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-ink-muted">
            {rules.minigame === "whack" ? (
              <span className="rounded-full border border-border bg-void-deep/60 px-3 py-1">
                ⏱ {secondsLabel(rules.timeLimitSec)} de jeu
              </span>
            ) : (
              <>
                <span className="rounded-full border border-border bg-void-deep/60 px-3 py-1">
                  {rules.questionCount} question{rules.questionCount === 1 ? "" : "s"}
                </span>
                <span className="rounded-full border border-border bg-void-deep/60 px-3 py-1">
                  ⏱ {secondsLabel(rules.timeLimitSec)}
                  {rules.timeLimitSec ? " par question" : " — Yrud révèle à la main"}
                </span>
              </>
            )}
          </p>
        </div>

        {rules.minigame === "whack" ? (
          <div ref={listRef as unknown as React.RefObject<HTMLDivElement>} className="flex flex-col gap-3">
            <p className="text-center text-sm text-ink">
              Tape les taupes le plus vite possible — ça accélère jusqu&apos;à la fin !
            </p>
            <WhackLegend />
          </div>
        ) : (
        <ul ref={listRef} className="flex flex-col gap-3">
          {rules.specialRules?.map((r) => (
            <RuleRow key={r.label} icon={r.icon} label={r.label} value={r.value} tone={r.tone} />
          ))}
          {!rules.specialRules?.some((r) => r.tone === "gain") && (
            <RuleRow icon="✔" label="Bonne réponse" value={rangeLabel(rules.points)} tone="gain" />
          )}
          <RuleRow
            icon="✘"
            label="Mauvaise réponse"
            value={penaltyLabel(rules.wrongPoints)}
            tone={rules.wrongPoints[0] < 0 ? "loss" : "neutral"}
          />
          {!blankSameAsWrong && (
            <RuleRow
              icon="…"
              label="Sans réponse"
              value={penaltyLabel(rules.blankPoints)}
              tone={rules.blankPoints[0] < 0 ? "loss" : "neutral"}
            />
          )}
          {rules.combo && (
            <RuleRow
              icon="🔥"
              label={`Combo : ${rules.combo.threshold} bonnes réponses d'affilée`}
              value={`${signed(rules.combo.bonus)} bonus`}
              tone="bonus"
            />
          )}
        </ul>
        )}

        <p className="text-center text-[11px] text-ink-muted">Ton score ne descend jamais sous 0.</p>
      </div>
    </OrnatePanel>
  );
}
