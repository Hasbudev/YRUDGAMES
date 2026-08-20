import type { Server } from "socket.io";
import type {
  ArenaSnapshot,
  ClientToServerEvents,
  EventSummary,
  InterferenceType,
  InterServerEvents,
  PublicPlayer,
  PublicQuestion,
  RevealResult,
  ServerToClientEvents,
  SocketData,
} from "@yrud/shared";
import {
  INTERFERENCE_REGISTRY,
  TAUNT_DISPLAY_MS,
  getPrankDefinition,
  pickPrankText,
  resolveAvatar,
} from "@yrud/shared";
import { prisma } from "../db/client";
import * as engine from "../game/engine";
import type { GameState, InternalQuestion } from "../game/types";
import * as duelEngine from "../duel/engine";
import type { DuelState } from "../duel/engine";
import { FinalBattleRunner } from "../showdown/battleRunner";
import { importTeam } from "../showdown/teamImport";

type IoServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export const DEFAULT_TIME_LIMIT_MS = 20_000;
const DUEL_ROLL_DELAY_MS = 1200;

export class EventRoom {
  readonly eventId: string;
  readonly code: string;
  readonly socketRoom: string;
  private io: IoServer;
  private state: GameState;
  private lastReveal?: RevealResult;
  private autoRevealTimer: NodeJS.Timeout | null = null;
  private duelState: DuelState | null = null;
  private livesPerPlayer: number;
  private avatarByPlayer: Record<string, string> = {};
  private battleRunner: FinalBattleRunner | null = null;
  private lastBattleSnapshot?: ArenaSnapshot["lastBattleSnapshot"];
  private battlePlan?: string;
  private playerSockets: Record<string, string> = {};
  private connectedPlayers: Set<string> = new Set();
  // First-eliminated-first — reversed at game end so the last player
  // standing (besides the winner) places 2nd, and so on down the ranking.
  private eliminationOrder: string[] = [];
  private blindTestPool: InternalQuestion[];
  // Sequential pointer, not random — "next blind test" mirrors "next
  // question" and the admin already controls ordering via the question
  // manager's up/down arrows.
  private blindTestIndex = 0;
  private blindTestState: { question: InternalQuestion; answers: Record<string, number>; revealed: boolean } | null =
    null;
  private blindTestStartedAt: number | null = null;

  constructor(
    io: IoServer,
    eventId: string,
    code: string,
    questions: InternalQuestion[],
    blindTestQuestions: InternalQuestion[],
    livesPerPlayer: number
  ) {
    this.io = io;
    this.eventId = eventId;
    this.code = code;
    this.socketRoom = `event:${code}`;
    this.state = engine.createInitialState(questions, livesPerPlayer);
    this.blindTestPool = blindTestQuestions;
    this.livesPerPlayer = livesPerPlayer;
  }

  private toPublicPlayer(p: { id: string; name: string; lives: number; eliminated: boolean }): PublicPlayer {
    return {
      id: p.id,
      name: p.name,
      lives: p.lives,
      maxLives: this.livesPerPlayer,
      avatarId: resolveAvatar(this.avatarByPlayer[p.id], p.id).id,
      eliminated: p.eliminated,
      connected: this.connectedPlayers.has(p.id),
    };
  }

