"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import type { EventSummary, PublicPlayer } from "@yrud/shared";
import { ClanBadge } from "@/components/yrud/ClanBadge";
import { EndGameSummary } from "./EndGameSummary";

interface GrandFinaleScreenProps {
  /** null = the battle ended in a double-faint tie. */
  winnerId: string | null;
  players: PublicPlayer[];
  summary: EventSummary | null;
  myPlayerId?: string | null;
}

// The actual climax of the night — shown a few seconds after the Pokémon
// final battle ends (letting its own win banner/confetti play out first),
// spotlighting the champion before rolling into the full classement.
export function GrandFinaleScreen({ winnerId, players, summary, myPlayerId }: GrandFinaleScreenProps) {
  const winner = players.find((p) => p.id === winnerId);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!heroRef.current) return;
    gsap.fromTo(
      heroRef.current,
      { opacity: 0, y: -24, scale: 0.85 },
      { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: "back.out(1.6)" }
    );
  }, []);

  return (
    <div className="flex w-full flex-col items-center gap-8 py-4">
      <div ref={heroRef} className="relative flex flex-col items-center gap-3">
        <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/25 blur-3xl" />
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-gold-dim">Champion de la soirée</p>
        {winner ? (
          <>
            <ClanBadge
              clanId={winner.clan}
              seed={winner.id}
              size={120}
              className="border-4 drop-shadow-[0_0_40px_rgba(232,193,90,0.7)]"
            />
            <h1 className="text-glow-gold font-display text-4xl font-black text-gold-bright sm:text-5xl">
              🏆 {winner.name}
            </h1>
            <p className="text-sm text-ink-muted">remporte la Bataille Finale de Yrud !</p>
          </>
        ) : (
          <h1 className="font-display text-3xl font-black text-gold-bright">Bataille finale : match nul !</h1>
        )}
      </div>

      {summary && <EndGameSummary summary={summary} myPlayerId={myPlayerId} />}
    </div>
  );
}
