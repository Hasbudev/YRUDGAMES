"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import type { BattleLogEntry, BattleSideSnapshot, BattleSnapshot } from "@yrud/shared";
import { FieldEffectOverlay } from "./FieldEffectOverlay";
import { playCorrect, playElimination, playDuelHit } from "@/lib/sfx";

const STATUS_LABEL: Record<string, string> = {
  brn: "Brûlure",
  par: "Paralysie",
  slp: "Sommeil",
  frz: "Gel",
  psn: "Poison",
  tox: "Poison Grave",
};

const STAT_ABBR: Record<string, string> = {
  atk: "ATQ",
  def: "DEF",
  spa: "ATS",
  spd: "DFS",
  spe: "VIT",
  accuracy: "PRÉ",
  evasion: "ESQ",
};

function spriteUrl(species: string) {
  const id = species.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `https://play.pokemonshowdown.com/sprites/gen5/${id}.png`;
}

function DurationBadge({ label, durationTurns, tone }: { label: string; durationTurns: number | null; tone: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      {label}
      {durationTurns !== null && <span className="ml-1 opacity-70">({durationTurns} tour{durationTurns > 1 ? "s" : ""})</span>}
    </span>
  );
}

interface SideCardProps {
  side: BattleSideSnapshot;
  spriteRef: React.RefObject<HTMLDivElement | null>;
}

function SideCard({ side, spriteRef }: SideCardProps) {
  const active = side.active;
  return (
    <div className="relative flex flex-col items-center gap-2">
      <span className="max-w-[8rem] truncate font-display text-sm font-bold text-ink">{side.name}</span>
      {active ? (
        <>
          <div ref={spriteRef} className="relative h-28 w-28">
            {/* Platform the Pokémon stands on — grounds the sprite instead of floating in empty space */}
            <div className="absolute bottom-1 left-1/2 h-4 w-20 -translate-x-1/2 rounded-[50%] bg-black/40 blur-[2px]" />
            <Image
              src={spriteUrl(active.species)}
              alt={active.species}
              fill
              unoptimized
              className={`object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.5)] ${active.fainted ? "opacity-30 grayscale" : ""}`}
            />
          </div>
          <span className="text-xs text-ink-muted">{active.species}</span>
          <div className="h-2.5 w-32 overflow-hidden rounded-full border border-black/30 bg-void-deep">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${
                active.hpPercent > 50 ? "bg-gold" : active.hpPercent > 20 ? "bg-amber-500" : "bg-crimson-bright"
              }`}
              style={{ width: `${active.hpPercent}%` }}
            />
          </div>
          <div className="flex flex-wrap justify-center gap-1">
            {active.status && (
              <span className="rounded-full bg-crimson/20 px-2 py-0.5 text-[10px] font-semibold text-crimson-bright">
                {STATUS_LABEL[active.status] ?? active.status}
              </span>
            )}
            {Object.entries(active.boosts)
              .filter(([, stage]) => stage)
              .map(([stat, stage]) => (
                <span
                  key={stat}
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    (stage ?? 0) > 0 ? "bg-gold/25 text-gold-bright" : "bg-purple/25 text-purple"
                  }`}
                >
                  {STAT_ABBR[stat] ?? stat} {(stage ?? 0) > 0 ? "+" : ""}
                  {stage}
                </span>
              ))}
          </div>
        </>
      ) : (
        <span className="flex h-28 w-28 items-center justify-center text-xs text-ink-muted">En attente...</span>
      )}
      <span className="text-[10px] text-ink-muted">{side.remainingCount} Pokémon restant(s)</span>
    </div>
  );
}

interface BattleStageProps {
  snapshot: BattleSnapshot;
  log?: BattleLogEntry[];
}

