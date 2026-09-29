"use client";

import { useState } from "react";
import type { PublicPlayer, StealState } from "@yrud/shared";
import { ClanBadge } from "@/components/yrud/ClanBadge";

interface StealPanelProps {
  steal: StealState;
  players: PublicPlayer[];
  myPlayerId?: string;
  onSteal?: (victimId: string) => void;
}

// Manche 4 — after each question, the fastest right answer picks who to rob.
export function StealPanel({ steal, players, myPlayerId, onSteal }: StealPanelProps) {
  const [sent, setSent] = useState(false);
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "?";
  const myTurn = !!myPlayerId && steal.pendingIds.includes(myPlayerId) && !!onSteal && !sent;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-3 rounded-2xl border-2 border-gold bg-gold/10 p-4">
      <p className="text-center font-display text-lg font-black text-gold-bright">
        🦹 {myTurn ? `Tu as trouvé en premier ! Vole ${steal.amount} pts à qui tu veux :` : "Le plus rapide vole des points !"}
      </p>
      {myTurn && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {players
            .filter((p) => p.id !== myPlayerId)
            .sort((a, b) => b.points - a.points)
            .map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSent(true);
                  onSteal?.(p.id);
                }}
                className="flex items-center gap-2 rounded-xl border border-border bg-void-deep/60 px-3 py-2 text-left transition-colors hover:border-crimson"
              >
                <ClanBadge clanId={p.clan} seed={p.id} size={24} />
                <span className="flex-1 text-ink">{p.name}</span>
                <span className="font-display font-bold text-gold-bright">{p.points} pts</span>
              </button>
            ))}
        </div>
      )}
      {!myTurn && steal.pendingIds.length > 0 && (
        <p className="text-center text-sm text-ink-muted">
          {steal.pendingIds.map(nameOf).join(", ")} choisit sa victime...
        </p>
      )}
      {steal.done.map((d) => (
        <p key={d.thiefId} className="text-center font-display font-bold text-ink">
          {nameOf(d.thiefId)} a volé {d.amount} pt{d.amount === 1 ? "" : "s"} à {nameOf(d.victimId)} !
        </p>
      ))}
    </div>
  );
}
