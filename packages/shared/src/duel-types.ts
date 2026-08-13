export type DuelActor = "yrud" | "opponent";

export interface DuelRoll {
  actor: DuelActor;
  move: string;
  accuracy: number;
  hit: boolean;
}

export interface DuelStartedPayload {
  opponentId: string;
}

export interface DuelEndedPayload {
  opponentId: string;
  winner: DuelActor;
  rollLog: DuelRoll[];
}
