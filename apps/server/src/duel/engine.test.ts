import { describe, expect, it } from "vitest";
import { advanceDuel, missCount, nextActor, startDuel } from "./engine";

describe("duel engine", () => {
  it("starts idle with Yrud going first", () => {
    const state = startDuel("p1");
    expect(state.phase).toBe("rolling");
    expect(nextActor(state)).toBe("yrud");
  });

  it("alternates actors strictly turn by turn", () => {
    // Always-hit RNG so the duel runs long enough to observe alternation.
    let state = startDuel("p1");
    const alwaysHit = () => 0; // 0 < any positive accuracy => hit
    state = advanceDuel(state, alwaysHit);
    expect(state.rollLog[0].actor).toBe("yrud");
    state = advanceDuel(state, alwaysHit);
    expect(state.rollLog[1].actor).toBe("opponent");
    state = advanceDuel(state, alwaysHit);
    expect(state.rollLog[2].actor).toBe("yrud");
  });

  it("uses the correct move and accuracy per actor", () => {
    let state = startDuel("p1");
    const alwaysHit = () => 0;
    state = advanceDuel(state, alwaysHit);
    expect(state.rollLog[0]).toMatchObject({ actor: "yrud", move: "Zen Headbutt", accuracy: 0.8, hit: true });
    state = advanceDuel(state, alwaysHit);
    expect(state.rollLog[1]).toMatchObject({ actor: "opponent", move: "Leaf Storm", accuracy: 0.7, hit: true });
  });

  it("a single miss does not end the duel", () => {
    let state = startDuel("p1");
    state = advanceDuel(state, () => 0.9); // Yrud misses (accuracy 0.8, roll 0.9)
    expect(state.phase).toBe("rolling");
    expect(missCount(state.rollLog, "yrud")).toBe(1);
  });

  it("ends the duel in favor of the opponent once Yrud reaches 3 misses", () => {
    let state = startDuel("p1");
    const yrudMiss = () => 0.9; // > 0.8 accuracy => miss
    const opponentHit = () => 0; // < 0.7 accuracy => hit
    state = advanceDuel(state, yrudMiss); // yrud miss 1
    state = advanceDuel(state, opponentHit);
    state = advanceDuel(state, yrudMiss); // yrud miss 2
    state = advanceDuel(state, opponentHit);
    state = advanceDuel(state, yrudMiss); // yrud miss 3 — resolved
    expect(state.phase).toBe("resolved");
    if (state.phase !== "resolved") throw new Error("unreachable");
    expect(state.winner).toBe("opponent");
    expect(missCount(state.rollLog, "yrud")).toBe(3);
  });

  it("ends the duel in favor of Yrud once the opponent reaches 3 misses", () => {
    let state = startDuel("p1");
    const yrudHit = () => 0; // < 0.8 accuracy => hit
    const opponentMiss = () => 0.9; // > 0.7 accuracy => miss
    state = advanceDuel(state, yrudHit);
    state = advanceDuel(state, opponentMiss); // opponent miss 1
    state = advanceDuel(state, yrudHit);
    state = advanceDuel(state, opponentMiss); // opponent miss 2
    state = advanceDuel(state, yrudHit);
    state = advanceDuel(state, opponentMiss); // opponent miss 3 — resolved
    expect(state.phase).toBe("resolved");
    if (state.phase !== "resolved") throw new Error("unreachable");
    expect(state.winner).toBe("yrud");
    expect(missCount(state.rollLog, "opponent")).toBe(3);
  });

  it("a miss that isn't the third does not resolve the duel", () => {
    let state = startDuel("p1");
    state = advanceDuel(state, () => 0.9); // yrud miss 1
    state = advanceDuel(state, () => 0); // opponent hit
    state = advanceDuel(state, () => 0.9); // yrud miss 2
    expect(state.phase).toBe("rolling");
  });

  it("does nothing once resolved", () => {
    let state = startDuel("p1");
    const yrudMiss = () => 0.9;
    const opponentHit = () => 0;
    state = advanceDuel(state, yrudMiss); // yrud miss 1
    state = advanceDuel(state, opponentHit);
    state = advanceDuel(state, yrudMiss); // yrud miss 2
    state = advanceDuel(state, opponentHit);
    state = advanceDuel(state, yrudMiss); // yrud miss 3 — resolved
    const resolved = state;
    state = advanceDuel(state, () => 0);
    expect(state).toEqual(resolved);
  });
});
