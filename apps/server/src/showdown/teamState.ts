import type { Battle, Side } from "pokemon-showdown";
import type { BattleActivePokemon, BattleStatus, BattleTeamMember, BoostStat, PokemonGender } from "@yrud/shared";

// Full team rosters and the active mon's gender aren't in the protocol text
// at all (Showdown's spectator stream reports species/HP/status only for
// the currently active Pokémon) — read straight off the live Battle object,
// same reasoning as fieldState.ts's weather/terrain read.

function genderOf(g: string): PokemonGender {
  return g === "M" || g === "F" ? g : "N";
}

function statusOf(status: string): BattleStatus | undefined {
  return status ? (status as BattleStatus) : undefined;
}

export function readTeamRoster(side: Side): BattleTeamMember[] {
  return side.pokemon.map((mon) => ({
    species: mon.species.name,
    hpPercent: mon.maxhp > 0 ? Math.max(0, Math.min(100, Math.round((mon.hp / mon.maxhp) * 100))) : 0,
    fainted: mon.fainted,
    status: statusOf(mon.status),
    isActive: side.active[0] === mon,
  }));
}

export function readActiveGender(side: Side): PokemonGender | undefined {
  const active = side.active[0];
  return active ? genderOf(active.gender) : undefined;
}

export interface ActiveHp {
  hp: number;
  maxHp: number;
}

export function readActiveHp(side: Side): ActiveHp | undefined {
  const active = side.active[0];
  return active ? { hp: active.hp, maxHp: active.maxhp } : undefined;
}

// Baton Pass carries real stat boosts to the incoming Pokémon in the
// simulator (selfSwitch: "copyvolatile") without re-emitting `-boost` lines
// for them — protocolParser.ts's "switch" case always resets `boosts: {}`
// on a fresh active, since that's correct for every OTHER kind of switch.
// Reading the live values back here (same pattern as gender/hp above) is
// what actually fixes the display for the Baton Pass case, rather than
// trying to special-case "was this switch a baton pass" in protocol text.
export function readActiveBoosts(side: Side): Partial<Record<BoostStat, number>> | undefined {
  const active = side.active[0];
  if (!active) return undefined;
  const boosts: Partial<Record<BoostStat, number>> = {};
  for (const stat of ["atk", "def", "spa", "spd", "spe", "accuracy", "evasion"] as const) {
    const value = active.boosts[stat];
    if (value) boosts[stat] = value;
  }
  return boosts;
}

export function readTeamRosters(battle: Battle): { p1: BattleTeamMember[]; p2: BattleTeamMember[] } {
  return { p1: readTeamRoster(battle.sides[0]), p2: readTeamRoster(battle.sides[1]) };
}

export function patchActive(
  active: BattleActivePokemon | null,
  gender: PokemonGender | undefined,
  hp: ActiveHp | undefined,
  boosts: Partial<Record<BoostStat, number>> | undefined
): BattleActivePokemon | null {
  if (!active) return active;
  return {
    ...active,
    gender: gender ?? active.gender,
    hp: hp?.hp ?? active.hp,
    maxHp: hp?.maxHp ?? active.maxHp,
    boosts: boosts ?? active.boosts,
  };
}
