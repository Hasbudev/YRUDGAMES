"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import type { PrankDefinition } from "@yrud/shared";
import { playPrankSting } from "@/lib/sfx";

// Per-id visual flourish. Any future registry entry without bespoke sprite
// art here still gets a full jumpscare treatment via the emoji fallback —
// no new plumbing needed to add another gag.
const PRANK_SPRITE: Record<string, string> = {
  zeratchoupi: "/sprites/zeratchoupi.png",
};
const FALLBACK_EMOJI = "👹";

interface PrankOverlayProps {
  prank: PrankDefinition;
  text: string;
  onDone: () => void;
}

export function PrankOverlay({ prank, text, onDone }: PrankOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const creatureRef = useRef<HTMLDivElement>(null);
  const sprite = PRANK_SPRITE[prank.id];

  useEffect(() => {
    playPrankSting();
    const root = rootRef.current;
    const creature = creatureRef.current;
    if (root && creature) {
      const tl = gsap.timeline();
      tl.fromTo(
        creature,
        { scale: 4, opacity: 0, rotation: -15 },
        { scale: 1, opacity: 1, rotation: 0, duration: 0.25, ease: "power4.out" }
      ).to(
        root,
        { x: -14, duration: 0.05, ease: "power1.inOut", repeat: 7, yoyo: true },
        0
      );
    }
    const timeout = setTimeout(onDone, prank.durationMs);
    return () => clearTimeout(timeout);
  }, [onDone, prank.durationMs]);

  return (
    <div
      ref={rootRef}
      onClick={onDone}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onDone()}
      className="fixed inset-0 z-[60] flex cursor-pointer flex-col items-center justify-center gap-6 bg-black px-6"
    >
      <div ref={creatureRef} className="flex h-48 items-center justify-center drop-shadow-[0_0_40px_rgba(232,193,90,0.6)]">
        {sprite ? (
          <Image
            src={sprite}
            alt={prank.id}
            width={202}
            height={182}
            className="h-full w-auto max-w-[14rem] object-contain"
            style={{ imageRendering: "pixelated" }}
          />
        ) : (
          <span className="text-[8rem] leading-none">{FALLBACK_EMOJI}</span>
        )}
      </div>
      <p
        className={`max-w-2xl rounded-2xl bg-black/50 px-6 py-3 text-center font-black italic leading-tight text-gold-bright shadow-[0_0_30px_rgba(0,0,0,0.6)] ${
          text.length > 90 ? "text-lg sm:text-xl" : text.length > 40 ? "text-2xl sm:text-3xl" : "text-4xl tracking-tight"
        }`}
      >
        {text}
      </p>
      <span className="text-xs text-white/40">Cliquer pour fermer</span>
    </div>
  );
}
