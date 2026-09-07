import type { Server } from "socket.io";
import type {
  ArenaSnapshot,
  BattleChoiceRequest,
  ClientToServerEvents,
  EventSummary,
  InterferenceType,
  InterServerEvents,
  PublicPlayer,
  PublicQuestion,
  RevealResult,
  ServerToClientEvents,
  SocketData,
  TeamSheetMember,
} from "@yrud/shared";
import {
  INTERFERENCE_REGISTRY,
  TAUNT_DISPLAY_MS,
  getPrankDefinition,
  pickPrankText,
  resolveClan,
} from "@yrud/shared";
import { prisma } from "../db/client";
import * as engine from "../game/engine";
import type { GameState, InternalQuestion } from "../game/types";
import * as duelEngine from "../duel/engine";
import type { DuelState } from "../duel/engine";
import { FinalBattleRunner } from "../showdown/battleRunner";
import { importTeam } from "../showdown/teamImport";
import { buildTeamSheet } from "../showdown/teamSheet";

type IoServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export const DEFAULT_TIME_LIMIT_MS = 10_000;
const DUEL_ROLL_DELAY_MS = 1200;
// Meaningful swing for a Yrud face-off, without a config screen — winning
// nets this many points, losing costs this many (never below 0).
const DUEL_POINTS = 3;

export class EventRoom {
  readonly eventId: string;
  readonly code: string;
  readonly socketRoom: string;
  private io: IoServer;
  private state: GameState;
  private lastReveal?: RevealResult;
  private autoRevealTimer: NodeJS.Timeout | null = null;
  private duelState: DuelState | null = null;
  private clanByPlayer: Record<string, string> = {};
  private battleRunner: FinalBattleRunner | null = null;
  private lastBattleSnapshot?: ArenaSnapshot["lastBattleSnapshot"];
  private lastBattleLog?: ArenaSnapshot["battleLog"];
  // A move/switch request is only ever pushed once, straight to the socket
  // that was connected when the simulator asked for it — a finalist who
  // refreshes mid-turn would otherwise see no move buttons and no way to
  // recover until the *next* turn's request arrives. Cached per player so a
  // reconnect can be handed the still-pending request immediately.
  private pendingBattleRequests: Record<string, BattleChoiceRequest> = {};
  // A finalist's own item/ability/EVs/IVs sheet — cached the same way as
  // pendingBattleRequests, and for the same reason: a reconnect mid-battle
  // needs it resent immediately, not just whenever the next server push
  // happens to fire.
  private teamSheets: Record<string, TeamSheetMember[]> = {};
  private battlePlan?: string;
  private playerSockets: Record<string, string> = {};
  private connectedPlayers: Set<string> = new Set();
  // Who has clicked through the CURRENT Yrud cold-open — reset every time a
  // new one starts (see start()/next()'s roundIntro branch) so a player who
  // saw Manche 2's intro doesn't get incorrectly credited for Manche 3's.
  private introSeenBy: Set<string> = new Set();

  constructor(io: IoServer, eventId: string, code: string, questions: InternalQuestion[]) {
    this.io = io;
    this.eventId = eventId;
    this.code = code;
    this.socketRoom = `event:${code}`;
    this.state = engine.createInitialState(questions);
  }

  private toPublicPlayer(p: { id: string; name: string; points: number }): PublicPlayer {
    return {
      id: p.id,
      name: p.name,
      points: p.points,
      clan: resolveClan(this.clanByPlayer[p.id], p.id).id,
      connected: this.connectedPlayers.has(p.id),
    };
  }

