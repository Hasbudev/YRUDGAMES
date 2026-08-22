"use client";

import { useEffect, useState } from "react";
import type { BattleMoveOption } from "@yrud/shared";
import { MoveCard } from "./MoveCard";

interface MoveSelectorProps {
  moves: BattleMoveOption[];
  onChoose: (moveIndex: number) => void;
}

export function MoveSelector({ moves, onChoose }: MoveSelectorProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);

  // A fresh set of moves means a new request came in — the previous pick
  // already resolved, so any "waiting" glow should clear.
  useEffect(() => {
    setPendingId(null);
  }, [moves]);

  return (
    <div>
      <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-widest text-gold-dim">
        Choisissez une attaque
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {moves.map((m, i) => (
          <MoveCard
            key={m.id}
            move={m}
            selected={pendingId === m.id}
            disabled={pendingId !== null}
            onChoose={() => {
              setPendingId(m.id);
              onChoose(i + 1);
            }}
          />
        ))}
      </div>
    </div>
  );
}
