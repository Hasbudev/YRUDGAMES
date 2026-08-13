"use client";

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
  const speedScoreByPlayer = new Map(
    (snapshot.speedRound?.scoreboard ?? []).map((s) => [s.playerId, s.correct])
  );
  const aliveCount = snapshot.players.filter((p) => !p.eliminated).length;

  return (
    <div className="w-full max-w-2xl">
      <h2 className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gold-dim">
        <span>Arène — {aliveCount} en vie</span>
        {snapshot.phase === "question" && (
          <span>
            {answeredSet.size} / {aliveCount} ont répondu
          </span>
        )}
        {snapshot.phase === "speed" && <span>Manche rapide en cours</span>}
      </h2>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {snapshot.players.map((player) => (
          <PlayerToken
            key={player.id}
            player={player}
            revealVerdict={verdictByPlayer.get(player.id) ?? null}
            hasAnswered={snapshot.phase === "question" && answeredSet.has(player.id)}
            speedScore={snapshot.phase === "speed" ? (speedScoreByPlayer.get(player.id) ?? 0) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
