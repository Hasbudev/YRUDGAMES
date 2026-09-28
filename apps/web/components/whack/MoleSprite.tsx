"use client";

import { useState } from "react";
import { MOLE_KINDS, type MoleKind } from "@yrud/shared";

// Remembered across renders/moles so a missing /whack/<kind>.png only 404s
// once instead of flickering on every mole of that kind.
const failedLevel: Partial<Record<MoleKind, number>> = {};

// Tries the real sprite (apps/web/public/whack/<kind>.png), then the kind's
// fallback sprite, then a name badge — so the game is playable before the
// sprites are delivered.
export function MoleSprite({ kind, className = "" }: { kind: MoleKind; className?: string }) {
  const def = MOLE_KINDS[kind];
  const [level, setLevel] = useState(failedLevel[kind] ?? 0);
  const sources = [`/whack/${kind}.png`, def.fallbackSprite].filter(Boolean) as string[];

  if (level >= sources.length) {
    return (
      <span
        className={`flex aspect-square items-center justify-center rounded-full border-2 border-gold bg-void-deep/90 p-1 text-center font-display text-[10px] font-black uppercase leading-tight text-gold-bright sm:text-xs ${className}`}
      >
        {def.label}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- local/remote sprites with a runtime fallback chain
    <img
      src={sources[level]}
      alt={def.label}
      draggable={false}
      className={`select-none object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.6)] ${className}`}
      // Showdown's gen5 sprites sit small in a padded 96px canvas — scaled up
      // so the placeholder Taupiqueur reads at the size a real sprite would.
      style={
        sources[level].startsWith("https://play.pokemonshowdown.com")
          ? { imageRendering: "pixelated", transform: "scale(1.7)", transformOrigin: "bottom" }
          : undefined
      }
      onError={() => {
        failedLevel[kind] = level + 1;
        setLevel(level + 1);
      }}
    />
  );
}
