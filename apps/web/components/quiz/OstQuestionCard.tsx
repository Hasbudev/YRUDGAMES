"use client";

import { useEffect, useRef, useState } from "react";
import { playMelody } from "@/lib/sfx";

interface OstPlayerProps {
  notes?: { freq: number; durationMs: number }[];
  mediaUrl?: string;
}

const BAR_COUNT = 12;

export function OstPlayer({ notes, mediaUrl }: OstPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [bars, setBars] = useState<number[]>(Array(BAR_COUNT).fill(0.15));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const totalDurationMs = (notes ?? []).reduce((sum, n) => sum + n.durationMs, 0) || 800;

  function stopVisualizer() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setBars(Array(BAR_COUNT).fill(0.15));
    setPlaying(false);
  }

  function play() {
    if (playing) return;
    setPlaying(true);
    intervalRef.current = setInterval(() => {
      setBars(Array.from({ length: BAR_COUNT }, () => 0.15 + Math.random() * 0.85));
    }, 90);

    // A real clip (once Rudy provides one) always wins over the synthesized
    // placeholder melody — the visualizer just rides whichever is playing.
    if (mediaUrl) {
      const audio = new Audio(mediaUrl);
      audioRef.current = audio;
      audio.addEventListener("ended", stopVisualizer);
      audio.addEventListener("error", stopVisualizer);
      audio.play().catch(stopVisualizer);
      return;
    }

    if (notes && notes.length > 0) {
      playMelody(notes);
      setTimeout(stopVisualizer, totalDurationMs);
    } else {
      stopVisualizer();
    }
  }

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      audioRef.current?.pause();
    };
  }, []);

  const disabled = playing || (!mediaUrl && (!notes || notes.length === 0));

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-gold/30 bg-void-deep/50 px-6 py-5 shadow-[inset_0_1px_0_rgba(232,193,90,0.1)]">
      <div className="flex h-16 items-end gap-1.5">
        {bars.map((h, i) => (
          <div
            key={i}
            className={`w-2.5 rounded-t-full transition-transform duration-75 ${
              playing
                ? "bg-gradient-to-t from-gold to-gold-bright shadow-[0_0_8px_rgba(232,193,90,0.6)]"
                : "bg-white/10"
            }`}
            style={{ height: "100%", transform: `scaleY(${h})`, transformOrigin: "bottom" }}
          />
        ))}
      </div>
      <button onClick={play} disabled={disabled} className="btn-gold rounded-full">
        {playing ? "🎵 Lecture..." : "▶ Écouter l'extrait"}
      </button>
    </div>
  );
}
