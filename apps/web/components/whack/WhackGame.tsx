"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ARTY_POPUP_MS,
  MOLE_KINDS,
  RUDY_BOOST_LABEL,
  RUDY_BOOST_MS,
  RUDY_BOOST_MULTIPLIER,
  WHACK_HOLES,
  WHACK_MUSIC_RATE,
  WHACK_MUSIC_URL,
  WHACK_VOICE_AT_MS,
  WHACK_VOICE_URL,
  whackSchedule,
  whackScore,
  type Mole,
  type PublicQuestion,
  type WhackHit,
} from "@yrud/shared";
import { playWhack } from "@/lib/sfx";
import { OrnatePanel } from "@/components/quiz/OrnatePanel";
import { MoleSprite } from "./MoleSprite";

// How long a mole takes to pop up / duck back down, inside its visible window.
const RISE_MS = 140;

const ARTY_LINES = [
  "Mon avis : cette partie est nulle.",
  "Avis : tu tapes comme un Ramoloss.",
  "Petit avis rapide sur ton gameplay...",
  "Avis important : regarde plutôt mon replay.",
];

interface Floater {
  key: number;
  hole: number;
  text: string;
  good: boolean;
}

interface WhackGameProps {
  question: PublicQuestion;
  // Omitted for spectators: the board plays, nothing is tappable.
  onWhack?: (moleId: number) => void;
  // A Yrud prank is on screen (the game is paused) — the music waits too.
  paused?: boolean;
}

