"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import type { DuelActor, DuelRoll } from "@yrud/shared";
import { playDuelHit, playDuelMiss, playDuelWin } from "@/lib/sfx";
import { SpriteFlipbook } from "@/components/vfx/SpriteFlipbook";

// Yrud is a known Medicham enjoyer. The challenger's own species reflects
// their clan: Rapepolofia always fields Arboliva, Paldea gets one of a
// handful of Paldea-dex Pokémon (picked deterministically per player, so
// the same challenger always shows up as the same mon rather than
// re-rolling every duel). A challenger from Yrud's own clan fields
// Doublade — Yrud arming his own sbires, even against himself. Any other/
// unknown clan falls back to Arboliva.
const OPPONENT_SPECIES_RAPEPOLOFIA = "arboliva";
const OPPONENT_SPECIES_YRUD = "doublade";
const PALDEA_SPECIES_POOL = [
  "skeledirge",
  "meowscarada",
  "quaquaval",
  "garganacl",
  "ceruledge",
  "armarouge",
  "dondozo",
  "tinkaton",
  "glimmora",
  "houndstone",
];

function hashToIndex(seed: string, length: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % length;
}

function opponentSpeciesFor(opponentId: string, opponentClan?: string | null): string {
  if (opponentClan === "paldea") return PALDEA_SPECIES_POOL[hashToIndex(opponentId, PALDEA_SPECIES_POOL.length)];
  if (opponentClan === "yrud") return OPPONENT_SPECIES_YRUD;
  return OPPONENT_SPECIES_RAPEPOLOFIA;
}

// The accuracy values are tuned for this mini-game's pacing, not the real
// move data (both are 90% in the actual games) — they're shown on the
// Précision badges since they're what actually governs the fight, not the
// real stats.
const YRUD_SPECIES = "medicham";
const YRUD_MOVE = "Zen Headbutt";
const OPPONENT_MOVE = "Leaf Storm";
const YRUD_ACCURACY = 80;
const OPPONENT_ACCURACY = 70;

// Same tint applied to both the Water-swirl and Fire-swirl art so they read
// as Psychic (pink/violet) and Grass (green) instead — the sheet only ships
// blue/red elemental VFX, no psychic/grass set, so the shape and sparkle
// quality carry over via a hue shift rather than being lost entirely.
const PSYCHIC_TINT = "hue-rotate(95deg) saturate(1.3) brightness(1.05)";
const LEAF_TINT = "hue-rotate(95deg) saturate(1.15)";

// Both sprites face the viewer — a "who's fighting" portrait reads far
// better front-on than Showdown's own back-view convention, which just
// looked like an unrecognizable blur at this size.
function spriteUrl(species: string) {
  return `https://play.pokemonshowdown.com/sprites/xyani/${species}.gif`;
}

interface DuelStageProps {
  opponentName: string;
  opponentId: string;
  opponentClan?: string | null;
  rollLog: DuelRoll[];
  winner?: DuelActor;
  onDone: () => void;
}

