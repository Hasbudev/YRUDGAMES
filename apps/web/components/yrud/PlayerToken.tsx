"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import type { PublicPlayer } from "@yrud/shared";
import { playCorrect, playElimination } from "@/lib/sfx";
import { AvatarIcon } from "./AvatarIcon";

interface PlayerTokenProps {
  player: PublicPlayer;
  revealVerdict?: "correct" | "wrong" | null;
  hasAnswered?: boolean;
}

// The card art is 280x360 — hearts are square, so a heart sized to X% of the
// card's WIDTH renders at X% * (280/360) of the card's HEIGHT. Deriving the
// row's height from that (instead of guessing a fixed height band) is what
// keeps hearts from getting squashed/clipped regardless of how many lives a
// player has.
const CARD_ASPECT = 280 / 360;
const HEART_GAP_PCT = 2;
const HEART_ROW_BUDGET_PCT = 78; // clear of the card's bottom corner gems
const HEART_MAX_WIDTH_PCT = 22;
const HEARTS_CENTER_Y_PCT = 87; // matches the card art's baked heart-outline hint

export function PlayerToken({ player, revealVerdict, hasAnswered }: PlayerTokenProps) {
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
      className={`relative aspect-[280/360] w-full overflow-visible transition-opacity ${
        player.eliminated ? "opacity-40 grayscale" : !player.connected ? "opacity-70 grayscale" : ""
      } ${revealVerdict === "correct" ? "drop-shadow-[0_0_18px_rgba(232,193,90,0.6)]" : ""}`}
    >
      <Image src="/play/player-card-small.png" alt="" fill sizes="200px" className="object-contain" />

      <div
        ref={sweepRef}
        className="pointer-events-none absolute left-1/2 top-1/2 z-30 h-10 w-10 -translate-x-1/2 -translate-y-1/2 opacity-0"
      >
        <Image src="/sprites/yrud.png" alt="" width={142} height={200} className="h-full w-auto" style={{ imageRendering: "pixelated" }} />
      </div>

      {hasAnswered && !player.eliminated && (
        <span
          title="A répondu"
          className="absolute -right-1 -top-1 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-void-deep shadow"
        >
          ✓
        </span>
      )}
      {!player.connected && !player.eliminated && (
        <span
          title="Hors ligne — connexion perdue"
          className="absolute -left-1 -top-1 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-void-deep text-[10px] ring-1 ring-ink-muted"
        >
          <span className="h-2 w-2 rounded-full bg-ink-muted" />
        </span>
      )}

      <div
        className="absolute flex items-center justify-center overflow-hidden rounded-full"
        style={{ left: "50%", top: "36%", width: "42%", aspectRatio: "1", transform: "translate(-50%, -50%)" }}
      >
        <AvatarIcon avatarId={player.avatarId} seed={player.id} size={36} className="h-full w-full" />
      </div>

      <span
        className="absolute inset-x-[14%] flex items-center justify-center truncate px-1 text-center text-[11px] font-medium text-ink sm:text-xs"
        style={{ top: "60%", height: "15%" }}
      >
        {player.name}
        {!player.connected && !player.eliminated && <span className="ml-1 text-ink-muted">⚠</span>}
      </span>

      {(() => {
        const maxLives = Math.max(player.maxLives, 1);
        const heartWidthPct = Math.min(
          HEART_MAX_WIDTH_PCT,
          (HEART_ROW_BUDGET_PCT - HEART_GAP_PCT * (maxLives - 1)) / maxLives
        );
        const heartHeightPct = heartWidthPct * CARD_ASPECT;
        const heartsTopPct = HEARTS_CENTER_Y_PCT - heartHeightPct / 2;
        return (
          <div
            className="absolute inset-x-0 flex items-center justify-center"
            style={{ top: `${heartsTopPct}%`, height: `${heartHeightPct}%`, gap: `${HEART_GAP_PCT}%` }}
          >
            {player.eliminated ? (
              <span className="text-[10px] text-crimson-bright">éliminé(e)</span>
            ) : (
              Array.from({ length: maxLives }, (_, i) => (
                <div key={i} className="relative aspect-square h-full">
                  <Image
                    src={i < player.lives ? "/play/heart-filled.png" : "/play/heart-empty.png"}
                    alt=""
                    fill
                    className={`object-contain ${i < player.lives ? "" : "opacity-60"}`}
                  />
                </div>
              ))
            )}
          </div>
        );
      })()}
    </div>
  );
}
