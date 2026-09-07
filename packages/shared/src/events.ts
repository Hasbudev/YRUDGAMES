// Typed Socket.IO event contract shared between apps/web and apps/server.
// Later phases extend this in place (battle:* ...).

import type { ArenaSnapshot, PublicPlayer, PublicQuestion, RevealResult } from "./game-types";
import type { DuelEndedPayload, DuelRoll, DuelStartedPayload } from "./duel-types";
import type { BattleChoiceRequest, BattleLogEntry, BattleSnapshot, InterferenceType, TeamSheetMember } from "./showdown-types";
import type { EventSummary } from "./summary-types";

export interface ServerToClientEvents {
  "state:sync": (snapshot: ArenaSnapshot) => void;
  "player:joined": (player: PublicPlayer) => void;
  "question:new": (question: PublicQuestion) => void;
  "question:reveal": (result: RevealResult) => void;
  // Fired once the quiz's last question is done, in place of game:finished —
  // the quiz is only the qualifier, so instead of declaring a winner this
  // names the top two scorers as the final battle's contenders. The client
  // shows a "Manche Combat" title card. game:finished (with the real
  // champion) only fires once that battle actually ends.
  "combat:announce": (payload: {
    player1: { id: string; name: string };
    player2: { id: string; name: string };
  }) => void;
  "game:finished": (payload: { winnerIds: string[]; summary: EventSummary }) => void;
  "error:message": (payload: { message: string }) => void;
  "yrud:taunt": (payload: { message: string }) => void;
  "prank:trigger": (payload: { prankId: string; text: string }) => void;
  "duel:start": (payload: DuelStartedPayload) => void;
  "duel:roll": (payload: DuelRoll) => void;
  "duel:end": (payload: DuelEndedPayload) => void;
  "battle:snapshot": (payload: { snapshot: BattleSnapshot; log: BattleLogEntry[] }) => void;
  "battle:interference": (payload: { type: InterferenceType; label: string; turn: number }) => void;
  "battle:end": (payload: { winnerId: string | null }) => void;
  "battle:plan": (payload: { text: string }) => void;
  // Private to one finalist's own socket — never broadcast — since it can
  // reveal info (exact PP, roster) the opponent shouldn't see.
  "battle:request": (payload: { request: BattleChoiceRequest }) => void;
  // Also private, same reasoning — a finalist's own held items/abilities/EVs/
  // IVs, never the opponent's.
  "battle:teamSheet": (payload: { team: TeamSheetMember[] }) => void;
}

export interface ClientToServerEvents {
  "player:join": (
    payload: { name: string; existingPlayerId?: string; clan?: string },
    ack: (res: { playerId: string } | { error: string }) => void
  ) => void;
  "player:answer": (payload: { questionId: string; choiceIndex: number }) => void;
  // Fired once a player clicks all the way through Yrud's current cold-open
  // — purely informational (see ArenaSnapshot.introSeenPlayerIds), never
  // gates anything server-side.
  "player:introSeen": () => void;
  "admin:start": (ack?: (res: { ok: true } | { error: string }) => void) => void;
  // Dismisses Yrud's cold-open and actually starts the first question's
  // timer — the deliberate second step after admin:start's "lobby -> intro".
  "admin:beginQuiz": (ack?: (res: { ok: true } | { error: string }) => void) => void;
  "admin:reveal": (ack?: (res: { ok: true } | { error: string }) => void) => void;
  "admin:next": (ack?: (res: { ok: true } | { error: string }) => void) => void;
  "admin:toggleTrap": (ack?: (res: { ok: true } | { error: string }) => void) => void;
  // Free-form point adjustment — the escape hatch for anything the
  // structured quiz flow can't express live (the "Roue d'Yrud" mini-duel,
  // a one-off joke question, a manual correction).
  "admin:adjustPoints": (
    payload: { playerId: string; delta: number },
    ack?: (res: { ok: true } | { error: string }) => void
  ) => void;
  // playerId omitted/undefined = broadcast to everyone, as before.
  "admin:taunt": (
    payload: { message: string; playerId?: string },
    ack?: (res: { ok: true } | { error: string }) => void
  ) => void;
  "admin:triggerPrank": (
    payload: { prankId: string },
    ack?: (res: { ok: true } | { error: string }) => void
  ) => void;
  "admin:challengeDuel": (
    payload: { opponentId: string },
    ack?: (res: { ok: true } | { error: string }) => void
  ) => void;
  "admin:declareBattlePlan": (
    payload: { text: string },
    ack?: (res: { ok: true } | { error: string }) => void
  ) => void;
  "admin:startFinalBattle": (
    payload: { player1Id: string; player2Id: string; team1: string; team2: string },
    ack?: (res: { ok: true } | { error: string }) => void
  ) => void;
  "admin:battleInterfere": (
    payload: { type: InterferenceType; optionId?: string },
    ack?: (res: { ok: true } | { error: string }) => void
  ) => void;
  "player:battleChoice": (
    payload: { choice: string },
    ack: (res: { ok: true } | { error: string }) => void
  ) => void;
  "player:battleForfeit": (ack: (res: { ok: true } | { error: string }) => void) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  eventCode: string;
  role: "player" | "admin";
  playerId?: string;
}
