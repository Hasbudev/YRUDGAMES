"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { listOpenEvents, type OpenEventSummary } from "@/lib/api";
import { SiteHeader } from "@/components/site/SiteHeader";

// Hand-placed rather than randomized so there's no client/server hydration
// mismatch — a fixed constellation reads just as natural as a random one.
// Clustered near the portal (left) with a sparser, slower set drifting
// across the empty right side so ultra-wide screens don't feel static.
const PARTICLES = [
  { left: "6%", bottom: "8%", dur: 9, delay: 0 },
  { left: "15%", bottom: "4%", dur: 11, delay: 2.5 },
  { left: "23%", bottom: "14%", dur: 8, delay: 5 },
  { left: "34%", bottom: "6%", dur: 10, delay: 1.2 },
  { left: "41%", bottom: "18%", dur: 12, delay: 4 },
  { left: "10%", bottom: "24%", dur: 9.5, delay: 6.5 },
  { left: "68%", bottom: "12%", dur: 16, delay: 3, faint: true },
  { left: "80%", bottom: "30%", dur: 18, delay: 9, faint: true },
  { left: "58%", bottom: "40%", dur: 15, delay: 12, faint: true },
];

export default function Home() {
  const [events, setEvents] = useState<OpenEventSummary[] | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    try {
      setEvents(await listOpenEvents());
    } catch {
      setEvents([]);
    }
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  // Subtle parallax — set as CSS custom properties (not React state) so
  // mouse movement never triggers a re-render, just a cheap style mutation.
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    function handleMove(e: MouseEvent) {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      el!.style.setProperty("--px", x.toFixed(3));
      el!.style.setProperty("--py", y.toFixed(3));
    }
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  // There is only ever one soirée at a time — Yrud opens it whenever he's
  // ready, rather than the site listing several scheduled events. The most
  // recently created open/live event (if any) is treated as "the" event.
  const currentEvent = events && events.length > 0 ? events[0] : null;
  const isLive = currentEvent?.status === "live";

  return (
    <div ref={heroRef} className="relative flex min-h-screen flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute -inset-8 -z-10 bg-cover bg-center"
        style={{
          backgroundImage: "url(/art2/bg.png)",
          transform: "translate(calc(var(--px, 0) * -10px), calc(var(--py, 0) * -8px)) scale(1.03)",
          maskImage: "linear-gradient(to bottom, black 0%, black 82%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 82%, transparent 100%)",
        }}
      />
      {/* The portal was competing with the title for first-glance attention — a soft
          gradient keeps its left side a touch darker without dulling the crystal itself. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 -z-[9] w-[48%] bg-gradient-to-r from-void-deep/25 via-void-deep/8 to-transparent" />
      {/* Crystal glow pulse + a slow horizontal fog drift for "premium launcher" motion. */}
      <div className="pointer-events-none absolute top-[36%] left-[9%] -z-[9] h-64 w-64 animate-[sun-pulse_5s_ease-in-out_infinite] rounded-full bg-purple/25 blur-3xl" />
      <div className="pointer-events-none absolute top-[20%] left-[2%] -z-[9] h-72 w-72 animate-[orb-drift-a_18s_ease-in-out_infinite] rounded-full bg-purple/10 blur-3xl" />

      <div className="pointer-events-none absolute inset-0 -z-[8] overflow-hidden">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className={`absolute h-1 w-1 rounded-full ${p.faint ? "bg-purple-deep/0 shadow-[0_0_5px_rgba(186,130,255,0.6)] bg-purple/50" : "bg-gold-bright/70 shadow-[0_0_6px_rgba(246,211,116,0.7)]"}`}
            style={{ left: p.left, bottom: p.bottom, animation: `hero-drift ${p.dur}s ease-in infinite`, animationDelay: `${p.delay}s` }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full">
        <SiteHeader />
      </div>

      <div className="relative z-10 flex w-full flex-1 items-center justify-center px-6 md:px-12">
        <div className="grid w-fit -translate-y-8 grid-cols-1 gap-x-6 md:-translate-y-10 md:grid-cols-[auto_auto] md:items-center lg:-translate-y-12 lg:gap-x-10">
          <div className="hidden items-center justify-center md:flex md:w-[345px] lg:w-[420px]">
            <div className="relative h-[84vh] max-h-[760px] w-full">
              <div className="absolute inset-x-8 bottom-4 -z-10 h-1/2 animate-[sun-pulse_6s_ease-in-out_infinite] rounded-full bg-purple/25 blur-3xl" />
              {/* Grounds him in the scene instead of reading as a flat cutout floating over the art. */}
              <div className="absolute bottom-2 left-1/2 h-6 w-2/3 -translate-x-1/2 rounded-[50%] bg-purple-deep/60 blur-lg" />
              <Image
                src="/art2/yrud.png"
                alt="Yrud"
                fill
                className="object-contain object-bottom"
                style={{ filter: "drop-shadow(0 0 16px rgba(186,130,255,0.4)) drop-shadow(0 0 6px rgba(232,193,90,0.3))" }}
                priority
              />
            </div>
          </div>

          <div className="relative flex w-full max-w-[650px] flex-col items-center gap-4 py-2 md:items-start">
            {/* Every element below is sized off viewport HEIGHT (with a px cap), not
                width breakpoints — a wide-but-short screen (e.g. 1280x800, or even
                2560x1140) would otherwise get the biggest size class while having the
                least vertical room, and the hero must still fit in one screen. */}
            <div className="relative -ml-2 self-center md:self-start" style={{ height: "min(28vh, 340px)", aspectRatio: "1448/1086" }}>
              <Image src="/art2/title.png" alt="L'épreuve de l'Empereur — YRUD GAMES" fill className="object-contain object-left" priority />
            </div>
            <div className="max-w-lg text-center md:text-left">
              <p className="text-base text-ink">Un battle royale de quiz animé en direct par Yrud.</p>
              <p className="font-display text-lg font-bold text-gold-bright">Trois vies. Aucune pitié.</p>
            </div>

            {currentEvent ? (
              <Link
                href={`/play/${currentEvent.code}`}
                className="relative w-full max-w-md transition-transform hover:-translate-y-0.5"
                style={{ height: "min(12vh, 150px)", aspectRatio: "2172/724" }}
              >
                <Image src="/art2/inscription.png" alt="S'inscrire" fill className="object-contain" priority />
              </Link>
            ) : (
              <div className="relative w-full max-w-md opacity-50 grayscale" style={{ height: "min(12vh, 150px)", aspectRatio: "2172/724" }}>
                <Image src="/art2/inscription.png" alt="S'inscrire (bientôt)" fill className="object-contain" />
              </div>
            )}

            {/* status.png (art2) is a fixed "à venir" graphic with baked-in text — great
                for the idle state alone, but raster text doesn't stay legible once scaled
                down to fit here, and it can't show a real live event at all. One HTML/CSS
                panel — styled to match it — covers both states legibly at any size. */}
            <div className="relative flex w-full max-w-md items-center gap-4 rounded-2xl border-2 border-gold/60 bg-gradient-to-b from-panel-raised to-panel p-4 shadow-[0_0_24px_rgba(232,193,90,0.15)]">
              <div className="pointer-events-none absolute top-0 left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-gold bg-purple" />
              <Image src="/art2/crest-icon.png" alt="" width={64} height={64} className="h-12 w-12 shrink-0 object-contain" />
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-bold text-gold-bright">
                  {currentEvent ? currentEvent.name : "Soirée YRUD GAMES"}
                </p>
                <p className={`text-sm font-semibold uppercase tracking-wide ${currentEvent && isLive ? "text-crimson-bright" : "text-purple"}`}>
                  Statut : {currentEvent ? (isLive ? "En cours" : "Ouvert") : "À venir"}
                </p>
                <p className="mt-1 text-sm text-ink-muted">
                  {currentEvent
                    ? `${currentEvent.playerCount} dresseur(s) déjà inscrit(s).`
                    : "Yrud lance la soirée quand il le souhaite."}
                </p>
              </div>
            </div>

            <div className="flex w-full max-w-md justify-center gap-6">
              {currentEvent ? (
                <Link href={`/play/${currentEvent.code}`} className="relative transition-transform hover:-translate-y-1" style={{ height: "min(13vh, 150px)", aspectRatio: "520/530" }}>
                  <Image src="/art2/tile-arene.png" alt="Entrer dans l'arène" fill className="object-contain" />
                </Link>
              ) : (
                <div className="relative opacity-50 grayscale" style={{ height: "min(13vh, 150px)", aspectRatio: "520/530" }}>
                  <Image src="/art2/tile-arene.png" alt="Entrer dans l'arène (bientôt)" fill className="object-contain" />
                </div>
              )}
              <a
                href="https://discord.gg/VRBwarbm5y"
                target="_blank"
                rel="noreferrer"
                className="relative transition-transform hover:-translate-y-1"
                style={{ height: "min(13vh, 150px)", aspectRatio: "520/530" }}
              >
                <Image src="/art2/tile-communaute.png" alt="Rejoindre la communauté" fill className="object-contain" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
