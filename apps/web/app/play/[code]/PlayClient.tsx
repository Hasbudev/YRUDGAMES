"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type {
  ArenaSnapshot,
  BattleChoiceRequest,
  BattleLogEntry,
  BattleSnapshot,
  ClientToServerEvents,
  DuelActor,
  DuelRoll,
  EventSummary,
  GamePhase,
  PublicQuestion,
  ServerToClientEvents,
  SpeedRoundEndedPayload,
} from "@yrud/shared";
import { AVATAR_REGISTRY, getPrankDefinition, type PrankDefinition } from "@yrud/shared";
import { createSocket } from "@/lib/socket-client";
import { mergePlayerJoined, mergeSpeedProgress } from "@/lib/arena";
import { ArenaView } from "@/components/yrud/ArenaView";
import { QuestionCard } from "@/components/quiz/QuestionCard";
import { SpeedRoundView } from "@/components/speed/SpeedRoundView";
import { TauntOverlay } from "@/components/yrud/TauntOverlay";
import { PrankOverlay } from "@/components/prank/PrankOverlay";
import { DuelStage } from "@/components/duel/DuelStage";
import { YrudCaption } from "@/components/yrud/YrudCaption";
import { useSceneMood } from "@/components/scene/SceneMoodContext";
import { AvatarIcon } from "@/components/yrud/AvatarIcon";
import { HeartRow } from "@/components/yrud/HeartRow";
import { BattleStage } from "@/components/battle/BattleStage";
import { BattleLogFeed } from "@/components/battle/BattleLogFeed";
import { MoveChooser } from "@/components/battle/MoveChooser";
import { InterferenceCutIn } from "@/components/battle/InterferenceCutIn";
import { EndGameSummary } from "@/components/summary/EndGameSummary";

function storageKey(code: string) {
  return `yrud:playerId:${code}`;
}

const GAME_START_LINES = [
  "Que la chasse commence... un seul faux pas et vous quittez mon arène.",
  "Bienvenue dans mon arène. Voyons qui tremble en premier.",
  "Vos vies m'appartiennent déjà. Prouvez-moi le contraire.",
];
const SPEED_LINES = [
  "Manche rapide ! Une seule erreur et c'est terminé pour vous.",
  "Vite, vite... l'arène n'attend pas les lents.",
  "Plus vite que votre ombre, ou vous êtes déjà éliminé(e).",
];
const ELIMINATION_LINES = [
  "Un de moins. L'arène se resserre.",
  "Adieu... l'arène ne pardonne pas.",
  "Encore un(e) qui tombe sous mon regard.",
  "Faible. Suivant.",
];
const FINALE_LINES = ["Il ne reste qu'un vainqueur... voyons de quoi il ou elle est fait(e)."];

interface ActiveDuel {
  opponentId: string;
  rollLog: DuelRoll[];
  winner?: DuelActor;
}

