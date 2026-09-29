"use client";

import { useEffect, useState } from "react";
import { AMBIANCE_TRACKS, isAmbianceSuppressed, onAmbianceSuppressionChange } from "@/lib/ambiance";
import { useSceneMood } from "./SceneMoodContext";

const VOLUME_KEY = "yrud:ambianceVolume";
const MUTED_KEY = "yrud:ambianceMuted";

function readStoredVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n : 30;
  } catch {
    return 30;
  }
}

function readStoredMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // private mode / blocked storage — the setting just won't be remembered
  }
}

// One audio element for the whole page: the bar is re-rendered as the screen
// changes (question → reveal → dialogue…), and the theme must carry on
// instead of restarting from zero each time.
let sharedAudio: HTMLAudioElement | null = null;
function audio(): HTMLAudioElement {
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.loop = true;
    sharedAudio.preload = "auto";
  }
  return sharedAudio;
}

// The floating sound bar (bottom right): plays the background theme of the
// current scene mood, with mute and volume remembered per browser. Browsers
// refuse sound before the page's first click/key, so until then it waits
// for one. It pauses by itself while something else plays its own sound.
export function AmbiancePlayer() {
  const { mood } = useSceneMood();
  const track = AMBIANCE_TRACKS[mood];
  const [volume, setVolume] = useState(30);
  const [muted, setMuted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [suppressed, setSuppressed] = useState(false);
  const [blocked, setBlocked] = useState(false);

  // Stored settings are read after mount (localStorage doesn't exist on the server render).
  useEffect(() => {
    setVolume(readStoredVolume());
    setMuted(readStoredMuted());
    setSuppressed(isAmbianceSuppressed());
    return onAmbianceSuppressionChange(() => setSuppressed(isAmbianceSuppressed()));
  }, []);

  useEffect(() => {
    const a = audio();
    a.volume = volume / 100;
    a.muted = muted;
  }, [volume, muted]);

  const shouldPlay = !!track && !muted && !suppressed;

  useEffect(() => {
    const a = audio();
    if (track && !a.src.endsWith(encodeURI(track))) a.src = track;
    if (!shouldPlay) {
      a.pause();
      return;
    }
    let cancelled = false;
    const start = () => {
      a.play()
        .then(() => !cancelled && setBlocked(false))
        .catch(() => !cancelled && setBlocked(true));
    };
    start();
    // Autoplay refused: the first click or key anywhere on the page starts it.
    const onGesture = () => start();
    window.addEventListener("pointerdown", onGesture, { once: true });
    window.addEventListener("keydown", onGesture, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, [track, shouldPlay]);

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    store(MUTED_KEY, next ? "1" : "0");
  }

  function changeVolume(v: number) {
    setVolume(v);
    store(VOLUME_KEY, String(v));
    if (muted && v > 0) {
      setMuted(false);
      store(MUTED_KEY, "0");
    }
  }

  return (
    <div className="fixed bottom-3 right-3 z-40 flex items-center gap-2 rounded-full border border-gold/20 bg-void-deep/80 py-1.5 pl-1.5 pr-2 backdrop-blur-sm">
      <button
        type="button"
        onClick={toggleMute}
        title={muted ? "Remettre la musique" : "Couper la musique"}
        aria-label={muted ? "Remettre la musique" : "Couper la musique"}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm text-ink-muted hover:text-ink"
      >
        {muted || volume === 0 ? "🔇" : "🔊"}
      </button>
      {blocked && !muted && (
        <span className="text-[10px] text-gold-bright">clique pour la musique</span>
      )}
      {suppressed && !muted && !blocked && <span className="text-[10px] text-ink-muted">en pause</span>}
      {expanded && (
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => changeVolume(Number(e.target.value))}
          className="w-24 accent-gold-bright"
          aria-label="Volume de la musique"
        />
      )}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        title="Volume"
        aria-label="Régler le volume"
        className="text-[10px] text-ink-muted hover:text-ink"
      >
        {expanded ? "▸" : "▾"}
      </button>
    </div>
  );
}
