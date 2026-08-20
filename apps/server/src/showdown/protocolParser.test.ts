import { describe, expect, it } from "vitest";
import { applyProtocolChunk, createInitialParserState } from "./protocolParser";

function freshState() {
  return createInitialParserState({ playerId: "p1id", name: "Alice" }, { playerId: "p2id", name: "Bob" });
}

describe("protocolParser", () => {
  it("tracks teamsize and switch into an active snapshot", () => {
    const chunk = [
      "|teamsize|p1|1",
      "|teamsize|p2|1",
      "|start",
      "|switch|p1a: Charizard|Charizard, F|297/297",
      "|switch|p2a: Blastoise|Blastoise, M|362/362",
      "|turn|1",
    ].join("\n");

    const { state, log } = applyProtocolChunk(chunk, freshState());
    expect(state.snapshot.p1.active).toEqual({
      species: "Charizard",
      level: 100,
      gender: "N",
      hpPercent: 100,
      fainted: false,
      boosts: {},
    });
    expect(state.snapshot.p2.remainingCount).toBe(1);
    expect(state.snapshot.field.turn).toBe(1);
    expect(log.some((l) => l.kind === "switch" && l.species === "Charizard")).toBe(true);
    expect(log.some((l) => l.kind === "turn" && l.turn === 1)).toBe(true);
  });

  it("applies damage, resists/super-effective are ignored, and rounds hp percent", () => {
    let { state } = applyProtocolChunk(
      ["|teamsize|p1|1", "|teamsize|p2|1", "|switch|p1a: Charizard|Charizard, F|297/297", "|switch|p2a: Blastoise|Blastoise, M|362/362"].join(
        "\n"
      ),
      freshState()
    );
    const { state: next, log } = applyProtocolChunk(
      ["|-resisted|p2a: Blastoise", "|-damage|p2a: Blastoise|295/362"].join("\n"),
      state
    );
    expect(next.snapshot.p2.active?.hpPercent).toBe(81);
    // "-resisted" isn't a recognized structured type — it passes through as
    // flavor text (the parser's designed fallback), not silently dropped.
    expect(log).toEqual([
      { kind: "text", text: "|-resisted|p2a: Blastoise" },
      { kind: "damage", target: "p2", hpPercent: 81 },
    ]);
  });

  it("marks a Pokémon fainted and decrements remainingCount", () => {
    let { state } = applyProtocolChunk(
      ["|teamsize|p1|2", "|switch|p1a: Charizard|Charizard, F|1/297"].join("\n"),
      freshState()
    );
    const { state: next, log } = applyProtocolChunk(
      ["|-damage|p1a: Charizard|0 fnt", "|faint|p1a: Charizard"].join("\n"),
      state
    );
    expect(next.snapshot.p1.active?.fainted).toBe(true);
    expect(next.snapshot.p1.active?.hpPercent).toBe(0);
    expect(next.snapshot.p1.remainingCount).toBe(1);
    expect(log.map((l) => l.kind)).toEqual(["damage", "faint"]);
  });

  it("records status, weather, and pseudo-weather (Trick Room/Gravity) changes", () => {
    let { state } = applyProtocolChunk(
      ["|teamsize|p1|1", "|switch|p1a: Charizard|Charizard, F|297/297"].join("\n"),
      freshState()
    );
    const { state: next, log } = applyProtocolChunk(
      [
        "|-status|p1a: Charizard|psn",
        "|-weather|RainDance",
        "|-fieldstart|move: Trick Room|[of] p1a: Charizard",
        "|-fieldstart|Gravity",
      ].join("\n"),
      state
    );
    expect(next.snapshot.p1.active?.status).toBe("psn");
    expect(next.snapshot.field.weather).toEqual({ id: "RainDance", label: "RainDance", durationTurns: null });
    expect(next.snapshot.field.pseudoWeathers).toEqual([
      { id: "Trick Room", label: "Trick Room", durationTurns: null },
      { id: "Gravity", label: "Gravity", durationTurns: null },
    ]);
    expect(log).toEqual([
      { kind: "status", target: "p1", status: "psn" },
      { kind: "weather", weather: "RainDance" },
      { kind: "fieldstart", condition: "Trick Room" },
      { kind: "fieldstart", condition: "Gravity" },
    ]);
  });

  it("accumulates stat boosts, clamps to +/-6, and resets them on switch-out", () => {
    let { state } = applyProtocolChunk(
      ["|teamsize|p1|2", "|switch|p1a: Charizard|Charizard, F|297/297"].join("\n"),
      freshState()
    );
    const { state: boosted, log } = applyProtocolChunk(
      ["|-boost|p1a: Charizard|atk|2", "|-boost|p1a: Charizard|atk|1", "|-unboost|p1a: Charizard|spe|1"].join("\n"),
      state
    );
    expect(boosted.snapshot.p1.active?.boosts).toEqual({ atk: 3, spe: -1 });
    expect(log).toEqual([
      { kind: "boost", target: "p1", stat: "atk", amount: 2 },
      { kind: "boost", target: "p1", stat: "atk", amount: 1 },
      { kind: "boost", target: "p1", stat: "spe", amount: -1 },
    ]);

    const { state: overboosted } = applyProtocolChunk(
      Array.from({ length: 5 }, () => "|-boost|p1a: Charizard|atk|2").join("\n"),
      boosted
    );
    expect(overboosted.snapshot.p1.active?.boosts.atk).toBe(6); // clamped

    const { state: switchedOut } = applyProtocolChunk("|switch|p1a: Venusaur|Venusaur, F|100/100", overboosted);
    expect(switchedOut.snapshot.p1.active?.boosts).toEqual({});
  });

  it("clears weather on |-weather|none and removes a pseudo-weather on |-fieldend|", () => {
    let { state } = applyProtocolChunk(
      ["|-weather|RainDance", "|-fieldstart|Gravity"].join("\n"),
      freshState()
    );
    const { state: next } = applyProtocolChunk(["|-weather|none", "|-fieldend|Gravity"].join("\n"), state);
    expect(next.snapshot.field.weather).toBeNull();
    expect(next.snapshot.field.pseudoWeathers).toEqual([]);
  });

  it("resolves the winner name back to the known playerId", () => {
    const { state, log } = applyProtocolChunk("|win|Bob", freshState());
    expect(state.snapshot.winnerId).toBe("p2id");
    expect(log).toEqual([{ kind: "win", winnerName: "Bob" }]);
  });

  it("skips noise lines and falls back to a text entry for anything unrecognized", () => {
    const { log } = applyProtocolChunk(
      ["|t:|123456", "|gametype|singles", "|html|<div>ignored</div>", "|-someunknownmessage|foo"].join("\n"),
      freshState()
    );
    expect(log).toEqual([{ kind: "text", text: "|-someunknownmessage|foo" }]);
  });
});