  private publicQuestion(): PublicQuestion | undefined {
    const q = engine.currentQuestion(this.state);
    // Also kept through "reveal" — clients need the prompt/choices on screen
    // for the reveal beat (correctIndex is separately gated behind the
    // question:reveal event itself, so this doesn't leak anything early).
    // Also exposed during "roundIntro" — Yrud's per-manche cold-open needs
    // the upcoming question's roundIndex/roundLabel (prompt/choices are
    // harmless to reveal early too, nothing scoring-sensitive is at stake).
    if (
      !q ||
      (this.state.phase !== "question" && this.state.phase !== "reveal" && this.state.phase !== "roundIntro")
    )
      return undefined;
    return {
      id: q.id,
      theme: q.theme,
      prompt: q.prompt,
      choices: q.choices,
      metadata: q.metadata,
      mediaUrl: q.mediaUrl,
      timeLimitMs: q.timeLimitMs,
      startedAt: this.state.questionStartedAt ?? Date.now(),
      questionIndex: this.state.questionIndex,
      questionCount: this.state.questions.length,
      points: q.points,
      roundIndex: q.roundIndex,
      roundLabel: q.roundLabel,
    };
  }

  snapshot(): ArenaSnapshot {
    return {
      phase: this.battleRunner ? "battle" : this.state.phase,
      players: this.state.playerOrder.map((id) => this.toPublicPlayer(this.state.players[id])),
      question: this.publicQuestion(),
      lastReveal: this.lastReveal,
      answeredPlayerIds: this.state.phase === "question" ? Object.keys(this.state.answers) : [],
      introSeenPlayerIds:
        this.state.phase === "intro" || this.state.phase === "roundIntro" ? [...this.introSeenBy] : [],
      battle: this.battleRunner?.snapshot,
      lastBattleSnapshot: this.lastBattleSnapshot,
      battleLog: this.battleRunner?.log ?? this.lastBattleLog,
      battlePlan: this.battlePlan,
      // Lets a client that (re)connects mid-duel resync instead of missing
      // it entirely — duelState is briefly non-null in "resolved" phase too,
      // but that's covered by the duel:end broadcast, not a resync need.
      activeDuel:
        this.duelState && this.duelState.phase === "rolling"
          ? { opponentId: this.duelState.opponentId, rollLog: this.duelState.rollLog }
          : undefined,
      trapActive: this.state.trapActive,
    };
  }

  registerPlayerSocket(playerId: string, socketId: string) {
    this.playerSockets[playerId] = socketId;
    const pendingRequest = this.pendingBattleRequests[playerId];
    if (pendingRequest) this.io.to(socketId).emit("battle:request", { request: pendingRequest });
    const sheet = this.teamSheets[playerId];
    if (sheet) this.io.to(socketId).emit("battle:teamSheet", { team: sheet });
  }

  // Called whenever a player's socket (re)joins — covers both a brand new
  // join and a reconnect after a dropped connection. Reconnects don't go
  // through engine.addPlayer's "new player" path, so this is the one place
  // that reliably flips them back to connected and lets everyone know.
  markPlayerConnected(playerId: string) {
    if (!this.state.players[playerId]) return;
    const wasConnected = this.connectedPlayers.has(playerId);
    this.connectedPlayers.add(playerId);
    if (!wasConnected) this.broadcastSnapshot();
  }

  markPlayerDisconnected(playerId: string) {
    if (!this.connectedPlayers.has(playerId)) return;
    this.connectedPlayers.delete(playerId);
    this.broadcastSnapshot();
  }

  private broadcastSnapshot() {
    this.io.to(this.socketRoom).emit("state:sync", this.snapshot());
  }

  // Reveal must happen even if no admin is watching the clock — the timer is
  // the actual deadline, the admin's manual button is just an early-out.
  private scheduleAutoReveal(timeLimitMs: number) {
    if (this.autoRevealTimer) clearTimeout(this.autoRevealTimer);
    this.autoRevealTimer = setTimeout(() => {
      this.reveal().catch((err) => console.error(`[${this.code}] auto-reveal failed:`, err));
    }, timeLimitMs);
  }

  private clearAutoReveal() {
    if (this.autoRevealTimer) {
      clearTimeout(this.autoRevealTimer);
      this.autoRevealTimer = null;
    }
  }

