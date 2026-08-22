import { BattleStream, getPlayerStreams } from "pokemon-showdown";
import type { BattleChoiceRequest, BattleLogEntry, BattleSnapshot, InterferenceType } from "@yrud/shared";
import { applyProtocolChunk, createInitialParserState, type ParserState } from "./protocolParser";
import { parseChoiceRequest } from "./choiceRequest";
import { applyInterference } from "./interference";
import { readFieldState } from "./fieldState";
import { patchActive, readActiveBoosts, readActiveGender, readActiveHp, readTeamRosters } from "./teamState";

export interface FinalBattlePlayer {
  id: string;
  name: string;
  packedTeam: string;
}

export interface FinalBattleCallbacks {
  onUpdate(snapshot: BattleSnapshot, log: BattleLogEntry[]): void;
  onRequest(playerId: string, request: BattleChoiceRequest): void;
  onEnd(winnerId: string | null): void;
  // The `for await` pump loops below silently stop forever if anything
  // inside them throws (a malformed request, a dex lookup on a species the
  // simulator half-created from a bad team import, etc.) — without this,
  // that failure mode is invisible: no more updates ever arrive, no request
  // ever arrives, and neither player has any indication the battle is dead
  // rather than just waiting on the other player.
  onError(error: unknown): void;
}

const FORMAT_ID = "gen9customgame";

export class FinalBattleRunner {
  readonly player1Id: string;
  readonly player2Id: string;
  private stream: BattleStream;
  private streams: ReturnType<typeof getPlayerStreams>;
  private parserState: ParserState;
  private callbacks: FinalBattleCallbacks;
  private ended = false;
  // Full history, not just the latest chunk — lets a client that (re)connects
  // mid-battle resync the log feed via room snapshot instead of only ever
  // seeing entries broadcast after it connected. Capped well above what the
  // UI ever displays (last 30-60) so it never grows unbounded.
  private fullLog: BattleLogEntry[] = [];

  constructor(player1: FinalBattlePlayer, player2: FinalBattlePlayer, callbacks: FinalBattleCallbacks) {
    this.player1Id = player1.id;
    this.player2Id = player2.id;
    this.callbacks = callbacks;
    this.stream = new BattleStream();
    this.streams = getPlayerStreams(this.stream);
    this.parserState = createInitialParserState(
      { playerId: player1.id, name: player1.name },
      { playerId: player2.id, name: player2.name }
    );

    this.pumpSide(this.streams.p1, player1.id).catch((err) => {
      console.error("battle p1 pump failed:", err);
      this.callbacks.onError(err);
    });
    this.pumpSide(this.streams.p2, player2.id).catch((err) => {
      console.error("battle p2 pump failed:", err);
      this.callbacks.onError(err);
    });
    this.pumpOmniscient().catch((err) => {
      console.error("battle omniscient pump failed:", err);
      this.callbacks.onError(err);
    });

    const spec = { formatid: FORMAT_ID };
    const p1spec = { name: player1.name, team: player1.packedTeam };
    const p2spec = { name: player2.name, team: player2.packedTeam };
    void this.streams.omniscient.write(
      `>start ${JSON.stringify(spec)}\n>player p1 ${JSON.stringify(p1spec)}\n>player p2 ${JSON.stringify(p2spec)}`
    );
  }

