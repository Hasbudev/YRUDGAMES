"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import type { EventSummary } from "@yrud/shared";
import { AvatarIcon } from "@/components/yrud/AvatarIcon";
import { Podium, placementLabel } from "@/components/site/Podium";

interface EndGameSummaryProps {
  summary: EventSummary;
  myPlayerId?: string | null;
}

export function EndGameSummary({ summary, myPlayerId }: EndGameSummaryProps) {
  const podiumRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (podiumRef.current) {
      gsap.fromTo(
        podiumRef.current.children,
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.55, stagger: 0.15, ease: "back.out(1.6)" }
      );
    }
    if (statsRef.current) {
      gsap.fromTo(
        statsRef.current.children,
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4, stagger: 0.08, delay: 0.4, ease: "power2.out" }
      );
    }
  }, []);

  const podium = summary.standings.slice(0, 3);
  const rest = summary.standings.slice(3);

  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-8 py-4">
      <h2 className="font-display text-glow-gold text-3xl font-black text-gold-bright">Résumé de la soirée</h2>

      <div ref={podiumRef} className="w-full">
        <Podium
          entries={podium.map((entry) => ({
            id: entry.playerId,
            name: entry.name,
            avatarSeed: entry.playerId,
            avatarId: entry.avatarId,
            rank: entry.placement,
            statLabel: `${entry.correctAnswers} bonne(s) réponse(s)`,
            highlight: entry.playerId === myPlayerId,
          }))}
        />
      </div>

      {rest.length > 0 && (
        <ol className="flex w-full max-w-md flex-col gap-1 text-sm">
          {rest.map((entry) => (
            <li
              key={entry.playerId}
              className={`flex items-center justify-between rounded-lg px-3 py-1.5 ${
                entry.playerId === myPlayerId ? "bg-gold/10 text-gold-bright" : "text-ink-muted"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="font-mono text-xs">{placementLabel(entry.placement)}</span>
                <AvatarIcon avatarId={entry.avatarId} seed={entry.playerId} size={22} />
                {entry.name}
              </span>
              <span className="text-xs">{entry.correctAnswers} bonne(s) réponse(s)</span>
            </li>
          ))}
        </ol>
      )}

      <div ref={statsRef} className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="panel rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-gold-bright">{summary.totalQuestions}</p>
          <p className="text-xs text-ink-muted">questions posées</p>
        </div>
        <div className="panel rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-purple">
            {summary.duelRecord.yrudWins} – {summary.duelRecord.opponentWins}
          </p>
          <p className="text-xs text-ink-muted">duels : Yrud vs challengers</p>
        </div>
        <div className="panel rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-crimson-bright">{summary.tauntCount + summary.prankCount}</p>
          <p className="text-xs text-ink-muted">provocations &amp; frayeurs de Yrud</p>
        </div>
        {summary.finalBattleWinnerName && (
          <div className="panel col-span-2 rounded-xl p-3 text-center sm:col-span-2">
            <p className="text-sm font-bold text-gold-bright">Bataille finale</p>
            <p className="text-xs text-ink-muted">{summary.finalBattleWinnerName} a remporté le combat Pokémon !</p>
          </div>
        )}
      </div>
    </div>
  );
}
