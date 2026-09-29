import { describe, expect, it } from "vitest";
import { matchesFreeText } from "./freeText";

const ACCEPTED = ["Jarramanca", "Cascarrafa"];

describe("matchesFreeText", () => {
  it("ignores case, accents, spaces and punctuation", () => {
    expect(matchesFreeText("  JARRAMANCA ", ACCEPTED)).toBe(true);
    expect(matchesFreeText("cascarrafa!", ACCEPTED)).toBe(true);
    expect(matchesFreeText("Cascarràfa", ACCEPTED)).toBe(true);
  });

  it("tolerates small typos on long answers", () => {
    expect(matchesFreeText("Jaramanca", ACCEPTED)).toBe(true);
    expect(matchesFreeText("Jarramenca", ACCEPTED)).toBe(true);
  });

  it("rejects other answers and blanks", () => {
    expect(matchesFreeText("Mesaledo", ACCEPTED)).toBe(false);
    expect(matchesFreeText("   ", ACCEPTED)).toBe(false);
    expect(matchesFreeText("Jarra", ACCEPTED)).toBe(false);
  });
});

describe("Navidex answers", () => {
  const NAVIDEX: [string, string][] = [
    ["Dedenne", "Dedenne"],
    ["Lampignon", "Shiinotic"],
    ["Hoothoot", "Hoothoot"],
    ["Limonde", "Stunfisk"],
    ["Cerfrousse", "Stantler"],
    ["Coquiperl", "Clamperl"],
    ["Venipatte", "Venipede"],
    ["Magicarpe", "Magikarp"],
    ["Chovsourir", "Woobat"],
    ["Chétiflor", "Bellsprout"],
  ];

  it("accepts the French and English name in any case, with or without accents", () => {
    for (const [fr, en] of NAVIDEX) {
      const accepted = [fr, en];
      for (const typed of [fr, en, fr.toUpperCase(), en.toLowerCase(), fr.normalize("NFD").replace(/[̀-ͯ]/g, "")]) {
        expect(matchesFreeText(typed, accepted), `${typed} → ${fr}`).toBe(true);
      }
    }
    expect(matchesFreeText("Morelull", ["Lampignon", "Shiinotic"])).toBe(false);
  });
});