export function BattleStage({ snapshot, log = [] }: BattleStageProps) {
  const p1SpriteRef = useRef<HTMLDivElement>(null);
  const p2SpriteRef = useRef<HTMLDivElement>(null);
  const [banner, setBanner] = useState<{ text: string; key: number } | null>(null);
  const lastAnimatedCount = useRef(0);
  const bannerCounter = useRef(0);

  useEffect(() => {
    if (log.length < lastAnimatedCount.current) lastAnimatedCount.current = 0; // new battle, log reset
    const newEntries = log.slice(lastAnimatedCount.current);
    lastAnimatedCount.current = log.length;
    if (newEntries.length === 0) return;

    for (const entry of newEntries) {
      if (entry.kind === "move") {
        bannerCounter.current += 1;
        setBanner({ text: `${entry.move} !`, key: bannerCounter.current });
        setTimeout(() => setBanner((prev) => (prev?.key === bannerCounter.current ? null : prev)), 1100);
      }
      if (entry.kind === "damage") {
        const ref = entry.target === "p1" ? p1SpriteRef : p2SpriteRef;
        if (ref.current) {
          playDuelHit();
          const tl = gsap.timeline();
          tl.to(ref.current, { x: entry.target === "p1" ? -8 : 8, duration: 0.05, repeat: 5, yoyo: true }, 0);
          tl.fromTo(ref.current, { filter: "brightness(2.2) saturate(0)" }, { filter: "brightness(1)", duration: 0.3 }, 0);
        }
      }
      if (entry.kind === "faint") {
        const ref = entry.target === "p1" ? p1SpriteRef : p2SpriteRef;
        if (ref.current) {
          playElimination();
          gsap.to(ref.current, { y: 24, opacity: 0.35, rotation: entry.target === "p1" ? -12 : 12, duration: 0.5, ease: "power2.in" });
        }
      }
      if (entry.kind === "switch") {
        const ref = entry.actor === "p1" ? p1SpriteRef : p2SpriteRef;
        if (ref.current) {
          gsap.set(ref.current, { y: 0, rotation: 0, opacity: 1, filter: "brightness(1)" });
          gsap.fromTo(
            ref.current,
            { opacity: 0, y: 26, scale: 0.75 },
            { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "back.out(1.7)" }
          );
        }
      }
      if (entry.kind === "boost") {
        const ref = entry.target === "p1" ? p1SpriteRef : p2SpriteRef;
        if (ref.current) {
          const glow = entry.amount > 0 ? "drop-shadow(0 0 14px rgba(232,193,90,0.9))" : "drop-shadow(0 0 14px rgba(106,95,214,0.9))";
          gsap
            .timeline()
            .to(ref.current, { scale: 1.12, duration: 0.15, ease: "power1.out" }, 0)
            .to(ref.current, { scale: 1, duration: 0.25, ease: "power1.in" }, 0.15)
            .fromTo(ref.current, { filter: glow }, { filter: "none", duration: 0.6 }, 0);
        }
      }
      if (entry.kind === "win") {
        playCorrect();
      }
    }
  }, [log]);

  return (
    <div className="panel relative w-full max-w-2xl overflow-hidden rounded-2xl p-6">
      <FieldEffectOverlay field={snapshot.field} />

      <div className="relative mb-4 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="rounded-full border border-border bg-void-deep/60 px-3 py-1 font-semibold text-gold-bright">
          Tour {snapshot.field.turn}
        </span>
        <div className="flex flex-wrap gap-2">
          {snapshot.field.weather && (
            <DurationBadge label={snapshot.field.weather.label} durationTurns={snapshot.field.weather.durationTurns} tone="bg-purple/25 text-purple" />
          )}
          {snapshot.field.terrain && (
            <DurationBadge label={snapshot.field.terrain.label} durationTurns={snapshot.field.terrain.durationTurns} tone="bg-emerald-500/20 text-emerald-300" />
          )}
          {snapshot.field.pseudoWeathers.map((e) => (
            <DurationBadge key={e.id} label={e.label} durationTurns={e.durationTurns} tone="bg-gold/20 text-gold-bright" />
          ))}
        </div>
      </div>

      {banner && (
        <p
          key={banner.key}
          className="pointer-events-none absolute left-1/2 top-16 z-10 -translate-x-1/2 rounded-full bg-black/70 px-4 py-1.5 text-sm font-bold text-white"
          style={{ animation: "move-banner-in 1.1s ease-out" }}
        >
          {banner.text}
        </p>
      )}

      <div className="relative flex items-center justify-between gap-4">
        <SideCard side={snapshot.p1} spriteRef={p1SpriteRef} />
        <span className="font-display text-lg font-black text-ink-muted">VS</span>
        <SideCard side={snapshot.p2} spriteRef={p2SpriteRef} />
      </div>

      {snapshot.winnerId && (
        <p className="relative mt-4 text-center font-display text-lg font-bold text-gold-bright">
          {snapshot.p1.playerId === snapshot.winnerId ? snapshot.p1.name : snapshot.p2.name} remporte la bataille !
        </p>
      )}
    </div>
  );
}