  private publicQuestion(): PublicQuestion | undefined {
    const q = engine.currentQuestion(this.state);
    // Also kept through "reveal" — clients need the prompt/choices on screen
    // for the reveal beat (correctIndex is separately gated behind the
    // question:reveal event itself, so this doesn't leak anything early).
    if (!q || (this.state.phase !== "question" && this.state.phase !== "reveal")) return undefined;
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
    };
  }

  // Mirrors publicQuestion() but sources the live blind-test question
  // instead of the main sequence — same PublicQuestion shape, so the client
  // needs zero new phase-branching to render it.
  private blindTestQuestion(): PublicQuestion | undefined {
    const bt = this.blindTestState;
    if (!bt) return undefined;
    const q = bt.question;
    const clipDurationMs = q.metadata?.clipDurationMs ?? 25_000;
    return {
      id: q.id,
      theme: q.theme,
      prompt: q.prompt,
      choices: q.choices,
      metadata: q.metadata,
      mediaUrl: q.mediaUrl,
      timeLimitMs: clipDurationMs + 20_000,
      startedAt: this.blindTestStartedAt ?? Date.now(),
      questionIndex: this.state.questionIndex,
      questionCount: this.state.questions.length,
    };
  }

  snapshot(): ArenaSnapshot {
    return {
      phase: this.battleRunner
        ? "battle"
        : this.blindTestState
          ? this.blindTestState.revealed
            ? "reveal"
            : "question"
          : this.state.phase,
      players: this.state.playerOrder.map((id) => this.toPublicPlayer(this.state.players[id])),
      question: this.blindTestState ? this.blindTestQuestion() : this.publicQuestion(),
      lastReveal: this.lastReveal,
      answeredPlayerIds: this.blindTestState
        ? this.blindTestState.revealed
          ? []
          : Object.keys(this.blindTestState.answers)
        : this.state.phase === "question"
          ? Object.keys(this.state.answers)
          : [],
      battle: this.battleRunner?.snapshot,
      lastBattleSnapshot: this.lastBattleSnapshot,
      battlePlan: this.battlePlan,
      // Lets a client that (re)connects mid-duel resync instead of missing
      // it entirely — duelState is briefly non-null in "resolved" phase too,
      // but that's covered by the duel:end broadcast, not a resync need.
      activeDuel:
        this.duelState && this.duelState.phase === "rolling"
          ? { opponentId: this.duelState.opponentId, rollLog: this.duelState.rollLog }
          : undefined,
    };
  }

  registerPlayerSocket(playerId: string, socketId: string) {
    this.playerSockets[playerId] = socketId;
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

  async addPlayer(id: string, name: string, avatarId?: string): Promise<PublicPlayer | { error: string }> {
    if (this.state.players[id]) {
      return this.toPublicPlayer(this.state.players[id]);
    }
    if (this.state.phase !== "lobby") {
      return { error: "Cet événement a déjà commencé." };
    }
    this.state = engine.addPlayer(this.state, { id, name });
    const player = this.state.players[id];
    const resolvedAvatarId = resolveAvatar(avatarId, id).id;
    this.avatarByPlayer[id] = resolvedAvatarId;

    await prisma.player.upsert({
      where: { id },
      update: {},
      create: { id, eventId: this.eventId, name, avatarId: resolvedAvatarId, lives: player.lives },
    });

    this.io.to(this.socketRoom).emit("player:joined", this.toPublicPlayer(player));
    return this.toPublicPlayer(player);
  }

  submitAnswer(playerId: string, questionId: string, choiceIndex: number) {
    if (this.blindTestState && !this.blindTestState.revealed) {
      if (this.blindTestState.question.id !== questionId) return;
      if (playerId in this.blindTestState.answers) return;
      this.blindTestState.answers[playerId] = choiceIndex;
      this.broadcastSnapshot();
      return;
    }

    const question = engine.currentQuestion(this.state);
    if (!question || question.id !== questionId) return;
    if (playerId in this.state.answers) return; // already answered — nothing changes

    this.state = engine.submitAnswer(this.state, playerId, choiceIndex);
    if (playerId in this.state.answers) {
      // Broadcast live "who's answered" progress — never what they chose.
      this.broadcastSnapshot();
    }
  }

  async start(): Promise<{ ok: true } | { error: string }> {
    if (this.state.phase !== "lobby") return { error: "La partie a déjà commencé." };
    if (this.state.playerOrder.length === 0) return { error: "Aucun joueur n'est encore inscrit." };

    this.state = engine.startGame(this.state, Date.now());
    await prisma.event.update({ where: { id: this.eventId }, data: { status: "live" } });

    const question = this.publicQuestion();
    if (question) {
      this.io.to(this.socketRoom).emit("question:new", question);
      this.scheduleAutoReveal(question.timeLimitMs);
    }
    this.broadcastSnapshot();
    return { ok: true };
  }

  async reveal(): Promise<{ ok: true } | { error: string }> {
    if (this.blindTestState && !this.blindTestState.revealed) return this.revealBlindTest();
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
            data: { lives: r.livesRemaining, eliminated: r.eliminated },
          })
        )
      );
      for (const r of result.results) {
        if (r.eliminated) this.eliminationOrder.push(r.playerId);
      }
    }

    this.io.to(this.socketRoom).emit("question:reveal", result);
    this.broadcastSnapshot();
    return { ok: true };
  }

  async next(): Promise<{ ok: true } | { error: string }> {
    if (this.blindTestState?.revealed) {
      this.blindTestState = null;
      this.blindTestStartedAt = null;
      this.broadcastSnapshot();
      return { ok: true };
    }
    if (this.state.phase !== "reveal") return { error: "Révèle d'abord la question en cours." };

    this.state = engine.advance(this.state, Date.now());

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
      this.io.to(this.socketRoom).emit("game:finished", { winnerIds, summary });
    } else {
      const question = this.publicQuestion();
      if (question) {
        this.io.to(this.socketRoom).emit("question:new", question);
        this.scheduleAutoReveal(question.timeLimitMs);
      }
    }

    this.broadcastSnapshot();
    return { ok: true };
  }

  // "Next blind test" — an admin-triggered side-activity pulling sequentially
  // from its own pool instead of being woven into the main "next question"
  // sequence.
  async startBlindTest(): Promise<{ ok: true } | { error: string }> {
    if (this.blindTestState) return { error: "Un blind test est déjà en cours." };
    if (this.state.phase !== "lobby" && this.state.phase !== "reveal") {
      return { error: "Impossible de lancer un blind test maintenant." };
    }
    if (this.blindTestIndex >= this.blindTestPool.length) {
      return { error: "Plus de blind test disponible." };
    }

    const question = this.blindTestPool[this.blindTestIndex];
    this.blindTestIndex += 1;
    this.blindTestState = { question, answers: {}, revealed: false };
    this.blindTestStartedAt = Date.now();
    this.clearAutoReveal();

    const publicQ = this.blindTestQuestion();
    if (publicQ) {
      this.io.to(this.socketRoom).emit("question:new", publicQ);
      this.scheduleAutoReveal(publicQ.timeLimitMs);
    }
    this.broadcastSnapshot();
    return { ok: true };
  }

  private async revealBlindTest(): Promise<{ ok: true } | { error: string }> {
    const bt = this.blindTestState;
    if (!bt) return { error: "Aucun blind test en cours." };
    this.clearAutoReveal();

    const results = this.state.playerOrder
      .filter((id) => !this.state.players[id].eliminated)
      .map((playerId) => {
        const player = this.state.players[playerId];
        const choiceIndex = bt.answers[playerId] ?? null;
        const correct = choiceIndex === bt.question.correctIndex;
        const lives = correct ? player.lives : Math.max(0, player.lives - 1);
        const eliminated = !correct && lives === 0;
        return { playerId, choiceIndex, correct, livesRemaining: lives, eliminated };
      });

    for (const r of results) {
      const player = this.state.players[r.playerId];
      const updated = { ...player, lives: r.livesRemaining, eliminated: r.eliminated };
      this.state = { ...this.state, players: { ...this.state.players, [r.playerId]: updated } };
      if (r.eliminated) this.eliminationOrder.push(r.playerId);
    }

    const round = await prisma.round.create({
      data: { eventId: this.eventId, theme: bt.question.theme, index: this.state.questionIndex },
    });
    await prisma.answerLog.createMany({
      data: results.map((r) => ({
        roundId: round.id,
        playerId: r.playerId,
        questionId: bt.question.id,
        correct: r.correct,
        responseMs: 0,
      })),
    });
    await Promise.all(
      results.map((r) =>
        prisma.player.update({ where: { id: r.playerId }, data: { lives: r.livesRemaining, eliminated: r.eliminated } })
      )
    );

    const result: RevealResult = { correctIndex: bt.question.correctIndex, results };
    this.lastReveal = result;
    bt.revealed = true;

    this.io.to(this.socketRoom).emit("question:reveal", result);
    this.broadcastSnapshot();
    return { ok: true };
  }

  async sendTaunt(message: string): Promise<{ ok: true } | { error: string }> {
    const trimmed = message.trim().slice(0, 200);
    if (!trimmed) return { error: "La provocation ne peut pas être vide." };

    await prisma.tauntLog.create({ data: { eventId: this.eventId, message: trimmed } });
    this.io.to(this.socketRoom).emit("yrud:taunt", { message: trimmed });
    this.extendActiveTimers(TAUNT_DISPLAY_MS);
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
    if (!opponent || opponent.eliminated) return { error: "Ce joueur n'est pas éligible pour un duel." };

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
    if (winner === "yrud") {
      const opponent = this.state.players[opponentId];
      if (opponent) {
        const lives = Math.max(0, opponent.lives - 1);
        const eliminated = lives === 0;
        const updated = { ...opponent, lives, eliminated };
        this.state = { ...this.state, players: { ...this.state.players, [opponentId]: updated } };
        await prisma.player.update({ where: { id: opponentId }, data: { lives, eliminated } });
        if (eliminated) this.eliminationOrder.push(opponentId);
      }
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
    this.battleRunner = new FinalBattleRunner(
      { id: player1Id, name: player1.name, packedTeam: team1.packed },
      { id: player2Id, name: player2.name, packedTeam: team2.packed },
      {
        onUpdate: (snapshot, log) => {
          this.io.to(this.socketRoom).emit("battle:snapshot", { snapshot, log });
        },
        onRequest: (playerId, request) => {
          const socketId = this.playerSockets[playerId];
          if (socketId) this.io.to(socketId).emit("battle:request", { request });
        },
        onEnd: (winnerId) => {
          this.lastBattleSnapshot = this.battleRunner?.snapshot;
          this.battleRunner = null;
          this.io.to(this.socketRoom).emit("battle:end", { winnerId });
          this.broadcastSnapshot();
        },
      }
    );

    this.broadcastSnapshot();
    return { ok: true };
  }

  submitBattleChoice(playerId: string, choice: string): { ok: true } | { error: string } {
    if (!this.battleRunner) return { error: "Aucune bataille finale en cours." };
    return this.battleRunner.submitChoice(playerId, choice);
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

  private async computeSummary(winnerIds: string[]): Promise<EventSummary> {
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

    // Winner(s) share 1st place, then reverse elimination order — the last
    // player eliminated placed higher than someone knocked out earlier.
    const rest = [...this.eliminationOrder].reverse().filter((id) => !winnerIds.includes(id));
    const orderedIds = [...winnerIds, ...rest];
    const standings = orderedIds.map((id, i) => {
      const player = this.state.players[id];
      return {
        playerId: id,
        name: player?.name ?? "?",
        avatarId: resolveAvatar(this.avatarByPlayer[id], id).id,
        // Standard competition ranking: ties share a placement, the next
        // rank after a tie skips ahead by the tie size (1,1,3 not 1,1,2).
        placement: i < winnerIds.length ? 1 : i + 1,
        correctAnswers: correctByPlayer.get(id) ?? 0,
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
