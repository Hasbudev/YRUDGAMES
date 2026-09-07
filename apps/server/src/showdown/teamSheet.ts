import { Teams } from "pokemon-showdown";
import type { TeamSheetMember } from "@yrud/shared";

// Re-derives the finalist-facing "your team" sheet (item/ability/nature/EVs/
// IVs) from the packed team string saved at import time — same data
// teamImport.ts already validated, just unpacked back into a display shape.
export function buildTeamSheet(packedTeam: string): TeamSheetMember[] {
  const sets = Teams.unpack(packedTeam);
  if (!sets) return [];
  return sets.map((set) => ({
    species: set.species,
    item: set.item || undefined,
    ability: set.ability || undefined,
    nature: set.nature || undefined,
    evs: { ...set.evs },
    ivs: { ...set.ivs },
  }));
}
