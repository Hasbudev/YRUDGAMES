import { describe, expect, it } from "vitest";
import { importTeam } from "./teamImport";

const VALID_TEAM = `
Charizard
Ability: Blaze
Level: 100
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Flamethrower
- Air Slash
- Roost
- Substitute
`;

describe("importTeam", () => {
  it("packs a valid Showdown export", () => {
    const result = importTeam(VALID_TEAM);
    expect(result).not.toHaveProperty("error");
    if ("error" in result) throw result;
    expect(result.pokemonCount).toBe(1);
    expect(result.packed.length).toBeGreaterThan(0);
  });

  it("rejects empty text", () => {
    expect(importTeam("   ")).toEqual({ error: "Le texte d'équipe est vide." });
  });

  it("rejects text that isn't a parseable export", () => {
    const result = importTeam("this is not a Showdown team export at all, just some prose.");
    expect(result).toHaveProperty("error");
  });

  it("rejects a typo'd species before the battle can start, instead of crashing mid-battle", () => {
    // Regression test: Teams.import/pack alone never touches the dex, so a
    // typo like this used to produce a "valid-looking" packed team that only
    // failed much later, as an uncaught exception once that Pokémon was
    // actually sent out live.
    const result = importTeam(VALID_TEAM.replace("Charizard", "Charizrad"));
    expect(result).toHaveProperty("error");
  });

  it("rejects a typo'd move", () => {
    const result = importTeam(VALID_TEAM.replace("Flamethrower", "Flamethrowr"));
    expect(result).toHaveProperty("error");
  });

  it("rejects a typo'd ability", () => {
    const result = importTeam(VALID_TEAM.replace("Blaze", "Blazee"));
    expect(result).toHaveProperty("error");
  });

  it("rejects a typo'd item", () => {
    const result = importTeam(VALID_TEAM.replace("Charizard\n", "Charizard @ Choise Band\n"));
    expect(result).toHaveProperty("error");
  });
});
