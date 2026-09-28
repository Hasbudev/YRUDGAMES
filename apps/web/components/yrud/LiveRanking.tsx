"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicPlayer, RevealResult } from "@yrud/shared";
import { ClanBadge } from "./ClanBadge";

const ROW_H = 48;
const ROW_GAP = 6;
const PITCH = ROW_H + ROW_GAP;
// Beat between "here's what each answer earned" (chips pop, bars still at
// their old values) and the rows actually sliding to their new places.
const SETTLE_DELAY_MS = 1100;

interface LiveRankingProps {
  players: PublicPlayer[];
  // Only meaningful while phase is "reveal" — the movement this question caused.
  lastReveal?: RevealResult;
  revealing: boolean;
  // Identifies which question's reveal is on screen, so a fresh reveal
  // restarts the animation but a mere re-sync of the same one doesn't.
  revealKey: string | null;
  answeredPlayerIds: string[];
  answering: boolean;
  myPlayerId?: string;
}

// Competition ranking (1, 1, 3): equal points share a place. Sort is stable
// on join order so tied players never swap places between renders.
function rankPlayers(players: PublicPlayer[], pointsOf: (p: PublicPlayer) => number) {
  const order = players.map((p, i) => ({ p, i, pts: pointsOf(p) })).sort((a, b) => b.pts - a.pts || a.i - b.i);
  const rankById = new Map<string, number>();
  order.forEach((entry, pos) => {
    const prev = order[pos - 1];
    rankById.set(entry.p.id, prev && prev.pts === entry.pts ? rankById.get(prev.p.id)! : pos + 1);
  });
  return { order, rankById };
}

function AnimatedNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);

  useEffect(() => {
    const from = shownRef.current;
    if (from === value) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 800);
      const eased = 1 - Math.pow(1 - t, 3);
      shownRef.current = t < 1 ? Math.round(from + (value - from) * eased) : value;
      setShown(shownRef.current);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{shown}</>;
}

const MEDAL = [
  "bg-gradient-to-b from-gold-bright to-gold text-void-deep",
  "bg-gradient-to-b from-slate-200 to-slate-400 text-void-deep",
  "bg-gradient-to-b from-amber-600 to-amber-800 text-white",
];

// The scoreboard as a live race: after every reveal you first see what each
// player just earned (+2 / −1 chips), then the bars grow and the rows slide
// into their new places, with ▲/▼ showing who climbed or dropped.
export function LiveRanking({
  players,
  lastReveal,
  revealing,
  revealKey,
  answeredPlayerIds,
  answering,
  myPlayerId,
}: LiveRankingProps) {
  const [seenKey, setSeenKey] = useState<string | null>(null);
  const [settled, setSettled] = useState(true);
  // Derived-state reset during render (not in an effect) so the very first
  // frame of a new reveal already shows the "before" order — an effect would
  // flash the "after" order for one frame first.
  if (revealKey !== seenKey) {
    setSeenKey(revealKey);
    setSettled(revealKey === null);
  }
  useEffect(() => {
    if (revealKey === null) return;
    const t = setTimeout(() => setSettled(true), SETTLE_DELAY_MS);
    return () => clearTimeout(t);
  }, [revealKey]);

  const resultById = new Map(lastReveal?.results.map((r) => [r.playerId, r]) ?? []);
  const deltaOf = (p: PublicPlayer) => (revealing ? (resultById.get(p.id)?.delta ?? 0) : 0);
  const beforeOf = (p: PublicPlayer) => p.points - deltaOf(p);

  const after = rankPlayers(players, (p) => p.points);
  const before = rankPlayers(players, beforeOf);
  const showAfter = settled || !revealing;
  const current = showAfter ? after : before;
  const shownPoints = (p: PublicPlayer) => (showAfter ? p.points : beforeOf(p));
  const maxPoints = Math.max(1, ...players.map(shownPoints));
  const answered = new Set(answeredPlayerIds);
  const posById = new Map(current.order.map((e, pos) => [e.p.id, pos]));

  if (players.length === 0) {
    return <p className="text-center text-sm text-ink-muted">Aucun joueur pour l&apos;instant.</p>;
  }

  return (
    <div className="relative w-full" style={{ height: players.length * PITCH - ROW_GAP }}>
      {players.map((p) => {
        const pos = posById.get(p.id) ?? 0;
        const rank = current.rankById.get(p.id) ?? pos + 1;
        const result = resultById.get(p.id);
        const delta = deltaOf(p);
        const moved = revealing && settled ? (before.rankById.get(p.id) ?? rank) - (after.rankById.get(p.id) ?? rank) : 0;
        const isMe = p.id === myPlayerId;
        const verdict = revealing && result ? (result.correct ? "correct" : "wrong") : null;

        return (
          <div
            key={p.id}
            className={`absolute inset-x-0 top-0 overflow-hidden rounded-xl border bg-void-deep/70 ${
              isMe ? "border-gold-bright shadow-[0_0_14px_rgba(232,193,90,0.35)]" : "border-border"
            } ${!p.connected ? "opacity-60" : ""}`}
            style={{
              height: ROW_H,
              transform: `translateY(${pos * PITCH}px)`,
              transition: "transform 900ms cubic-bezier(0.22, 1, 0.36, 1)",
              zIndex: players.length - pos,
            }}
          >
            <div
              className={`absolute inset-y-0 left-0 ${
                rank === 1 ? "bg-gold/30" : "bg-purple/25"
              }`}
              style={{
                width: `${(shownPoints(p) / maxPoints) * 100}%`,
                transition: "width 900ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            />
            {verdict && (
              <div
                className={`absolute inset-y-0 left-0 w-1 ${verdict === "correct" ? "bg-emerald-400" : "bg-crimson-bright"}`}
              />
            )}
            <div className="relative flex h-full items-center gap-2 px-2 sm:gap-3 sm:px-3">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-xs font-black ${
                  MEDAL[rank - 1] ?? "border border-border bg-void-deep text-ink-muted"
                }`}
              >
                {rank}
              </span>
              <ClanBadge clanId={p.clan} seed={p.id} size={28} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                {p.name}
                {isMe && <span className="ml-1 text-[10px] font-bold uppercase text-gold-bright">toi</span>}
                {!p.connected && <span className="ml-1 text-ink-muted">⚠</span>}
              </span>
              {answering && answered.has(p.id) && (
                <span title="A répondu" className="text-xs font-bold text-gold-bright">
                  ✓
                </span>
              )}
              {moved !== 0 && (
                <span className={`text-xs font-bold ${moved > 0 ? "text-emerald-400" : "text-crimson-bright"}`}>
                  {moved > 0 ? "▲" : "▼"}
                  {Math.abs(moved)}
                </span>
              )}
              {revealing && result && (
                <span
                  className={`rounded-md px-1.5 py-0.5 text-xs font-black tabular-nums ${
                    delta > 0
                      ? "bg-emerald-400/20 text-emerald-300"
                      : delta < 0
                        ? "bg-crimson/25 text-crimson-bright"
                        : "bg-void-deep text-ink-muted"
                  }`}
                >
                  {delta > 0 ? `+${delta}` : delta < 0 ? `−${Math.abs(delta)}` : "0"}
                </span>
              )}
              <span className="w-12 text-right font-display text-lg font-black tabular-nums text-gold-bright">
                <AnimatedNumber value={shownPoints(p)} />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
