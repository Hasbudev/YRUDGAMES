"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type {
  ArenaSnapshot,
  BattleLogEntry,
  BattleSnapshot,
  ClientToServerEvents,
  DuelActor,
  DuelRoll,
  EventSummary,
  ServerToClientEvents,
} from "@yrud/shared";
import { INTERFERENCE_REGISTRY, PRANK_REGISTRY } from "@yrud/shared";
import { createSocket } from "@/lib/socket-client";
import { mergePlayerJoined } from "@/lib/arena";
import { getStoredAdminCode, storeAdminCode, clearStoredAdminCode } from "@/lib/api";
import { ArenaView } from "@/components/yrud/ArenaView";
import { TimerBar } from "@/components/quiz/TimerBar";
import { AdminCodeGate } from "@/components/admin/AdminCodeGate";
import { DuelStage } from "@/components/duel/DuelStage";
import { BattleStage } from "@/components/battle/BattleStage";
import { EndGameSummary } from "@/components/summary/EndGameSummary";
import { BattleLogFeed } from "@/components/battle/BattleLogFeed";
import { InterferenceCutIn } from "@/components/battle/InterferenceCutIn";

interface ActiveDuel {
  opponentId: string;
  rollLog: DuelRoll[];
  winner?: DuelActor;
}

const PHASE_LABEL: Record<string, string> = {
  lobby: "en attente",
  question: "question",
  reveal: "révélation",
  battle: "bataille finale",
  finished: "terminé",
};

// "speed" is kept here for display only — legacy question rows can still
// carry that theme even though the speed round feature was removed.
const THEME_LABEL: Record<string, string> = {
  trivia: "quiz de Yrud",
  ost: "devine la musique",
  stats: "duel de stats",
  speed: "manche rapide",
};

