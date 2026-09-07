// Types for the final 1v1 Pokémon Showdown battle. The battle simulator
// itself runs in-process on the server (packages/pokemon-showdown as a
// library, not a hosted service) — these types describe the derived,
// client-facing view of that battle, not the simulator's own internals.

export type BattleStatus = "brn" | "par" | "slp" | "frz" | "psn" | "tox";

export type PokemonGender = "M" | "F" | "N";

export type BoostStat = "atk" | "def" | "spa" | "spd" | "spe" | "accuracy" | "evasion";

export interface BattleActivePokemon {
  species: string;
  level: number;
  gender: PokemonGender;
  hpPercent: number; // 0-100, rounded — used for the bar's fill width
  hp: number | null; // exact current HP — this is the omniscient/spectator
  maxHp: number | null; // stream (both finalists + spectators), unlike a real
  // opponent-facing Showdown client, so showing the real numbers (matching
  // the final-battle reference UI) doesn't leak anything competitive ladder
  // play would hide. null only until the live Battle object patches it in
  // (see teamState.ts) — never fabricated.
  fainted: boolean;
  status?: BattleStatus;
  boosts: Partial<Record<BoostStat, number>>; // stat stage, e.g. { atk: 2 } for a Swords Dance
}

// One slot of the 6-Pokémon roster, read straight off the live Battle
// object (not derived from protocol text) — see battleRunner's
// pumpOmniscient, same pattern as field state.
export interface BattleTeamMember {
  species: string;
  hpPercent: number;
  fainted: boolean;
  status?: BattleStatus;
  isActive: boolean;
}

export type StatKey = "hp" | "atk" | "def" | "spa" | "spd" | "spe";

// A finalist's own team sheet — item/ability/nature/EVs/IVs per Pokémon, in
// team order (matches BattleTeamMember's order). Sent privately to that
// player's own socket only; never part of the shared BattleSnapshot that
// both finalists/spectators receive, since it would leak the opponent's set.
export interface TeamSheetMember {
  species: string;
  item?: string;
  ability?: string;
  nature?: string;
  evs: Record<StatKey, number>;
  ivs: Record<StatKey, number>;
}

export interface BattleSideSnapshot {
  playerId: string;
  name: string;
  active: BattleActivePokemon | null;
  team: BattleTeamMember[]; // full roster in team order, length up to 6
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
  // Distinct from `winnerId` — a simultaneous double-faint (Explosion,
  // Destiny Bond, Perish Song running out for both) ends the battle with no
  // winner at all, so `winnerId` alone can't tell "still playing" apart from
  // "over, tied". Anything gating on "is this battle finished" should check
  // this, not `winnerId` truthiness.
  ended: boolean;
}

export type BattleLogEntry =
  | { kind: "move"; actor: string; move: string; target?: string; moveType?: string }
  | {
      kind: "damage";
      target: string;
      hpPercent: number;
      // True for a `|-heal|` line — same visual beat (HP bar moves), but
      // the direction and log wording differ.
      isHeal?: boolean;
      // The revealed item/ability/effect behind a passive tick — e.g.
      // "Leftovers", "Rocky Helmet", "Poison" — from the protocol's
      // `[from] item: X` / `[from] ability: X` tag. This is exactly how a
      // held item or ability actually gets revealed to spectators, so it's
      // worth surfacing in the log rather than showing an anonymous heal.
      sourceLabel?: string;
    }
  | { kind: "crit"; target: string }
  | { kind: "supereffective"; target: string }
  | { kind: "faint"; target: string }
  | { kind: "status"; target: string; status: BattleStatus }
  | { kind: "boost"; target: string; stat: BoostStat; amount: number }
  | { kind: "weather"; weather: string }
  | { kind: "fieldstart"; condition: string }
  | { kind: "switch"; actor: string; species: string }
  | { kind: "turn"; turn: number }
  | { kind: "win"; winnerName: string }
  | { kind: "tie" }
  | { kind: "sidestart"; target: string; condition: string }
  | { kind: "sideend"; target: string; condition: string }
  | { kind: "ability"; target: string; ability: string }
  | { kind: "item"; target: string; item: string }
  | { kind: "enditem"; target: string; item: string }
  | { kind: "volatilestart"; target: string; effect: string }
  | { kind: "volatileend"; target: string; effect: string }
  | { kind: "terastallize"; target: string; teraType: string }
  | { kind: "cant"; target: string; reason: string }
  | { kind: "curestatus"; target: string }
  | { kind: "formechange"; target: string; species: string }
  | { kind: "transform"; target: string; species: string }
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
  type: string; // e.g. "Fire" — drives the move card's icon/accent color only
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
