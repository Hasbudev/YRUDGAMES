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
