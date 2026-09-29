import { useEffect } from "react";
import type { SceneMood } from "@/components/scene/SceneMoodContext";

// Background playlist per scene mood — audio files under apps/web/public,
// played one after the other and looped by the floating sound bar
// (AmbiancePlayer). An empty list = silence for that mood. Same playlist
// everywhere for now.
const PLAYLIST = ["/ambiance/leon-epic.mp3", "/ambiance/leon-remix.mp3"];
export const AMBIANCE_TRACKS: Record<SceneMood, string[]> = {
  calm: PLAYLIST, // lobby, quiz rounds
  tense: PLAYLIST, // close calls, trap reveals
  duel: PLAYLIST, // Yrud duels, the Pokémon final battle
  finale: PLAYLIST, // end-of-event summary
};

// Anything that plays its own sound (a blind-test clip, the chasse-taupes
// music, a video prank) pauses the ambiance while it's on screen.
let suppressors = 0;
const listeners = new Set<() => void>();

export function isAmbianceSuppressed(): boolean {
  return suppressors > 0;
}

export function onAmbianceSuppressionChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function suppressAmbiance(): () => void {
  suppressors += 1;
  listeners.forEach((l) => l());
  return () => {
    suppressors -= 1;
    listeners.forEach((l) => l());
  };
}

// Pauses the ambiance while `active` (and the calling component is mounted).
export function useSuppressAmbiance(active = true) {
  useEffect(() => (active ? suppressAmbiance() : undefined), [active]);
}
