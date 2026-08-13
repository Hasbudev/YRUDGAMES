import { describe, expect, it } from "vitest";
import { Teams } from "pokemon-showdown";
import type { BattleLogEntry, BattleSnapshot } from "@yrud/shared";
import { FinalBattleRunner } from "./battleRunner";

const P1_TEAM = `
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
const P2_TEAM = `
Blastoise
Ability: Torrent
Level: 100
EVs: 252 HP / 252 Def / 4 SpD
Bold Nature
- Surf
- Ice Beam
- Toxic
- Withdraw
`;

describe("FinalBattleRunner", () => {
  it("runs a real battle to completion, honors interference, and reports a winner", async () => {
    const updates: { snapshot: BattleSnapshot; log: BattleLogEntry[] }[] = [];
    let ended: string | null | undefined;
    let interfereResult: { ok: true } | { error: string } | undefined;

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("battle did not finish in time")), 15000);

      const runner = new FinalBattleRunner(
        { id: "p1id", name: "Alice", packedTeam: packOrThrow(P1_TEAM) },
        { id: "p2id", name: "Bob", packedTeam: packOrThrow(P2_TEAM) },
        {
          onUpdate: (snapshot, log) => {
            updates.push({ snapshot, log });
            // Apply on the very first update rather than waiting for a
            // specific turn — a fast/lucky battle can end before turn 2,
            // which made this flaky when it waited for that turn number.
            if (!interfereResult) {
              interfereResult = runner.interfere("gravity");
            }
          },
          onRequest: (playerId) => {
            runner.submitChoice(playerId, "move 1");
          },
          onEnd: (winnerId) => {
            ended = winnerId;
            clearTimeout(timeout);
            resolve();
          },
        }
      );
    });

    expect(ended === "p1id" || ended === "p2id").toBe(true);
    expect(interfereResult).toEqual({ ok: true });
    const sawGravity = updates.some((u) => u.snapshot.field.pseudoWeathers.some((e) => e.id === "gravity"));
    expect(sawGravity).toBe(true);
    const gravityEntry = updates
      .flatMap((u) => u.snapshot.field.pseudoWeathers)
      .find((e) => e.id === "gravity");
    expect(gravityEntry?.durationTurns).toBeGreaterThan(0);
  });

  it("rejects a choice from someone who isn't in the battle", () => {
    const runner = new FinalBattleRunner(
      { id: "p1id", name: "Alice", packedTeam: packOrThrow(P1_TEAM) },
      { id: "p2id", name: "Bob", packedTeam: packOrThrow(P2_TEAM) },
      { onUpdate: () => {}, onRequest: () => {}, onEnd: () => {} }
    );
    expect(runner.submitChoice("someone-else", "move 1")).toEqual({ error: "Tu ne participes pas à cette bataille." });
  });
});

function packOrThrow(text: string): string {
  const sets = Teams.import(text);
  if (!sets) throw new Error("test team failed to parse");
  return Teams.pack(sets);
}
