import { useEffect } from "react";
import type { SceneMood } from "@/components/scene/SceneMoodContext";

// Background theme per scene mood — an audio file under apps/web/public,
// looped quietly behind the event by the floating sound bar (AmbiancePlayer).
// null = silence for that mood. Same file everywhere for now.
const THEME = "/ambiance/leon-epic.mp3";
export const AMBIANCE_TRACKS: Record<SceneMood, string | null> = {
  calm: THEME, // lobby, quiz rounds
  tense: THEME, // close calls, trap reveals
  duel: THEME, // Yrud duels, the Pokémon final battle
  finale: THEME, // end-of-event summary
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
