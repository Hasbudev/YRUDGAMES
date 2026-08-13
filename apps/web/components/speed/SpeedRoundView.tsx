"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import gsap from "gsap";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SpeedQuestion,
  SpeedRoundEndedPayload,
} from "@yrud/shared";
import { playSpeedMiss, playSpeedTick } from "@/lib/sfx";

interface SpeedRoundViewProps {
  socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  endsAt: number;
  eliminated: boolean;
  result?: SpeedRoundEndedPayload;
  myPlayerId: string;
}

export function SpeedRoundView({ socket, endsAt, eliminated, result, myPlayerId }: SpeedRoundViewProps) {
  const [question, setQuestion] = useState<SpeedQuestion | null>(null);
  const [combo, setCombo] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const [remainingMs, setRemainingMs] = useState(0); // corrected immediately by the effect below
  const [busted, setBusted] = useState(false);
  const comboRef = useRef<HTMLSpanElement>(null);
  const comboCountRef = useRef(0);
  const answeringRef = useRef(false);

  useEffect(() => {
    const tick = () => setRemainingMs(Math.max(0, endsAt - Date.now()));
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [endsAt]);

  function requestNext() {
    socket.emit("speedRound:requestQuestion", (res) => {
      if ("question" in res) {
        setQuestion(res.question);
        return;
      }
      if ("busted" in res) {
        // Reconnect mid-round after already busting — server is authoritative.
        setQuestion(null);
        setBusted(true);
        return;
      }
      // done or error — stop; speedRound:ended will arrive shortly if done.
      setQuestion(null);
    });
  }

  useEffect(() => {
    if (!eliminated && !result) requestNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eliminated]);

  function answer(choiceIndex: number) {
    if (!question || answeringRef.current) return;
    answeringRef.current = true;
    socket.emit("speedRound:answer", { questionId: question.id, choiceIndex }, (res) => {
      answeringRef.current = false;
      if ("error" in res) {
        setQuestion(null);
        return;
      }
      if (res.correct) {
        comboCountRef.current += 1;
        setCombo(comboCountRef.current);
        setTotalCorrect((t) => t + 1);
        setFlash("correct");
        playSpeedTick(comboCountRef.current);
        if (comboRef.current) {
          gsap.fromTo(
            comboRef.current,
            { scale: 1 },
            { scale: 1.3 + Math.min(comboCountRef.current, 10) * 0.05, duration: 0.15, yoyo: true, repeat: 1 }
          );
        }
        setTimeout(() => setFlash(null), 150);
        setQuestion(null);
        requestNext();
      } else {
        // Sudden death — one miss ends the run. No retry.
        setFlash("wrong");
        playSpeedMiss();
        setQuestion(null);
        setBusted(true);
      }
    });
  }

  if (eliminated) {
    return <p className="text-sm text-ink-muted">Tu es éliminé(e) — regarde la manche rapide sur l&apos;arène ci-dessous.</p>;
  }

  if (result) {
    const won = result.bonusWinnerIds.includes(myPlayerId);
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <h3 className="font-display text-lg font-bold text-gold-bright">Manche rapide terminée !</h3>
        <p className="text-sm text-ink-muted">Tu as répondu correctement {totalCorrect} fois.</p>
        {won && <p className="font-bold text-gold-bright">Vie bonus gagnée !</p>}
      </div>
    );
  }

  if (busted) {
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-3 text-center">
        <span className="font-mono text-sm text-ink-muted">⏱ {Math.ceil(remainingMs / 1000)}s restantes</span>
        <div className="panel w-full rounded-xl border-crimson/50 p-6">
          <h3 className="mb-2 text-lg font-bold text-crimson-bright">Faux ! Tu es éliminé(e) pour cette manche.</h3>
          <p className="text-sm text-ink-muted">Score final : {totalCorrect} bonne(s) réponse(s).</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between text-sm">
        <span className="font-mono text-ink-muted">⏱ {Math.ceil(remainingMs / 1000)}s</span>
        <span ref={comboRef} className={`font-bold ${combo > 1 ? "text-gold-bright" : "opacity-0"}`}>
          combo x{combo}
        </span>
        <span className="text-ink-muted">✓ {totalCorrect}</span>
      </div>
      {question ? (
        <div
          className={`panel w-full rounded-xl p-6 transition-colors ${
            flash === "correct"
              ? "border-gold bg-gold/10"
              : flash === "wrong"
                ? "border-crimson bg-crimson/10"
                : ""
          }`}
        >
          <p className="mb-4 text-lg font-semibold text-ink">{question.prompt}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {question.choices.map((choice, i) => (
              <button
                key={i}
                onClick={() => answer(i)}
                className="flex items-center gap-3 rounded-xl border border-border bg-gradient-to-r from-void-deep/60 to-void-deep/30 px-4 py-3 text-left text-sm font-medium text-ink transition-all duration-150 hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-[0_6px_18px_rgba(232,193,90,0.12)]"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-strong text-xs font-bold text-ink-muted">
                  {["A", "B", "C", "D"][i] ?? i + 1}
                </span>
                {choice}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Chargement de la question suivante...</p>
      )}
    </div>
  );
}
