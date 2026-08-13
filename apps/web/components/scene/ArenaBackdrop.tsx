"use client";

import { useEffect, useState } from "react";
import { useSceneMood } from "./SceneMoodContext";

// Fixed, deterministic ember field (no Math.random at render time — avoids
// SSR/client hydration mismatches). Values are left%, animation-delay(s),
// duration(s), and size(px).
const EMBERS: Array<[number, number, number, number]> = [
  [2, 0, 14, 3], [7, 2.1, 11, 2], [12, 4.6, 16, 4], [18, 1.2, 12, 2],
  [24, 6.3, 15, 3], [29, 0.4, 10, 2], [35, 3.9, 13, 4], [41, 7.8, 17, 2],
  [46, 2.7, 11, 3], [52, 5.5, 14, 2], [58, 1.6, 12, 4], [64, 8.4, 16, 2],
  [69, 3.2, 10, 3], [75, 6.9, 15, 2], [80, 0.9, 13, 4], [86, 4.4, 11, 2],
  [91, 7.1, 17, 3], [96, 2.3, 12, 2], [5, 9.6, 14, 2], [15, 5.8, 10, 3],
  [22, 8.9, 16, 2], [33, 1.9, 13, 4], [44, 9.2, 11, 2], [55, 4.1, 15, 3],
  [66, 6.6, 12, 2], [77, 0.6, 17, 4], [88, 3.5, 10, 2], [95, 8.1, 14, 3],
];

// Subtle film-grain noise so flat dark gradients don't read as an empty
// void — the single highest-leverage trick against color-banded flatness.
const NOISE_DATA_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

