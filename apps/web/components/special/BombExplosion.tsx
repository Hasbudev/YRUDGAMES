"use client";

import { useEffect } from "react";
import { CLAN_REGISTRY } from "@yrud/shared";
import { playWrong } from "@/lib/sfx";

// Full-screen "BOUM" when a bomb goes off.
export function BombExplosion({ clan, holderName, penalty, onDone }: { clan: string; holderName: string; penalty: number; onDone: () => void }) {
  const def = CLAN_REGISTRY.find((c) => c.id === clan);
  useEffect(() => {
    playWrong();
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[60] flex flex-col items-center justify-center text-center"
      style={{ background: "radial-gradient(circle, rgba(249,115,22,0.75), rgba(217,88,74,0.7) 45%, rgba(0,0,0,0.9))" }}
    >
      <p className="animate-scene-enter text-8xl">💥</p>
      <p className="font-display text-6xl font-black text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">BOUM !</p>
      <p className="mt-2 font-display text-2xl font-bold text-white">
        La bombe explose sur {holderName} — clan{" "}
        <span style={{ color: def?.color }}>{def?.label ?? clan}</span> : −{penalty} pts chacun
      </p>
    </div>
  );
}
