"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

export type SceneMood = "calm" | "tense" | "duel" | "finale";

interface SceneMoodValue {
  mood: SceneMood;
  flashKey: number;
  setMood: (mood: SceneMood) => void;
  flash: () => void;
}

const SceneMoodContext = createContext<SceneMoodValue | null>(null);

export function SceneMoodProvider({ children }: { children: React.ReactNode }) {
  const [mood, setMoodState] = useState<SceneMood>("calm");
  const [flashKey, setFlashKey] = useState(0);
  const flashCounter = useRef(0);

  const setMood = useCallback((next: SceneMood) => setMoodState(next), []);
  const flash = useCallback(() => {
    flashCounter.current += 1;
    setFlashKey(flashCounter.current);
  }, []);

  const value = useMemo(() => ({ mood, flashKey, setMood, flash }), [mood, flashKey, setMood, flash]);

  return <SceneMoodContext.Provider value={value}>{children}</SceneMoodContext.Provider>;
}

export function useSceneMood() {
  const ctx = useContext(SceneMoodContext);
  if (!ctx) throw new Error("useSceneMood must be used within SceneMoodProvider");
  return ctx;
}
