"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import type { EventSummary } from "@yrud/shared";
import { AvatarIcon } from "@/components/yrud/AvatarIcon";

const PLACEMENT_LABEL: Record<number, string> = { 1: "1er", 2: "2e", 3: "3e" };

function placementLabel(placement: number): string {
  return PLACEMENT_LABEL[placement] ?? `${placement}e`;
}

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
  const podiumHeight: Record<number, string> = { 1: "h-36", 2: "h-24", 3: "h-16" };
  const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean); // 2nd, 1st, 3rd left-to-right

  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-8 py-4">
      <h2 className="font-display text-glow-gold text-3xl font-black text-gold-bright">Résumé de la soirée</h2>

      <div ref={podiumRef} className="flex w-full items-end justify-center gap-4">
        {podiumOrder.map((entry) => (
          <div key={entry.playerId} className="flex flex-col items-center gap-2">
            <AvatarIcon avatarId={entry.avatarId} seed={entry.playerId} size={entry.placement === 1 ? 56 : 44} />
            <span className={`max-w-[7rem] truncate text-center text-sm font-bold ${entry.playerId === myPlayerId ? "text-gold-bright" : "text-ink"}`}>
              {entry.name}
            </span>
            <span className="text-xs text-ink-muted">{entry.correctAnswers} bonne(s) réponse(s)</span>
            <div
              className={`flex w-24 items-start justify-center rounded-t-lg border-t-2 border-x-2 border-gold/40 bg-gradient-to-b from-gold/25 to-purple/10 pt-2 ${podiumHeight[entry.placement] ?? "h-12"}`}
            >
              <span className="font-display text-lg font-black text-gold-bright">{placementLabel(entry.placement)}</span>
            </div>
          </div>
        ))}
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
        {summary.speedRoundBonusWinnerIds.length > 0 && (
          <div className="panel col-span-2 rounded-xl p-3 text-center sm:col-span-1">
            <p className="text-sm font-bold text-gold-bright">Vie bonus</p>
            <p className="text-xs text-ink-muted">
              {summary.standings
                .filter((s) => summary.speedRoundBonusWinnerIds.includes(s.playerId))
                .map((s) => s.name)
                .join(", ")}
            </p>
          </div>
        )}
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
