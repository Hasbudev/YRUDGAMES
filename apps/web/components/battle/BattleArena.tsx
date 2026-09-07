"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import type { BattleLogEntry, BattleSnapshot, BattleStatus } from "@yrud/shared";
import { FieldEffectOverlay } from "./FieldEffectOverlay";
import { EffectIndicators } from "./EffectIndicators";
import { TurnIndicator } from "./TurnIndicator";
import { PokemonSprite } from "./PokemonSprite";
import { HPBar } from "./HPBar";
import { StatusBadge } from "./StatusBadge";
import { typeColor } from "./typeTheme";
import { SpriteFlipbook } from "@/components/vfx/SpriteFlipbook";
import { playCorrect, playElimination, playDuelHit, playCrit } from "@/lib/sfx";

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

interface ArenaNameplateProps {
  species: string | undefined;
  hpPercent: number | undefined;
  status: BattleStatus | undefined;
  fainted: boolean | undefined;
  corner: "near" | "far";
}

function ArenaNameplate({ species, hpPercent, status, fainted, corner }: ArenaNameplateProps) {
  if (!species) return null;
  // Classic Pokémon-game HUD convention — each nameplate sits in the corner
  // *opposite* its own sprite (near sprite bottom-left -> its plate
  // bottom-right; far sprite top-right -> its plate top-left), so the box
  // never sits on top of the Pokémon it's describing.
  const posClass = corner === "near" ? "bottom-[4%] right-[4%] sm:right-[8%]" : "top-[4%] left-[4%] sm:left-[8%]";
  const shownPercent = fainted ? 0 : (hpPercent ?? 0);
  return (
    <div
      className={`pointer-events-none absolute z-10 w-32 rounded-lg border border-gold/25 bg-void-deep/75 px-2 py-1 backdrop-blur-sm sm:w-40 ${posClass}`}
    >
      <div className="mb-0.5 flex items-center justify-between gap-1">
        <span className="truncate text-[10px] font-bold text-ink sm:text-xs">{species}</span>
        {status && !fainted && <StatusBadge status={status} className="h-3.5 shrink-0" />}
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex-1">
          <HPBar hpPercent={shownPercent} size="sm" />
        </div>
        <span className="shrink-0 font-mono text-[9px] text-ink-muted sm:text-[10px]">{shownPercent}%</span>
      </div>
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

interface TypeBurst {
  key: number;
  side: "near" | "far";
  color: string;
  big?: boolean;
}

interface Projectile {
  key: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  isGrass?: boolean;
}

// One entry per source→target flight, animated on mount so adding a new
// projectile to the array is all the parent needs to do.
function TravelingProjectile({ p }: { p: Projectile }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(
      ref.current,
      { left: p.fromX, top: p.fromY, opacity: 0, scale: 0.6 },
      { left: p.toX, top: p.toY, opacity: 1, scale: 1, duration: 0.4, ease: "power1.in" }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={ref} className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2" style={{ left: p.fromX, top: p.fromY }}>
      {p.isGrass ? (
        <SpriteFlipbook src="/defi/leaf.png" frameCount={6} frameWidth={362} frameHeight={724} fps={24} className="h-10 sm:h-14" />
      ) : (
        <div
          className="h-6 w-6 rounded-full sm:h-8 sm:w-8"
          style={{
            background: `radial-gradient(circle, ${p.color} 0%, ${p.color}aa 55%, transparent 80%)`,
            boxShadow: `0 0 14px ${p.color}, 0 0 4px ${p.color}`,
          }}
        />
      )}
    </div>
  );
}

interface BattleArenaProps {
  snapshot: BattleSnapshot;
  log: BattleLogEntry[];
  /** Which side renders bottom-left/large (the viewer's own side). Spectators default to p1. */
  viewerSide: "p1" | "p2";
  showVs?: boolean;
}

export function BattleArena({ snapshot, log, viewerSide, showVs }: BattleArenaProps) {
  const arenaRef = useRef<HTMLDivElement>(null);
  const nearRef = useRef<HTMLDivElement>(null);
  const farRef = useRef<HTMLDivElement>(null);
  const [banner, setBanner] = useState<{ text: string; key: number; tone?: "normal" | "crit" } | null>(null);
  const [floaters, setFloaters] = useState<FloatingText[]>([]);
  const [impacts, setImpacts] = useState<ImpactBurst[]>([]);
  const impactCounter = useRef(0);
  const [typeBursts, setTypeBursts] = useState<TypeBurst[]>([]);
  const typeBurstCounter = useRef(0);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const projectileCounter = useRef(0);
  // Which move is currently resolving — lets the "damage" beat (which only
  // carries target/hpPercent, not the move that caused it) look up whether
  // this specific hit deserves a dedicated impact VFX, and what type-colored
  // flash to show for every other move.
  const lastMoveTypeRef = useRef<string | null>(null);
  // Set by a "crit"/"supereffective" entry, consumed by the "damage" entry
  // that immediately follows it in the same turn — the protocol always
  // emits them in that order (move -> [crit] -> [supereffective] -> damage).
  const pendingCritRef = useRef(false);
  const pendingSuperRef = useRef(false);
  const [screenFlash, setScreenFlash] = useState<number | null>(null);
  const screenFlashCounter = useRef(0);
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

  function centerOf(ref: HTMLDivElement | null): { x: number; y: number } | null {
    if (!ref || !arenaRef.current) return null;
    const r = ref.getBoundingClientRect();
    const a = arenaRef.current.getBoundingClientRect();
    return { x: r.left - a.left + r.width / 2, y: r.top - a.top + r.height / 2 };
  }

  // The actual "shot fired" beat — every type gets one of these instead of
  // the impact-only flash that used to be the whole animation, since a
  // burst that only appears on arrival is easy to miss entirely (which is
  // exactly what looked like "no animation at all" for anything that
  // wasn't Close Combat).
  function spawnProjectile(fromSide: "near" | "far", color: string, isGrass?: boolean) {
    const fromRef = fromSide === "near" ? nearRef.current : farRef.current;
    const toRef = fromSide === "near" ? farRef.current : nearRef.current;
    const from = centerOf(fromRef);
    const to = centerOf(toRef);
    if (!from || !to) return;
    projectileCounter.current += 1;
    const key = projectileCounter.current;
    setProjectiles((prev) => [...prev, { key, fromX: from.x, fromY: from.y, toX: to.x, toY: to.y, color, isGrass }]);
    setTimeout(() => setProjectiles((prev) => prev.filter((p) => p.key !== key)), 450);
  }

  function spawnTypeBurst(side: "near" | "far", color: string, big?: boolean) {
    typeBurstCounter.current += 1;
    const key = typeBurstCounter.current;
    setTypeBursts((prev) => [...prev, { key, side, color, big }]);
    setTimeout(() => setTypeBursts((prev) => prev.filter((b) => b.key !== key)), 450);
  }

  // Every distinct beat (a move, damage landing, a status taking hold, a
  // stat change...) gets its own dedicated moment on screen instead of all
  // updates in one server broadcast firing at once — otherwise the first
  // half of a turn (whoever moved first) is overwritten before it's ever
  // rendered, and the fight reads as if moves are being skipped.
  async function animateEntry(entry: BattleLogEntry) {
    if (entry.kind === "move") {
      lastMoveTypeRef.current = entry.moveType ?? null;
      const actorIsNear = entry.actor === viewerSide;
      const actorRef = actorIsNear ? nearRef.current : farRef.current;
      if (entry.moveType === "Fighting") {
        // A physical strike reads better as the attacker lunging in than
        // as a projectile — the existing fist-impact flipbook on arrival
        // (spawnImpact, keyed off the type below) sells the actual hit.
        if (actorRef) {
          gsap
            .timeline()
            .to(actorRef, { x: actorIsNear ? 26 : -26, duration: 0.18, ease: "power2.out" })
            .to(actorRef, { x: 0, duration: 0.22, ease: "power2.in" });
        }
      } else if (entry.moveType) {
        spawnProjectile(actorIsNear ? "near" : "far", typeColor(entry.moveType), entry.moveType === "Grass");
      }
      bannerCounter.current += 1;
      const key = bannerCounter.current;
      setBanner({ text: `${nameOf(entry.actor)} — ${entry.move} !`, key });
      await sleep(950);
      setBanner((prev) => (prev?.key === key ? null : prev));
      await sleep(120);
      return;
    }
    if (entry.kind === "crit") {
      pendingCritRef.current = true;
      return;
    }
    if (entry.kind === "supereffective") {
      pendingSuperRef.current = true;
      return;
    }
    if (entry.kind === "damage") {
      const isNear = entry.target === viewerSide;
      const ref = isNear ? nearRef.current : farRef.current;

      if (entry.isHeal) {
        // A heal is never a "hit" — no shake, no crit/type VFX, just a
        // gentle glow and a green tick so a passive item/ability reveal
        // (Leftovers, Black Sludge...) reads as good news, not an attack.
        pendingCritRef.current = false;
        pendingSuperRef.current = false;
        if (ref) {
          gsap.fromTo(ref, { filter: "brightness(1) drop-shadow(0 0 0 rgba(90,220,120,0))" }, { filter: "brightness(1) drop-shadow(0 0 12px rgba(90,220,120,0.8))", duration: 0.15, yoyo: true, repeat: 1 });
        }
        const label = entry.sourceLabel ? `+${entry.hpPercent}% PV (${entry.sourceLabel})` : `+${entry.hpPercent}% PV`;
        spawnFloater(label, isNear ? "near" : "far", "good");
        await sleep(450);
        return;
      }

      const isCrit = pendingCritRef.current;
      const isSuper = pendingSuperRef.current;
      pendingCritRef.current = false;
      pendingSuperRef.current = false;

      if (isCrit) {
        playCrit();
        screenFlashCounter.current += 1;
        const key = screenFlashCounter.current;
        setScreenFlash(key);
        setTimeout(() => setScreenFlash((prev) => (prev === key ? null : prev)), 220);
        if (arenaRef.current) {
          gsap
            .timeline()
            .to(arenaRef.current, { scale: 1.03, duration: 0.08, ease: "power2.out" })
            .to(arenaRef.current, { scale: 1, duration: 0.22, ease: "power2.in" });
        }
      } else {
        playDuelHit();
      }

      if (ref) {
        const tl = gsap.timeline();
        const shakeX = isCrit ? (isNear ? -14 : 14) : isNear ? -8 : 8;
        tl.to(ref, { x: shakeX, duration: 0.05, repeat: isCrit ? 7 : 5, yoyo: true }, 0);
        tl.fromTo(
          ref,
          { filter: isCrit ? "brightness(3) saturate(0)" : "brightness(2.2) saturate(0)" },
          { filter: "brightness(1)", duration: isCrit ? 0.4 : 0.3 },
          0
        );
      }
      if (lastMoveTypeRef.current === "Fighting") spawnImpact(isNear ? "near" : "far");
      if (lastMoveTypeRef.current) spawnTypeBurst(isNear ? "near" : "far", typeColor(lastMoveTypeRef.current), isCrit || isSuper);
      if (isCrit) {
        bannerCounter.current += 1;
        const key = bannerCounter.current;
        setBanner({ text: "COUP CRITIQUE !", key, tone: "crit" });
        setTimeout(() => setBanner((prev) => (prev?.key === key ? null : prev)), 700);
      } else if (isSuper) {
        spawnFloater("Super efficace !", isNear ? "near" : "far", "bad");
      }
      const dmgLabel = entry.sourceLabel ? `${entry.hpPercent}% PV (${entry.sourceLabel})` : `${entry.hpPercent}% PV`;
      spawnFloater(dmgLabel, isNear ? "near" : "far", "bad");
      await sleep(isCrit ? 650 : 500);
      return;
    }
    if (entry.kind === "faint") {
      const isNear = entry.target === viewerSide;
      const ref = isNear ? nearRef.current : farRef.current;
      if (ref) {
        playElimination();
        if (arenaRef.current) {
          gsap.fromTo(arenaRef.current, { x: 0 }, { x: isNear ? 10 : -10, duration: 0.06, repeat: 6, yoyo: true });
        }
        // Only the drop/rotate is animated here — PokemonSprite's own
        // `fainted` class handles the opacity fade (via the updated
        // snapshot), so stacking a second opacity tween on this wrapper
        // would multiply the two together and leave the sprite nearly
        // invisible instead of just dimmed.
        await new Promise<void>((resolve) => {
          gsap.to(ref, {
            y: 24,
            rotation: isNear ? -12 : 12,
            duration: 0.6,
            ease: "power2.in",
            onComplete: resolve,
          });
        });
      }
      await sleep(450);
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

  // Only meaningful once a multi-Pokémon team has actually been whittled
  // down — a team that only ever had one Pokémon is at "remainingCount 1"
  // from turn one, which isn't sudden death, it's just the format.
  const suddenDeath =
    !snapshot.ended &&
    near.team.length > 1 &&
    far.team.length > 1 &&
    near.remainingCount === 1 &&
    far.remainingCount === 1 &&
    !near.active?.fainted &&
    !far.active?.fainted;

  return (
    <div
      ref={arenaRef}
      className="relative w-full overflow-hidden rounded-2xl border border-gold/30 shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
    >
      {/* background */}
      <Image src="/fight/arena-bg.png" alt="" fill sizes="900px" priority className="object-cover" />
      {screenFlash !== null && (
        <div key={screenFlash} className="pointer-events-none absolute inset-0 z-30 bg-white" style={{ animation: "crit-flash 0.22s ease-out" }} />
      )}

      {/* environment-effects (weather/field, pointer-events: none) */}
      <FieldEffectOverlay field={snapshot.field} />

      {/* pokemon-layer, on its own ground decal */}
      <div className="relative aspect-[16/9] w-full sm:aspect-[2/1]">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2">
          <Image src="/fight/arena-ground.png" alt="" fill sizes="900px" className="object-contain object-bottom opacity-90" />
        </div>

        <ArenaPokemon species={near.active?.species} fainted={near.active?.fainted} facing="back" corner="bottom-left" spriteRef={nearRef} />
        <ArenaPokemon species={far.active?.species} fainted={far.active?.fainted} facing="front" corner="top-right" spriteRef={farRef} />
        <ArenaNameplate
          species={near.active?.species}
          hpPercent={near.active?.hpPercent}
          status={near.active?.status}
          fainted={near.active?.fainted}
          corner="near"
        />
        <ArenaNameplate
          species={far.active?.species}
          hpPercent={far.active?.hpPercent}
          status={far.active?.status}
          fainted={far.active?.fainted}
          corner="far"
        />

        {/* battle-animation-layer */}
        {banner && (
          <p
            key={banner.key}
            className={`pointer-events-none absolute left-1/2 top-[14%] z-20 -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-bold ${
              banner.tone === "crit"
                ? "border border-gold-bright bg-crimson/90 text-lg font-black uppercase tracking-wide text-white shadow-[0_0_24px_rgba(255,200,60,0.8)]"
                : "bg-black/70 text-white"
            }`}
            style={{ animation: banner.tone === "crit" ? "crit-banner-in 0.7s ease-out" : "move-banner-in 1.1s ease-out" }}
          >
            {banner.tone === "crit" ? "⚡ " : ""}
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
        {projectiles.map((p) => (
          <TravelingProjectile key={p.key} p={p} />
        ))}
        {typeBursts.map((b) => (
          <div
            key={b.key}
            className={`pointer-events-none absolute z-20 rounded-full ${b.big ? "h-24 w-24 sm:h-36 sm:w-36" : "h-16 w-16 sm:h-24 sm:w-24"} ${
              b.side === "near" ? "bottom-[14%] left-[16%] sm:left-[20%]" : "right-[14%] top-[16%] sm:right-[20%]"
            }`}
            style={{
              background: `radial-gradient(circle, ${b.color}cc 0%, ${b.color}55 45%, transparent 75%)`,
              animation: `type-burst ${b.big ? "0.6s" : "0.45s"} ease-out`,
            }}
          />
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
          {suddenDeath && (
            <span
              className="rounded-full border border-crimson-bright bg-crimson/80 px-3 py-0.5 text-[10px] font-black uppercase tracking-widest text-white shadow-[0_0_16px_rgba(217,88,74,0.7)] sm:text-xs"
              style={{ animation: "sudden-death-pulse 1.4s ease-in-out infinite" }}
            >
              ⚔ Mort subite
            </span>
          )}
        </div>
      </div>

      {snapshot.ended && (
        <div className="relative overflow-hidden border-t border-gold/20 bg-void-deep/90 py-4">
          {snapshot.winnerId &&
            Array.from({ length: 24 }, (_, i) => (
              <span
                key={i}
                className="pointer-events-none absolute top-0 h-2 w-2 rounded-sm"
                style={{
                  left: `${(i * 41) % 100}%`,
                  background: i % 3 === 0 ? "#e8c15a" : i % 3 === 1 ? "#6a5fd6" : "#d9584a",
                  animation: `confetti-fall ${1.4 + (i % 5) * 0.2}s ease-in ${(i % 7) * 0.06}s forwards`,
                }}
              />
            ))}
          <p className="relative text-center font-display text-xl font-black text-gold-bright drop-shadow-[0_0_18px_rgba(232,193,90,0.6)] sm:text-2xl">
            {snapshot.winnerId
              ? `🏆 ${snapshot.p1.playerId === snapshot.winnerId ? snapshot.p1.name : snapshot.p2.name} remporte la bataille !`
              : "Match nul — aucun des deux Pokémon n'a survécu !"}
          </p>
        </div>
      )}
    </div>
  );
}
