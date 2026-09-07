"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { playTaunt } from "@/lib/sfx";

interface YrudDialogueProps {
  lines: string[];
  // Shown once the last line has been dismissed, while the client waits for
  // the server-side phase to actually move on (the admin decides when).
  waitingLabel: string;
  // Fired once, the moment the last line is dismissed — lets the caller tell
  // the server "this player has seen it" (purely advisory, see
  // ArenaSnapshot.introSeenPlayerIds; never gates anything).
  onFinished?: () => void;
}

// Yrud's cold-open, reused for every scripted moment: the game's opening
// monologue, each per-manche transition (both server-gated — see engine.ts's
// "roundIntro" phase — so the pause genuinely blocks the next question's
// timer, not just a cosmetic overlay), and the final-battle announcement
// (not phase-gated — combat:announce is a one-shot event, the actual battle
// start is already admin-paced via team pasting).
export function YrudDialogue({ lines, waitingLabel, onFinished }: YrudDialogueProps) {
  const [lineIndex, setLineIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const bustRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  // A new dialogue script (e.g. moving from the intro to a round-intro)
  // should always restart at line 0, not resume wherever the last one left off.
  useEffect(() => {
    setLineIndex(0);
    setFinished(false);
  }, [lines]);

  useEffect(() => {
    if (heroRef.current) {
      gsap.fromTo(heroRef.current, { x: -100, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55, ease: "power3.out" });
    }
    if (bustRef.current) {
      gsap.fromTo(
        bustRef.current,
        { x: 80, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.5, delay: 0.1, ease: "power3.out" }
      );
    }
    if (boxRef.current) {
      gsap.fromTo(
        boxRef.current,
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4, delay: 0.2, ease: "back.out(1.6)" }
      );
    }
  }, []);

  useEffect(() => {
    playTaunt();
    if (textRef.current) {
      gsap.fromTo(textRef.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" });
    }
  }, [lineIndex]);

  function advance() {
    if (finished) return;
    if (lineIndex < lines.length - 1) {
      setLineIndex((i) => i + 1);
    } else {
      setFinished(true);
      onFinished?.();
    }
  }

  return (
    <button
      type="button"
      onClick={advance}
      aria-label={finished ? "En attente" : "Toucher pour continuer"}
      className="fixed inset-0 z-[60] block h-full w-full cursor-pointer overflow-hidden bg-black text-left"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 70% 60% at 50% 100%, rgba(107,33,168,0.25), transparent 65%)" }}
      />

      <div ref={heroRef} className="absolute bottom-0 left-[-4%] h-[66%] w-[74%] sm:h-[92%] sm:w-[38%]">
        <Image
          src="/art/yrud-hero.png"
          alt=""
          fill
          sizes="(max-width: 640px) 62vw, 38vw"
          className="object-contain object-bottom drop-shadow-[0_25px_50px_rgba(0,0,0,0.85)]"
          priority
        />
      </div>

      <div
        ref={bustRef}
        className="absolute right-0 top-0 h-[60%] w-[70%] sm:h-[58%] sm:w-[40%]"
        style={{ clipPath: "polygon(22% 0, 100% 0, 100% 100%, 0 100%)" }}
      >
        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-l from-transparent via-transparent to-black/70" />
        <Image
          src="/dialogue/yrud.png"
          alt="Yrud"
          fill
          sizes="(max-width: 640px) 58vw, 40vw"
          className="object-cover object-[30%_20%]"
          priority
        />
      </div>

      <div ref={boxRef} className="absolute inset-x-[2%] bottom-[3%] sm:inset-x-[6%] sm:bottom-[5%]">
        <div className="relative w-full" style={{ aspectRatio: "2172 / 724" }}>
          <Image src="/dialogue/Textbox.png" alt="" fill sizes="100vw" className="object-contain" />
          <div
            className="absolute flex items-center"
            style={{ left: "21%", right: "11%", top: "30%", height: "36%" }}
          >
            <p
              ref={textRef}
              key={`${lines.length}-${lineIndex}`}
              className="font-display text-sm font-bold leading-snug text-white sm:text-xl md:text-2xl"
            >
              {lines[lineIndex]}
            </p>
          </div>
        </div>
      </div>

      <span
        className={`absolute bottom-1 right-3 text-[10px] uppercase tracking-widest sm:bottom-2 sm:right-6 sm:text-xs ${
          finished ? "text-gold-bright" : "animate-pulse text-white/60"
        }`}
      >
        {finished ? waitingLabel : "Touchez pour continuer ▼"}
      </span>
    </button>
  );
}
