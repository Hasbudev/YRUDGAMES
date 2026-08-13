"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { YrudPortrait } from "@/components/yrud/YrudPortrait";
import { playPrankSting } from "@/lib/sfx";

interface InterferenceCutInProps {
  label: string;
  onDone: () => void;
}

export function InterferenceCutIn({ label, onDone }: InterferenceCutInProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    playPrankSting();
    const card = cardRef.current;
    if (card) {
      gsap.fromTo(
        card,
        { scale: 0.3, opacity: 0, rotation: -6 },
        { scale: 1, opacity: 1, rotation: 0, duration: 0.4, ease: "back.out(1.7)" }
      );
    }
    const timeout = setTimeout(onDone, 2400);
    return () => clearTimeout(timeout);
  }, [onDone]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center gap-3">
      <div
        ref={cardRef}
        className="flex max-w-lg flex-col items-center gap-4 rounded-2xl border-2 border-crimson bg-zinc-950/95 px-8 py-8 text-center shadow-2xl"
      >
        <span className="rounded-full bg-crimson px-3 py-1 text-xs font-bold uppercase tracking-widest text-white">
          Interférence de Yrud
        </span>
        <YrudPortrait size="lg" />
        <p className="text-xl font-bold text-white">{label} !</p>
      </div>
    </div>
  );
}