  // Taunts/pranks render as full-screen overlays that block interaction —
  // without this, they'd silently eat into the question clock.
  // Shift the deadline forward by exactly how long the overlay is on screen
  // so nobody loses real time to Yrud's interruptions.
  private extendActiveTimers(extraMs: number) {
    if (this.state.phase === "question" && this.state.questionStartedAt !== null) {
      const question = engine.currentQuestion(this.state);
      if (question) {
        const newStartedAt = this.state.questionStartedAt + extraMs;
        this.state = { ...this.state, questionStartedAt: newStartedAt };
        const remaining = newStartedAt + question.timeLimitMs - Date.now();
        this.clearAutoReveal();
        if (remaining > 0) this.scheduleAutoReveal(remaining);
      }
    }

    if (this.state.phase === "question") {
      this.broadcastSnapshot();
    }
  }

  async addPlayer(id: string, name: string, clan?: string): Promise<PublicPlayer | { error: string }> {
    if (this.state.players[id]) {
      return this.toPublicPlayer(this.state.players[id]);
    }
    if (this.state.phase !== "lobby") {
      return { error: "Cet événement a déjà commencé." };
    }
    this.state = engine.addPlayer(this.state, { id, name });
    const player = this.state.players[id];
    const resolvedClan = resolveClan(clan, id).id;
    this.clanByPlayer[id] = resolvedClan;

    await prisma.player.upsert({
      where: { id },
      update: {},
      create: { id, eventId: this.eventId, name, clan: resolvedClan },
    });

    this.io.to(this.socketRoom).emit("player:joined", this.toPublicPlayer(player));
    return this.toPublicPlayer(player);
  }

  submitAnswer(playerId: string, questionId: string, choiceIndex: number) {
    const question = engine.currentQuestion(this.state);
    if (!question || question.id !== questionId) return;
    if (playerId in this.state.answers) return; // already answered — nothing changes

    this.state = engine.submitAnswer(this.state, playerId, choiceIndex);
    if (playerId in this.state.answers) {
      // Broadcast live "who's answered" progress — never what they chose.
      this.broadcastSnapshot();
    }
  }

  // Lobby -> intro. Yrud's cold-open plays here — deliberately no question
  // and no timer yet, so the first question's clock can't start ticking
  // while everyone's still watching him monologue.
  async start(): Promise<{ ok: true } | { error: string }> {
    if (this.state.phase !== "lobby") return { error: "La partie a déjà commencé." };
    if (this.state.playerOrder.length === 0) return { error: "Aucun joueur n'est encore inscrit." };

    this.state = engine.enterIntro(this.state);
    this.introSeenBy.clear();
    await prisma.event.update({ where: { id: this.eventId }, data: { status: "live" } });
    this.broadcastSnapshot();
    return { ok: true };
  }

  // Advisory-only — never gates admin:beginQuiz. Lets the console show
  // "X/Y ont vu l'intro" so the admin can judge for themselves whether to
  // wait, without risking getting stuck if someone dropped off mid-monologue.
  markIntroSeen(playerId: string) {
    if (this.state.phase !== "intro" && this.state.phase !== "roundIntro") return;
    if (!this.state.players[playerId]) return;
    if (this.introSeenBy.has(playerId)) return;
    this.introSeenBy.add(playerId);
    this.broadcastSnapshot();
  }

  // Dismisses whichever Yrud cold-open is currently blocking — either the
  // very first one (intro -> question) or a per-manche one crossing into a
  // new round (roundIntro -> question, see engine.advance). Either way this
  // is the only place that question's timer actually starts, which is the
  // whole point: the client-driven dialogue can take as long as it wants
  // without silently burning down a clock nobody can see yet.
  async beginQuiz(): Promise<{ ok: true } | { error: string }> {
    if (this.state.phase === "intro") {
      this.state = engine.startGame(this.state, Date.now());
    } else if (this.state.phase === "roundIntro") {
      this.state = engine.confirmRoundIntro(this.state, Date.now());
    } else {
      return { error: "Rien à confirmer pour l'instant." };
    }

    const question = this.publicQuestion();
    if (question) {
      this.io.to(this.socketRoom).emit("question:new", question);
      // A blind-test (ost) question has no hard deadline — Yrud reveals it
      // manually once the clip has played long enough, unlike every other
      // theme's auto-reveal-on-timeout.
      if (question.theme !== "ost") this.scheduleAutoReveal(question.timeLimitMs);
    }
    this.broadcastSnapshot();
    return { ok: true };
  }

