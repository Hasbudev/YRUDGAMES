"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";

interface BattleIntroProps {
  leftName: string;
  rightName: string;
  onDone: () => void;
}

// Short, skippable "PLAYER 1 VS PLAYER 2 → COMBAT FINAL" beat before the HUD
// takes over — the one place a giant permanent VS is earned, per the brief.
export function BattleIntro({ leftName, rightName, onDone }: BattleIntroProps) {
  const [phase, setPhase] = useState<"vs" | "title">("vs");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("title"), 1400);
    const t2 = setTimeout(onDone, 2600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);

  useEffect(() => {
    if (boxRef.current) {
      gsap.fromTo(boxRef.current, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.35, ease: "power2.out" });
    }
  }, [phase]);

  return (
    <button
      type="button"
      onClick={onDone}
      className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center gap-4 bg-void-deep"
      aria-label="Passer l'introduction"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(106,95,214,0.22), transparent), radial-gradient(ellipse 70% 50% at 50% 100%, rgba(178,58,47,0.15), transparent)",
        }}
      />
      <div ref={boxRef} className="relative flex flex-col items-center gap-3">
        {phase === "vs" ? (
          <div className="flex items-center gap-6 sm:gap-10">
            <span className="max-w-[10rem] truncate font-display text-xl font-bold text-sky-300 sm:text-3xl">{leftName}</span>
            <Image src="/fight/vs-badge.png" alt="VS" width={107} height={107} className="h-14 w-14 sm:h-20 sm:w-20" />
            <span className="max-w-[10rem] truncate font-display text-xl font-bold text-crimson-bright sm:text-3xl">{rightName}</span>
          </div>
        ) : (
          <span className="font-display text-3xl font-black uppercase tracking-widest text-gold-bright [text-shadow:0_0_28px_rgba(232,193,90,0.6)] sm:text-5xl">
            Combat final
          </span>
        )}
      </div>
      <span className="relative text-xs text-ink-muted">Touchez pour passer</span>
    </button>
  );
}
