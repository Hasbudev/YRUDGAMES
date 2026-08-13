// Types for the final 1v1 Pokémon Showdown battle. The battle simulator
// itself runs in-process on the server (packages/pokemon-showdown as a
// library, not a hosted service) — these types describe the derived,
// client-facing view of that battle, not the simulator's own internals.

export type BattleStatus = "brn" | "par" | "slp" | "frz" | "psn" | "tox";

export type BoostStat = "atk" | "def" | "spa" | "spd" | "spe" | "accuracy" | "evasion";

export interface BattleActivePokemon {
  species: string;
  level: number;
  hpPercent: number; // 0-100, rounded — exact HP is hidden from opponents by Showdown itself
  fainted: boolean;
  status?: BattleStatus;
  boosts: Partial<Record<BoostStat, number>>; // stat stage, e.g. { atk: 2 } for a Swords Dance
}

export interface BattleSideSnapshot {
  playerId: string;
  name: string;
  active: BattleActivePokemon | null;
  remainingCount: number; // Pokémon still standing, including the active one
}

export interface FieldEffectInfo {
  id: string;
  label: string;
  durationTurns: number | null; // turns remaining, null when indefinite/unknown
}

export interface BattleFieldSnapshot {
  weather: FieldEffectInfo | null;
  terrain: FieldEffectInfo | null;
  pseudoWeathers: FieldEffectInfo[]; // e.g. Trick Room, Gravity
  turn: number;
}

export interface BattleSnapshot {
  p1: BattleSideSnapshot;
  p2: BattleSideSnapshot;
  field: BattleFieldSnapshot;
  winnerId: string | null;
}

export type BattleLogEntry =
  | { kind: "move"; actor: string; move: string; target?: string }
  | { kind: "damage"; target: string; hpPercent: number }
  | { kind: "faint"; target: string }
  | { kind: "status"; target: string; status: BattleStatus }
  | { kind: "boost"; target: string; stat: BoostStat; amount: number }
  | { kind: "weather"; weather: string }
  | { kind: "fieldstart"; condition: string }
  | { kind: "switch"; actor: string; species: string }
  | { kind: "turn"; turn: number }
  | { kind: "win"; winnerName: string }
  | { kind: "text"; text: string };

// Registry of Yrud's final-battle interference moves — same pattern as
// PRANK_REGISTRY: adding a future effect is a new entry, not new plumbing,
// as long as it maps to one of the InterferenceType handlers server-side.
export type InterferenceType = "weather" | "trickroom" | "gravity" | "poisonAll" | "swap";

export interface InterferenceOption {
  id: string; // sub-choice, e.g. weather id "raindance"
  label: string;
}

export interface InterferenceDefinition {
  type: InterferenceType;
  label: string;
  needsOption: boolean;
  options?: InterferenceOption[];
}

// Trimmed-down, typed view of Showdown's own "ChoiceRequest" JSON — just
// enough for a real move/switch chooser UI, not a full re-modeling of the
// simulator's request format.
export interface BattleMoveOption {
  id: string;
  name: string;
  pp: number;
  maxPp: number;
  disabled: boolean;
}

export interface BattleSwitchOption {
  slot: number; // 1-based, matches the "switch N" choice string
  species: string;
  fainted: boolean;
  isActive: boolean;
}

export interface BattleChoiceRequest {
  teamPreview: boolean;
  forceSwitch: boolean;
  trapped: boolean; // can't voluntarily switch this turn (e.g. Mean Look, Arena Trap)
  moves: BattleMoveOption[];
  switchOptions: BattleSwitchOption[];
}

export const INTERFERENCE_REGISTRY: InterferenceDefinition[] = [
  {
    type: "weather",
    label: "Météo",
    needsOption: true,
    options: [
      { id: "raindance", label: "Pluie" },
      { id: "sunnyday", label: "Soleil" },
      { id: "sandstorm", label: "Tempête de sable" },
      { id: "snow", label: "Neige" },
    ],
  },
  { type: "trickroom", label: "Distorsion", needsOption: false },
  { type: "gravity", label: "Gravité", needsOption: false },
  { type: "poisonAll", label: "Poison Grave (les deux actifs)", needsOption: false },
];
