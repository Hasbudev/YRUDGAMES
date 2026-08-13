import { describe, expect, it } from "vitest";
import { advanceDuel, nextActor, startDuel } from "./engine";

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
    expect(state.rollLog[0]).toMatchObject({ actor: "yrud", move: "Hydro Pump", accuracy: 0.8, hit: true });
    state = advanceDuel(state, alwaysHit);
    expect(state.rollLog[1]).toMatchObject({ actor: "opponent", move: "Focus Blast", accuracy: 0.7, hit: true });
  });

  it("ends the duel in favor of the opponent when Yrud misses first", () => {
    // roll >= accuracy => miss. Yrud's accuracy is 0.8, so 0.9 misses.
    let state = startDuel("p1");
    state = advanceDuel(state, () => 0.9); // Yrud misses on the very first shot
    expect(state.phase).toBe("resolved");
    if (state.phase !== "resolved") throw new Error("unreachable");
    expect(state.winner).toBe("opponent");
    expect(state.rollLog).toHaveLength(1);
  });

  it("ends the duel in favor of Yrud when the opponent misses first", () => {
    let state = startDuel("p1");
    state = advanceDuel(state, () => 0); // Yrud hits
    state = advanceDuel(state, () => 0.9); // opponent misses (accuracy 0.7, roll 0.9)
    expect(state.phase).toBe("resolved");
    if (state.phase !== "resolved") throw new Error("unreachable");
    expect(state.winner).toBe("yrud");
    expect(state.rollLog).toHaveLength(2);
  });

  it("does nothing once resolved", () => {
    let state = startDuel("p1");
    state = advanceDuel(state, () => 0.9); // Yrud misses immediately
    const resolved = state;
    state = advanceDuel(state, () => 0);
    expect(state).toEqual(resolved);
  });
});
