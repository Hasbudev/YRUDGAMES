"use client";

import { useEffect, useRef, useState } from "react";

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  getPlayerState(): number;
  destroy(): void;
}

interface YTPlayerOptions {
  videoId: string;
  playerVars?: Record<string, number | string>;
  events?: {
    onReady?: (event: { target: YTPlayer }) => void;
    onStateChange?: (event: { data: number; target: YTPlayer }) => void;
    onError?: () => void;
  };
}

declare global {
  interface Window {
    YT?: { Player: new (element: HTMLElement, options: YTPlayerOptions) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

const YT_PLAYING = 1;
const BAR_COUNT = 12;

// Loaded once for the whole app — a second BlindTestPlayer mount (e.g. after
// a fast-refresh) just resolves immediately against the cached script/global.
let apiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve();
      return;
    }
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve();
    };
    if (!document.getElementById("youtube-iframe-api")) {
      const script = document.createElement("script");
      script.id = "youtube-iframe-api";
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
  });
  return apiPromise;
}

interface BlindTestPlayerProps {
  youtubeId: string;
  startSeconds: number;
  clipDurationMs: number;
}

export function BlindTestPlayer({ youtubeId, startSeconds, clipDurationMs }: BlindTestPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const barsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<"loading" | "waiting-for-click" | "playing" | "done">("loading");
  const [bars, setBars] = useState<number[]>(Array(BAR_COUNT).fill(0.15));

  useEffect(() => {
    let cancelled = false;

    function stopVisualizer() {
      if (barsIntervalRef.current) clearInterval(barsIntervalRef.current);
      barsIntervalRef.current = null;
      setBars(Array(BAR_COUNT).fill(0.15));
    }

    function handlePlaying() {
      if (cancelled) return;
      setStatus("playing");
      if (!barsIntervalRef.current) {
        barsIntervalRef.current = setInterval(() => {
          setBars(Array.from({ length: BAR_COUNT }, () => 0.15 + Math.random() * 0.85));
        }, 90);
      }
      if (!stopTimeoutRef.current) {
        stopTimeoutRef.current = setTimeout(() => {
          playerRef.current?.pauseVideo();
          stopVisualizer();
          if (!cancelled) setStatus("done");
        }, clipDurationMs);
      }
    }

    loadYouTubeApi().then(() => {
      if (cancelled || !containerRef.current || !window.YT) return;
      const player = new window.YT.Player(containerRef.current, {
        videoId: youtubeId,
        playerVars: {
          start: startSeconds,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          disablekb: 1,
          fs: 0,
        },
        events: {
          onReady: (event) => {
            playerRef.current = event.target;
            event.target.playVideo();
            setTimeout(() => {
              if (cancelled) return;
              if (playerRef.current?.getPlayerState() !== YT_PLAYING) setStatus("waiting-for-click");
            }, 1200);
          },
          onStateChange: (event) => {
            if (event.data === YT_PLAYING) handlePlaying();
          },
          onError: () => setStatus("done"),
        },
      });
      playerRef.current = player;
    });

    return () => {
      cancelled = true;
      if (barsIntervalRef.current) clearInterval(barsIntervalRef.current);
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [youtubeId, startSeconds, clipDurationMs]);

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-gold/30 bg-void-deep/50 px-6 py-5 shadow-[inset_0_1px_0_rgba(232,193,90,0.1)]">
      {/* The player itself must exist in the DOM for the API, but is never
          shown — seeing the video/title would give the answer away. */}
      <div ref={containerRef} className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0" />
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
      {status === "waiting-for-click" && (
        <button onClick={() => playerRef.current?.playVideo()} className="btn-gold rounded-full">
          🔊 Lancer l&apos;extrait
        </button>
      )}
      {status === "loading" && <p className="text-sm text-ink-muted">Chargement de l&apos;extrait...</p>}
      {status === "playing" && (
        <p className="text-sm font-semibold text-gold-bright drop-shadow-[0_0_6px_rgba(232,193,90,0.5)]">
          🎵 Écoutez bien...
        </p>
      )}
      {status === "done" && <p className="text-sm text-ink-muted">Extrait terminé.</p>}
    </div>
  );
}
