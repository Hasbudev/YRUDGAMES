"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import type { PublicPlayer } from "@yrud/shared";
import { playCorrect, playWrong } from "@/lib/sfx";
import { ClanBadge } from "./ClanBadge";

interface PlayerTokenProps {
  player: PublicPlayer;
  revealVerdict?: "correct" | "wrong" | null;
  hasAnswered?: boolean;
}

// The card art (/play/player-card-small.png) has three heart outlines baked
// directly into the bottom of the image from the old lives system — there's
// no lives concept left to justify them, and no way to edit the PNG itself,
// so the points pill is sized and positioned as an opaque patch that fully
// covers that baked-in row instead of just sitting near it.
const HEART_ROW_TOP_PCT = 81;
const HEART_ROW_HEIGHT_PCT = 17;

export function PlayerToken({ player, revealVerdict, hasAnswered }: PlayerTokenProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (revealVerdict === "correct") {
      playCorrect();
      gsap.fromTo(
        el,
        { scale: 1 },
        { scale: 1.15, duration: 0.15, yoyo: true, repeat: 1, ease: "power1.out" }
      );
    } else if (revealVerdict === "wrong") {
      playWrong();
      gsap.fromTo(el, { x: 0 }, { x: -6, duration: 0.05, repeat: 5, yoyo: true });
    }
  }, [revealVerdict]);

  return (
    <div
      ref={ref}
      className={`relative aspect-[280/360] w-full overflow-visible transition-opacity ${
        !player.connected ? "opacity-70 grayscale" : ""
      } ${revealVerdict === "correct" ? "drop-shadow-[0_0_18px_rgba(232,193,90,0.6)]" : ""}`}
    >
      <Image src="/play/player-card-small.png" alt="" fill sizes="200px" className="object-contain" />

      {hasAnswered && (
        <span
          title="A répondu"
          className="absolute -right-1 -top-1 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-void-deep shadow"
        >
          ✓
        </span>
      )}
      {!player.connected && (
        <span
          title="Hors ligne — connexion perdue"
          className="absolute -left-1 -top-1 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-void-deep text-[10px] ring-1 ring-ink-muted"
        >
          <span className="h-2 w-2 rounded-full bg-ink-muted" />
        </span>
      )}

      <div
        className="absolute overflow-hidden rounded-full"
        style={{ left: "50%", top: "36%", width: "42%", aspectRatio: "1", transform: "translate(-50%, -50%)" }}
      >
        <ClanBadge clanId={player.clan} seed={player.id} className="h-full w-full" />
      </div>

      <span
        className="absolute inset-x-[14%] flex items-center justify-center truncate px-1 text-center text-[11px] font-medium text-ink sm:text-xs"
        style={{ top: "60%", height: "15%" }}
      >
        {player.name}
        {!player.connected && <span className="ml-1 text-ink-muted">⚠</span>}
      </span>

      <div
        className="absolute inset-x-[16%] flex items-center justify-center gap-1 rounded-full border border-gold/30 bg-void-deep shadow-[0_0_0_2px_rgba(10,6,20,0.9)]"
        style={{ top: `${HEART_ROW_TOP_PCT}%`, height: `${HEART_ROW_HEIGHT_PCT}%` }}
      >
        <span className="font-display text-sm font-black text-gold-bright sm:text-base">{player.points}</span>
        <span className="text-[10px] uppercase tracking-wide text-ink-muted">pt{player.points === 1 ? "" : "s"}</span>
      </div>
    </div>
  );
}