export function ConsoleClient({ code }: { code: string }) {
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [unlocked, setUnlocked] = useState<boolean | null>(null); // null = not checked yet
  const [gateError, setGateError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ArenaSnapshot | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [winnerIds, setWinnerIds] = useState<string[] | null>(null);
  const [summary, setSummary] = useState<EventSummary | null>(null);
  const [tauntText, setTauntText] = useState("");
  const [duelTargetId, setDuelTargetId] = useState("");
  const [activeDuel, setActiveDuel] = useState<ActiveDuel | null>(null);
  const [battleSnapshot, setBattleSnapshot] = useState<BattleSnapshot | null>(null);
  const [battleLog, setBattleLog] = useState<BattleLogEntry[]>([]);
  const [activeInterference, setActiveInterference] = useState<{ label: string; key: number } | null>(null);
  const [planText, setPlanText] = useState("");
  const [planAnnounced, setPlanAnnounced] = useState(false);
  const [finalist1Id, setFinalist1Id] = useState("");
  const [finalist2Id, setFinalist2Id] = useState("");
  const [team1Text, setTeam1Text] = useState("");
  const [team2Text, setTeam2Text] = useState("");
  const [weatherOption, setWeatherOption] = useState(INTERFERENCE_REGISTRY[0].options?.[0]?.id ?? "");

  useEffect(() => {
    setUnlocked(Boolean(getStoredAdminCode()));
  }, []);

  useEffect(() => {
    if (!unlocked) return;

    const socket = createSocket(code, "admin");
    socketRef.current = socket;

    socket.on("error:message", ({ message }) => {
      if (message.toLowerCase().includes("administrateur")) {
        clearStoredAdminCode();
        setUnlocked(false);
        setGateError(message);
      } else {
        setConnectError(message);
      }
    });
    socket.on("player:joined", (player) => setSnapshot((prev) => mergePlayerJoined(prev, player)));
    socket.on("state:sync", (snap) => {
      setSnapshot(snap);
      if (snap.activeDuel) setActiveDuel({ opponentId: snap.activeDuel.opponentId, rollLog: snap.activeDuel.rollLog });
    });
    socket.on("question:new", () => setActionError(null));
    socket.on("game:finished", ({ winnerIds, summary }) => {
      setWinnerIds(winnerIds);
      setSummary(summary);
    });
    socket.on("duel:start", ({ opponentId }) => setActiveDuel({ opponentId, rollLog: [] }));
    socket.on("duel:roll", (roll) =>
      setActiveDuel((prev) => (prev ? { ...prev, rollLog: [...prev.rollLog, roll] } : prev))
    );
    socket.on("duel:end", ({ opponentId, winner, rollLog }) => setActiveDuel({ opponentId, rollLog, winner }));
    socket.on("battle:snapshot", ({ snapshot: snap, log }) => {
      setBattleSnapshot(snap);
      setBattleLog((prev) => [...prev, ...log].slice(-60));
    });
    socket.on("battle:interference", ({ label }) => setActiveInterference({ label, key: Date.now() }));
    socket.on("battle:end", () => setActionError(null));
    socket.on("battle:plan", ({ text }) => setPlanText(text));

    return () => {
      socket.disconnect();
    };
  }, [code, unlocked]);

  function unlock(codeInput: string) {
    setGateError(null);
    storeAdminCode(codeInput);
    setUnlocked(true);
  }

  function runAction(action: "admin:start" | "admin:reveal" | "admin:next" | "admin:startBlindTest") {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit(action, (res) => {
      if (res && "error" in res) setActionError(res.error);
      else setActionError(null);
    });
  }

  function sendTaunt() {
    const socket = socketRef.current;
    if (!socket || !tauntText.trim()) return;
    socket.emit("admin:taunt", { message: tauntText.trim() }, (res) => {
      if (res && "error" in res) setActionError(res.error);
      else {
        setActionError(null);
        setTauntText("");
      }
    });
  }

  function triggerPrank(prankId: string) {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit("admin:triggerPrank", { prankId }, (res) => {
      if (res && "error" in res) setActionError(res.error);
    });
  }

  function challengeDuel() {
    const socket = socketRef.current;
    if (!socket || !duelTargetId) return;
    socket.emit("admin:challengeDuel", { opponentId: duelTargetId }, (res) => {
      if (res && "error" in res) setActionError(res.error);
    });
  }

  function declareBattlePlan() {
    const socket = socketRef.current;
    if (!socket || !planText.trim()) return;
    socket.emit("admin:declareBattlePlan", { text: planText.trim() }, (res) => {
      if (res && "error" in res) setActionError(res.error);
      else {
        setActionError(null);
        setPlanAnnounced(true);
        setTimeout(() => setPlanAnnounced(false), 2500);
      }
    });
  }

  function startFinalBattle() {
    const socket = socketRef.current;
    if (!socket || !finalist1Id || !finalist2Id || !team1Text.trim() || !team2Text.trim()) return;
    socket.emit(
      "admin:startFinalBattle",
      { player1Id: finalist1Id, player2Id: finalist2Id, team1: team1Text, team2: team2Text },
      (res) => {
        if (res && "error" in res) setActionError(res.error);
        else setActionError(null);
      }
    );
  }

  function triggerInterference(type: (typeof INTERFERENCE_REGISTRY)[number]["type"], optionId?: string) {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit("admin:battleInterfere", { type, optionId }, (res) => {
      if (res && "error" in res) setActionError(res.error);
    });
  }

  if (unlocked === null) return null;
  if (!unlocked) return <AdminCodeGate onUnlock={unlock} error={gateError} />;
  if (connectError) return <p className="text-crimson-bright">{connectError}</p>;
  if (!snapshot) return <p className="text-ink-muted">Connexion...</p>;

  const nameById = new Map(snapshot.players.map((p) => [p.id, p.name]));
  const eligibleDuelTargets = snapshot.players.filter((p) => !p.eliminated);

  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-6">
      {activeDuel && (
        <DuelStage
          opponentName={nameById.get(activeDuel.opponentId) ?? "???"}
          rollLog={activeDuel.rollLog}
          winner={activeDuel.winner}
          onDone={() => setActiveDuel(null)}
        />
      )}
      {activeInterference && (
        <InterferenceCutIn label={activeInterference.label} onDone={() => setActiveInterference(null)} />
      )}

      <div className="flex items-center gap-3 text-sm">
        <span className="rounded-full border border-border bg-void-deep/60 px-3 py-1 font-mono text-gold-bright">
          phase : {PHASE_LABEL[snapshot.phase] ?? snapshot.phase}
        </span>
        <span className="rounded-full border border-border bg-void-deep/60 px-3 py-1 text-ink-muted">
          {snapshot.players.length} inscrit(s)
        </span>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={() => runAction("admin:start")}
          disabled={snapshot.phase !== "lobby"}
          className="btn-gold"
        >
          Démarrer
        </button>
        <button
          onClick={() => runAction("admin:reveal")}
          disabled={snapshot.phase !== "question"}
          className="btn-gold"
        >
          Révéler la réponse
        </button>
        <button
          onClick={() => runAction("admin:next")}
          disabled={snapshot.phase !== "reveal"}
          className="btn-gold"
        >
          Question suivante
        </button>
        <button
          onClick={() => runAction("admin:startBlindTest")}
          disabled={snapshot.phase !== "lobby" && snapshot.phase !== "reveal"}
          className="btn-crimson"
        >
          🎵 Lancer le blind test
        </button>
      </div>
      {snapshot.phase === "question" && (
        <p className="text-xs text-ink-muted">Révélation automatique quand le temps est écoulé — le bouton ci-dessus le fait juste en avance.</p>
      )}
      {actionError && <p className="text-sm text-crimson-bright">{actionError}</p>}

      <div className="panel w-full rounded-2xl p-4">
        <p className="mb-3 font-display text-sm font-semibold text-gold-bright">Interférence de Yrud</p>

        <div className="mb-4 flex gap-2">
          <input
            value={tauntText}
            onChange={(e) => setTauntText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendTaunt()}
            placeholder="Provoquer les joueurs..."
            maxLength={200}
            className="flex-1 rounded-lg border border-border bg-void-deep/60 px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
          />
          <button
            onClick={sendTaunt}
            disabled={!tauntText.trim()}
            className="btn-gold"
          >
            Envoyer la provocation
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {PRANK_REGISTRY.map((prank) => (
            <button
              key={prank.id}
              onClick={() => triggerPrank(prank.id)}
              className="rounded-lg border border-purple/40 bg-purple-deep/40 px-3 py-2 text-sm font-medium text-ink hover:bg-purple-deep/70"
            >
              {prank.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={duelTargetId}
            onChange={(e) => setDuelTargetId(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-void-deep/60 px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
          >
            <option value="">Défier un joueur en duel...</option>
            {eligibleDuelTargets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            onClick={challengeDuel}
            disabled={!duelTargetId || Boolean(activeDuel && !activeDuel.winner)}
            className="btn-crimson"
          >
            Lancer le duel
          </button>
        </div>
      </div>

      <div className="panel w-full rounded-2xl p-4">
        <p className="mb-3 font-display text-sm font-semibold text-gold-bright">Bataille finale</p>

        <div className="mb-4 flex gap-2">
          <input
            value={planText}
            onChange={(e) => setPlanText(e.target.value)}
            placeholder="Annonce publique du plan d'interférence..."
            maxLength={500}
            className="flex-1 rounded-lg border border-border bg-void-deep/60 px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
          />
          <button
            onClick={declareBattlePlan}
            disabled={!planText.trim()}
            className="btn-gold"
          >
            Annoncer le plan
          </button>
        </div>
        {planAnnounced && (
          <p className="-mt-2 mb-4 text-xs font-semibold text-gold-bright">✓ Plan annoncé à tous les joueurs.</p>
        )}

        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <select
              value={finalist1Id}
              onChange={(e) => setFinalist1Id(e.target.value)}
              className="rounded-lg border border-border bg-void-deep/60 px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
            >
              <option value="">Finaliste 1...</option>
              {snapshot.players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <textarea
              value={team1Text}
              onChange={(e) => setTeam1Text(e.target.value)}
              placeholder="Coller l'équipe exportée du finaliste 1..."
              rows={4}
              className="rounded-lg border border-border bg-void-deep/60 px-3 py-2 text-xs text-ink focus:border-gold focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <select
              value={finalist2Id}
              onChange={(e) => setFinalist2Id(e.target.value)}
              className="rounded-lg border border-border bg-void-deep/60 px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
            >
              <option value="">Finaliste 2...</option>
              {snapshot.players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <textarea
              value={team2Text}
              onChange={(e) => setTeam2Text(e.target.value)}
              placeholder="Coller l'équipe exportée du finaliste 2..."
              rows={4}
              className="rounded-lg border border-border bg-void-deep/60 px-3 py-2 text-xs text-ink focus:border-gold focus:outline-none"
            />
          </div>
        </div>

        <button
          onClick={startFinalBattle}
          disabled={
            snapshot.phase === "battle" ||
            !finalist1Id ||
            !finalist2Id ||
            !team1Text.trim() ||
            !team2Text.trim()
          }
          className="btn-crimson mb-4 w-full"
        >
          Lancer la bataille finale
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={weatherOption}
            onChange={(e) => setWeatherOption(e.target.value)}
            disabled={snapshot.phase !== "battle"}
            className="rounded-lg border border-border bg-void-deep/60 px-2 py-2 text-sm text-ink focus:border-gold focus:outline-none disabled:opacity-40"
          >
            {INTERFERENCE_REGISTRY[0].options?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          {INTERFERENCE_REGISTRY.map((def) => (
            <button
              key={def.type}
              onClick={() => triggerInterference(def.type, def.needsOption ? weatherOption : undefined)}
              disabled={snapshot.phase !== "battle"}
              className="rounded-lg border border-purple/40 bg-purple-deep/40 px-3 py-2 text-sm font-medium text-ink hover:bg-purple-deep/70 disabled:opacity-40"
            >
              {def.label}
            </button>
          ))}
        </div>
      </div>

      {battleSnapshot && (
        <div className="flex w-full flex-col items-center gap-3">
          <BattleStage snapshot={battleSnapshot} log={battleLog} />
          <BattleLogFeed entries={battleLog} sideNames={{ p1: battleSnapshot.p1.name, p2: battleSnapshot.p2.name }} />
        </div>
      )}

      {snapshot.question && (
        <div className="panel w-full rounded-2xl p-4 text-sm">
          {snapshot.phase === "question" && (
            <div className="mb-3">
              <TimerBar startedAt={snapshot.question.startedAt} timeLimitMs={snapshot.question.timeLimitMs} />
            </div>
          )}
          <p className="mb-1 text-xs uppercase tracking-wide text-gold-dim">
            {THEME_LABEL[snapshot.question.theme] ?? snapshot.question.theme}
          </p>
          <p className="font-semibold text-ink">{snapshot.question.prompt}</p>
          <ul className="mt-2 list-disc pl-5 text-ink">
            {snapshot.question.choices.map((c, i) => (
              <li
                key={i}
                className={snapshot.lastReveal?.correctIndex === i ? "font-bold text-gold-bright" : ""}
              >
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {winnerIds && summary && <EndGameSummary summary={summary} />}

      <ArenaView snapshot={snapshot} />
    </div>
  );
}