export function DuelStage({ opponentName, opponentId, opponentClan, rollLog, winner, onDone }: DuelStageProps) {
  const opponentSpecies = opponentSpeciesFor(opponentId, opponentClan);
  const stageRef = useRef<HTMLDivElement>(null);
  const framesRowRef = useRef<HTMLDivElement>(null);
  const labelsRowRef = useRef<HTMLDivElement>(null);
  const leafStormRef = useRef<HTMLDivElement>(null);
  const yrudFrameRef = useRef<HTMLDivElement>(null);
  const opponentFrameRef = useRef<HTMLDivElement>(null);
  const yrudImpactRef = useRef<HTMLDivElement>(null);
  const opponentImpactRef = useRef<HTMLDivElement>(null);
  const vsRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const winnerBoxRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const lastAnimatedCount = useRef(0);
  const [feedback, setFeedback] = useState<{ hit: boolean; side: "left" | "right"; key: number } | null>(null);
  const feedbackCounter = useRef(0);

  // Entrance clash: both combatants slam in from opposite edges, a "VS"
  // banner flashes, camera settles — the fight's opening beat.
  useEffect(() => {
    const tl = gsap.timeline();
    if (flashRef.current) {
      tl.fromTo(flashRef.current, { opacity: 0.9 }, { opacity: 0, duration: 0.5, ease: "power2.out" }, 0);
    }
    if (yrudFrameRef.current) {
      tl.fromTo(
        yrudFrameRef.current,
        { x: -420, opacity: 0, rotation: -10 },
        { x: 0, opacity: 1, rotation: 0, duration: 0.55, ease: "back.out(1.6)" },
        0
      );
    }
    if (opponentFrameRef.current) {
      tl.fromTo(
        opponentFrameRef.current,
        { x: 420, opacity: 0, rotation: 10 },
        { x: 0, opacity: 1, rotation: 0, duration: 0.55, ease: "back.out(1.6)" },
        0
      );
    }
    if (vsRef.current) {
      tl.fromTo(
        vsRef.current,
        { scale: 3, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.35, ease: "power4.out" },
        0.25
      ).to(vsRef.current, { opacity: 0.55, duration: 0.3 }, 0.7);
    }
    if (labelsRowRef.current) {
      tl.fromTo(labelsRowRef.current, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: "power2.out" }, 0.35);
    }
    if (stageRef.current) {
      tl.fromTo(stageRef.current, { x: -6 }, { x: 6, duration: 0.04, repeat: 5, yoyo: true }, 0.5);
    }
  }, []);

  function spawnImpact(ref: React.RefObject<HTMLDivElement | null>) {
    if (!ref.current) return;
    gsap.fromTo(
      ref.current,
      { opacity: 1, scale: 0.4, rotation: 0 },
      { opacity: 0, scale: 1.6, rotation: 25, duration: 0.6, ease: "power2.out" }
    );
  }

  function flashFeedback(hit: boolean, side: "left" | "right") {
    feedbackCounter.current += 1;
    setFeedback({ hit, side, key: feedbackCounter.current });
  }

  // Runs after the pill (re)renders for a new roll, so the ref is guaranteed
  // to be attached before the entrance tween starts.
  useEffect(() => {
    if (!feedback || !feedbackRef.current) return;
    const el = feedbackRef.current;
    gsap.killTweensOf(el);
    gsap.fromTo(
      el,
      { opacity: 0, scale: 0.7, x: feedback.side === "left" ? -8 : 8 },
      {
        opacity: 1,
        scale: 1,
        x: 0,
        duration: 0.2,
        ease: "back.out(2)",
        onComplete: () => {
          gsap.to(el, { opacity: 0, delay: 0.55, duration: 0.25 });
        },
      }
    );
  }, [feedback]);

  function shakeDefender(defenderBox: HTMLDivElement | null, fromLeft: boolean) {
    if (!defenderBox) return;
    gsap.fromTo(defenderBox, { x: 0 }, { x: fromLeft ? 10 : -10, duration: 0.05, yoyo: true, repeat: 3 });
    gsap.fromTo(defenderBox, { filter: "brightness(2.2)" }, { filter: "brightness(1)", duration: 0.35, ease: "power2.out" });
  }

  // Animate only the newest roll as it arrives.
  useEffect(() => {
    if (rollLog.length <= lastAnimatedCount.current) return;
    lastAnimatedCount.current = rollLog.length;
    const roll = rollLog[rollLog.length - 1];
    const isYrud = roll.actor === "yrud";

    if (isYrud) {
      // Zen Headbutt — a contact move: Yrud's own portrait lunges at the
      // opponent instead of firing a projectile, then springs back.
      if (!yrudFrameRef.current) return;
      const tl = gsap.timeline();
      tl.to(yrudFrameRef.current, { x: 70, rotation: -4, duration: 0.2, ease: "power2.in" });
      if (roll.hit) {
        tl.call(() => {
          playDuelHit();
          spawnImpact(opponentImpactRef);
          flashFeedback(true, "right");
          shakeDefender(opponentFrameRef.current, true);
        });
      } else {
        tl.call(() => {
          playDuelMiss();
          flashFeedback(false, "left");
        });
      }
      tl.to(yrudFrameRef.current, { x: 0, rotation: 0, duration: 0.3, ease: "back.out(1.8)" }, "+=0.06");
    } else {
      // Leaf Storm — a ranged move: a cluster of leaves crosses the stage.
      const cluster = leafStormRef.current;
      if (!cluster) return;
      gsap.set(cluster, { opacity: 1, left: "80%", scale: 1, rotation: 0 });

      if (roll.hit) {
        gsap.to(cluster, {
          left: "20%",
          rotation: -140,
          duration: 0.48,
          ease: "power1.in",
          onComplete: () => {
            playDuelHit();
            gsap.to(cluster, { opacity: 0, duration: 0.12 });
            spawnImpact(yrudImpactRef);
            flashFeedback(true, "left");
            shakeDefender(yrudFrameRef.current, false);
          },
        });
      } else {
        gsap.to(cluster, {
          left: "50%",
          rotation: -60,
          duration: 0.32,
          ease: "power1.in",
          onComplete: () => {
            playDuelMiss();
            gsap.to(cluster, { scale: 0.2, opacity: 0, duration: 0.25 });
            flashFeedback(false, "right");
            if (opponentFrameRef.current && stageRef.current) {
              gsap.to(stageRef.current, { scale: 1.1, duration: 0.35, ease: "power2.out" });
              gsap.fromTo(
                opponentFrameRef.current,
                { x: 0 },
                { x: 8, duration: 0.06, ease: "power1.inOut", repeat: 5, yoyo: true }
              );
            }
          },
        });
      }
    }
  }, [rollLog]);

  useEffect(() => {
    if (!winner) return;
    playDuelWin();
    const box = winner === "yrud" ? yrudFrameRef.current : opponentFrameRef.current;
    if (box) {
      gsap.to(box, { scale: 1.15, duration: 0.4, ease: "back.out(2)" });
    }
    if (winnerBoxRef.current) {
      gsap.fromTo(winnerBoxRef.current, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4, delay: 0.2 });
    }
    const timeout = setTimeout(onDone, 3200);
    return () => clearTimeout(timeout);
  }, [winner, onDone]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 overflow-y-auto overflow-x-hidden bg-void-deep px-4 py-6">
      {/* Charged arena backdrop — crimson/purple radial glow + rim pillars */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 60%, rgba(178,58,47,0.22), transparent 65%), radial-gradient(ellipse 90% 70% at 50% 0%, rgba(106,95,214,0.18), transparent)",
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-crimson/15 to-transparent" />
      <div ref={flashRef} className="pointer-events-none absolute inset-0 bg-white" />

      <Image
        src="/defi/corner-tl.png"
        alt=""
        width={145}
        height={145}
        className="pointer-events-none absolute left-3 top-3 hidden h-20 w-20 opacity-80 sm:block"
      />
      <Image
        src="/defi/corner-tr.png"
        alt=""
        width={146}
        height={143}
        className="pointer-events-none absolute right-3 top-3 hidden h-20 w-20 opacity-80 sm:block"
      />

      <Image
        src="/defi/title-banner.png"
        alt="Le défi de Yrud"
        width={698}
        height={126}
        priority
        className="relative h-auto w-72 shrink-0 sm:w-[26rem]"
      />

      <div ref={stageRef} className="relative flex w-full max-w-3xl flex-col items-center gap-3">
        {/* Frames row — both portraits share the same square footprint so they line up exactly */}
        <div ref={framesRowRef} className="relative flex w-full items-center justify-between">
          <div ref={yrudFrameRef} className="relative aspect-square" style={{ width: "clamp(112px, 30vw, 256px)" }}>
            {/* Ambient elemental aura hovering above the portrait — Yrud's Psychic tint. The
                static wrapper centers it (Tailwind's translate class); a plain-transform inner
                element carries the bob animation so the two transforms never fight. */}
            <div className="pointer-events-none absolute -top-6 left-1/2 h-14 w-14 -translate-x-1/2 opacity-70 sm:-top-8 sm:h-20 sm:w-20">
              <div className="relative h-full w-full" style={{ animation: "duel-aura-bob 3.4s ease-in-out infinite" }}>
                <Image src="/defi/aura-blue.png" alt="" fill className="object-contain" style={{ filter: PSYCHIC_TINT }} />
              </div>
            </div>
            <Image src="/defi/frame-blue.png" alt="" fill sizes="320px" className="relative object-contain" />
            <div className="absolute overflow-hidden rounded-full" style={{ left: "13%", right: "13%", top: "19%", bottom: "16%" }}>
              <Image
                src={spriteUrl(YRUD_SPECIES)}
                alt="Yrud"
                fill
                unoptimized
                className="object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)]"
              />
            </div>
            {/* Impact on Yrud — Leaf Storm landing, tinted green */}
            <div ref={yrudImpactRef} className="pointer-events-none absolute inset-0 opacity-0" style={{ filter: LEAF_TINT }}>
              <Image src="/defi/vfx-red.png" alt="" fill className="object-contain" />
            </div>
          </div>

          <div ref={vsRef} className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
            <Image src="/defi/vs-badge.png" alt="VS" width={300} height={290} className="h-20 w-auto sm:h-28" />
          </div>

          {/* Leaf Storm — a cluster of leaves crossing the stage from the opponent's side.
              Keyed on rollLog.length so a fresh flipbook mounts (and restarts its frame
              cycle from 0) every time a new toss launches, instead of only playing once. */}
          <div ref={leafStormRef} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0">
            <SpriteFlipbook
              key={rollLog.length}
              src="/defi/leaf.png"
              frameCount={6}
              frameWidth={362}
              frameHeight={724}
              fps={20}
              className="h-16 drop-shadow-[0_0_10px_rgba(120,200,90,0.6)]"
            />
          </div>

          <div ref={opponentFrameRef} className="relative aspect-square" style={{ width: "clamp(112px, 30vw, 256px)" }}>
            {/* Ambient elemental aura hovering above the portrait — Arboliva's Grass tint */}
            <div className="pointer-events-none absolute -top-6 left-1/2 h-14 w-14 -translate-x-1/2 opacity-70 sm:-top-8 sm:h-20 sm:w-20">
              <div className="relative h-full w-full" style={{ animation: "duel-aura-bob 3.8s ease-in-out infinite" }}>
                <Image src="/defi/aura-red.png" alt="" fill className="object-contain" style={{ filter: LEAF_TINT }} />
              </div>
            </div>
            <Image src="/defi/frame-red.png" alt="" fill sizes="320px" className="relative object-contain" />
            <div className="absolute overflow-hidden rounded-full" style={{ left: "13%", right: "13%", top: "17%", bottom: "14%" }}>
              <Image
                src={spriteUrl(opponentSpecies)}
                alt={opponentName}
                fill
                unoptimized
                className="object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)]"
              />
            </div>
            {/* Impact on the opponent — Zen Headbutt landing, tinted psychic pink */}
            <div ref={opponentImpactRef} className="pointer-events-none absolute inset-0 opacity-0" style={{ filter: PSYCHIC_TINT }}>
              <Image src="/defi/vfx-blue.png" alt="" fill className="object-contain" />
            </div>
          </div>
        </div>

        {/* Hit/miss feedback pill — reserves its own row so it never overlaps the VS badge or the frames */}
        <div className="relative flex h-9 w-full items-center justify-center">
          {feedback && (
            <div ref={feedbackRef} className="pointer-events-none absolute z-30 opacity-0">
              <Image
                src={feedback.hit ? "/defi/touche-pill.png" : "/defi/rate-pill.png"}
                alt={feedback.hit ? "Touché" : "Raté"}
                width={feedback.hit ? 206 : 211}
                height={59}
                className="h-auto w-36 sm:w-44"
              />
            </div>
          )}
        </div>

        {/* Labels row — nameplate / misses / move / attack indicator / precision, one column per side */}
        <div ref={labelsRowRef} className="flex w-full items-start justify-between">
          <div className="flex flex-col items-center gap-2" style={{ width: "clamp(112px, 30vw, 256px)" }}>
            <div className="relative w-full">
              <Image src="/defi/status-bar-blue.png" alt="" width={405} height={96} className="h-auto w-full" />
              <span className="absolute inset-0 flex items-center justify-center px-3 font-display text-base font-bold text-gold-bright sm:text-lg">
                Yrud
              </span>
            </div>
            <span className="font-display text-sm font-semibold text-gold-dim sm:text-base">{YRUD_MOVE}</span>
            <div className="relative w-32 sm:w-40">
              <Image src="/defi/precision-blue.png" alt="" width={190} height={116} className="h-auto w-full" />
              <span
                className="absolute flex items-center justify-center text-sm font-black text-white sm:text-base"
                style={{ left: "24%", right: "24%", top: "57%", bottom: "12%" }}
              >
                {YRUD_ACCURACY}%
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2" style={{ width: "clamp(112px, 30vw, 256px)" }}>
            <div className="relative w-full">
              <Image src="/defi/status-bar-red.png" alt="" width={410} height={96} className="h-auto w-full" />
              <span className="absolute inset-0 flex items-center justify-center px-4 font-display text-base font-bold text-ink sm:text-lg">
                {/* text-overflow only ellipsizes a block's own inline content —
                    it's a no-op directly on a flex container, which just hard-clips
                    long names instead. The inner block wrapper is what actually
                    gets the ellipsis. */}
                <span className="max-w-full truncate">{opponentName}</span>
              </span>
            </div>
            <span className="font-display text-sm font-semibold text-crimson-bright sm:text-base">{OPPONENT_MOVE}</span>
            <div className="relative w-32 sm:w-40">
              <Image src="/defi/precision-red.png" alt="" width={199} height={114} className="h-auto w-full" />
              <span
                className="absolute flex items-center justify-center text-sm font-black text-white sm:text-base"
                style={{ left: "24%", right: "24%", top: "57%", bottom: "12%" }}
              >
                {OPPONENT_ACCURACY}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-1.5">
        {rollLog.map((roll, i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full ${
              roll.hit ? (roll.actor === "yrud" ? "bg-sky-400" : "bg-amber-500") : "bg-white/20"
            }`}
            title={`${roll.actor}: ${roll.move} — ${roll.hit ? "touché" : "raté"}`}
          />
        ))}
      </div>

      {winner && (
        <div ref={winnerBoxRef} className="relative flex flex-col items-center gap-2">
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-2xl"
            style={{ background: winner === "yrud" ? "rgba(79,143,224,0.5)" : "rgba(224,101,44,0.5)" }}
          />
          <Image src="/defi/resultat-banner.png" alt="Résultat" width={379} height={116} className="h-auto w-60 sm:w-72" />
          <p
            className={`max-w-sm text-center font-display text-xl font-black sm:text-2xl ${winner === "yrud" ? "text-sky-400" : "text-amber-500"}`}
          >
            {winner === "yrud" ? "Yrud gagne ! Des points sont perdus..." : `${opponentName} gagne des points et échappe à la fureur de Yrud !`}
          </p>
          <Image
            src={winner === "yrud" ? "/defi/vie-perdue-pill.png" : "/defi/vie-gagnee-pill.png"}
            alt=""
            width={216}
            height={62}
            className="h-auto w-48"
          />
        </div>
      )}
    </div>
  );
}
