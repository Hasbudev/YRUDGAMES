"use client";

import { useEffect, useRef, useState } from "react";
import { loadYouTubeApi, type YTPlayer } from "@/lib/youtube";
import { AMBIANCE_TRACKS } from "@/lib/ambiance";
import { useSceneMood } from "./SceneMoodContext";

const VOLUME_KEY = "yrud:ambianceVolume";
const MUTED_KEY = "yrud:ambianceMuted";

function readStoredVolume(): number {
  if (typeof window === "undefined") return 30;
  const raw = Number(localStorage.getItem(VOLUME_KEY));
  return Number.isFinite(raw) && raw >= 0 && raw <= 100 ? raw : 30;
}

function readStoredMuted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(MUTED_KEY) === "1";
}

// A small, unobtrusive floating control — the ambiance track itself is a
// hidden YouTube player looping whatever AMBIANCE_TRACKS maps the current
// scene mood to, switching tracks as the mood changes. Silent by design
// when a mood has no track configured (AMBIANCE_TRACKS starts empty).
export function AmbiancePlayer() {
  const { mood } = useSceneMood();
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const readyRef = useRef(false);
  const [volume, setVolume] = useState(readStoredVolume);
  const [muted, setMuted] = useState(readStoredMuted);
  const [expanded, setExpanded] = useState(false);

  const trackId = AMBIANCE_TRACKS[mood];

  // Mount the (hidden) player once.
  useEffect(() => {
    let cancelled = false;
    loadYouTubeApi().then(() => {
      if (cancelled || !containerRef.current || !window.YT) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        playerVars: { controls: 0, modestbranding: 1, disablekb: 1, fs: 0, loop: 1 },
        events: {
          onReady: (event) => {
            readyRef.current = true;
            event.target.setVolume(volume);
            if (muted) event.target.mute();
            const initial = AMBIANCE_TRACKS[mood];
            if (initial) {
              event.target.loadVideoById(initial);
              event.target.playVideo();
            }
          },
        },
      });
    });
    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch track when the mood changes.
  useEffect(() => {
    if (!readyRef.current || !playerRef.current) return;
    if (trackId) {
      playerRef.current.loadVideoById(trackId);
      playerRef.current.playVideo();
    } else {
      playerRef.current.stopVideo();
    }
  }, [trackId]);

  useEffect(() => {
    if (!readyRef.current || !playerRef.current) return;
    playerRef.current.setVolume(volume);
    localStorage.setItem(VOLUME_KEY, String(volume));
  }, [volume]);

  useEffect(() => {
    if (!readyRef.current || !playerRef.current) return;
    if (muted) playerRef.current.mute();
    else playerRef.current.unMute();
    localStorage.setItem(MUTED_KEY, muted ? "1" : "0");
  }, [muted]);

  return (
    <div className="fixed bottom-3 right-3 z-40 flex items-center gap-2 rounded-full border border-gold/20 bg-void-deep/70 py-1.5 pl-1.5 pr-2 backdrop-blur-sm">
      <div ref={containerRef} className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0" />
      <button
        onClick={() => setMuted((v) => !v)}
        title={muted ? "Activer le son d'ambiance" : "Couper le son d'ambiance"}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm text-ink-muted hover:text-ink"
      >
        {muted ? "🔇" : "🔊"}
      </button>
      {expanded && (
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-20 accent-gold-bright"
          aria-label="Volume de l'ambiance"
        />
      )}
      <button
        onClick={() => setExpanded((v) => !v)}
        title="Réglages du volume"
        className="text-[10px] text-ink-muted hover:text-ink"
      >
        {expanded ? "▸" : "▾"}
      </button>
    </div>
  );
}
