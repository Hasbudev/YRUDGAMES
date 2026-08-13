"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import type { DuelActor, DuelRoll } from "@yrud/shared";
import { playDuelHit, playDuelMiss, playDuelWin } from "@/lib/sfx";

// Yrud fights with a Water-type, the challenger with a Fighting-type — real
// Pokémon sprites (same official CDN as the final battle stage) instead of
// an abstract portrait/emblem, so the duel reads as an actual clash.
const YRUD_SPECIES = "gyarados";
const OPPONENT_SPECIES = "machamp";

function spriteUrl(species: string) {
  return `https://play.pokemonshowdown.com/sprites/gen5/${species}.png`;
}

interface DuelStageProps {
  opponentName: string;
  rollLog: DuelRoll[];
  winner?: DuelActor;
  onDone: () => void;
}

export function DuelStage({ opponentName, rollLog, winner, onDone }: DuelStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const waterProjectileRef = useRef<HTMLDivElement>(null);
  const focusProjectileRef = useRef<HTMLDivElement>(null);
  const yrudBoxRef = useRef<HTMLDivElement>(null);
  const opponentBoxRef = useRef<HTMLDivElement>(null);
  const yrudImpactRef = useRef<HTMLDivElement>(null);
  const opponentImpactRef = useRef<HTMLDivElement>(null);
  const vsRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const winnerBoxRef = useRef<HTMLDivElement>(null);
  const lastAnimatedCount = useRef(0);

  // Entrance clash: both combatants slam in from opposite edges, a "VS"
  // banner flashes, camera settles — the fight's opening beat.
  useEffect(() => {
    const tl = gsap.timeline();
    if (flashRef.current) {
      tl.fromTo(flashRef.current, { opacity: 0.9 }, { opacity: 0, duration: 0.5, ease: "power2.out" }, 0);
    }
    if (yrudBoxRef.current) {
      tl.fromTo(
        yrudBoxRef.current,
        { x: -420, opacity: 0, rotation: -10 },
        { x: 0, opacity: 1, rotation: 0, duration: 0.55, ease: "back.out(1.6)" },
        0
      );
    }
    if (opponentBoxRef.current) {
      tl.fromTo(
        opponentBoxRef.current,
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
      ).to(vsRef.current, { opacity: 0.35, duration: 0.3 }, 0.7);
    }
    if (stageRef.current) {
      tl.fromTo(stageRef.current, { x: -6 }, { x: 6, duration: 0.04, repeat: 5, yoyo: true }, 0.5);
    }
  }, []);

  function spawnImpact(ref: React.RefObject<HTMLDivElement | null>, color: string) {
    if (!ref.current) return;
    gsap.fromTo(
      ref.current,
      { opacity: 0.85, scale: 0.3, borderColor: color },
      { opacity: 0, scale: 2.4, duration: 0.5, ease: "power2.out" }
    );
  }

  // Animate only the newest roll as it arrives.
  useEffect(() => {
    if (rollLog.length <= lastAnimatedCount.current) return;
    lastAnimatedCount.current = rollLog.length;
    const roll = rollLog[rollLog.length - 1];
    const isYrud = roll.actor === "yrud";
    const projectile = isYrud ? waterProjectileRef.current : focusProjectileRef.current;
    const attackerBox = isYrud ? yrudBoxRef.current : opponentBoxRef.current;
    const defenderBox = isYrud ? opponentBoxRef.current : yrudBoxRef.current;
    const defenderImpact = isYrud ? opponentImpactRef : yrudImpactRef;
    if (!projectile) return;

    const fromLeft = isYrud;
    gsap.set(projectile, { opacity: 1, left: fromLeft ? "24%" : "76%", rotation: 0 });

    if (roll.hit) {
      gsap.to(projectile, {
        left: fromLeft ? "76%" : "24%",
        rotation: isYrud ? 0 : 360,
        duration: 0.45,
        ease: "power1.in",
        onComplete: () => {
          playDuelHit();
          gsap.to(projectile, { opacity: 0, duration: 0.12 });
          spawnImpact(defenderImpact, isYrud ? "#4f8fe0" : "#e0652c");
          if (defenderBox) {
            gsap.fromTo(defenderBox, { x: 0 }, { x: fromLeft ? 10 : -10, duration: 0.05, yoyo: true, repeat: 3 });
            gsap.fromTo(
              defenderBox,
              { filter: "brightness(2.2)" },
              { filter: "brightness(1)", duration: 0.35, ease: "power2.out" }
            );
          }
        },
      });
    } else {
      gsap.to(projectile, {
        left: "50%",
        rotation: isYrud ? 0 : 200,
        duration: 0.3,
        ease: "power1.in",
        onComplete: () => {
          playDuelMiss();
          gsap.to(projectile, { scale: 0, opacity: 0, duration: 0.2 });
          if (attackerBox && stageRef.current) {
            // The miss is the dramatic beat — punch in and shake the attacker.
            gsap.to(stageRef.current, { scale: 1.1, duration: 0.35, ease: "power2.out" });
            gsap.fromTo(
              attackerBox,
              { x: 0 },
              { x: -8, duration: 0.06, ease: "power1.inOut", repeat: 5, yoyo: true }
            );
          }
        },
      });
    }
  }, [rollLog]);

  useEffect(() => {
    if (!winner) return;
    playDuelWin();
    const box = winner === "yrud" ? yrudBoxRef.current : opponentBoxRef.current;
    if (box) {
      gsap.to(box, { scale: 1.15, duration: 0.4, ease: "back.out(2)" });
    }
    if (winnerBoxRef.current) {
      gsap.fromTo(winnerBoxRef.current, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4, delay: 0.2 });
    }
    const timeout = setTimeout(onDone, 3200);
    return () => clearTimeout(timeout);
  }, [winner, onDone]);

  const successCount = rollLog.filter((r) => r.hit).length;
  const tensionPct = Math.min(100, successCount * 22);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 overflow-hidden bg-black/95">
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

      <p className="relative font-display text-sm font-bold uppercase tracking-widest text-gold-bright">
        Le défi de Yrud
      </p>

      {/* Tension meter — climbs with every clean hit, since the first miss ends it all */}
      <div className="relative h-1.5 w-64 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold via-crimson-bright to-crimson-bright transition-[width] duration-300"
          style={{ width: `${tensionPct}%` }}
        />
      </div>

      <div ref={stageRef} className="relative flex w-full max-w-xl items-center justify-between px-8">
        <div
          ref={vsRef}
          className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 font-display text-4xl font-black text-white/90 [text-shadow:0_0_20px_rgba(217,88,74,0.8)]"
        >
          VS
        </div>

        <div ref={yrudBoxRef} className="relative flex flex-col items-center gap-2">
          <div className="relative flex h-40 w-40 items-center justify-center rounded-full border-4 border-gold bg-void-deep shadow-[0_0_30px_rgba(232,193,90,0.35)]">
            <div ref={yrudImpactRef} className="pointer-events-none absolute inset-0 rounded-full border-4 opacity-0" />
            <Image src={spriteUrl(YRUD_SPECIES)} alt="Gyarados" width={110} height={110} unoptimized className="h-32 w-32 object-contain" />
          </div>
          <span className="font-display font-bold text-gold-bright">Yrud</span>
          <span className="text-xs text-gold-dim">Hydro Pump</span>
        </div>

        {/* Hydro Pump — a stream of water droplets arcing across the stage */}
        <div
          ref={waterProjectileRef}
          className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-0.5 opacity-0"
        >
          <span className="h-3 w-3 rounded-full bg-blue-300/70" />
          <span className="h-4 w-4 rounded-full bg-blue-400/90 shadow-[0_0_10px_rgba(79,143,224,0.9)]" />
          <span className="h-5 w-5 rounded-full bg-sky-300 shadow-[0_0_14px_rgba(125,211,252,1)]" />
        </div>

        {/* Focus Blast — a spinning orange energy sphere */}
        <div
          ref={focusProjectileRef}
          className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0"
          style={{
            background: "radial-gradient(circle at 35% 35%, #fde68a, #e0652c 60%, #b23a2f)",
            boxShadow: "0 0 16px rgba(224,101,44,0.9)",
          }}
        />

        <div ref={opponentBoxRef} className="relative flex flex-col items-center gap-2">
          <div className="relative flex h-40 w-40 items-center justify-center rounded-full border-4 border-crimson bg-void-deep shadow-[0_0_30px_rgba(178,58,47,0.35)]">
            <div ref={opponentImpactRef} className="pointer-events-none absolute inset-0 rounded-full border-4 opacity-0" />
            <Image src={spriteUrl(OPPONENT_SPECIES)} alt="Machamp" width={110} height={110} unoptimized className="h-32 w-32 object-contain" />
          </div>
          <span className="max-w-[8rem] truncate font-display font-bold text-ink">{opponentName}</span>
          <span className="text-xs text-crimson-bright">Focus Blast</span>
        </div>
      </div>

      <div className="flex gap-1.5">
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
        <div ref={winnerBoxRef} className="relative flex flex-col items-center gap-1">
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-2xl"
            style={{ background: winner === "yrud" ? "rgba(79,143,224,0.5)" : "rgba(224,101,44,0.5)" }}
          />
          <p
            className={`font-display text-2xl font-black ${winner === "yrud" ? "text-sky-400" : "text-amber-500"}`}
          >
            {winner === "yrud" ? "Yrud gagne ! Une vie est perdue..." : `${opponentName} esquive la fureur de Yrud !`}
          </p>
        </div>
      )}
    </div>
  );
}