  async reveal(): Promise<{ ok: true } | { error: string }> {
    if (this.state.phase !== "question") return { error: "Aucune question n'est en cours." };
    this.clearAutoReveal();

    const question = engine.currentQuestion(this.state);
    const { state: nextState, result } = engine.reveal(this.state);
    this.state = nextState;
    this.lastReveal = result;

    if (question) {
      const round = await prisma.round.create({
        data: { eventId: this.eventId, theme: question.theme, index: this.state.questionIndex },
      });
      await prisma.answerLog.createMany({
        data: result.results.map((r) => ({
          roundId: round.id,
          playerId: r.playerId,
          questionId: question.id,
          correct: r.correct,
          responseMs: 0,
        })),
      });
      await Promise.all(
        result.results.map((r) =>
          prisma.player.update({
            where: { id: r.playerId },
            data: { points: r.points },
          })
        )
      );
    }

    this.io.to(this.socketRoom).emit("question:reveal", result);
    this.broadcastSnapshot();
    return { ok: true };
  }

  async next(): Promise<{ ok: true } | { error: string }> {
    if (this.state.phase !== "reveal") {
      return { error: "Révèle d'abord la question en cours." };
    }

    this.state = engine.advance(this.state, Date.now());
    if (this.state.phase === "roundIntro") this.introSeenBy.clear();

    if (this.state.phase === "finished") {
      await prisma.event.update({ where: { id: this.eventId }, data: { status: "finished" } });
      const winnerIds = engine.winners(this.state);
      const summary = await this.computeSummary(winnerIds);
      // Persist final standings — computeSummary's result otherwise only ever
      // reaches whoever is connected at this exact moment (broadcast below),
      // and is lost once this room is dropped. The public /api/leaderboard
      // reads these two columns back.
      await prisma.$transaction(
        summary.standings.map((s) =>
          prisma.player.update({
            where: { id: s.playerId },
            data: { placement: s.placement, correctAnswers: s.correctAnswers },
          })
        )
      );

      // Don't crown a point-based winner yet — the quiz is only the
      // qualifier. The real climax is the final battle between the top two
      // scorers, so announce that matchup instead ("Manche Combat") and
      // defer game:finished (with the actual champion) to startFinalBattle's
      // onEnd. If fewer than 2 players even exist, there's no battle to
      // have — fall back to declaring the quiz result immediately.
      const byPointsDesc = [...this.state.playerOrder].sort(
        (a, b) => this.state.players[b].points - this.state.players[a].points
      );
      if (byPointsDesc.length >= 2) {
        const [p1Id, p2Id] = byPointsDesc;
        this.io.to(this.socketRoom).emit("combat:announce", {
          player1: { id: p1Id, name: this.state.players[p1Id].name },
          player2: { id: p2Id, name: this.state.players[p2Id].name },
        });
      } else {
        this.io.to(this.socketRoom).emit("game:finished", { winnerIds, summary });
      }
    } else if (this.state.phase === "question") {
      // Same manche as before — no cold-open needed, straight to the next question.
      const question = this.publicQuestion();
      if (question) {
        this.io.to(this.socketRoom).emit("question:new", question);
        if (question.theme !== "ost") this.scheduleAutoReveal(question.timeLimitMs);
      }
    }
    // else: phase is "roundIntro" (engine.advance just crossed into a new
    // manche) — deliberately no question:new/timer here. The client renders
    // Yrud's per-manche cold-open from the phase + upcoming question's
    // roundIndex/roundLabel, and beginQuiz() is what actually starts that
    // manche's first question once the admin dismisses it.

    this.broadcastSnapshot();
    return { ok: true };
  }

  // Free-form escape hatch for anything the structured quiz can't express
  // live — a mid-event mini-game with its own point rules, a one-off joke
  // question, a correction. Never below 0, same floor as every other
  // scoring path.
  async adjustPoints(playerId: string, delta: number): Promise<{ ok: true } | { error: string }> {
    const player = this.state.players[playerId];
    if (!player) return { error: "Joueur introuvable." };
    const points = Math.max(0, player.points + delta);
    this.state = { ...this.state, players: { ...this.state.players, [playerId]: { ...player, points } } };
    await prisma.player.update({ where: { id: playerId }, data: { points } });
    this.broadcastSnapshot();
    return { ok: true };
  }

