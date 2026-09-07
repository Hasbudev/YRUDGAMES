"use client";

import { useEffect, useRef, useState } from "react";

const BAR_COUNT = 12;

interface LocalBlindTestPlayerProps {
  /** Filename under apps/web/public/blindtest, e.g. "1ZoneZero.wav". */
  audioFile: string;
}

// Blind test clips are the user's own local audio files now (no more
// YouTube embed) — plain HTML5 audio, looped, with no auto-stop. Yrud
// decides live when the round is over and hits "reveal" himself, so there's
// nothing here to time out on.
export function LocalBlindTestPlayer({ audioFile }: LocalBlindTestPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const barsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [status, setStatus] = useState<"loading" | "waiting-for-click" | "playing" | "paused">("loading");
  const [bars, setBars] = useState<number[]>(Array(BAR_COUNT).fill(0.15));

  const src = `/blindtest/${encodeURIComponent(audioFile)}`;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.9;
    audio
      .play()
      .then(() => setStatus("playing"))
      .catch(() => setStatus("waiting-for-click"));

    function onPlay() {
      setStatus("playing");
      if (!barsIntervalRef.current) {
        barsIntervalRef.current = setInterval(() => {
          setBars(Array.from({ length: BAR_COUNT }, () => 0.15 + Math.random() * 0.85));
        }, 90);
      }
    }
    function onPause() {
      setStatus("paused");
      if (barsIntervalRef.current) clearInterval(barsIntervalRef.current);
      barsIntervalRef.current = null;
      setBars(Array(BAR_COUNT).fill(0.15));
    }

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      if (barsIntervalRef.current) clearInterval(barsIntervalRef.current);
      barsIntervalRef.current = null;
    };
  }, [audioFile]);

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-gold/30 bg-void-deep/50 px-6 py-5 shadow-[inset_0_1px_0_rgba(232,193,90,0.1)]">
      <audio ref={audioRef} src={src} loop />
      <div className="flex h-16 items-end gap-1.5">
        {bars.map((h, i) => (
          <div
            key={i}
            className={`w-2.5 rounded-t-full transition-transform duration-75 ${
              status === "playing"
                ? "bg-gradient-to-t from-gold to-gold-bright shadow-[0_0_8px_rgba(232,193,90,0.6)]"
                : "bg-white/10"
            }`}
            style={{ height: "100%", transform: `scaleY(${h})`, transformOrigin: "bottom" }}
          />
        ))}
      </div>
      {(status === "waiting-for-click" || status === "paused") && (
        <button onClick={() => audioRef.current?.play()} className="btn-gold rounded-full">
          🔊 {status === "paused" ? "Reprendre" : "Lancer"} l&apos;extrait
        </button>
      )}
      {status === "loading" && <p className="text-sm text-ink-muted">Chargement de l&apos;extrait...</p>}
      {status === "playing" && (
        <p className="text-sm font-semibold text-gold-bright drop-shadow-[0_0_6px_rgba(232,193,90,0.5)]">
          🎵 Écoutez bien...
        </p>
      )}
    </div>
  );
}
