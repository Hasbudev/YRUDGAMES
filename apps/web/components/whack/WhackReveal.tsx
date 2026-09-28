"use client";

import { useEffect } from "react";
import type { PlayerRevealResult, PublicPlayer } from "@yrud/shared";
import { playCorrect, playWrong } from "@/lib/sfx";
import { OrnatePanel } from "@/components/quiz/OrnatePanel";
import { signed } from "@/lib/roundRules";

interface WhackRevealProps {
  results: PlayerRevealResult[];
  players: PublicPlayer[];
  myPlayerId?: string;
}

// End of a chasse-taupes: what the player scored, and who tapped best.
export function WhackReveal({ results, players, myPlayerId }: WhackRevealProps) {
  const mine = results.find((r) => r.playerId === myPlayerId);
  const ranking = [...results].sort((a, b) => b.delta - a.delta).slice(0, 5);
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "?";

  useEffect(() => {
    if (!mine) return;
    if (mine.delta > 0) playCorrect();
    else playWrong();
  }, [mine]);

  return (
    <OrnatePanel className="w-full max-w-2xl">
      <div className="flex flex-col items-center gap-4">
        <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-gold-dim">Chasse-taupes terminée</p>
        {mine && (
          <p className="font-display text-glow-gold text-4xl font-black text-gold-bright">
            {signed(mine.delta)} pt{Math.abs(mine.delta) === 1 ? "" : "s"}
          </p>
        )}
        <ol className="flex w-full flex-col gap-2">
          {ranking.map((r, i) => (
            <li
              key={r.playerId}
              className={`flex items-center gap-3 rounded-xl border px-4 py-2 ${
                r.playerId === myPlayerId ? "border-gold bg-gold/10" : "border-border bg-void-deep/40"
              }`}
            >
              <span className="w-6 font-display font-black text-gold-dim">{i + 1}</span>
              <span className="flex-1 font-medium text-ink">{nameOf(r.playerId)}</span>
              <span className="font-display font-black tabular-nums text-gold-bright">{signed(r.delta)}</span>
            </li>
          ))}
        </ol>
        {mine && (
          <p className="text-sm text-ink-muted">
            Total : {mine.points} pt{mine.points === 1 ? "" : "s"}.
          </p>
        )}
      </div>
    </OrnatePanel>
  );
}
