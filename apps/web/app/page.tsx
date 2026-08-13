"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { listOpenEvents, type OpenEventSummary } from "@/lib/api";

export default function Home() {
  const [events, setEvents] = useState<OpenEventSummary[] | null>(null);

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

  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-hidden px-6 py-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(106,95,214,0.25), transparent 40%), radial-gradient(circle at 80% 0%, rgba(232,193,90,0.18), transparent 45%)",
        }}
      />

      <Image src="/art/Logo_RPPLF.png" alt="RPPLF — League France" width={96} height={96} className="relative drop-shadow-[0_0_18px_rgba(232,193,90,0.25)]" priority />

      <div className="relative mt-10 flex w-full max-w-5xl animate-scene-enter flex-col items-center gap-14 md:flex-row md:items-start md:justify-center">
        <div className="relative w-56 shrink-0 md:w-72">
          <div className="absolute inset-0 -z-10 animate-pulse rounded-full bg-gold/20 blur-3xl" />
          <Image
            src="/art/yrud.png"
            alt="Yrud"
            width={1024}
            height={1536}
            priority
            className="w-full drop-shadow-[0_10px_40px_rgba(0,0,0,0.6)]"
          />
        </div>

        <div className="flex flex-col items-center gap-4 text-center md:items-start md:pb-8 md:text-left">
          <h1 className="font-display text-glow-gold text-5xl font-black tracking-wide text-gold-bright sm:text-6xl">
            YRUD GAMES
          </h1>
          <p className="max-w-md text-sm text-ink-muted">
            Un battle royale de quiz animé en direct par Yrud. Trois vies, aucune pitié.
          </p>

          <div className="mt-4 flex w-full max-w-sm flex-col gap-3 overflow-y-auto pr-1 md:max-h-[420px]">
            {events === null && <p className="text-center text-sm text-ink-muted md:text-left">Recherche d&apos;événements ouverts...</p>}
            {events?.length === 0 && (
              <p className="text-center text-sm text-ink-muted md:text-left">
                Aucun événement n&apos;est ouvert pour le moment. Reviens bientôt.
              </p>
            )}
            {events?.map((event) => (
              <Link
                key={event.code}
                href={`/play/${event.code}`}
                className="panel group flex items-center justify-between rounded-xl px-5 py-4 transition-all hover:border-border-strong hover:shadow-[0_0_20px_rgba(232,193,90,0.15)]"
              >
                <div>
                  <p className="font-semibold text-ink">{event.name}</p>
                  <p className="text-xs text-ink-muted">
                    {event.status === "live" ? "En cours" : "Salon ouvert"} · {event.playerCount} inscrit(s)
                  </p>
                </div>
                <span className="rounded-full bg-gold px-3 py-1 text-xs font-bold text-void-deep transition-transform group-hover:scale-105">
                  Rejoindre
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