  async toggleTrap(): Promise<{ ok: true } | { error: string }> {
    if (this.state.phase !== "question") return { error: "Aucune question en cours à piéger." };
    this.state = engine.setTrap(this.state, !this.state.trapActive);
    this.broadcastSnapshot();
    return { ok: true };
  }

  async sendTaunt(message: string, targetPlayerId?: string): Promise<{ ok: true } | { error: string }> {
    const trimmed = message.trim().slice(0, 200);
    if (!trimmed) return { error: "La provocation ne peut pas être vide." };
    if (targetPlayerId && !this.state.players[targetPlayerId]) return { error: "Joueur introuvable." };

    await prisma.tauntLog.create({ data: { eventId: this.eventId, message: trimmed } });
    if (targetPlayerId) {
      const socketId = this.playerSockets[targetPlayerId];
      if (socketId) this.io.to(socketId).emit("yrud:taunt", { message: trimmed });
      // Only this one player is actually blocked by the overlay — extending
      // the shared question deadline for everyone else would just be giving
      // them free extra time they never lost.
    } else {
      this.io.to(this.socketRoom).emit("yrud:taunt", { message: trimmed });
      this.extendActiveTimers(TAUNT_DISPLAY_MS);
    }
    return { ok: true };
  }

  async triggerPrank(prankId: string): Promise<{ ok: true } | { error: string }> {
    const prank = getPrankDefinition(prankId);
    if (!prank) return { error: "Blague inconnue." };

    const text = pickPrankText(prank);
    await prisma.prankLog.create({ data: { eventId: this.eventId, prankId } });
    this.io.to(this.socketRoom).emit("prank:trigger", { prankId, text });
    this.extendActiveTimers(prank.durationMs);
    return { ok: true };
  }

  async challengeDuel(opponentId: string): Promise<{ ok: true } | { error: string }> {
    if (this.duelState) return { error: "Un duel est déjà en cours." };
    const opponent = this.state.players[opponentId];
    if (!opponent) return { error: "Ce joueur n'est pas éligible pour un duel." };

    this.duelState = duelEngine.startDuel(opponentId);
    this.io.to(this.socketRoom).emit("duel:start", { opponentId });
    this.scheduleNextDuelRoll();
    return { ok: true };
  }

  private scheduleNextDuelRoll() {
    setTimeout(() => {
      this.advanceDuelRoll().catch((err) => console.error(`[${this.code}] duel roll failed:`, err));
    }, DUEL_ROLL_DELAY_MS);
  }

  private async advanceDuelRoll() {
    const duelState = this.duelState;
    if (!duelState || duelState.phase !== "rolling") return;

    const nextState = duelEngine.advanceDuel(duelState);
    this.duelState = nextState;
    const lastRoll = nextState.rollLog[nextState.rollLog.length - 1];
    this.io.to(this.socketRoom).emit("duel:roll", lastRoll);

    if (nextState.phase !== "resolved") {
      this.scheduleNextDuelRoll();
      return;
    }

    const { opponentId, winner, rollLog } = nextState;
    const opponent = this.state.players[opponentId];
    if (opponent) {
      // Yrud winning costs the challenger points; the challenger winning
      // earns them the same amount — same stakes either way.
      const points = winner === "yrud" ? Math.max(0, opponent.points - DUEL_POINTS) : opponent.points + DUEL_POINTS;
      const updated = { ...opponent, points };
      this.state = { ...this.state, players: { ...this.state.players, [opponentId]: updated } };
      await prisma.player.update({ where: { id: opponentId }, data: { points } });
    }

    await prisma.duelLog.create({
      data: { eventId: this.eventId, opponentId, winner, rollLog: rollLog as object[] },
    });

    this.io.to(this.socketRoom).emit("duel:end", { opponentId, winner, rollLog });
    this.duelState = null;
    this.broadcastSnapshot();
  }

