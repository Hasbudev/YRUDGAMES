// Typed Socket.IO event contract shared between apps/web and apps/server.
// Later phases extend this in place (battle:* ...).

import type { ArenaSnapshot, PublicPlayer, PublicQuestion, RevealResult } from "./game-types";
import type { DuelEndedPayload, DuelRoll, DuelStartedPayload } from "./duel-types";
import type { SliderTrick } from "./specialRounds";
import type { BattleChoiceRequest, BattleLogEntry, BattleSnapshot, InterferenceType, TeamSheetMember } from "./showdown-types";
import type { EventSummary } from "./summary-types";

export interface ServerToClientEvents {
  // Manche 3 — the bomb went off on its holder's clan.
  "bomb:explode": (payload: { clan: string; penalty: number; affectedIds: string[] }) => void;
  // Manche 4 — a winner took their points.
  "steal:done": (payload: { thiefId: string; victimId: string; amount: number }) => void;
  // Manche 2 — Rudy messes with everyone's cursor.
  "slider:trick": (payload: { trick: SliderTrick }) => void;
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
  // A typed answer to a free-text question (QuestionMetadata.freeText) —
  // matched server-side against the accepted answers.
  "player:answerText": (payload: { questionId: string; text: string }) => void;
  // Chasse-taupes: the player tapped this mole (an id from whackSchedule).
  "player:whack": (payload: { questionId: string; moleId: number }) => void;
  // Manche 1 — a vote for a category, during the player's clan's turn.
  "player:voteCategory": (payload: { category: string }) => void;
  // Manche 4 — the manche's winner picks who to steal from.
  "player:steal": (payload: { victimId: string }, ack?: (res: { ok: true } | { error: string }) => void) => void;
  // Manche 1 — opens the category vote; `order` is the clans' picking order.
  "admin:startDraft": (payload: { order: string[] }, ack?: (res: { ok: true } | { error: string }) => void) => void;
  // Closes the current clan's vote (majority wins, a tie is drawn at random).
  "admin:closeVote": (ack?: (res: { ok: true } | { error: string }) => void) => void;
  // Gives up on a pending steal (the winner is AFK...).
  "admin:skipSteal": (ack?: (res: { ok: true } | { error: string }) => void) => void;
  "admin:sliderTrick": (payload: { trick: SliderTrick }, ack?: (res: { ok: true } | { error: string }) => void) => void;
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
  // Abandons the live question with no scoring at all and moves straight on
  // (next question, or the next manche's intro) — for a question that turns
  // out broken, or a moment that needs to move faster.
  "admin:skip": (ack?: (res: { ok: true } | { error: string }) => void) => void;
  // Sets how long every timed question of a manche lasts, overriding the
  // per-question value. seconds null = back to each question's own value.
  // roundIndex omitted = the manche the game is in (or about to start).
  // Never touches a question that is already live.
  "admin:setTimeLimit": (
    payload: { seconds: number | null; roundIndex?: number },
    ack?: (res: { ok: true } | { error: string }) => void
  ) => void;
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
