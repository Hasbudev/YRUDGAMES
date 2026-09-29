import type { Server } from "socket.io";
import type {
  ArenaSnapshot,
  BattleChoiceRequest,
  BombState,
  CategoryDraft,
  StealState,
  ClientToServerEvents,
  EventSummary,
  InterferenceType,
  InterServerEvents,
  PublicPlayer,
  PublicQuestion,
  RevealResult,
  RoundRules,
  ServerToClientEvents,
  SocketData,
  TeamSheetMember,
} from "@yrud/shared";
import {
  BOMB_STRIKES,
  SLIDER_TRICKS,
  type SliderTrick,
  CLAN_REGISTRY,
  INTERFERENCE_REGISTRY,
  TAUNT_DISPLAY_MS,
  WHACK_HIT_GRACE_MS,
  whackSchedule,
  whackScore,
  type Mole,
  type WhackHit,
  getPrankDefinition,
  pickPrankText,
  resolveClan,
} from "@yrud/shared";
import { prisma } from "../db/client";
import * as engine from "../game/engine";
import { summarizeRound } from "../game/rules";
import { matchesFreeText } from "../game/freeText";
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

// Used for any question that doesn't carry its own duration.
export const DEFAULT_TIME_LIMIT_MS = 20_000;
const MIN_TIME_LIMIT_SEC = 5;
const MAX_TIME_LIMIT_SEC = 300;
const DUEL_ROLL_DELAY_MS = 1200;
// Chasse-taupes: the clock runs this much past the last mole so the final
// hits still reach the server before the auto-reveal.
const WHACK_END_GRACE_MS = 1500;
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
  // Admin-set duration per manche (roundIndex -> ms), beating each
  // question's own value. Lives in memory like the rest of the room state.
  private roundTimeLimitMs = new Map<number, number>();
  // The duration the currently-live question actually started with, frozen
  // at that moment — a later override must not retroactively change a clock
  // that is already ticking (clients derive their countdown from it).
  private liveTimeLimitMs: number | null = null;
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
  // The live chasse-taupes game, if the current question is one — its board
  // (seed picked at launch) and every player's accepted hits, in order.
  private whackGame: { questionId: string; seed: number; schedule: Mole[]; hits: Record<string, WhackHit[]> } | null =
    null;
  // Manche 1 — which clan got which category, and the live vote.
  private categoryDraft: CategoryDraft | null = null;
  private draftVotes: Record<string, string> = {};
  // Manche 3 — the hot-potato bomb: the clan holding it, the clans' passing
  // order, how many strikes each bomb takes to go off (secret) and how many
  // the current one has.
  private bomb: {
    roundIndex: number;
    holderClan: string | null;
    order: string[];
    number: number;
    fuses: number[];
    strikes: number;
    penalty: number;
    lastOutcome?: BombState["lastOutcome"];
  } | null = null;
  private bombRoundsDone = new Set<number>();
  // Who answered the live question, in arrival order — for manche 4, where
  // the fastest right answer earns a steal.
  private answerOrder: string[] = [];
  private steal: StealState | null = null;

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

  private timeLimitFor(q: InternalQuestion): number {
    // A chasse-taupes lasts as long as its board, whatever the manche's timer.
    if (q.theme === "whack" && q.metadata?.whack) return q.metadata.whack.durationMs + WHACK_END_GRACE_MS;
    return this.roundTimeLimitMs.get(q.roundIndex) ?? q.timeLimitMs;
  }

  // The manche the game is in — or about to start (lobby/intro have no
  // question yet, so that's the first one; roundIntro's questionIndex has
  // already moved onto the upcoming manche's first question).
  private roundRules(): RoundRules | undefined {
    if (this.state.phase === "finished") return undefined;
    const q = this.state.questions[Math.max(0, this.state.questionIndex)];
    if (!q) return undefined;
    return summarizeRound(
      this.state.questions,
      q.roundIndex,
      (question) => this.timeLimitFor(question),
      this.roundTimeLimitMs.has(q.roundIndex)
    );
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
    // A free-text question's choices hold its answer (shown at reveal), and
    // its accepted answers must never reach a client at all.
    const { acceptedAnswers, ...metadata } = q.metadata ?? {};
    const freeText = !!acceptedAnswers?.length;
    if (metadata.whack && this.whackGame?.questionId === q.id) {
      metadata.whack = { ...metadata.whack, seed: this.whackGame.seed };
    }
    return {
      id: q.id,
      theme: q.theme,
      prompt: q.prompt,
      choices: freeText && this.state.phase !== "reveal" ? [] : q.choices,
      metadata: q.metadata ? { ...metadata, ...(freeText ? { freeText: true } : {}) } : undefined,
      mediaUrl: q.mediaUrl,
      timeLimitMs: this.state.phase === "roundIntro" ? this.timeLimitFor(q) : (this.liveTimeLimitMs ?? this.timeLimitFor(q)),
      startedAt: this.state.questionStartedAt ?? Date.now(),
      serverNow: Date.now(),
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
      roundRules: this.roundRules(),
      trapActive: this.state.trapActive,
      categoryDraft: this.categoryDraft ?? undefined,
      answeringClan: this.answeringClan(),
      bomb: this.bomb
        ? {
            holderClan: this.bomb.holderClan,
            bombNumber: Math.min(this.bomb.number, this.bomb.fuses.length),
            totalBombs: this.bomb.fuses.length,
            heat: Math.min(1, this.bomb.strikes / (this.bomb.fuses[this.bomb.number - 1] ?? 1)),
            penalty: this.bomb.penalty,
            lastOutcome: this.bomb.lastOutcome,
          }
        : undefined,
      steal: this.steal ?? undefined,
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
        const remaining = newStartedAt + (this.liveTimeLimitMs ?? question.timeLimitMs) - Date.now();
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
    if (!this.canAnswer(playerId, question)) return; // manche 1: not this clan's turn
    if (playerId in this.state.answers) return; // already answered — nothing changes
    const slider = question.theme === "slider" ? question.metadata?.slider : undefined;
    if (slider && (!Number.isInteger(choiceIndex) || choiceIndex < slider.low || choiceIndex > slider.high)) return;

    this.state = engine.submitAnswer(this.state, playerId, choiceIndex);
    if (playerId in this.state.answers) {
      this.answerOrder.push(playerId);
      // Broadcast live "who's answered" progress — never what they chose.
      this.broadcastSnapshot();
    }
  }

  // One tap on a chasse-taupes mole. Only kept if that mole is really up on
  // the board right now (with some slack for latency) and this player hasn't
  // already tapped it — the score is rebuilt from these at reveal, so a
  // client can't just claim points.
  whack(playerId: string, questionId: string, moleId: number) {
    const game = this.whackGame;
    if (!game || game.questionId !== questionId || this.state.phase !== "question") return;
    if (!this.state.players[playerId] || this.state.questionStartedAt === null) return;
    const mole = game.schedule[moleId];
    if (!mole) return;
    const atMs = Date.now() - this.state.questionStartedAt;
    if (atMs < mole.appearAt - 250 || atMs > mole.hideAt + WHACK_HIT_GRACE_MS) return;
    const hits = (game.hits[playerId] ??= []);
    if (hits.some((h) => h.moleId === moleId)) return;
    hits.push({ moleId, atMs });
  }

  // A typed answer to a free-text question becomes a normal pick — the
  // correct index if it matches an accepted answer, an out-of-range index
  // (a wrong pick) otherwise — so scoring, traps and reveal need no special case.
  submitTextAnswer(playerId: string, questionId: string, text: string) {
    const question = engine.currentQuestion(this.state);
    const accepted = question?.metadata?.acceptedAnswers;
    if (!question || question.id !== questionId || !accepted?.length) return;
    if (!text.trim()) return;
    this.submitAnswer(playerId, questionId, matchesFreeText(text, accepted) ? question.correctIndex : -1);
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
    const upcoming = this.state.questions[Math.max(0, this.state.questionIndex)];
    if (upcoming?.metadata?.category && !this.draftComplete()) {
      return { error: "Fais d'abord choisir leur catégorie aux clans (panneau « Choix des catégories »)." };
    }
    if (this.state.phase === "intro") {
      this.state = engine.startGame(this.state, Date.now());
    } else if (this.state.phase === "roundIntro") {
      this.state = engine.confirmRoundIntro(this.state, Date.now());
    } else {
      return { error: "Rien à confirmer pour l'instant." };
    }

    this.launchQuestion();
    this.broadcastSnapshot();
    return { ok: true };
  }

  // Puts the just-started question on the wire and arms its clock. The
  // duration is frozen here (see liveTimeLimitMs) so it stays consistent
  // between what clients count down and when the server auto-reveals.
  private launchQuestion() {
    const current = engine.currentQuestion(this.state);
    if (!current) return;
    this.answerOrder = [];
    this.whackGame =
      current.theme === "whack" && current.metadata?.whack
        ? (() => {
            const seed = Math.floor(Math.random() * 2 ** 31);
            return { questionId: current.id, seed, schedule: whackSchedule(seed, current.metadata.whack.durationMs), hits: {} };
          })()
        : null;
    const bombRule = current.metadata?.bomb;
    if (bombRule && !this.bomb && !this.bombRoundsDone.has(current.roundIndex)) {
      const order = this.categoryDraft?.order ?? CLAN_REGISTRY.map((c) => c.id);
      this.bomb = {
        roundIndex: current.roundIndex,
        order,
        holderClan: this.nextClanWithPlayers(order, null),
        number: 1,
        fuses: Array.from({ length: bombRule.count }, () => BOMB_STRIKES.min + Math.floor(Math.random() * (BOMB_STRIKES.max - BOMB_STRIKES.min + 1))),
        strikes: 0,
        penalty: bombRule.penalty,
      };
    }
    if (this.bomb) {
      this.bomb.lastOutcome = undefined;
      if (this.bomb.number > this.bomb.fuses.length) {
        // Every bomb has gone off — the rest of the manche is played by all.
        this.bombRoundsDone.add(this.bomb.roundIndex);
        this.bomb = null;
      }
    }
    this.liveTimeLimitMs = this.timeLimitFor(current);
    const question = this.publicQuestion();
    if (!question) return;
    this.io.to(this.socketRoom).emit("question:new", question);
    // A blind-test (ost) question has no hard deadline — Yrud reveals it
    // manually once the clip has played long enough, unlike every other
    // theme's auto-reveal-on-timeout.
    if (question.theme !== "ost") this.scheduleAutoReveal(question.timeLimitMs);
  }

  async reveal(): Promise<{ ok: true } | { error: string }> {
    if (this.state.phase !== "question") return { error: "Aucune question n'est en cours." };
    this.clearAutoReveal();

    const question = engine.currentQuestion(this.state);
    const game = this.whackGame;
    const { state: nextState, result } =
      question?.theme === "whack" && game
        ? engine.revealScores(
            this.state,
            Object.fromEntries(Object.entries(game.hits).map(([id, hits]) => [id, whackScore(game.schedule, hits)]))
          )
        : engine.reveal(this.state, this.categoryPointsFor(question), this.participantFilter(question));
    this.whackGame = null;
    this.state = nextState;
    this.lastReveal = result;

    if (question) {
      if (question.metadata?.bomb) this.tickBomb(question, result);
      this.maybeOpenSteal(question, result);
    }

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
    if (this.steal?.pendingIds.length) {
      const names = this.steal.pendingIds.map((id) => this.state.players[id]?.name ?? "?").join(", ");
      return { error: `${names} doit encore choisir à qui voler des points (ou annule le vol).` };
    }

    this.state = engine.advance(this.state, Date.now());
    return this.afterAdvance();
  }

  // Yrud's "passer" — drops the live question with no scoring and moves on
  // exactly as after a reveal + "Question suivante".
  async skip(): Promise<{ ok: true } | { error: string }> {
    if (this.state.phase !== "question") return { error: "Aucune question à passer." };
    this.clearAutoReveal();
    this.whackGame = null;
    this.state = engine.skipQuestion(this.state, Date.now());
    this.lastReveal = undefined;
    return this.afterAdvance();
  }

  // Sets one manche's answer time (or clears it with null) — see the
  // admin:setTimeLimit event for the semantics.
  async setTimeLimit(seconds: number | null, roundIndex?: number): Promise<{ ok: true } | { error: string }> {
    const round = roundIndex ?? this.roundRules()?.roundIndex;
    if (round === undefined) return { error: "Aucune manche à régler." };
    if (!this.state.questions.some((q) => q.roundIndex === round)) return { error: "Manche introuvable." };

    if (seconds === null) {
      this.roundTimeLimitMs.delete(round);
    } else {
      if (!Number.isFinite(seconds) || seconds < MIN_TIME_LIMIT_SEC || seconds > MAX_TIME_LIMIT_SEC) {
        return { error: `La durée doit être entre ${MIN_TIME_LIMIT_SEC} et ${MAX_TIME_LIMIT_SEC} secondes.` };
      }
      this.roundTimeLimitMs.set(round, Math.round(seconds) * 1000);
    }
    this.broadcastSnapshot();
    return { ok: true };
  }

  // Everything that follows the state having moved past a question —
  // shared by next() (after a reveal) and skip() (straight from a live one).
  private async afterAdvance(): Promise<{ ok: true } | { error: string }> {
    if (this.state.phase === "roundIntro") this.introSeenBy.clear();
    this.steal = null;
    // A bomb only lives in its own manche (e.g. if questions were skipped
    // before every bomb went off).
    const upcoming = engine.currentQuestion(this.state);
    if (this.bomb && upcoming?.roundIndex !== this.bomb.roundIndex) {
      this.bombRoundsDone.add(this.bomb.roundIndex);
      this.bomb = null;
    }

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
      this.launchQuestion();
    }
    // else: phase is "roundIntro" (engine.advance just crossed into a new
    // manche) — deliberately no question:new/timer here. The client renders
    // Yrud's per-manche cold-open from the phase + upcoming question's
    // roundIndex/roundLabel, and beginQuiz() is what actually starts that
    // manche's first question once the admin dismisses it.

    this.broadcastSnapshot();
    return { ok: true };
  }

  private clanOf(playerId: string): string {
    return resolveClan(this.clanByPlayer[playerId], playerId).id;
  }

  private async setPoints(playerId: string, points: number) {
    const player = this.state.players[playerId];
    if (!player) return;
    this.state = { ...this.state, players: { ...this.state.players, [playerId]: { ...player, points } } };
    await prisma.player.update({ where: { id: playerId }, data: { points } });
  }

  // --- Manche 1: categories picked by the clans ----------------------------

  private draftCategories(): string[] {
    return [...new Set(this.state.questions.map((q) => q.metadata?.category).filter((c): c is string => !!c))];
  }

  private draftComplete(): boolean {
    return !!this.categoryDraft && this.categoryDraft.turn >= this.categoryDraft.order.length;
  }

  // The clan that picked this category question's category — the only one
  // answering it. undefined for any other question (everyone plays).
  private ownerClan(question: InternalQuestion | undefined): string | undefined {
    const category = question?.metadata?.category;
    if (!category || !this.categoryDraft) return undefined;
    return Object.entries(this.categoryDraft.assignments).find(([, c]) => c === category)?.[0];
  }

  // The only clan allowed to answer this question: its category's owner
  // (manche 1) or the bomb's holder (manche 3). undefined = everyone plays.
  private turnClan(question: InternalQuestion | undefined): string | undefined {
    if (question?.metadata?.bomb && this.bomb) return this.bomb.holderClan ?? undefined;
    return this.ownerClan(question);
  }

  private answeringClan(): string | undefined {
    if (this.state.phase !== "question" && this.state.phase !== "reveal") return undefined;
    const question = engine.currentQuestion(this.state);
    // At reveal the bomb may already have moved on — the clan that answered
    // is the one in its outcome.
    if (this.state.phase === "reveal" && question?.metadata?.bomb && this.bomb?.lastOutcome) return this.bomb.lastOutcome.clan;
    return this.turnClan(question);
  }

  private canAnswer(playerId: string, question: InternalQuestion): boolean {
    const clan = this.turnClan(question);
    return !clan || this.clanOf(playerId) === clan;
  }

  private participantFilter(question: InternalQuestion | undefined) {
    const clan = this.turnClan(question);
    return clan ? (playerId: string) => this.clanOf(playerId) === clan : undefined;
  }

  private categoryPointsFor(question: InternalQuestion | undefined) {
    const worth = question?.metadata?.categoryPoints;
    if (!question?.metadata?.category || !worth) return undefined;
    return () => worth.own;
  }

  // Once every clan has its category, manche 1 is played clan by clan in the
  // picking order: that clan's questions first, then the next clan's...
  // Only the category questions move, and they keep their block's place.
  private orderCategoryQuestions() {
    const draft = this.categoryDraft;
    if (!draft || draft.turn < draft.order.length) return;
    const questions = this.state.questions;
    const slots = questions.map((q, i) => (q.metadata?.category ? i : -1)).filter((i) => i >= 0);
    if (slots.length === 0) return;
    const rank = (category: string | undefined) => {
      const clanIndex = draft.order.findIndex((clan) => draft.assignments[clan] === category);
      return clanIndex === -1 ? draft.order.length : clanIndex;
    };
    const sorted = slots
      .map((i) => questions[i])
      .map((q, originalPos) => ({ q, originalPos }))
      .sort((a, b) => rank(a.q.metadata?.category) - rank(b.q.metadata?.category) || a.originalPos - b.originalPos)
      .map((x) => x.q);
    const next = [...questions];
    slots.forEach((slot, k) => (next[slot] = sorted[k]));
    this.state = { ...this.state, questions: next };
  }

  async startDraft(order: string[]): Promise<{ ok: true } | { error: string }> {
    const categories = this.draftCategories();
    if (!categories.length) return { error: "Aucune manche à catégories dans cette partie." };
    const firstCategoryIndex = this.state.questions.findIndex((q) => q.metadata?.category);
    if (this.state.questionIndex > firstCategoryIndex || (this.state.questionIndex === firstCategoryIndex && this.state.phase !== "roundIntro")) {
      return { error: "La manche à catégories a déjà commencé." };
    }
    const clanIds = CLAN_REGISTRY.map((c) => c.id);
    if (order.length !== clanIds.length || new Set(order).size !== order.length || order.some((c) => !clanIds.includes(c))) {
      return { error: "L'ordre doit contenir chaque clan une fois." };
    }
    this.categoryDraft = { categories, order, turn: 0, assignments: {}, voteCounts: {}, voterIds: [] };
    this.draftVotes = {};
    this.settleDraftTurns();
    this.broadcastSnapshot();
    return { ok: true };
  }

  voteCategory(playerId: string, category: string) {
    const draft = this.categoryDraft;
    if (!draft || draft.turn >= draft.order.length) return;
    if (this.clanOf(playerId) !== draft.order[draft.turn]) return;
    if (!draft.categories.includes(category) || Object.values(draft.assignments).includes(category)) return;
    this.draftVotes[playerId] = category;
    this.refreshVoteCounts();
    // Everyone of that clan who's here has voted — no need to wait for Yrud.
    const clan = draft.order[draft.turn];
    const present = this.state.playerOrder.filter((id) => this.clanOf(id) === clan && this.connectedPlayers.has(id));
    if (present.every((id) => id in this.draftVotes)) this.resolveDraftTurn();
    this.broadcastSnapshot();
  }

  async closeVote(): Promise<{ ok: true } | { error: string }> {
    const draft = this.categoryDraft;
    if (!draft || draft.turn >= draft.order.length) return { error: "Aucun vote en cours." };
    this.resolveDraftTurn();
    this.broadcastSnapshot();
    return { ok: true };
  }

  private refreshVoteCounts() {
    if (!this.categoryDraft) return;
    const counts: Record<string, number> = {};
    for (const c of Object.values(this.draftVotes)) counts[c] = (counts[c] ?? 0) + 1;
    this.categoryDraft = { ...this.categoryDraft, voteCounts: counts, voterIds: Object.keys(this.draftVotes) };
  }

  // Majority wins; a tie (or nobody voting) is drawn at random among the
  // top/remaining categories.
  private resolveDraftTurn() {
    const draft = this.categoryDraft;
    if (!draft) return;
    const remaining = draft.categories.filter((c) => !Object.values(draft.assignments).includes(c));
    const best = Math.max(0, ...remaining.map((c) => draft.voteCounts[c] ?? 0));
    const top = remaining.filter((c) => (draft.voteCounts[c] ?? 0) === best);
    const pick = top[Math.floor(Math.random() * top.length)];
    this.categoryDraft = {
      ...draft,
      assignments: { ...draft.assignments, [draft.order[draft.turn]]: pick },
      turn: draft.turn + 1,
      voteCounts: {},
      voterIds: [],
    };
    this.draftVotes = {};
    this.settleDraftTurns();
  }

  // Skips the vote when there's nothing to decide: a single category left,
  // or a clan with nobody here to vote.
  private settleDraftTurns() {
    const draft = this.categoryDraft;
    if (!draft) return;
    if (draft.turn >= draft.order.length) {
      this.orderCategoryQuestions();
      return;
    }
    const remaining = draft.categories.filter((c) => !Object.values(draft.assignments).includes(c));
    const clan = draft.order[draft.turn];
    const present = this.state.playerOrder.some((id) => this.clanOf(id) === clan && this.connectedPlayers.has(id));
    if (remaining.length <= 1 || !present) {
      if (remaining.length === 0) {
        this.categoryDraft = { ...draft, turn: draft.order.length };
        this.orderCategoryQuestions();
        return;
      }
      this.resolveDraftTurn();
    }
  }

  // --- Manche 3: the bomb ---------------------------------------------------

  // The next clan after `from` in the passing order that has players (the
  // first one when `from` is null) — a clan nobody is playing for is skipped.
  private nextClanWithPlayers(order: string[], from: string | null): string | null {
    const withPlayers = new Set(this.state.playerOrder.map((id) => this.clanOf(id)));
    const start = from === null ? -1 : order.indexOf(from);
    for (let step = 1; step <= order.length; step++) {
      const clan = order[(start + step + order.length) % order.length];
      if (withPlayers.has(clan)) return clan;
    }
    return null;
  }

  // The holding clan's majority answer decides: right → the bomb goes to the
  // next clan; wrong (or a tie with a wrong answer, or nobody answering) →
  // it stays and takes a strike, and at its secret number of strikes it goes
  // off: every player of that clan loses `penalty`, and the next bomb starts
  // with the next clan.
  private tickBomb(question: InternalQuestion, result: RevealResult) {
    const bomb = this.bomb;
    const clan = bomb?.holderClan;
    if (!bomb || !clan) return;

    const votes = new Map<number, number>();
    for (const r of result.results) {
      if (r.choiceIndex !== null) votes.set(r.choiceIndex, (votes.get(r.choiceIndex) ?? 0) + 1);
    }
    const total = [...votes.values()].reduce((a, b) => a + b, 0);
    const best = Math.max(0, ...votes.values());
    const rightVotes = votes.get(question.correctIndex) ?? 0;
    const correct = rightVotes > 0 && [...votes.entries()].every(([choice, n]) => choice === question.correctIndex || n < rightVotes);

    if (correct) {
      bomb.holderClan = this.nextClanWithPlayers(bomb.order, clan);
      bomb.lastOutcome = { clan, correct: true, votes: total, majorityVotes: rightVotes, passedTo: bomb.holderClan ?? undefined };
      return;
    }

    bomb.strikes += 1;
    bomb.lastOutcome = { clan, correct: false, votes: total, majorityVotes: best };
    if (bomb.strikes < bomb.fuses[bomb.number - 1]) return;

    // The penalty is shared by the clan's voters on this question: every
    // player of the clan loses penalty ÷ voters (nobody voted → the full
    // penalty) — the more of them answer, the softer the blast.
    const share = Math.round(bomb.penalty / Math.max(1, total));
    const affectedIds = this.state.playerOrder.filter((id) => this.clanOf(id) === clan);
    for (const id of affectedIds) {
      const player = this.state.players[id];
      const points = Math.max(0, player.points - share);
      this.state = { ...this.state, players: { ...this.state.players, [id]: { ...player, points } } };
      const entry = result.results.find((r) => r.playerId === id);
      if (entry) {
        entry.delta += points - entry.points;
        entry.points = points;
      }
    }
    this.io.to(this.socketRoom).emit("bomb:explode", { clan, penalty: share, affectedIds });
    bomb.lastOutcome = { ...bomb.lastOutcome, exploded: true };
    bomb.number += 1;
    bomb.strikes = 0;
    bomb.holderClan = bomb.number > bomb.fuses.length ? null : this.nextClanWithPlayers(bomb.order, clan);
    if (bomb.holderClan) bomb.lastOutcome.passedTo = bomb.holderClan;
  }

  // --- Manche 4: the winner steals ------------------------------------------

  // After each question carrying `steal`: whoever got it right first picks a
  // player to take that many points from. Nobody right → no steal.
  private maybeOpenSteal(question: InternalQuestion, result: RevealResult) {
    const amount = question.metadata?.steal;
    if (!amount) return;
    const right = new Set(result.results.filter((r) => r.correct).map((r) => r.playerId));
    const fastest = this.answerOrder.find((id) => right.has(id));
    if (fastest) this.steal = { amount, pendingIds: [fastest], done: [] };
  }

  async stealPoints(thiefId: string, victimId: string): Promise<{ ok: true } | { error: string }> {
    const steal = this.steal;
    if (!steal || !steal.pendingIds.includes(thiefId)) return { error: "Tu n'as rien à voler." };
    if (thiefId === victimId || !this.state.players[victimId]) return { error: "Choisis un autre joueur." };
    const victim = this.state.players[victimId];
    const amount = Math.min(steal.amount, victim.points);
    await this.setPoints(victimId, victim.points - amount);
    await this.setPoints(thiefId, this.state.players[thiefId].points + amount);
    this.steal = {
      ...steal,
      pendingIds: steal.pendingIds.filter((id) => id !== thiefId),
      done: [...steal.done, { thiefId, victimId, amount }],
    };
    this.io.to(this.socketRoom).emit("steal:done", { thiefId, victimId, amount });
    this.broadcastSnapshot();
    return { ok: true };
  }

  sliderTrick(trick: string): { ok: true } | { error: string } {
    const question = engine.currentQuestion(this.state);
    if (this.state.phase !== "question" || question?.theme !== "slider") return { error: "Aucun curseur en cours." };
    if (!SLIDER_TRICKS.some((t) => t.id === trick)) return { error: "Coup inconnu." };
    this.io.to(this.socketRoom).emit("slider:trick", { trick: trick as SliderTrick });
    return { ok: true };
  }

  async skipSteal(): Promise<{ ok: true } | { error: string }> {
    if (!this.steal?.pendingIds.length) return { error: "Aucun vol en attente." };
    this.steal = { ...this.steal, pendingIds: [] };
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
