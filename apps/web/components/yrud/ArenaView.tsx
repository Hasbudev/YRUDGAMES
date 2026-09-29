"use client";

import { useState } from "react";
import Image from "next/image";
import type { ArenaSnapshot } from "@yrud/shared";
import { PlayerToken } from "./PlayerToken";
import { LiveRanking } from "./LiveRanking";

interface ArenaViewProps {
  snapshot: ArenaSnapshot;
  myPlayerId?: string;
}

export function ArenaView({ snapshot, myPlayerId }: ArenaViewProps) {
  // The ranking is the easier read, so it's the default; the player cards
  // (with their answer/verdict animations) stay one tap away.
  const [view, setView] = useState<"ranking" | "cards">("ranking");
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
            {answeredSet.size} /{" "}
            {snapshot.answeringClan
              ? snapshot.players.filter((p) => p.clan === snapshot.answeringClan).length
              : playerCount}{" "}
            ont répondu
          </span>
        )}
        <div className="flex overflow-hidden rounded-lg border border-border text-xs font-semibold">
          {(["ranking", "cards"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3 py-1 transition-colors ${
                view === v ? "bg-gold text-void-deep" : "text-ink-muted hover:text-ink"
              }`}
            >
              {v === "ranking" ? "Classement" : "Cartes"}
            </button>
          ))}
        </div>
      </div>
      {view === "ranking" ? (
        <LiveRanking
          players={snapshot.players}
          lastReveal={snapshot.lastReveal}
          revealing={snapshot.phase === "reveal" && Boolean(snapshot.lastReveal)}
          revealKey={snapshot.phase === "reveal" && snapshot.lastReveal ? (snapshot.question?.id ?? "reveal") : null}
          answeredPlayerIds={snapshot.answeredPlayerIds}
          answering={snapshot.phase === "question"}
          myPlayerId={myPlayerId}
        />
      ) : (
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
      )}
    </div>
  );
}
