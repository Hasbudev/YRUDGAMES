"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import type {
  ArenaSnapshot,
  BattleLogEntry,
  BattleSnapshot,
  DuelActor,
  DuelRoll,
  EventSummary,
  GamePhase,
  PublicQuestion,
} from "@yrud/shared";
import { getPrankDefinition, type PrankDefinition } from "@yrud/shared";
import { createSocket } from "@/lib/socket-client";
import { mergePlayerJoined } from "@/lib/arena";
import { ArenaView } from "@/components/yrud/ArenaView";
import { QuestionCard } from "@/components/quiz/QuestionCard";
import { TauntOverlay } from "@/components/yrud/TauntOverlay";
import { PrankOverlay } from "@/components/prank/PrankOverlay";
import { DuelStage } from "@/components/duel/DuelStage";
import { YrudCaption } from "@/components/yrud/YrudCaption";
import { useSceneMood } from "@/components/scene/SceneMoodContext";
import { AmbiancePlayer } from "@/components/scene/AmbiancePlayer";
import { FinalBattleView } from "@/components/battle/FinalBattleView";
import { InterferenceCutIn } from "@/components/battle/InterferenceCutIn";
import { YrudDialogue } from "@/components/yrud/YrudDialogue";
import { INTRO_LINES, combatLines, roundIntroLines } from "@/lib/yrudDialogue";
import { EndGameSummary } from "@/components/summary/EndGameSummary";
import { GrandFinaleScreen } from "@/components/summary/GrandFinaleScreen";
import { RevealCard } from "@/components/quiz/RevealCard";

const FINALE_LINES = ["Il ne reste qu'un vainqueur... voyons de quoi il ou elle est fait(e)."];

interface ActiveDuel {
  opponentId: string;
  rollLog: DuelRoll[];
  winner?: DuelActor;
}

