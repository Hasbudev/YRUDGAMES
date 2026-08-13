"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { TAUNT_DISPLAY_MS } from "@yrud/shared";
import { YrudPortrait } from "./YrudPortrait";
import { playTaunt } from "@/lib/sfx";

interface TauntOverlayProps {
  message: string;
  onDone: () => void;
}

export function TauntOverlay({ message, onDone }: TauntOverlayProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    playTaunt();
    const card = cardRef.current;
    if (card) {
      gsap.fromTo(
        card,
        { scale: 0.3, opacity: 0, rotation: -6 },
        { scale: 1, opacity: 1, rotation: 0, duration: 0.4, ease: "back.out(1.7)" }
      );
    }
    const timeout = setTimeout(onDone, TAUNT_DISPLAY_MS);
    return () => clearTimeout(timeout);
  }, [onDone]);

  return (
    <div
      onClick={onDone}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onDone()}
      className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-sm"
    >
      <div
        ref={cardRef}
        className="flex max-w-lg flex-col items-center gap-4 rounded-2xl border-2 border-amber-500 bg-zinc-950 px-8 py-8 text-center shadow-2xl"
      >
        <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-bold uppercase tracking-widest text-black">
          Yrud parle
        </span>
        <YrudPortrait size="lg" />
        <p className="text-xl font-bold text-white">{message}</p>
      </div>
      <span className="text-xs text-white/50">Cliquer pour fermer</span>
    </div>
  );
}