  async declareBattlePlan(text: string): Promise<{ ok: true } | { error: string }> {
    const trimmed = text.trim().slice(0, 500);
    if (!trimmed) return { error: "Le plan ne peut pas être vide." };

    this.battlePlan = trimmed;
    await prisma.battlePlanLog.create({ data: { eventId: this.eventId, plan: trimmed } });
    this.io.to(this.socketRoom).emit("battle:plan", { text: trimmed });
    this.broadcastSnapshot();
    return { ok: true };
  }

  async startFinalBattle(
    player1Id: string,
    player2Id: string,
    team1Text: string,
    team2Text: string
  ): Promise<{ ok: true } | { error: string }> {
    if (this.battleRunner) return { error: "Une bataille finale est déjà en cours." };
    if (player1Id === player2Id) return { error: "Choisis deux joueurs différents." };
    const player1 = this.state.players[player1Id];
    const player2 = this.state.players[player2Id];
    if (!player1 || !player2) return { error: "Joueur introuvable." };

    const team1 = importTeam(team1Text);
    if ("error" in team1) return { error: `Équipe de ${player1.name} : ${team1.error}` };
    const team2 = importTeam(team2Text);
    if ("error" in team2) return { error: `Équipe de ${player2.name} : ${team2.error}` };

    await prisma.finalBattleTeam.createMany({
      data: [
        { eventId: this.eventId, playerId: player1Id, playerName: player1.name, packedTeam: team1.packed },
        { eventId: this.eventId, playerId: player2Id, playerName: player2.name, packedTeam: team2.packed },
      ],
    });

    this.lastBattleSnapshot = undefined;
    this.lastBattleLog = undefined;
    this.pendingBattleRequests = {};
    this.teamSheets = {
      [player1Id]: buildTeamSheet(team1.packed),
      [player2Id]: buildTeamSheet(team2.packed),
    };
    for (const [playerId, sheet] of Object.entries(this.teamSheets)) {
      const socketId = this.playerSockets[playerId];
      if (socketId) this.io.to(socketId).emit("battle:teamSheet", { team: sheet });
    }
    this.battleRunner = new FinalBattleRunner(
      { id: player1Id, name: player1.name, packedTeam: team1.packed },
      { id: player2Id, name: player2.name, packedTeam: team2.packed },
      {
        onUpdate: (snapshot, log) => {
          this.io.to(this.socketRoom).emit("battle:snapshot", { snapshot, log });
        },
        onRequest: (playerId, request) => {
          this.pendingBattleRequests[playerId] = request;
          const socketId = this.playerSockets[playerId];
          if (socketId) this.io.to(socketId).emit("battle:request", { request });
        },
        onEnd: (winnerId) => {
          this.lastBattleSnapshot = this.battleRunner?.snapshot;
          this.lastBattleLog = this.battleRunner?.log;
          this.pendingBattleRequests = {};
          this.battleRunner = null;
          this.io.to(this.socketRoom).emit("battle:end", { winnerId });
          this.broadcastSnapshot();
          // The quiz-end summary (computeSummary, called from next()) is
          // built before the final battle even starts, so its
          // finalBattleWinnerName is always null at that point — recompute
          // and re-push it now that the actual battle winner is known, so
          // the grand-finale screen shows the real champion, not a stale
          // "no battle yet" summary.
          this.computeSummary(engine.winners(this.state))
            .then((summary) => {
              this.io.to(this.socketRoom).emit("game:finished", { winnerIds: engine.winners(this.state), summary });
            })
            .catch((err) => console.error(`[${this.code}] post-battle summary recompute failed:`, err));
        },
        // The battle simulator's own internal pump loops can throw on a bad
        // request or a species the sim only half-created from an
        // unvalidated team paste — without this, that failure is invisible
        // to both finalists (no more updates, no error, just a permanently
        // frozen battle screen). Surfacing it as the same error:message
        // event used for connection failures reuses an existing, working
        // full-page error display instead of inventing new UI under time
        // pressure.
        onError: (err) => {
          console.error(`[${this.code}] final battle pump error:`, err);
          this.io.to(this.socketRoom).emit("error:message", {
            message: "Une erreur est survenue pendant la bataille finale. Contactez un administrateur.",
          });
        },
      }
    );

    this.broadcastSnapshot();
    return { ok: true };
  }