// The chasse-taupes board. Timing is derived from the server's startedAt (via
// the clock offset from serverNow), so a Yrud prank that pauses the game —
// it pushes startedAt forward — freezes the board here too.
export function WhackGame({ question, onWhack, paused }: WhackGameProps) {
  const whack = question.metadata?.whack;
  const durationMs = whack?.durationMs ?? 0;
  const seed = whack?.seed;
  const schedule = useMemo(() => (seed !== undefined ? whackSchedule(seed, durationMs) : []), [seed, durationMs]);

  const clockRef = useRef({ offset: 0, startedAt: question.startedAt });
  useEffect(() => {
    clockRef.current = { offset: question.serverNow - Date.now(), startedAt: question.startedAt };
  }, [question.serverNow, question.startedAt]);

  // `now` (wall clock) drives the Artymasion popup, which must last its 3 s
  // even if a pause rewinds `elapsed` (the game clock).
  const [{ now, elapsed }, setClock] = useState({ now: 0, elapsed: -1 });
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const { offset, startedAt } = clockRef.current;
      const wall = Date.now();
      setClock({ now: wall, elapsed: wall + offset - startedAt });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const [hits, setHits] = useState<WhackHit[]>([]);
  const [popup, setPopup] = useState<{ until: number; line: string } | null>(null);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const floaterKey = useRef(0);

  const hitIds = useMemo(() => new Set(hits.map((h) => h.moleId)), [hits]);
  const score = useMemo(() => whackScore(schedule, hits), [schedule, hits]);
  const lastRudy = [...hits].reverse().find((h) => schedule[h.moleId]?.kind === "rudy");
  const boostLeft = lastRudy ? lastRudy.atMs + RUDY_BOOST_MS - elapsed : 0;
  const popupLeft = popup ? popup.until - now : 0;
  const over = elapsed >= durationMs;

  const byHole: (Mole | undefined)[] = Array.from({ length: WHACK_HOLES }, () => undefined);
  for (const m of schedule) {
    if (elapsed >= m.appearAt && elapsed < m.hideAt && !hitIds.has(m.id)) byHole[m.hole] = m;
  }

  function tap(mole: Mole) {
    if (!onWhack || over || popupLeft > 0 || hitIds.has(mole.id)) return;
    const def = MOLE_KINDS[mole.kind];
    const boosted = def.points > 0 && boostLeft > 0;
    setHits((prev) => [...prev, { moleId: mole.id, atMs: elapsed }]);
    onWhack(mole.id);
    playWhack(def.points >= 0);

    const text =
      def.effect === "boost"
        ? `${RUDY_BOOST_LABEL} !`
        : def.effect === "popup"
          ? "AVIS"
          : `${def.points > 0 ? "+" : "−"}${String(Math.round(Math.abs(def.points * (boosted ? RUDY_BOOST_MULTIPLIER : 1)) * 10) / 10).replace(".", ",")}`;
    floaterKey.current += 1;
    const key = floaterKey.current;
    setFloaters((prev) => [...prev, { key, hole: mole.hole, text, good: def.points >= 0 }]);
    setTimeout(() => setFloaters((prev) => prev.filter((f) => f.key !== key)), 900);

    if (def.effect === "popup") {
      setPopup({ until: now + ARTY_POPUP_MS, line: ARTY_LINES[mole.id % ARTY_LINES.length] });
    }
  }

  const remaining = Math.max(0, durationMs - Math.max(0, elapsed));

  // The live mix: the music for the length of the game (silent during a
  // prank), speeding up as the moles do, with the voice clip dropped in once
  // at WHACK_VOICE_AT_MS while the music ducks under it.
  const musicRef = useRef<HTMLAudioElement>(null);
  const voiceRef = useRef<HTMLAudioElement>(null);
  const [voiceState, setVoiceState] = useState<"waiting" | "playing" | "done">("waiting");
  const musicOn = elapsed >= 0 && !over && !paused;
  const voiceOn = musicOn && voiceState === "playing";
  if (voiceState === "waiting" && musicOn && elapsed >= WHACK_VOICE_AT_MS) setVoiceState("playing");

  useEffect(() => {
    const audio = musicRef.current;
    if (!audio) return;
    if (musicOn) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [musicOn]);

  useEffect(() => {
    const voice = voiceRef.current;
    if (!voice) return;
    if (voiceOn) {
      voice.volume = 1;
      voice.play().catch(() => setVoiceState("done"));
    } else {
      voice.pause();
    }
  }, [voiceOn]);

  // Tempo follows the game; stepped to 0.01 so it isn't reset every frame.
  const rate =
    remaining <= WHACK_MUSIC_RATE.finalRushMs
      ? WHACK_MUSIC_RATE.finalRush
      : WHACK_MUSIC_RATE.start +
        (WHACK_MUSIC_RATE.end - WHACK_MUSIC_RATE.start) * Math.min(1, Math.max(0, elapsed) / Math.max(1, durationMs));
  const steppedRate = Math.round(rate * 100) / 100;
  useEffect(() => {
    const audio = musicRef.current;
    if (!audio) return;
    audio.preservesPitch = false; // pitch rises with the tempo — arcade feel
    audio.playbackRate = steppedRate;
  }, [steppedRate]);

  useEffect(() => {
    const audio = musicRef.current;
    if (audio) audio.volume = voiceOn ? 0.2 : 0.6;
  }, [voiceOn]);

  return (
    <OrnatePanel className="animate-scene-enter w-full max-w-2xl">
      <audio ref={musicRef} src={WHACK_MUSIC_URL} loop preload="auto" />
      <audio ref={voiceRef} src={WHACK_VOICE_URL} preload="auto" onEnded={() => setVoiceState("done")} />
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 font-semibold uppercase tracking-wide text-gold-bright">
            Chasse-taupes
          </span>
          {boostLeft > 0 && !over && (
            <span className="animate-pulse rounded-full border border-emerald-400/60 bg-emerald-400/15 px-3 py-1 font-display font-black text-emerald-300">
              RUDY {RUDY_BOOST_LABEL} · {(boostLeft / 1000).toFixed(1)} s
            </span>
          )}
          {onWhack && (
            <span className="font-display text-lg font-black tabular-nums text-gold-bright">
              {score} pt{Math.abs(score) === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-void-deep/70">
          <div
            className="h-full bg-gradient-to-r from-gold to-gold-bright"
            style={{ width: `${durationMs ? (remaining / durationMs) * 100 : 0}%` }}
          />
        </div>

        {/* Capped by the viewport height so all three rows fit on a laptop/phone
            screen without scrolling mid-game. */}
        <div className="relative mx-auto w-full" style={{ maxWidth: "min(100%, 58vh)" }}>
          <div className="grid touch-manipulation select-none grid-cols-3 gap-2 sm:gap-3">
            {byHole.map((mole, hole) => {
              const rise = mole
                ? Math.min(1, (elapsed - mole.appearAt) / RISE_MS, (mole.hideAt - elapsed) / RISE_MS)
                : 0;
              return (
                <div
                  key={hole}
                  className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-emerald-900/40 to-void-deep/60"
                >
                  <div className="absolute inset-x-[12%] bottom-[8%] h-[22%] rounded-[50%] bg-black/70 shadow-[inset_0_6px_10px_rgba(0,0,0,0.8)]" />
                  {mole && (
                    <button
                      type="button"
                      aria-label={MOLE_KINDS[mole.kind].label}
                      disabled={!onWhack}
                      onPointerDown={() => tap(mole)}
                      className="absolute inset-x-[10%] bottom-[14%] top-[6%] flex items-end justify-center disabled:cursor-default"
                      style={{ transform: `translateY(${(1 - Math.max(0, rise)) * 100}%)` }}
                    >
                      <MoleSprite kind={mole.kind} className="h-full w-full" />
                    </button>
                  )}
                  {floaters
                    .filter((f) => f.hole === hole)
                    .map((f) => (
                      <span
                        key={f.key}
                        className={`pointer-events-none absolute inset-x-0 top-[20%] text-center font-display text-2xl font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] ${
                          f.good ? "text-gold-bright" : "text-crimson-bright"
                        }`}
                        style={{ animation: "float-up-fade 0.9s ease-out forwards" }}
                      >
                        {f.text}
                      </span>
                    ))}
                </div>
              );
            })}
          </div>

          {popup && popupLeft > 0 && (
            <div className="absolute inset-[-8px] z-20 flex items-center justify-center rounded-2xl bg-black/60 backdrop-blur-sm">
              <div className="animate-scene-enter flex w-[90%] flex-col items-center gap-3 rounded-2xl border-4 border-crimson bg-gradient-to-b from-[#fff8e6] to-[#f3dfb0] p-5 text-center shadow-[0_0_40px_rgba(217,88,74,0.6)]">
                <MoleSprite kind="artymasion" className="h-24 w-24" />
                <p className="font-display text-3xl font-black uppercase tracking-wide text-crimson">📢 Avis</p>
                <p className="font-display text-lg font-bold text-[#3a2a12]">{popup.line}</p>
                <p className="text-xs font-semibold text-[#7a5a2a]">— Artymasion · {Math.ceil(popupLeft / 1000)} s</p>
              </div>
            </div>
          )}

          {(elapsed < 0 || over) && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-black/50">
              <p className="font-display text-xl font-black text-gold-bright">
                {over ? "Temps écoulé ! Résultats dans un instant..." : "Prêt ?"}
              </p>
            </div>
          )}
        </div>

        {!onWhack && <p className="text-center text-xs text-ink-muted">Mode spectateur — les joueurs tapent sur leur écran.</p>}
      </div>
    </OrnatePanel>
  );
}
