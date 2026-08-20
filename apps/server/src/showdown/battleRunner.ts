import { BattleStream, getPlayerStreams } from "pokemon-showdown";
import type { BattleChoiceRequest, BattleLogEntry, BattleSnapshot, InterferenceType } from "@yrud/shared";
import { applyProtocolChunk, createInitialParserState, type ParserState } from "./protocolParser";
import { parseChoiceRequest } from "./choiceRequest";
import { applyInterference } from "./interference";
import { readFieldState } from "./fieldState";
import { patchActiveGender, readActiveGender, readTeamRosters } from "./teamState";

export interface FinalBattlePlayer {
  id: string;
  name: string;
  packedTeam: string;
}

export interface FinalBattleCallbacks {
  onUpdate(snapshot: BattleSnapshot, log: BattleLogEntry[]): void;
  onRequest(playerId: string, request: BattleChoiceRequest): void;
  onEnd(winnerId: string | null): void;
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

    this.pumpSide(this.streams.p1, player1.id).catch((err) => console.error("battle p1 pump failed:", err));
    this.pumpSide(this.streams.p2, player2.id).catch((err) => console.error("battle p2 pump failed:", err));
    this.pumpOmniscient().catch((err) => console.error("battle omniscient pump failed:", err));

    const spec = { formatid: FORMAT_ID };
    const p1spec = { name: player1.name, team: player1.packedTeam };
    const p2spec = { name: player2.name, team: player2.packedTeam };
    void this.streams.omniscient.write(
      `>start ${JSON.stringify(spec)}\n>player p1 ${JSON.stringify(p1spec)}\n>player p2 ${JSON.stringify(p2spec)}`
    );
  }

  private async pumpSide(sideStream: ReturnType<typeof getPlayerStreams>["p1"], playerId: string) {
    for await (const chunk of sideStream) {
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
    }
  }

  private async pumpOmniscient() {
    for await (const chunk of this.streams.omniscient) {
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
            p1: { ...snap.p1, team: rosters.p1, active: patchActiveGender(snap.p1.active, readActiveGender(battle.sides[0])) },
            p2: { ...snap.p2, team: rosters.p2, active: patchActiveGender(snap.p2.active, readActiveGender(battle.sides[1])) },
          },
        };
      }
      if (log.length) this.callbacks.onUpdate(this.parserState.snapshot, log);
      if (!this.ended && this.parserState.snapshot.winnerId !== null) {
        this.ended = true;
        this.callbacks.onEnd(this.parserState.snapshot.winnerId);
      }
    }
  }

  submitChoice(playerId: string, choice: string): { ok: true } | { error: string } {
    if (this.ended) return { error: "La bataille est déjà terminée." };
    if (playerId === this.player1Id) {
      this.streams.p1.write(choice);
      return { ok: true };
    }
    if (playerId === this.player2Id) {
      this.streams.p2.write(choice);
      return { ok: true };
    }
    return { error: "Tu ne participes pas à cette bataille." };
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
}
