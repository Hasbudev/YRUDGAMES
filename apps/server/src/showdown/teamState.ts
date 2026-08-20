import type { Battle, Side } from "pokemon-showdown";
import type { BattleActivePokemon, BattleStatus, BattleTeamMember, PokemonGender } from "@yrud/shared";

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

export function readTeamRosters(battle: Battle): { p1: BattleTeamMember[]; p2: BattleTeamMember[] } {
  return { p1: readTeamRoster(battle.sides[0]), p2: readTeamRoster(battle.sides[1]) };
}

export function patchActiveGender(active: BattleActivePokemon | null, gender: PokemonGender | undefined): BattleActivePokemon | null {
  if (!active || !gender) return active;
  return { ...active, gender };
}
