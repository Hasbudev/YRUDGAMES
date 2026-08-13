import { Teams } from "pokemon-showdown";

export interface TeamImportResult {
  packed: string;
  pokemonCount: number;
}

// Wraps Teams.import/pack — Showdown's own parser for the human-readable
// export format every player already knows how to copy out of the client.
export function importTeam(text: string): TeamImportResult | { error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { error: "Le texte d'équipe est vide." };

  let sets;
  try {
    sets = Teams.import(trimmed);
  } catch {
    sets = null;
  }
  if (!sets || sets.length === 0) {
    return { error: "Impossible d'analyser cette équipe — vérifie le format d'export Showdown." };
  }

  return { packed: Teams.pack(sets), pokemonCount: sets.length };
}