  private async pumpSide(sideStream: ReturnType<typeof getPlayerStreams>["p1"], playerId: string) {
    for await (const chunk of sideStream) {
      // A single malformed request (e.g. a dex lookup failing on a species
      // the simulator only half-created from an unvalidated team import)
      // must not kill the whole `for await` loop — that would silently stop
      // this player from ever receiving another move request for the rest
      // of the battle, with the other player still playing into the void.
      try {
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("|request|")) continue;
          const raw = JSON.parse(line.slice("|request|".length));
          if (raw?.teamPreview) {
            // v1 doesn't build a team-order UI — keep the pasted order.
            sideStream.write("team 1");
            continue;
          }
          if (!this.stream.battle) continue;
          const parsed = parseChoiceRequest(raw, this.stream.battle.dex);
          if (parsed) this.callbacks.onRequest(playerId, parsed);
        }
      } catch (err) {
        console.error(`battle pump (${playerId}) chunk failed:`, err);
        this.callbacks.onError(err);
      }
    }
  }

  private async pumpOmniscient() {
    for await (const chunk of this.streams.omniscient) {
      // Same reasoning as pumpSide: one bad chunk must not permanently stop
      // every future snapshot/log update for both players.
      try {
        this.processOmniscientChunk(chunk);
      } catch (err) {
        console.error("battle omniscient pump chunk failed:", err);
        this.callbacks.onError(err);
      }
    }
  }

  private processOmniscientChunk(chunk: string) {
    const { state, log } = applyProtocolChunk(chunk, this.parserState);
    this.parserState = state;
    if (this.stream.battle) {
      const battle = this.stream.battle;
      const rosters = readTeamRosters(battle);
      const snap = this.parserState.snapshot;
      this.parserState = {
        ...this.parserState,
        snapshot: {
          ...snap,
          field: readFieldState(battle),
          p1: {
            ...snap.p1,
            team: rosters.p1,
            active: patchActive(
              snap.p1.active,
              readActiveGender(battle.sides[0]),
              readActiveHp(battle.sides[0]),
              readActiveBoosts(battle.sides[0])
            ),
          },
          p2: {
            ...snap.p2,
            team: rosters.p2,
            active: patchActive(
              snap.p2.active,
              readActiveGender(battle.sides[1]),
              readActiveHp(battle.sides[1]),
              readActiveBoosts(battle.sides[1])
            ),
          },
        },
      };
    }
    if (log.length) {
      this.fullLog.push(...log);
      if (this.fullLog.length > 300) this.fullLog = this.fullLog.slice(-300);
      this.callbacks.onUpdate(this.parserState.snapshot, log);
    }
    // Checks `ended`, not `winnerId !== null` — a simultaneous double-faint
    // (Explosion, Destiny Bond, Perish Song hitting zero for both) ends the
    // battle with `winnerId` staying null forever, which used to be
    // indistinguishable from "still in progress" and left both players
    // frozen on the battle screen with no way to leave.
    if (!this.ended && this.parserState.snapshot.ended) {
      this.ended = true;
      this.callbacks.onEnd(this.parserState.snapshot.winnerId);
    }
  }

  submitChoice(playerId: string, choice: string): { ok: true } | { error: string } {
    if (this.ended) return { error: "La bataille est déjà terminée." };
    if (playerId === this.player1Id) {
      this.logChoice("p1", choice);
      this.streams.p1.write(choice);
      return { ok: true };
    }
    if (playerId === this.player2Id) {
      this.logChoice("p2", choice);
      this.streams.p2.write(choice);
      return { ok: true };
    }
    return { error: "Tu ne participes pas à cette bataille." };
  }

  // Diagnostic only — a player once saw a forced-switch resolve to a
  // Pokémon they never clicked, and static tracing turned up no code path
  // that could cause it. If it recurs, this pins down the exact choice
  // string and the sim's own pending-request state at the moment it landed,
  // instead of relying on the client-facing log alone.
  private logChoice(side: "p1" | "p2", choice: string) {
    const requestState = this.stream.battle?.sides[side === "p1" ? 0 : 1]?.requestState;
    console.log(`[battle:${this.player1Id.slice(0, 8)}] ${side} choice="${choice}" pendingRequestState=${requestState}`);
  }

  // The simulator itself has no forfeit concept (it's a JS library, not a
  // server with a "player left" signal) — ending in the other finalist's
  // favor here is the same real win condition as any other battle end, just
  // triggered by choice instead of an empty-team loss.
  forfeit(playerId: string): { ok: true } | { error: string } {
    if (this.ended) return { error: "La bataille est déjà terminée." };
    const winnerId =
      playerId === this.player1Id ? this.player2Id : playerId === this.player2Id ? this.player1Id : null;
    if (!winnerId) return { error: "Tu ne participes pas à cette bataille." };
    this.ended = true;
    this.callbacks.onEnd(winnerId);
    return { ok: true };
  }

  interfere(type: InterferenceType, optionId?: string): { ok: true } | { error: string } {
    if (this.ended) return { error: "La bataille est déjà terminée." };
    if (!this.stream.battle) return { error: "La bataille n'est pas encore prête." };
    return applyInterference(this.stream, this.stream.battle, type, optionId);
  }

  get snapshot(): BattleSnapshot {
    return this.parserState.snapshot;
  }

  get log(): BattleLogEntry[] {
    return this.fullLog;
  }
}
