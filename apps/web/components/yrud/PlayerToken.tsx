"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import type { PublicPlayer } from "@yrud/shared";
import { playCorrect, playElimination } from "@/lib/sfx";
import { AvatarIcon } from "./AvatarIcon";
import { HeartRow } from "./HeartRow";

interface PlayerTokenProps {
  player: PublicPlayer;
  revealVerdict?: "correct" | "wrong" | null;
  hasAnswered?: boolean;
  speedScore?: number;
}

export function PlayerToken({ player, revealVerdict, hasAnswered, speedScore }: PlayerTokenProps) {
  const ref = useRef<HTMLDivElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);
  const prevEliminated = useRef(player.eliminated);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const justEliminated = player.eliminated && !prevEliminated.current;
    prevEliminated.current = player.eliminated;

    if (justEliminated) {
      playElimination();
      const tl = gsap.timeline();
      if (sweepRef.current) {
        tl.set(sweepRef.current, { opacity: 1, x: -70, rotation: -20 }).to(
          sweepRef.current,
          { x: 70, rotation: 20, duration: 0.3, ease: "power2.in" },
          0
        );
      }
      tl.to(el, { x: -12, duration: 0.06, ease: "power1.inOut" }, 0.1)
        .to(el, { x: 12, duration: 0.06, ease: "power1.inOut", repeat: 3, yoyo: true })
        .to(el, {
          x: 260,
          y: -40,
          rotation: 240,
          scale: 0.4,
          opacity: 0,
          duration: 0.6,
          ease: "power2.in",
        })
        .set(sweepRef.current, { opacity: 0 }, "<");
      return;
    }

    if (revealVerdict === "correct") {
      playCorrect();
      gsap.fromTo(
        el,
        { scale: 1 },
        { scale: 1.15, duration: 0.15, yoyo: true, repeat: 1, ease: "power1.out" }
      );
    }
  }, [player.eliminated, revealVerdict]);

  return (
    <div
      ref={ref}
      className={`relative flex flex-col items-center gap-1 overflow-visible rounded-lg border p-3 text-center transition-colors ${
        player.eliminated
          ? "border-crimson/30 bg-crimson/5 opacity-40"
          : revealVerdict === "correct"
            ? "border-gold bg-gold/10"
            : "border-border bg-void-deep/40"
      }`}
    >
      <div
        ref={sweepRef}
        className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-10 w-10 -translate-x-1/2 -translate-y-1/2 opacity-0"
      >
        <Image src="/sprites/yrud.png" alt="" width={142} height={200} className="h-full w-auto" style={{ imageRendering: "pixelated" }} />
      </div>
      {hasAnswered && !player.eliminated && (
        <span
          title="A répondu"
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-void-deep"
        >
          ✓
        </span>
      )}
      {speedScore !== undefined && !player.eliminated && (
        <span
          title="Score de la manche rapide"
          className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-purple px-1 text-[11px] font-bold text-white"
        >
          {speedScore}
        </span>
      )}
      {!player.connected && !player.eliminated && (
        <span
          title="Hors ligne — connexion perdue"
          className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-void-deep text-[10px] ring-1 ring-ink-muted"
        >
          <span className="h-2 w-2 rounded-full bg-ink-muted" />
        </span>
      )}
      <AvatarIcon
        avatarId={player.avatarId}
        seed={player.id}
        size={36}
        className={player.eliminated ? "opacity-40 grayscale" : !player.connected ? "opacity-60 grayscale" : ""}
      />
      <span className="max-w-[6rem] truncate text-xs font-medium text-ink">
        {player.name}
        {!player.connected && !player.eliminated && <span className="ml-1 text-ink-muted">⚠</span>}
      </span>
      {player.eliminated ? (
        <span className="text-[10px] text-crimson-bright">éliminé(e)</span>
      ) : (
        <HeartRow lives={player.lives} maxLives={player.maxLives} size={12} />
      )}
    </div>
  );
}