export function ArenaBackdrop() {
  const { mood, flashKey } = useSceneMood();
  const [flashing, setFlashing] = useState(false);

  useEffect(() => {
    if (flashKey === 0) return;
    setFlashing(true);
    const t = setTimeout(() => setFlashing(false), 550);
    return () => clearTimeout(t);
  }, [flashKey]);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {/* Base vignette + mood tint */}
      <div
        className="absolute inset-0 transition-colors duration-[1200ms] ease-out"
        style={{
          background:
            mood === "duel"
              ? "radial-gradient(ellipse 90% 70% at 50% 0%, rgba(178,58,47,0.28), transparent), radial-gradient(ellipse 70% 60% at 50% 100%, rgba(106,95,214,0.18), transparent), #050409"
              : mood === "tense"
                ? "radial-gradient(ellipse 90% 70% at 50% -10%, rgba(232,193,90,0.22), transparent), radial-gradient(ellipse 60% 50% at 100% 100%, rgba(178,58,47,0.15), transparent), #050409"
                : mood === "finale"
                  ? "radial-gradient(ellipse 100% 80% at 50% 20%, rgba(232,193,90,0.3), transparent), #050409"
                  : "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(106,95,214,0.25), transparent), radial-gradient(ellipse 60% 50% at 100% 100%, rgba(232,193,90,0.08), transparent), #050409",
        }}
      />

      {/* Grain texture — breaks up flat color banding across the whole page */}
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{ backgroundImage: `url("${NOISE_DATA_URI}")`, backgroundSize: "140px 140px" }}
      />

      {/* Slow-drifting glow orbs — depth without being distracting */}
      <div
        className="absolute h-[32rem] w-[32rem] rounded-full bg-purple/10 blur-3xl"
        style={{ animation: "orb-drift-a 34s ease-in-out infinite", left: "-6rem", top: "-4rem" }}
      />
      <div
        className="absolute h-[26rem] w-[26rem] rounded-full bg-gold/8 blur-3xl"
        style={{ animation: "orb-drift-b 40s ease-in-out infinite", right: "-4rem", bottom: "-2rem" }}
      />

      {/* Slow spotlight sweep */}
      <div className="absolute inset-0 opacity-60 animate-[spotlight-sweep_22s_ease-in-out_infinite] [background:radial-gradient(circle_38%_at_50%_50%,rgba(232,193,90,0.08),transparent_70%)]" />

      {/* Coliseum colonnade — repeating pillar shafts across the full width */}
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(0,0,0,0.4) 0px, rgba(0,0,0,0.4) 2px, transparent 2px, transparent 3px, rgba(232,193,90,0.05) 3px, rgba(232,193,90,0.05) 4px, transparent 4px, transparent 160px)",
        }}
      />
      {/* Scalloped arches along the very top, matching the colonnade rhythm */}
      <div
        className="absolute inset-x-0 top-0 h-28 opacity-50"
        style={{
          backgroundImage:
            "repeating-radial-gradient(circle at 80px -40px, transparent 0px, transparent 78px, rgba(5,4,9,0.55) 82px, rgba(5,4,9,0.55) 88px, transparent 92px)",
          backgroundSize: "160px 100%",
        }}
      />

      {/* Arena pillars framing the edges, brighter than the mid-field colonnade */}
      <div className="absolute inset-y-0 left-0 hidden w-28 bg-gradient-to-r from-black/70 via-black/20 to-transparent md:block" />
      <div className="absolute inset-y-0 right-0 hidden w-28 bg-gradient-to-l from-black/70 via-black/20 to-transparent md:block" />
      <div className="absolute top-0 left-6 hidden h-full w-2 rounded-full bg-gradient-to-b from-gold/25 via-gold/5 to-transparent md:block" />
      <div className="absolute top-0 right-6 hidden h-full w-2 rounded-full bg-gradient-to-b from-gold/25 via-gold/5 to-transparent md:block" />

      {/* Hanging banners at the pillar tops — RPPLF gold/purple ribbon cloth */}
      <div
        className="absolute top-0 left-8 hidden h-40 w-10 md:block"
        style={{
          background: "linear-gradient(180deg, rgba(232,193,90,0.28), rgba(106,95,214,0.18))",
          clipPath: "polygon(0 0, 100% 0, 100% 82%, 50% 100%, 0 82%)",
        }}
      />
      <div
        className="absolute top-0 right-8 hidden h-40 w-10 md:block"
        style={{
          background: "linear-gradient(180deg, rgba(106,95,214,0.24), rgba(232,193,90,0.16))",
          clipPath: "polygon(0 0, 100% 0, 100% 82%, 50% 100%, 0 82%)",
        }}
      />

      {/* Distant crowd silhouette — two tiers of repeating dome shapes for depth */}
      <svg className="absolute inset-x-0 bottom-32 h-8 w-full opacity-20" preserveAspectRatio="none" viewBox="0 0 400 20">
        <defs>
          <pattern id="crowd-far" width="14" height="20" patternUnits="userSpaceOnUse">
            <circle cx="7" cy="13" r="5" fill="#050409" />
          </pattern>
        </defs>
        <rect width="400" height="20" fill="url(#crowd-far)" />
      </svg>
      <svg className="absolute inset-x-0 bottom-24 h-10 w-full opacity-35" preserveAspectRatio="none" viewBox="0 0 400 20">
        <defs>
          <pattern id="crowd-near" width="16" height="20" patternUnits="userSpaceOnUse">
            <circle cx="8" cy="14" r="6" fill="#050409" />
          </pattern>
        </defs>
        <rect width="400" height="20" fill="url(#crowd-near)" />
      </svg>

      {/* Rising embers */}
      {EMBERS.map(([left, delay, duration, size], i) => (
        <span
          key={i}
          className="absolute bottom-0 rounded-full bg-gold-bright/70 shadow-[0_0_6px_rgba(246,211,116,0.8)] animate-[ember-rise_var(--dur)_linear_infinite]"
          style={{
            left: `${left}%`,
            width: size,
            height: size,
            animationDelay: `${delay}s`,
            // @ts-expect-error custom property for animation duration
            "--dur": `${duration}s`,
          }}
        />
      ))}

      {/* Bottom stage floor glow */}
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-purple-deep/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 to-transparent" />

      {/* One-shot elimination flash */}
      <div
        className={`absolute inset-0 bg-crimson-bright/0 transition-none ${
          flashing ? "animate-[scene-flash_0.55s_ease-out]" : ""
        }`}
      />
    </div>
  );
}
