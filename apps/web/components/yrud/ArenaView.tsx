"use client";

import Image from "next/image";
import type { ArenaSnapshot } from "@yrud/shared";
import { PlayerToken } from "./PlayerToken";

interface ArenaViewProps {
  snapshot: ArenaSnapshot;
}

export function ArenaView({ snapshot }: ArenaViewProps) {
  const verdictByPlayer = new Map<string, "correct" | "wrong">();
  if (snapshot.lastReveal) {
    for (const r of snapshot.lastReveal.results) {
      verdictByPlayer.set(r.playerId, r.correct ? "correct" : "wrong");
    }
  }
  const answeredSet = new Set(snapshot.answeredPlayerIds);
  const playerCount = snapshot.players.length;

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative h-8 w-36 shrink-0 sm:h-9 sm:w-40">
            <Image src="/play/arene-badge.png" alt="" fill sizes="160px" className="object-contain" />
          </div>
          <span className="font-display text-sm font-bold text-gold-bright sm:text-base">{playerCount}</span>
        </div>
        {snapshot.phase === "question" && (
          <span className="text-xs text-ink-muted">
            {answeredSet.size} / {playerCount} ont répondu
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {snapshot.players.map((player) => (
          <PlayerToken
            key={player.id}
            player={player}
            revealVerdict={verdictByPlayer.get(player.id) ?? null}
            hasAnswered={snapshot.phase === "question" && answeredSet.has(player.id)}
          />
        ))}
      </div>
    </div>
  );
}