// Read-only twin of PlayClient — no name/clan entry, no player:join, no
// answer submission. Just connects to the room's socket and renders
// whatever every player already sees, purely for an audience to watch on a
// shared screen.
export function WatchClient({ code }: { code: string }) {
  const [connectError, setConnectError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ArenaSnapshot | null>(null);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [winnerIds, setWinnerIds] = useState<string[] | null>(null);
  const [summary, setSummary] = useState<EventSummary | null>(null);
  const [battleFinalWinnerId, setBattleFinalWinnerId] = useState<string | null | undefined>(undefined);
  const [activeTaunt, setActiveTaunt] = useState<{ message: string; key: number } | null>(null);
  const [activePrank, setActivePrank] = useState<{ def: PrankDefinition; text: string; key: number } | null>(null);
  const [activeDuel, setActiveDuel] = useState<ActiveDuel | null>(null);
  const [caption, setCaption] = useState<{ message: string; key: number } | null>(null);
  const [battleSnapshot, setBattleSnapshot] = useState<BattleSnapshot | null>(null);
  const [battleLog, setBattleLog] = useState<BattleLogEntry[]>([]);
  const [battlePlan, setBattlePlan] = useState<string | undefined>(undefined);
  const [activeInterference, setActiveInterference] = useState<{ label: string; key: number } | null>(null);
  const [pendingCombat, setPendingCombat] = useState<{ player1: string; player2: string } | null>(null);
  const { setMood, flash } = useSceneMood();
  const prevPhaseRef = useRef<GamePhase | null>(null);
  const captionCounter = useRef(0);

  const fireCaption = useCallback((pool: string[]) => {
    captionCounter.current += 1;
    setCaption({ message: pool[Math.floor(Math.random() * pool.length)], key: captionCounter.current });
  }, []);

  useEffect(() => {
    const socket = createSocket(code, "spectator");

    socket.on("error:message", ({ message }) => setConnectError(message));
    socket.on("player:joined", (player) => setSnapshot((prev) => mergePlayerJoined(prev, player)));
    socket.on("state:sync", (snap) => {
      setSnapshot(snap);
      setQuestion(snap.question ?? null);
      if (snap.activeDuel) setActiveDuel({ opponentId: snap.activeDuel.opponentId, rollLog: snap.activeDuel.rollLog });
      if (snap.battle ?? snap.lastBattleSnapshot) setBattleSnapshot(snap.battle ?? snap.lastBattleSnapshot ?? null);
      if (snap.battleLog) setBattleLog(snap.battleLog.slice(-300));
      if (snap.battlePlan) setBattlePlan(snap.battlePlan);
    });
    socket.on("question:new", (q) => setQuestion(q));
    socket.on("game:finished", ({ winnerIds, summary }) => {
      setWinnerIds(winnerIds);
      setSummary(summary);
      setMood("finale");
      fireCaption(FINALE_LINES);
    });
    socket.on("combat:announce", ({ player1, player2 }) => {
      setPendingCombat({ player1: player1.name, player2: player2.name });
      setMood("finale");
    });
    socket.on("yrud:taunt", ({ message }) => setActiveTaunt({ message, key: Date.now() }));
    socket.on("prank:trigger", ({ prankId, text }) => {
      const def = getPrankDefinition(prankId);
      if (def) setActivePrank({ def, text, key: Date.now() });
    });
    socket.on("duel:start", ({ opponentId }) => {
      setActiveDuel({ opponentId, rollLog: [] });
      setMood("duel");
    });
    socket.on("duel:roll", (roll) =>
      setActiveDuel((prev) => (prev ? { ...prev, rollLog: [...prev.rollLog, roll] } : prev))
    );
    socket.on("duel:end", ({ opponentId, winner, rollLog }) => setActiveDuel({ opponentId, rollLog, winner }));
    socket.on("battle:snapshot", ({ snapshot: snap, log }) => {
      setBattleSnapshot(snap);
      setBattleLog((prev) => [...prev, ...log].slice(-300));
    });
    socket.on("battle:interference", ({ label }) => setActiveInterference({ label, key: Date.now() }));
    socket.on("battle:end", ({ winnerId }) => {
      setMood("finale");
      setTimeout(() => setBattleFinalWinnerId(winnerId), 3800);
    });
    socket.on("battle:plan", ({ text }) => setBattlePlan(text));

    return () => {
      socket.disconnect();
    };
  }, [code, flash, setMood, fireCaption]);

  useEffect(() => {
    if (!snapshot) return;
    const phase = snapshot.phase;
    if (prevPhaseRef.current !== phase) {
      if (phase === "battle") setMood("duel");
      prevPhaseRef.current = phase;
    }
  }, [snapshot, setMood]);

  const header = (
    <div className="relative w-full max-w-lg">
      <Image src="/play/header-bar.png" alt="" width={1415} height={185} className="h-auto w-full" priority />
      <span
        className="absolute flex items-center justify-center overflow-hidden font-display text-xs font-bold leading-none tracking-[0.02em] text-gold-bright sm:text-sm"
        style={{ left: "73.5%", right: "14%", top: "58%", bottom: "25%" }}
      >
        {code}
      </span>
    </div>
  );

  if (connectError) {
    return (
      <div className="flex flex-col items-center gap-6">
        {header}
        <p className="text-crimson-bright">{connectError}</p>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="flex flex-col items-center gap-6">
        {header}
        <p className="text-sm text-ink-muted">Connexion...</p>
      </div>
    );
  }

  const overlays = (
    <>
      <AmbiancePlayer />
      {activeTaunt && <TauntOverlay message={activeTaunt.message} onDone={() => setActiveTaunt(null)} />}
      {activePrank && (
        <PrankOverlay prank={activePrank.def} text={activePrank.text} onDone={() => setActivePrank(null)} />
      )}
      {activeDuel &&
        (() => {
          const opponent = snapshot.players.find((p) => p.id === activeDuel.opponentId);
          return (
            <DuelStage
              opponentName={opponent?.name ?? "???"}
              opponentId={activeDuel.opponentId}
              opponentClan={opponent?.clan}
              rollLog={activeDuel.rollLog}
              winner={activeDuel.winner}
              onDone={() => {
                setActiveDuel(null);
                setMood("calm");
              }}
            />
          );
        })()}
      {caption && <YrudCaption message={caption.message} captionKey={caption.key} />}
      {activeInterference && (
        <InterferenceCutIn label={activeInterference.label} onDone={() => setActiveInterference(null)} />
      )}
    </>
  );

  const battleSection = battleSnapshot && (
    <FinalBattleView
      snapshot={battleSnapshot}
      log={battleLog}
      request={null}
      onChooseMove={() => {}}
      onSwitch={() => {}}
      onForfeit={() => {}}
      viewerPlayerId={null}
      players={snapshot.players}
      battlePlan={battlePlan}
      eventCode={code}
    />
  );

  if (snapshot.phase === "intro") {
    return <YrudDialogue lines={INTRO_LINES} waitingLabel="En attente que Yrud lance la Manche 1..." />;
  }

  if (snapshot.phase === "roundIntro" && question) {
    return (
      <YrudDialogue
        lines={roundIntroLines(question.roundIndex, question.roundLabel)}
        waitingLabel={`En attente que Yrud lance la Manche ${question.roundIndex}...`}
      />
    );
  }

  if (pendingCombat && snapshot.phase !== "battle" && !battleSnapshot && battleFinalWinnerId === undefined) {
    return (
      <YrudDialogue
        lines={combatLines(pendingCombat.player1, pendingCombat.player2)}
        waitingLabel="En attente que Yrud lance la Bataille Finale..."
      />
    );
  }

  if (battleFinalWinnerId !== undefined) {
    return (
      <div className="flex w-full flex-col items-center gap-6">
        {overlays}
        {header}
        <GrandFinaleScreen winnerId={battleFinalWinnerId} players={snapshot.players} summary={summary} />
      </div>
    );
  }

  if (winnerIds && snapshot.phase !== "battle" && !battleSnapshot) {
    return (
      <div className="flex w-full flex-col items-center gap-8">
        {overlays}
        {header}
        {summary ? <EndGameSummary summary={summary} /> : <ArenaView snapshot={snapshot} />}
      </div>
    );
  }

  if (battleSection && snapshot.phase !== "question") {
    return (
      <div className="flex w-full flex-col items-center gap-6">
        {overlays}
        {battleSection}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-8">
      {overlays}
      {header}
      <p className="text-xs uppercase tracking-wide text-ink-muted">Mode spectateur</p>
      <div key={snapshot.phase} className="animate-scene-enter flex w-full flex-col items-center">
        {question && snapshot.phase === "question" ? (
          <QuestionCard key={question.id} question={question} disabled selectedIndex={null} onAnswer={() => {}} />
        ) : question && snapshot.phase === "reveal" && snapshot.lastReveal ? (
          <RevealCard
            key={`reveal-${question.id}`}
            question={question}
            correctIndex={snapshot.lastReveal.correctIndex}
            trap={snapshot.lastReveal.trap}
            allCorrect={snapshot.lastReveal.allCorrect}
          />
        ) : (
          <p className="text-sm text-ink-muted">En attente que Yrud lance la prochaine question...</p>
        )}
      </div>
      <ArenaView snapshot={snapshot} />
    </div>
  );
}
