"use client";

import { useEffect, useRef, useState } from "react";
import { SLIDER_SWEEP_MS, SLIDER_TRICKS, type PublicQuestion, type SliderTrick } from "@yrud/shared";
import { OrnatePanel } from "@/components/quiz/OrnatePanel";
import { TimerBar } from "@/components/quiz/TimerBar";
import { PokemonSprite } from "@/components/battle/PokemonSprite";

interface SliderCardProps {
  question: PublicQuestion;
  // The value the player stopped on, once they have.
  stopped: number | null;
  // Omitted for spectators — the cursor runs, nothing to stop.
  onStop?: (value: number) => void;
  // Rudy's latest dirty trick (key changes each time he fires one).
  trick?: { trick: SliderTrick; key: number } | null;
}

const SPEED_BOOST = 3;
const SHAKE_JITTER = 3;

// Manche 2 — the cursor bounces across the stat window; the player stops it
// on the stat's maximum. Space bar works too.
export function SliderCard({ question, stopped, onStop, trick }: SliderCardProps) {
  const slider = question.metadata?.slider;
  const low = slider?.low ?? 0;
  const high = slider?.high ?? 1;
  const [value, setValue] = useState(low);
  const valueRef = useRef(low);

  // The trick in effect, if any — read by the animation loop through a ref.
  const [active, setActive] = useState<SliderTrick | null>(null);
  const activeRef = useRef<SliderTrick | null>(null);
  useEffect(() => {
    if (!trick) return;
    const def = SLIDER_TRICKS.find((t) => t.id === trick.trick);
    activeRef.current = trick.trick;
    setActive(trick.trick);
    const timeout = setTimeout(() => {
      activeRef.current = null;
      setActive(null);
    }, def?.durationMs ?? 2000);
    return () => clearTimeout(timeout);
  }, [trick]);

  useEffect(() => {
    if (stopped !== null) return;
    let frame = 0;
    let last = performance.now();
    let phase = 0; // 0..2: there (0→1) and back (1→2)
    const tick = (now: number) => {
      const speed = activeRef.current === "speed" ? SPEED_BOOST : 1;
      phase = (phase + ((now - last) / SLIDER_SWEEP_MS) * speed) % 2;
      last = now;
      const t = phase <= 1 ? phase : 2 - phase;
      let v = Math.round(low + t * (high - low));
      if (activeRef.current === "shake") {
        v = Math.min(high, Math.max(low, v + Math.round((Math.random() * 2 - 1) * SHAKE_JITTER)));
      }
      valueRef.current = v;
      setValue(v);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [low, high, stopped]);

  useEffect(() => {
    if (!onStop || stopped !== null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        onStop(valueRef.current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStop, stopped]);

  const shown = stopped ?? value;
  const pct = ((shown - low) / Math.max(1, high - low)) * 100;
  const hidden = active === "hide" && stopped === null;
  const shaking = active === "shake" && stopped === null;

  return (
    <OrnatePanel className="animate-scene-enter w-full max-w-2xl">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between text-xs">
          <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 font-semibold uppercase tracking-wide text-gold-bright">
            Stat max
          </span>
          <span className="text-ink-muted">
            Question {question.questionIndex + 1} sur {question.questionCount}
          </span>
        </div>
        <TimerBar startedAt={question.startedAt} timeLimitMs={question.timeLimitMs} />
        <h2 className="font-display text-xl font-semibold text-ink">{question.prompt}</h2>

        {slider && (
          <div className="flex items-center gap-4">
            <div className="relative h-28 w-28 shrink-0">
              <PokemonSprite species={slider.species} className="object-contain" />
            </div>
            <div>
              <p className="font-display text-2xl font-black text-ink">{slider.pokemon}</p>
              <p className="text-sm uppercase tracking-wide text-gold-bright">{slider.stat}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2" style={shaking ? { animation: "slider-shake 0.09s linear infinite" } : undefined}>
          {active && stopped === null && (
            <p className="text-center font-display text-sm font-black uppercase tracking-wide text-crimson-bright">
              {active === "speed" ? "⚡ Rudy accélère le curseur !" : active === "shake" ? "〰 Rudy fait tout trembler !" : "🙈 Rudy cache le curseur !"}
            </p>
          )}
          <p
            className={`text-center font-display text-6xl font-black tabular-nums ${
              stopped !== null ? "text-gold-bright text-glow-gold" : "text-ink"
            }`}
          >
            {hidden ? "???" : shown}
          </p>
          <div className="relative h-4 w-full rounded-full bg-void-deep/70">
            <div
              hidden={hidden}
              className="absolute top-1/2 h-8 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-bright shadow-[0_0_12px_rgba(232,193,90,0.8)]"
              style={{ left: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs tabular-nums text-ink-muted">
            <span>{low}</span>
            <span>{high}</span>
          </div>
        </div>

        {onStop && (
          <button
            type="button"
            disabled={stopped !== null}
            onPointerDown={() => onStop(valueRef.current)}
            className="btn-crimson rounded-xl py-4 font-display text-2xl font-black disabled:opacity-50"
          >
            {stopped !== null ? `Arrêté sur ${stopped}` : "STOP !"}
          </button>
        )}
        {!onStop && <p className="text-center text-xs text-ink-muted">Mode spectateur — les joueurs arrêtent le curseur.</p>}
      </div>
    </OrnatePanel>
  );
}
