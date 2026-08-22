"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
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
} from "@yrud/shared";
import { CLAN_REGISTRY, getPrankDefinition, type PrankDefinition } from "@yrud/shared";
import { createSocket } from "@/lib/socket-client";
import { mergePlayerJoined } from "@/lib/arena";
import { ArenaView } from "@/components/yrud/ArenaView";
import { QuestionCard } from "@/components/quiz/QuestionCard";
import { TauntOverlay } from "@/components/yrud/TauntOverlay";
import { PrankOverlay } from "@/components/prank/PrankOverlay";
import { DuelStage } from "@/components/duel/DuelStage";
import { YrudCaption } from "@/components/yrud/YrudCaption";
import { useSceneMood } from "@/components/scene/SceneMoodContext";
import { ClanBadge } from "@/components/yrud/ClanBadge";
import { HeartRow } from "@/components/yrud/HeartRow";
import { FinalBattleView } from "@/components/battle/FinalBattleView";
import { InterferenceCutIn } from "@/components/battle/InterferenceCutIn";
import { EndGameSummary } from "@/components/summary/EndGameSummary";
import { RevealCard } from "@/components/quiz/RevealCard";

function storageKey(code: string) {
  return `yrud:playerId:${code}`;
}

const GAME_START_LINES = [
  "Que la chasse commence... un seul faux pas et vous quittez mon arène.",
  "Bienvenue dans mon arène. Voyons qui tremble en premier.",
  "Vos vies m'appartiennent déjà. Prouvez-moi le contraire.",
];
const ELIMINATION_LINES = [
  "Un de moins. L'arène se resserre.",
  "Adieu... l'arène ne pardonne pas.",
  "Encore un(e) qui tombe sous mon regard.",
  "Faible. Suivant.",
];
// Yrud fields his own clan in the event — no gameplay bonus, but he doesn't
// hide his favoritism. Triggered whenever the elimination/finale involves
// one of his own instead of the neutral lines above.
const ELIMINATION_LINES_YRUD_CLAN = [
  "Non... pas toi. Je fermerai les yeux pour cette fois, mais l'arène ne le refera pas deux fois.",
  "Un de mes fidèles tombe... dommage, tu avais toute ma faveur.",
  "Même mes propres sbires ne sont pas épargnés par l'arène. Je m'en souviendrai.",
  "Ce n'est pas juste... mais même moi, je ne peux pas tout truquer.",
];
const FINALE_LINES = ["Il ne reste qu'un vainqueur... voyons de quoi il ou elle est fait(e)."];
const FINALE_LINES_YRUD_CLAN = [
  "Bien sûr que c'est l'un des miens qui va jusqu'au bout. Je n'attendais rien de moins.",
  "Mon sbire préféré... montre-leur ce que signifie porter mes couleurs.",
];

interface ActiveDuel {
  opponentId: string;
  rollLog: DuelRoll[];
  winner?: DuelActor;
}

