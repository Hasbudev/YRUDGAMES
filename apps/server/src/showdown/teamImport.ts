import { Teams, TeamValidator } from "pokemon-showdown";

export interface TeamImportResult {
  packed: string;
  pokemonCount: number;
}

// Must match battleRunner.ts's FORMAT_ID — validation has to run against the
// same format the battle will actually use, or a set that passes here could
// still not exist as far as the live battle's own dex is concerned.
const FORMAT_ID = "gen9customgame";

// Teams.import/pack alone (the previous implementation) is a pure text
// parser — it never touches the dex, so a typo'd species/move/item/ability
// silently produces a "valid-looking" set that only fails much later, mid
// battle, as an uncaught exception once that Pokémon is actually used (the
// simulator's own dex lookups don't throw on an unknown name, they return an
// inert stub — see teamState.ts's readTeamRoster comment for the same class
// of gotcha). TeamValidator.validateTeam runs Showdown's real existence
// checks against this exact format's dex up front, catching that class of
// mistake before the battle ever starts, at the cost of a clear French error
// instead of a live, on-stage freeze. gen9customgame's ruleset is
// deliberately "no restrictions" (no legality/EV/banlist enforcement) — this
// only rejects things that flat-out don't exist, never a legitimately
// unusual set.
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

  try {
    const problems = new TeamValidator(FORMAT_ID).validateTeam(sets);
    if (problems && problems.length > 0) {
      return { error: `Équipe invalide : ${problems[0]}` };
    }
  } catch (err) {
    return { error: `Équipe invalide : ${err instanceof Error ? err.message : String(err)}` };
  }

  return { packed: Teams.pack(sets), pokemonCount: sets.length };
}