  submitBattleChoice(playerId: string, choice: string): { ok: true } | { error: string } {
    if (!this.battleRunner) return { error: "Aucune bataille finale en cours." };
    const result = this.battleRunner.submitChoice(playerId, choice);
    // Consumed — a reconnect before the next request arrives shouldn't
    // replay this one and let the choice be resubmitted.
    if ("ok" in result) delete this.pendingBattleRequests[playerId];
    return result;
  }

  forfeitBattle(playerId: string): { ok: true } | { error: string } {
    if (!this.battleRunner) return { error: "Aucune bataille finale en cours." };
    return this.battleRunner.forfeit(playerId);
  }

  async applyBattleInterference(
    type: InterferenceType,
    optionId?: string
  ): Promise<{ ok: true } | { error: string }> {
    if (!this.battleRunner) return { error: "Aucune bataille finale en cours." };
    const result = this.battleRunner.interfere(type, optionId);
    if ("error" in result) return result;

    const def = INTERFERENCE_REGISTRY.find((d) => d.type === type);
    const optionLabel = def?.options?.find((o) => o.id === optionId)?.label;
    const label = optionLabel ? `${def?.label} — ${optionLabel}` : (def?.label ?? type);
    const turn = this.battleRunner.snapshot.field.turn;

    await prisma.battleInterferenceLog.create({
      data: { eventId: this.eventId, type, params: optionId ? { optionId } : undefined, turn },
    });
    this.io.to(this.socketRoom).emit("battle:interference", { type, label, turn });
    return { ok: true };
  }

  private async computeSummary(_winnerIds: string[]): Promise<EventSummary> {
    const [answers, duelLogs, tauntCount, prankCount] = await Promise.all([
      prisma.answerLog.findMany({ where: { round: { eventId: this.eventId } }, select: { playerId: true, correct: true } }),
      prisma.duelLog.findMany({ where: { eventId: this.eventId }, select: { winner: true } }),
      prisma.tauntLog.count({ where: { eventId: this.eventId } }),
      prisma.prankLog.count({ where: { eventId: this.eventId } }),
    ]);

    const correctByPlayer = new Map<string, number>();
    for (const a of answers) {
      if (a.correct) correctByPlayer.set(a.playerId, (correctByPlayer.get(a.playerId) ?? 0) + 1);
    }

    // Ranked purely by final points — nobody was ever knocked out, so
    // there's no elimination order to fall back on anymore. Standard
    // competition ranking: ties share a placement, the next rank after a
    // tie skips ahead by the tie size (1,1,3 not 1,1,2).
    const orderedIds = [...this.state.playerOrder].sort(
      (a, b) => this.state.players[b].points - this.state.players[a].points
    );
    let lastPlacement = 0;
    let lastPoints: number | null = null;
    const standings = orderedIds.map((id, i) => {
      const player = this.state.players[id];
      const points = player?.points ?? 0;
      const placement = points === lastPoints ? lastPlacement : i + 1;
      lastPlacement = placement;
      lastPoints = points;
      return {
        playerId: id,
        name: player?.name ?? "?",
        clan: resolveClan(this.clanByPlayer[id], id).id,
        placement,
        correctAnswers: correctByPlayer.get(id) ?? 0,
        points,
      };
    });

    const finalBattleWinnerId = this.lastBattleSnapshot?.winnerId ?? null;

    return {
      standings,
      totalQuestions: this.state.questions.length,
      duelRecord: {
        yrudWins: duelLogs.filter((d) => d.winner === "yrud").length,
        opponentWins: duelLogs.filter((d) => d.winner === "opponent").length,
      },
      tauntCount,
      prankCount,
      finalBattleWinnerName: finalBattleWinnerId ? (this.state.players[finalBattleWinnerId]?.name ?? null) : null,
    };
  }
}
