"use client";

import { useEffect, useState } from "react";
import type { BattleChoiceRequest, BattleLogEntry, BattleSnapshot, PublicPlayer } from "@yrud/shared";
import { BattleHeader } from "./BattleHeader";
import { BattleArena } from "./BattleArena";
import { PlayerPanel } from "./PlayerPanel";
import { MoveSelector } from "./MoveSelector";
import { SwitchSelector } from "./SwitchSelector";
import { BattleCommands } from "./BattleCommands";
import { BattleLog } from "./BattleLog";
import { BattleIntro } from "./BattleIntro";

interface FinalBattleViewProps {
  snapshot: BattleSnapshot;
  log: BattleLogEntry[];
  request: BattleChoiceRequest | null;
  onChooseMove: (moveIndex: number) => void;
  onSwitch: (slot: number) => void;
  onForfeit: () => void;
  /** null/undefined for spectators (admin console, eliminated players) */
  viewerPlayerId?: string | null;
  players: PublicPlayer[];
  battlePlan?: string;
  eventCode?: string;
}

function clanFor(players: PublicPlayer[], playerId: string): string | null {
  return players.find((p) => p.id === playerId)?.clan ?? null;
}

export function FinalBattleView({
  snapshot,
  log,
  request,
  onChooseMove,
  onSwitch,
  onForfeit,
  viewerPlayerId,
  players,
  battlePlan,
  eventCode,
}: FinalBattleViewProps) {
  const [introDone, setIntroDone] = useState(false);
  const [switchMode, setSwitchMode] = useState(false);

  const isParticipant = Boolean(viewerPlayerId && (viewerPlayerId === snapshot.p1.playerId || viewerPlayerId === snapshot.p2.playerId));
  const viewerSide: "p1" | "p2" = viewerPlayerId === snapshot.p2.playerId ? "p2" : "p1";
  const opponentSide: "p1" | "p2" = viewerSide === "p1" ? "p2" : "p1";
  const nearSide = snapshot[viewerSide];
  const farSide = snapshot[opponentSide];

  // A fresh non-forced request means the previous switch resolved — drop
  // back into the move view automatically.
  useEffect(() => {
    if (request && !request.forceSwitch) setSwitchMode(false);
  }, [request]);

  const showSwitchUi = Boolean(request?.forceSwitch) || switchMode;

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {!introDone && <BattleIntro leftName={snapshot.p1.name} rightName={snapshot.p2.name} onDone={() => setIntroDone(true)} />}

      <BattleHeader
        left={{
          name: snapshot.p1.name,
          playerId: snapshot.p1.playerId,
          clan: clanFor(players, snapshot.p1.playerId),
        }}
        right={{
          name: snapshot.p2.name,
          playerId: snapshot.p2.playerId,
          clan: clanFor(players, snapshot.p2.playerId),
        }}
        eventCode={eventCode}
      />

      {battlePlan && (
        <p className="max-w-2xl text-center text-xs text-ink-muted">
          <span className="font-semibold text-gold-dim">Plan annoncé par Yrud :</span> {battlePlan}
        </p>
      )}

      <div className="grid w-full max-w-5xl gap-3 lg:grid-cols-[216px_1fr_216px]">
        <div className="hidden lg:block">
          <PlayerPanel side={nearSide} />
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <BattleArena snapshot={snapshot} log={log} viewerSide={viewerSide} showVs={introDone && log.length === 0} />

          {isParticipant && !snapshot.ended && (
            <div className="rounded-2xl border border-border bg-void-deep/40 p-3">
              {showSwitchUi ? (
                <SwitchSelector
                  options={request?.switchOptions ?? []}
                  forced={request?.forceSwitch}
                  onChoose={(slot) => {
                    onSwitch(slot);
                    setSwitchMode(false);
                  }}
                />
              ) : request && request.moves.length > 0 ? (
                <MoveSelector moves={request.moves} onChoose={onChooseMove} />
              ) : (
                <p className="text-center text-xs text-ink-muted">En attente de l&apos;adversaire...</p>
              )}
            </div>
          )}

          <BattleLog entries={log} sideNames={{ p1: snapshot.p1.name, p2: snapshot.p2.name }} />

          {isParticipant && !snapshot.ended && !request?.forceSwitch && (
            <div className="flex justify-end">
              <BattleCommands
                canSwitch={!request?.trapped}
                switchMode={switchMode}
                onToggleSwitch={() => setSwitchMode((v) => !v)}
                onForfeit={onForfeit}
              />
            </div>
          )}
        </div>

        <div className="hidden lg:block">
          <PlayerPanel side={farSide} />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:hidden">
          <PlayerPanel side={nearSide} />
          <PlayerPanel side={farSide} />
        </div>
      </div>
    </div>
  );
}