export function PlayClient({ code }: { code: string }) {
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [name, setName] = useState("");
  const [clan, setClan] = useState(CLAN_REGISTRY[0].id);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ArenaSnapshot | null>(null);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [winnerIds, setWinnerIds] = useState<string[] | null>(null);
  const [summary, setSummary] = useState<EventSummary | null>(null);
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
  // effect doesn't need name/clan in its deps (that would tear down and
  // recreate the connection on every keystroke while typing a name).
  const nameRef = useRef(name);
  const clanRef = useRef(clan);
  useEffect(() => {
    nameRef.current = name;
    clanRef.current = clan;
  }, [name, clan]);
  // The socket effect below only runs once per connection (see its deps),
  // so handlers inside it close over stale state — question:reveal needs
  // the *current* roster to know an eliminated player's clan, hence a ref
  // kept in sync on every snapshot update rather than reading `snapshot`
  // directly from that closure.
  const snapshotRef = useRef<ArenaSnapshot | null>(null);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

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
    // form. The server ignores name/clan for a player that already exists,
    // so it's safe to resend whatever's currently in state here.
    socket.on("connect", () => {
      const existingPlayerId = localStorage.getItem(storageKey(code));
      if (!existingPlayerId) return;
      socket.emit(
        "player:join",
        { name: nameRef.current || "Joueur", existingPlayerId, clan: clanRef.current },
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
      if (snap.activeDuel) setActiveDuel({ opponentId: snap.activeDuel.opponentId, rollLog: snap.activeDuel.rollLog });
      if (snap.battle ?? snap.lastBattleSnapshot) setBattleSnapshot(snap.battle ?? snap.lastBattleSnapshot ?? null);
      // Full history from the room resync, not a delta — always at least as
      // complete as whatever this client already accumulated locally, so a
      // (re)connect mid-battle recovers the log instead of starting empty.
      if (snap.battleLog) setBattleLog(snap.battleLog.slice(-300));
      if (snap.battlePlan) setBattlePlan(snap.battlePlan);
    });
    socket.on("question:new", (q) => {
      setQuestion(q);
      setSelectedIndex(null);
    });
    socket.on("question:reveal", (result) => {
      // snapshot's lastReveal drives the arena sweep animation; here we only
      // add the livestream-facing beats (screen flash + Yrud line) on top.
      const eliminated = result.results.filter((r) => r.eliminated);
      if (eliminated.length > 0) {
        flash();
        const players = snapshotRef.current?.players ?? [];
        const hitOwnClan = eliminated.some((r) => players.find((p) => p.id === r.playerId)?.clan === "yrud");
        fireCaption(hitOwnClan ? ELIMINATION_LINES_YRUD_CLAN : ELIMINATION_LINES);
      }
    });
    socket.on("game:finished", ({ winnerIds, summary }) => {
      setWinnerIds(winnerIds);
      setSummary(summary);
      setMood("finale");
      const ownClanWon = summary.standings.some((s) => winnerIds.includes(s.playerId) && s.clan === "yrud");
      fireCaption(ownClanWon ? FINALE_LINES_YRUD_CLAN : FINALE_LINES);
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
      if (phase === "battle") {
        setMood("duel");
      }
      prevPhaseRef.current = phase;
    }
  }, [snapshot, fireCaption, setMood]);

  function join() {
    if (!socket || !name.trim()) return;
    const existingPlayerId = localStorage.getItem(storageKey(code)) ?? undefined;
    socket.emit("player:join", { name, existingPlayerId, clan }, (res) => {
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

  function chooseBattleMove(moveIndex: number) {
    if (!socket) return;
    setBattleRequest(null);
    socket.emit("player:battleChoice", { choice: `move ${moveIndex}` }, () => {});
  }

  function switchBattlePokemon(slot: number) {
    if (!socket) return;
    setBattleRequest(null);
    socket.emit("player:battleChoice", { choice: `switch ${slot}` }, () => {});
  }

  function forfeitBattle() {
    if (!socket) return;
    socket.emit("player:battleForfeit", () => {});
  }

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

  if (!playerId) {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        {header}
        <div className="panel-ornate flex w-full flex-col gap-4 rounded-2xl p-6">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && join()}
          placeholder="Ton nom"
          className="rounded-lg border border-border bg-void-deep/60 px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-gold focus:outline-none"
          maxLength={24}
        />
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Choisis ton clan</p>
          <div className="grid grid-cols-3 gap-2">
            {CLAN_REGISTRY.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setClan(c.id)}
                className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-all ${
                  clan === c.id
                    ? "border-gold-bright bg-gold/10 scale-105"
                    : "border-border bg-void-deep/40 hover:border-border-strong"
                }`}
              >
                <ClanBadge clanId={c.id} seed={c.id} size={44} />
                <span className="text-xs text-ink-muted">{c.label}</span>
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
      request={battleRequest}
      onChooseMove={chooseBattleMove}
      onSwitch={switchBattlePokemon}
      onForfeit={forfeitBattle}
      viewerPlayerId={playerId}
      players={snapshot?.players ?? []}
      battlePlan={battlePlan}
      eventCode={code}
    />
  );

  if (winnerIds && snapshot?.phase !== "battle" && !battleSnapshot) {
    const won = winnerIds.includes(playerId);
    return (
      <div className="flex flex-col items-center gap-6">
        {overlays}
        {header}
        <h2 className="font-display text-glow-gold text-2xl font-bold text-gold-bright">
          {won ? "Tu as survécu à l'arène de Yrud !" : "Yrud t'a balayé(e)."}
        </h2>
        {summary ? <EndGameSummary summary={summary} myPlayerId={playerId} /> : snapshot && <ArenaView snapshot={snapshot} />}
      </div>
    );
  }

  if (battleSection && snapshot?.phase !== "question") {
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
      {header}
      {myself && (
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          {myself.eliminated ? (
            "Tu as été éliminé(e) — regarde l'arène."
          ) : (
            <>
              <ClanBadge clanId={myself.clan} seed={myself.id} size={26} />
              <span>Tes vies :</span>
              <HeartRow lives={myself.lives} maxLives={myself.maxLives} size={16} />
            </>
          )}
        </div>
      )}
      <div key={snapshot?.phase ?? "waiting"} className="animate-scene-enter flex w-full flex-col items-center">
        {question && snapshot?.phase === "question" ? (
          <QuestionCard
            key={question.id}
            question={question}
            disabled={selectedIndex !== null || Boolean(myself?.eliminated)}
            selectedIndex={selectedIndex}
            onAnswer={answer}
          />
        ) : question && snapshot?.phase === "reveal" && snapshot.lastReveal ? (
          <RevealCard
            key={`reveal-${question.id}`}
            question={question}
            correctIndex={snapshot.lastReveal.correctIndex}
            myResult={snapshot.lastReveal.results.find((r) => r.playerId === playerId)}
          />
        ) : (
          <p className="text-sm text-ink-muted">En attente que Yrud lance la prochaine question...</p>
        )}
      </div>
      {snapshot && <ArenaView snapshot={snapshot} />}
    </div>
  );
}
