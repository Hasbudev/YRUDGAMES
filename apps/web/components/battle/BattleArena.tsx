"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import type { BattleLogEntry, BattleSnapshot, BattleStatus } from "@yrud/shared";
import { FieldEffectOverlay } from "./FieldEffectOverlay";
import { EffectIndicators } from "./EffectIndicators";
import { TurnIndicator } from "./TurnIndicator";
import { PokemonSprite } from "./PokemonSprite";
import { SpriteFlipbook } from "@/components/vfx/SpriteFlipbook";
import { playCorrect, playElimination, playDuelHit } from "@/lib/sfx";

const STATUS_GLOW: Record<BattleStatus, string> = {
  brn: "rgba(224,101,44,0.9)",
  psn: "rgba(168,85,247,0.9)",
  tox: "rgba(124,31,162,0.9)",
  par: "rgba(234,179,8,0.9)",
  frz: "rgba(103,232,249,0.9)",
  slp: "rgba(148,163,184,0.9)",
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

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

interface ArenaPokemonProps {
  species: string | undefined;
  fainted: boolean | undefined;
  facing: "front" | "back";
  corner: "bottom-left" | "top-right";
  spriteRef: React.RefObject<HTMLDivElement | null>;
}

function ArenaPokemon({ species, fainted, facing, corner, spriteRef }: ArenaPokemonProps) {
  const posClass =
    corner === "bottom-left"
      ? "bottom-[8%] left-[10%] sm:left-[14%]"
      : "right-[10%] top-[10%] sm:right-[14%]";
  return (
    <div className={`pointer-events-none absolute h-28 w-28 sm:h-40 sm:w-40 ${posClass}`}>
      {/* Ground contact shadow — grounds the sprite instead of floating */}
      <div className="absolute bottom-1 left-1/2 h-5 w-24 -translate-x-1/2 rounded-[50%] bg-black/40 blur-[3px] sm:w-32" />
      {species && (
        <div ref={spriteRef} className="relative h-full w-full">
          <PokemonSprite species={species} facing={facing} fainted={fainted} className="drop-shadow-[0_10px_16px_rgba(0,0,0,0.55)]" />
        </div>
      )}
    </div>
  );
}

interface FloatingText {
  key: number;
  text: string;
  side: "near" | "far";
  tone: "good" | "bad";
}

interface ImpactBurst {
  key: number;
  side: "near" | "far";
}

interface BattleArenaProps {
  snapshot: BattleSnapshot;
  log: BattleLogEntry[];
  /** Which side renders bottom-left/large (the viewer's own side). Spectators default to p1. */
  viewerSide: "p1" | "p2";
  showVs?: boolean;
}

export function BattleArena({ snapshot, log, viewerSide, showVs }: BattleArenaProps) {
  const nearRef = useRef<HTMLDivElement>(null);
  const farRef = useRef<HTMLDivElement>(null);
  const [banner, setBanner] = useState<{ text: string; key: number } | null>(null);
  const [floaters, setFloaters] = useState<FloatingText[]>([]);
  const [impacts, setImpacts] = useState<ImpactBurst[]>([]);
  const impactCounter = useRef(0);
  // Which move is currently resolving — lets the "damage" beat (which only
  // carries target/hpPercent, not the move that caused it) look up whether
  // this specific hit deserves a dedicated impact VFX.
  const lastMoveRef = useRef<string | null>(null);
  // Tracks the *object* last animated, not a raw index — `log` is a capped,
  // sliding-window array (oldest entries drop off once the cap is hit), so a
  // plain length-based cursor desyncs the moment trimming starts: the cursor
  // keeps climbing but the array's contents shift under it, and once the
  // array length plateaus at the cap, `log.slice(cursor)` returns nothing
  // forever — every animation past that point silently stops firing.
  const lastAnimatedEntry = useRef<BattleLogEntry | null>(null);
  const bannerCounter = useRef(0);
  const floaterCounter = useRef(0);
  const queueRef = useRef<BattleLogEntry[]>([]);
  const processingRef = useRef(false);

  const opponentSide: "p1" | "p2" = viewerSide === "p1" ? "p2" : "p1";
  const near = snapshot[viewerSide];
  const far = snapshot[opponentSide];

  function nameOf(side: string) {
    return side === "p1" ? snapshot.p1.name : side === "p2" ? snapshot.p2.name : side;
  }

  function spawnFloater(text: string, side: "near" | "far", tone: "good" | "bad") {
    floaterCounter.current += 1;
    const key = floaterCounter.current;
    setFloaters((prev) => [...prev, { key, text, side, tone }]);
    setTimeout(() => setFloaters((prev) => prev.filter((f) => f.key !== key)), 1200);
  }

  function spawnImpact(side: "near" | "far") {
    impactCounter.current += 1;
    const key = impactCounter.current;
    setImpacts((prev) => [...prev, { key, side }]);
    setTimeout(() => setImpacts((prev) => prev.filter((i) => i.key !== key)), 400);
  }

  // Every distinct beat (a move, damage landing, a status taking hold, a
  // stat change...) gets its own dedicated moment on screen instead of all
  // updates in one server broadcast firing at once — otherwise the first
  // half of a turn (whoever moved first) is overwritten before it's ever
  // rendered, and the fight reads as if moves are being skipped.
  async function animateEntry(entry: BattleLogEntry) {
    if (entry.kind === "move") {
      lastMoveRef.current = entry.move;
      bannerCounter.current += 1;
      const key = bannerCounter.current;
      setBanner({ text: `${nameOf(entry.actor)} — ${entry.move} !`, key });
      await sleep(950);
      setBanner((prev) => (prev?.key === key ? null : prev));
      await sleep(120);
      return;
    }
    if (entry.kind === "damage") {
      const isNear = entry.target === viewerSide;
      const ref = isNear ? nearRef.current : farRef.current;
      if (ref) {
        playDuelHit();
        const tl = gsap.timeline();
        tl.to(ref, { x: isNear ? -8 : 8, duration: 0.05, repeat: 5, yoyo: true }, 0);
        tl.fromTo(ref, { filter: "brightness(2.2) saturate(0)" }, { filter: "brightness(1)", duration: 0.3 }, 0);
      }
      if (lastMoveRef.current === "Close Combat") spawnImpact(isNear ? "near" : "far");
      spawnFloater(`${entry.hpPercent}% PV`, isNear ? "near" : "far", "bad");
      await sleep(500);
      return;
    }
    if (entry.kind === "faint") {
      const isNear = entry.target === viewerSide;
      const ref = isNear ? nearRef.current : farRef.current;
      if (ref) {
        playElimination();
        // Only the drop/rotate is animated here — PokemonSprite's own
        // `fainted` class handles the opacity fade (via the updated
        // snapshot), so stacking a second opacity tween on this wrapper
        // would multiply the two together and leave the sprite nearly
        // invisible instead of just dimmed.
        await new Promise<void>((resolve) => {
          gsap.to(ref, {
            y: 24,
            rotation: isNear ? -12 : 12,
            duration: 0.5,
            ease: "power2.in",
            onComplete: resolve,
          });
        });
      }
      await sleep(300);
      return;
    }
    if (entry.kind === "switch") {
      const isNear = entry.actor === viewerSide;
      const ref = isNear ? nearRef.current : farRef.current;
      if (ref) {
        gsap.set(ref, { y: 0, rotation: 0, opacity: 1, filter: "brightness(1)" });
        gsap.fromTo(ref, { opacity: 0, y: 26, scale: 0.75 }, { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "back.out(1.7)" });
      }
      await sleep(500);
      return;
    }
    if (entry.kind === "boost") {
      const isNear = entry.target === viewerSide;
      const ref = isNear ? nearRef.current : farRef.current;
      const rising = entry.amount > 0;
      const glow = rising ? "drop-shadow(0 0 14px rgba(232,193,90,0.9))" : "drop-shadow(0 0 14px rgba(106,95,214,0.9))";
      if (ref) {
        gsap
          .timeline()
          .to(ref, { scale: 1.12, duration: 0.15, ease: "power1.out" }, 0)
          .to(ref, { scale: 1, duration: 0.25, ease: "power1.in" }, 0.15)
          .fromTo(ref, { filter: glow }, { filter: "none", duration: 0.6 }, 0);
      }
      const statLabel = STAT_ABBR[entry.stat] ?? entry.stat.toUpperCase();
      spawnFloater(`${statLabel} ${rising ? "+" : ""}${entry.amount}`, isNear ? "near" : "far", rising ? "good" : "bad");
      await sleep(700);
      return;
    }
    if (entry.kind === "status") {
      const isNear = entry.target === viewerSide;
      const ref = isNear ? nearRef.current : farRef.current;
      if (ref) {
        const glow = `drop-shadow(0 0 16px ${STATUS_GLOW[entry.status]})`;
        gsap.fromTo(ref, { filter: glow }, { filter: "none", duration: 0.9, ease: "power2.out" });
      }
      spawnFloater(entry.status.toUpperCase(), isNear ? "near" : "far", "bad");
      await sleep(650);
      return;
    }
    if (entry.kind === "win" || entry.kind === "tie") {
      playCorrect();
      return;
    }
    // weather / fieldstart / turn / text / sidestart / sideend / ability /
    // item / enditem / volatilestart / volatileend / terastallize / cant —
    // reflected elsewhere (HUD, log), no dedicated arena beat, but still
    // worth a brief pause so the pacing of the whole turn doesn't feel
    // instantaneous.
    await sleep(120);
  }

  async function drainQueue() {
    if (processingRef.current) return;
    processingRef.current = true;
    while (queueRef.current.length > 0) {
      const entry = queueRef.current.shift();
      if (entry) await animateEntry(entry);
    }
    processingRef.current = false;
  }

  useEffect(() => {
    if (log.length === 0) {
      lastAnimatedEntry.current = null; // new battle, log reset
      return;
    }
    const cursorIdx = lastAnimatedEntry.current ? log.indexOf(lastAnimatedEntry.current) : -1;
    // cursorIdx === -1 covers both "nothing animated yet" and "the last
    // entry we saw already fell off the front of the capped array" — in
    // both cases everything currently in `log` is unseen from here.
    const newEntries = cursorIdx === -1 ? log : log.slice(cursorIdx + 1);
    lastAnimatedEntry.current = log[log.length - 1];
    if (newEntries.length === 0) return;
    queueRef.current.push(...newEntries);
    void drainQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log]);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-gold/30 shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
      {/* background */}
      <Image src="/fight/arena-bg.png" alt="" fill sizes="900px" priority className="object-cover" />

      {/* environment-effects (weather/field, pointer-events: none) */}
      <FieldEffectOverlay field={snapshot.field} />

      {/* pokemon-layer, on its own ground decal */}
      <div className="relative aspect-[16/9] w-full sm:aspect-[2/1]">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2">
          <Image src="/fight/arena-ground.png" alt="" fill sizes="900px" className="object-contain object-bottom opacity-90" />
        </div>

        <ArenaPokemon species={near.active?.species} fainted={near.active?.fainted} facing="back" corner="bottom-left" spriteRef={nearRef} />
        <ArenaPokemon species={far.active?.species} fainted={far.active?.fainted} facing="front" corner="top-right" spriteRef={farRef} />

        {/* battle-animation-layer */}
        {banner && (
          <p
            key={banner.key}
            className="pointer-events-none absolute left-1/2 top-[14%] z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-4 py-1.5 text-sm font-bold text-white"
            style={{ animation: "move-banner-in 1.1s ease-out" }}
          >
            {banner.text}
          </p>
        )}
        {floaters.map((f) => (
          <span
            key={f.key}
            className={`pointer-events-none absolute z-20 font-display text-sm font-black sm:text-base ${
              f.tone === "good" ? "text-emerald-300" : "text-crimson-bright"
            } ${f.side === "near" ? "bottom-[30%] left-[18%] sm:left-[22%]" : "right-[18%] top-[24%] sm:right-[22%]"}`}
            style={{ animation: "float-up-fade 1.2s ease-out forwards", textShadow: "0 2px 6px rgba(0,0,0,0.8)" }}
          >
            {f.text}
          </span>
        ))}
        {impacts.map((imp) => (
          <div
            key={imp.key}
            className={`pointer-events-none absolute z-20 h-28 sm:h-40 ${
              imp.side === "near" ? "bottom-[8%] left-[10%] sm:left-[14%]" : "right-[10%] top-[10%] sm:right-[14%]"
            }`}
          >
            <SpriteFlipbook src="/fight/fight.png" frameCount={6} frameWidth={362} frameHeight={724} fps={22} className="h-full" />
          </div>
        ))}
        {showVs && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ animation: "scene-enter 0.4s ease-out" }}>
            <Image src="/fight/vs-badge.png" alt="VS" width={107} height={107} className="h-16 w-16 drop-shadow-[0_0_20px_rgba(232,193,90,0.5)] sm:h-24 sm:w-24" />
          </div>
        )}

        {/* arena-hud */}
        <div className="pointer-events-none absolute inset-x-0 top-2 flex flex-col items-center gap-1.5 sm:top-3">
          <TurnIndicator turn={snapshot.field.turn} />
          <EffectIndicators field={snapshot.field} />
        </div>
      </div>

      {snapshot.ended && (
        <p className="relative border-t border-gold/20 bg-void-deep/80 py-2 text-center font-display text-base font-bold text-gold-bright">
          {snapshot.winnerId
            ? `${snapshot.p1.playerId === snapshot.winnerId ? snapshot.p1.name : snapshot.p2.name} remporte la bataille !`
            : "Match nul — aucun des deux Pokémon n'a survécu !"}
        </p>
      )}
    </div>
  );
}