export function PlayClient({ code }: { code: string }) {
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [name, setName] = useState("");
  const [avatarId, setAvatarId] = useState(AVATAR_REGISTRY[0].id);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ArenaSnapshot | null>(null);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [winnerIds, setWinnerIds] = useState<string[] | null>(null);
  const [summary, setSummary] = useState<EventSummary | null>(null);
  const [speedRoundEndsAt, setSpeedRoundEndsAt] = useState<number | null>(null);
  const [speedRoundResult, setSpeedRoundResult] = useState<SpeedRoundEndedPayload | undefined>(undefined);
  const [activeTaunt, setActiveTaunt] = useState<{ message: string; key: number } | null>(null);
  const [activePrank, setActivePrank] = useState<{ def: PrankDefinition; text: string; key: number } | null>(null);
  const [activeDuel, setActiveDuel] = useState<ActiveDuel | null>(null);
  const [caption, setCaption] = useState<{ message: string; key: number } | null>(null);
  const [battleSnapshot, setBattleSnapshot] = useState<BattleSnapshot | null>(null);
  const [battleLog, setBattleLog] = useState<BattleLogEntry[]>([]);
  const [battleRequest, setBattleRequest] = useState<BattleChoiceRequest | null>(null);
  const [battlePlan, setBattlePlan] = useState<string | undefined>(undefined);
  const [activeInterference, setActiveInterference] = useState<{ label: string; key: number } | null>(null);
  const { setMood, flash } = useSceneMood();
  const prevPhaseRef = useRef<GamePhase | null>(null);
  const captionCounter = useRef(0);
  // Read via ref inside the connect/reconnect handler below so the socket
  // effect doesn't need name/avatarId in its deps (that would tear down and
  // recreate the connection on every keystroke while typing a name).
  const nameRef = useRef(name);
  const avatarIdRef = useRef(avatarId);
  useEffect(() => {
    nameRef.current = name;
    avatarIdRef.current = avatarId;
  }, [name, avatarId]);

  const fireCaption = useCallback((pool: string[]) => {
    captionCounter.current += 1;
    setCaption({ message: pool[Math.floor(Math.random() * pool.length)], key: captionCounter.current });
  }, []);

  useEffect(() => {
    const socket = createSocket(code, "player");
    setSocket(socket);

    // Fires on the first connect AND every automatic reconnect after a
    // dropped connection — auto-restoring identity either way means a wifi
    // blip (or a page refresh) doesn't dump the player back on the join
    // form. The server ignores name/avatarId for a player that already
    // exists, so it's safe to resend whatever's currently in state here.
    socket.on("connect", () => {
      const existingPlayerId = localStorage.getItem(storageKey(code));
      if (!existingPlayerId) return;
      socket.emit(
        "player:join",
        { name: nameRef.current || "Joueur", existingPlayerId, avatarId: avatarIdRef.current },
        (res) => {
          if (!("error" in res)) {
            localStorage.setItem(storageKey(code), res.playerId);
            setPlayerId(res.playerId);
            setJoinError(null);
          }
        }
      );
    });

    socket.on("error:message", ({ message }) => setConnectError(message));
    socket.on("player:joined", (player) => setSnapshot((prev) => mergePlayerJoined(prev, player)));
    socket.on("state:sync", (snap) => {
      setSnapshot(snap);
      setQuestion(snap.question ?? null);
      if (snap.phase !== "question") setSelectedIndex(null);
      if (snap.phase === "speed" && snap.speedRound) setSpeedRoundEndsAt(snap.speedRound.endsAt);
      if (snap.lastSpeedRoundResult) setSpeedRoundResult(snap.lastSpeedRoundResult);
      if (snap.activeDuel) setActiveDuel({ opponentId: snap.activeDuel.opponentId, rollLog: snap.activeDuel.rollLog });
      if (snap.battle ?? snap.lastBattleSnapshot) setBattleSnapshot(snap.battle ?? snap.lastBattleSnapshot ?? null);
      if (snap.battlePlan) setBattlePlan(snap.battlePlan);
    });
    socket.on("question:new", (q) => {
      setQuestion(q);
      setSelectedIndex(null);
    });
    socket.on("question:reveal", (result) => {
      // snapshot's lastReveal drives the arena sweep animation; here we only
      // add the livestream-facing beats (screen flash + Yrud line) on top.
      if (result.results.some((r) => r.eliminated)) {
        flash();
        fireCaption(ELIMINATION_LINES);
      }
    });
    socket.on("speedRound:started", ({ endsAt }) => {
      setSpeedRoundResult(undefined);
      setSpeedRoundEndsAt(endsAt);
      setMood("tense");
      fireCaption(SPEED_LINES);
    });
    socket.on("speedRound:progress", (entry) => setSnapshot((prev) => mergeSpeedProgress(prev, entry)));
    socket.on("speedRound:ended", (payload) => setSpeedRoundResult(payload));
    socket.on("game:finished", ({ winnerIds, summary }) => {
      setWinnerIds(winnerIds);
      setSummary(summary);
      setMood("finale");
      fireCaption(FINALE_LINES);
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
      setBattleLog((prev) => [...prev, ...log].slice(-60));
    });
    socket.on("battle:request", ({ request }) => setBattleRequest(request));
    socket.on("battle:interference", ({ label }) => setActiveInterference({ label, key: Date.now() }));
    socket.on("battle:end", () => {
      setBattleRequest(null);
      setMood("finale");
    });
    socket.on("battle:plan", ({ text }) => setBattlePlan(text));

    return () => {
      socket.disconnect();
    };
  }, [code, flash, setMood, fireCaption]);

  useEffect(() => {
    if (!snapshot) return;
    const phase = snapshot.phase;
    const prev = prevPhaseRef.current;
    if (prev !== phase) {
      if (phase === "question" && prev === "lobby") {
        fireCaption(GAME_START_LINES);
      }
      if (phase !== "speed" && prev === "speed" && phase !== "finished") {
        setMood("calm");
      }
      if (phase === "battle") {
        setMood("duel");
      }
      prevPhaseRef.current = phase;
    }
  }, [snapshot, fireCaption, setMood]);

  function join() {
    if (!socket || !name.trim()) return;
    const existingPlayerId = localStorage.getItem(storageKey(code)) ?? undefined;
    socket.emit("player:join", { name, existingPlayerId, avatarId }, (res) => {
      if ("error" in res) {
        setJoinError(res.error);
        return;
      }
      localStorage.setItem(storageKey(code), res.playerId);
      setPlayerId(res.playerId);
      setJoinError(null);
    });
  }

  function answer(choiceIndex: number) {
    if (!socket || !question || selectedIndex !== null) return;
    setSelectedIndex(choiceIndex);
    socket.emit("player:answer", { questionId: question.id, choiceIndex });
  }

  function chooseBattleMove(choice: string) {
    if (!socket) return;
    setBattleRequest(null);
    socket.emit("player:battleChoice", { choice }, () => {});
  }

  if (connectError) {
    return <p className="text-crimson-bright">{connectError}</p>;
  }

  if (!playerId) {
    return (
      <div className="panel flex w-full max-w-sm flex-col gap-4 rounded-2xl p-6">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && join()}
          placeholder="Ton nom"
          className="rounded-lg border border-border bg-void-deep/60 px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-gold focus:outline-none"
          maxLength={24}
        />
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Choisis ton emblème</p>
          <div className="grid grid-cols-4 gap-2">
            {AVATAR_REGISTRY.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAvatarId(a.id)}
                className={`flex flex-col items-center gap-1 rounded-lg border p-2 transition-all ${
                  avatarId === a.id
                    ? "border-gold-bright bg-gold/10 scale-105"
                    : "border-border bg-void-deep/40 hover:border-border-strong"
                }`}
              >
                <AvatarIcon avatarId={a.id} seed={a.id} size={30} />
                <span className="text-[10px] text-ink-muted">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={join}
          className="rounded-lg bg-gradient-to-b from-gold-bright to-gold px-4 py-2.5 text-sm font-bold text-void-deep shadow-[0_4px_16px_rgba(232,193,90,0.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(232,193,90,0.5)] active:translate-y-0"
        >
          Rejoindre la partie {code}
        </button>
        {joinError && <p className="text-sm text-crimson-bright">{joinError}</p>}
      </div>
    );
  }

  const overlays = (
    <>
      {activeTaunt && <TauntOverlay message={activeTaunt.message} onDone={() => setActiveTaunt(null)} />}
      {activePrank && (
        <PrankOverlay prank={activePrank.def} text={activePrank.text} onDone={() => setActivePrank(null)} />
      )}
      {activeDuel &&
        (() => {
          const opponent = snapshot?.players.find((p) => p.id === activeDuel.opponentId);
          return (
            <DuelStage
              opponentName={opponent?.name ?? "???"}
              rollLog={activeDuel.rollLog}
              winner={activeDuel.winner}
              onDone={() => {
                setActiveDuel(null);
                setMood(snapshot?.phase === "speed" ? "tense" : "calm");
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
    <div className="flex w-full flex-col items-center gap-3">
      {battlePlan && (
        <p className="max-w-2xl text-center text-xs text-ink-muted">
          <span className="font-semibold text-gold-dim">Plan annoncé par Yrud :</span> {battlePlan}
        </p>
      )}
      <BattleStage snapshot={battleSnapshot} log={battleLog} />
      <BattleLogFeed entries={battleLog} sideNames={{ p1: battleSnapshot.p1.name, p2: battleSnapshot.p2.name }} />
      {battleRequest && <MoveChooser request={battleRequest} onChoose={chooseBattleMove} />}
    </div>
  );

  if (winnerIds && snapshot?.phase !== "battle" && !battleSnapshot) {
    const won = winnerIds.includes(playerId);
    return (
      <div className="flex flex-col items-center gap-4">
        {overlays}
        <h2 className="font-display text-glow-gold text-2xl font-bold text-gold-bright">
          {won ? "Tu as survécu à l'arène de Yrud !" : "Yrud t'a balayé(e)."}
        </h2>
        {summary ? <EndGameSummary summary={summary} myPlayerId={playerId} /> : snapshot && <ArenaView snapshot={snapshot} />}
      </div>
    );
  }

  if (battleSection && snapshot?.phase !== "question" && snapshot?.phase !== "speed") {
    return (
      <div className="flex w-full flex-col items-center gap-6">
        {overlays}
        {battleSection}
      </div>
    );
  }

  const myself = snapshot?.players.find((p) => p.id === playerId);

  return (
    <div className="flex w-full flex-col items-center gap-8">
      {overlays}
      {myself && (
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          {myself.eliminated ? (
            "Tu as été éliminé(e) — regarde l'arène."
          ) : (
            <>
              <AvatarIcon avatarId={myself.avatarId} seed={myself.id} size={26} />
              <span>Tes vies :</span>
              <HeartRow lives={myself.lives} maxLives={myself.maxLives} size={16} />
            </>
          )}
        </div>
      )}
      <div key={snapshot?.phase ?? "waiting"} className="animate-scene-enter flex w-full flex-col items-center">
        {snapshot?.phase === "speed" && socket && speedRoundEndsAt ? (
          <SpeedRoundView
            socket={socket}
            endsAt={speedRoundEndsAt}
            eliminated={Boolean(myself?.eliminated)}
            result={speedRoundResult}
            myPlayerId={playerId}
          />
        ) : question && snapshot?.phase === "question" ? (
          <QuestionCard
            key={question.id}
            question={question}
            disabled={selectedIndex !== null || Boolean(myself?.eliminated)}
            selectedIndex={selectedIndex}
            onAnswer={answer}
          />
        ) : (
          <p className="text-sm text-ink-muted">En attente que Yrud lance la prochaine question...</p>
        )}
      </div>
      {snapshot && <ArenaView snapshot={snapshot} />}
    </div>
  );
}
