import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InternalQuestion } from "../game/types";

vi.mock("../db/client", () => ({
  prisma: {
    event: { update: vi.fn(async () => ({})) },
    player: { upsert: vi.fn(async () => ({})), update: vi.fn(async () => ({})) },
    round: { create: vi.fn(async () => ({ id: "round" })) },
    answerLog: { createMany: vi.fn(async () => ({})) },
    tauntLog: { create: vi.fn(async () => ({})) },
    prankLog: { create: vi.fn(async () => ({})) },
  },
}));

import { DEFAULT_TIME_LIMIT_MS, EventRoom } from "./eventRoom";

function question(id: string, over: Partial<InternalQuestion> = {}): InternalQuestion {
  return {
    id,
    theme: "trivia",
    prompt: id,
    choices: ["a", "b"],
    correctIndex: 0,
    timeLimitMs: DEFAULT_TIME_LIMIT_MS,
    points: 1,
    roundIndex: 1,
    wrongPoints: 0,
    ...over,
  };
}

function setup(questions: InternalQuestion[]) {
  const emitted: { event: string; payload: any }[] = [];
  const io = {
    to: () => ({ emit: (event: string, payload: unknown) => emitted.push({ event, payload }) }),
  } as any;
  const room = new EventRoom(io, "evt", "CODE", questions);
  const lastQuestionNew = () => [...emitted].reverse().find((e) => e.event === "question:new")?.payload;
  return { room, emitted, lastQuestionNew };
}

async function startedRoom(questions: InternalQuestion[]) {
  const ctx = setup(questions);
  await ctx.room.addPlayer("p1", "Alice");
  await ctx.room.start();
  return ctx;
}

describe("EventRoom answer time", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("defaults to 20 s, and auto-reveals exactly when that elapses", async () => {
    expect(DEFAULT_TIME_LIMIT_MS).toBe(20_000);
    const { room, lastQuestionNew } = await startedRoom([question("q1")]);
    await room.beginQuiz();
    expect(lastQuestionNew().timeLimitMs).toBe(20_000);

    await vi.advanceTimersByTimeAsync(19_999);
    expect(room.snapshot().phase).toBe("question");
    await vi.advanceTimersByTimeAsync(1);
    expect(room.snapshot().phase).toBe("reveal");
  });

  it("uses a question's own duration, and a manche override beats it", async () => {
    const { room, lastQuestionNew } = await startedRoom([
      question("q1", { timeLimitMs: 30_000 }),
      question("q2", { timeLimitMs: 30_000 }),
    ]);
    await room.beginQuiz();
    expect(lastQuestionNew().timeLimitMs).toBe(30_000);
    await room.reveal();

    await room.setTimeLimit(45);
    await room.next();
    expect(lastQuestionNew().timeLimitMs).toBe(45_000);
    await vi.advanceTimersByTimeAsync(44_999);
    expect(room.snapshot().phase).toBe("question");
    await vi.advanceTimersByTimeAsync(1);
    expect(room.snapshot().phase).toBe("reveal");
  });

  it("never changes a question that is already live, but applies from the next one", async () => {
    const { room, lastQuestionNew } = await startedRoom([question("q1"), question("q2")]);
    await room.beginQuiz();
    await room.setTimeLimit(60);

    expect(room.snapshot().question?.timeLimitMs).toBe(20_000); // frozen for the live question
    await vi.advanceTimersByTimeAsync(20_000);
    expect(room.snapshot().phase).toBe("reveal");

    await room.next();
    expect(lastQuestionNew().timeLimitMs).toBe(60_000);
  });

  it("exposes the manche's rules, tracks the override, and clears it with null", async () => {
    const { room } = await startedRoom([question("q1", { points: 2, wrongPoints: -1 })]);
    // Intro phase: no question yet, rules are those of the first manche.
    expect(room.snapshot().phase).toBe("intro");
    expect(room.snapshot().roundRules).toMatchObject({
      roundIndex: 1,
      points: [2, 2],
      wrongPoints: [-1, -1],
      timeLimitSec: [20, 20],
      timeLimitOverridden: false,
    });

    await room.setTimeLimit(35);
    expect(room.snapshot().roundRules).toMatchObject({ timeLimitSec: [35, 35], timeLimitOverridden: true });
    await room.setTimeLimit(null);
    expect(room.snapshot().roundRules).toMatchObject({ timeLimitSec: [20, 20], timeLimitOverridden: false });
  });

  it("rejects out-of-range durations and unknown manches", async () => {
    const { room } = await startedRoom([question("q1")]);
    expect(await room.setTimeLimit(2)).toHaveProperty("error");
    expect(await room.setTimeLimit(9999)).toHaveProperty("error");
    expect(await room.setTimeLimit(20, 42)).toHaveProperty("error");
    expect(await room.setTimeLimit(20, 1)).toEqual({ ok: true });
  });

  it("gives a blind-test question no clock", async () => {
    const { room } = await startedRoom([question("q1", { theme: "ost" })]);
    expect(room.snapshot().roundRules?.timeLimitSec).toBeNull();
    await room.beginQuiz();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(room.snapshot().phase).toBe("question"); // still waiting for Yrud
  });
});

describe("EventRoom skip", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("moves to the next question with no scoring and a fresh clock", async () => {
    const { room, lastQuestionNew, emitted } = await startedRoom([question("q1"), question("q2")]);
    await room.beginQuiz();
    room.submitAnswer("p1", "q1", 0); // would have scored

    expect(await room.skip()).toEqual({ ok: true });
    expect(lastQuestionNew().id).toBe("q2");
    expect(room.snapshot().phase).toBe("question");
    expect(room.snapshot().players[0].points).toBe(0);
    expect(emitted.some((e) => e.event === "question:reveal")).toBe(false);

    // q1's original auto-reveal must be gone; only q2's clock is running.
    await vi.advanceTimersByTimeAsync(19_999);
    expect(room.snapshot().phase).toBe("question");
    await vi.advanceTimersByTimeAsync(1);
    expect(room.snapshot().phase).toBe("reveal");
  });

  it("pauses on the next manche's intro when skipping across manches", async () => {
    const { room } = await startedRoom([question("q1"), question("q2", { roundIndex: 2 })]);
    await room.beginQuiz();
    await room.skip();
    expect(room.snapshot().phase).toBe("roundIntro");
    expect(room.snapshot().roundRules?.roundIndex).toBe(2);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(room.snapshot().phase).toBe("roundIntro"); // no clock running yet
  });

  it("refuses outside a live question", async () => {
    const { room } = await startedRoom([question("q1")]);
    expect(await room.skip()).toHaveProperty("error"); // still in intro
  });
});

describe("EventRoom video prank", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("broadcasts the tchoupu video prank with no caption and gives back the time it covers", async () => {
    const { room, emitted } = await startedRoom([question("q1")]);
    await room.beginQuiz();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(await room.triggerPrank("tchoupu")).toEqual({ ok: true });
    expect(emitted.find((e) => e.event === "prank:trigger")?.payload).toEqual({ prankId: "tchoupu", text: "" });

    // 20 s clock + 6.8 s of video: still live 25 s in, revealed by 26.8 s.
    await vi.advanceTimersByTimeAsync(20_000);
    expect(room.snapshot().phase).toBe("question");
    await vi.advanceTimersByTimeAsync(1_800);
    expect(room.snapshot().phase).toBe("reveal");
  });
});

describe("EventRoom free-text question", () => {
  const freeText = () =>
    question("q1", {
      theme: "ost",
      choices: ["Jarramanca / Cascarrafa"],
      points: 10,
      metadata: { audioFile: "clip.mp3", acceptedAnswers: ["Jarramanca", "Cascarrafa"] },
    });

  it("hides the answer until reveal, then scores a typed match", async () => {
    const { room, lastQuestionNew } = setup([freeText()]);
    await room.addPlayer("p1", "Alice");
    await room.addPlayer("p2", "Bob");
    await room.start();
    await room.beginQuiz();

    const live = lastQuestionNew();
    expect(live.choices).toEqual([]);
    expect(live.metadata).toEqual({ audioFile: "clip.mp3", freeText: true });

    room.submitTextAnswer("p1", "q1", "cascarafa");
    room.submitTextAnswer("p2", "q1", "Mesaledo");
    await room.reveal();

    const snap = room.snapshot();
    expect(snap.question?.choices).toEqual(["Jarramanca / Cascarrafa"]);
    expect(snap.question?.metadata?.acceptedAnswers).toBeUndefined();
    const byId = Object.fromEntries(snap.lastReveal!.results.map((r) => [r.playerId, r]));
    expect(byId.p1).toMatchObject({ correct: true, points: 10 });
    expect(byId.p2).toMatchObject({ correct: false, points: 0 });
  });
});

describe("EventRoom chasse-taupes", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("only scores moles that are really up, once each, and auto-reveals after the board", async () => {
    const { room, lastQuestionNew } = setup([
      question("w1", { theme: "whack", choices: [], metadata: { whack: { durationMs: 20_000 } } }),
    ]);
    await room.addPlayer("p1", "Alice");
    await room.addPlayer("p2", "Bob");
    await room.start();
    await room.beginQuiz();

    const live = lastQuestionNew();
    const { whackSchedule, MOLE_KINDS } = await import("@yrud/shared");
    const board = whackSchedule(live.metadata.whack.seed, 20_000);
    const target = board.find((m) => MOLE_KINDS[m.kind].points > 0)!;

    room.whack("p1", "w1", target.id); // too early — not up yet
    await vi.advanceTimersByTimeAsync(target.appearAt + 50);
    room.whack("p1", "w1", target.id);
    room.whack("p1", "w1", target.id); // double tap ignored
    room.whack("p2", "w1", 99_999); // no such mole

    await vi.advanceTimersByTimeAsync(20_000 + 1_500);
    const snap = room.snapshot();
    expect(snap.phase).toBe("reveal");
    const byId = Object.fromEntries(snap.lastReveal!.results.map((r) => [r.playerId, r]));
    expect(byId.p1.delta).toBe(MOLE_KINDS[target.kind].points);
    expect(byId.p2.delta).toBe(0);
  });
});

describe("EventRoom Yrud Games 2 special manches", () => {
  async function room3Clans(questions: InternalQuestion[]) {
    const ctx = setup(questions);
    await ctx.room.addPlayer("a", "Alice", "rapepolofia");
    await ctx.room.addPlayer("b", "Bob", "paldea");
    await ctx.room.addPlayer("c", "Chloé", "yrud");
    for (const id of ["a", "b", "c"]) ctx.room.markPlayerConnected(id);
    await ctx.room.start();
    return ctx;
  }

  it("manche 1: clans vote a category in order, then score 6 on their own and 3 elsewhere", async () => {
    const cat = (id: string, category: string) =>
      question(id, { points: 3, metadata: { category, categoryPoints: { own: 6, other: 3 } } });
    const { room } = await room3Clans([cat("q1", "Force Z"), cat("q2", "Dynamax"), cat("q3", "1G")]);

    expect(await room.beginQuiz()).toEqual({ error: expect.stringContaining("catégorie") });
    await room.startDraft(["yrud", "paldea", "rapepolofia"]);
    room.voteCategory("a", "1G"); // not rapepolofia's turn — ignored
    room.voteCategory("c", "1G"); // yrud, alone in its clan → decided at once
    room.voteCategory("b", "Force Z"); // paldea → decided; rapepolofia gets what's left
    const draft = room.snapshot().categoryDraft!;
    expect(draft.assignments).toEqual({ yrud: "1G", paldea: "Force Z", rapepolofia: "Dynamax" });
    expect(draft.turn).toBe(3);

    expect(await room.beginQuiz()).toEqual({ ok: true });
    for (const id of ["a", "b", "c"]) room.submitAnswer(id, "q1", 0); // Force Z = paldea's
    await room.reveal();
    const byId = Object.fromEntries(room.snapshot().lastReveal!.results.map((r) => [r.playerId, r.points]));
    expect(byId).toEqual({ a: 3, b: 6, c: 3 });
  });

  it("manche 2: the slider scores by distance to the real max", async () => {
    const { room } = await room3Clans([
      question("s1", { theme: "slider", choices: [], correctIndex: 284, metadata: { slider: { pokemon: "Dracolosse", species: "Dragonite", stat: "Vitesse", low: 260, high: 300 } } }),
    ]);
    await room.beginQuiz();
    room.submitAnswer("a", "s1", 284);
    room.submitAnswer("b", "s1", 281);
    room.submitAnswer("c", "s1", 999); // outside the range — ignored, counts as blank
    await room.reveal();
    const byId = Object.fromEntries(room.snapshot().lastReveal!.results.map((r) => [r.playerId, r.points]));
    expect(byId).toEqual({ a: 6, b: 3, c: 0 });
  });

  it("manche 3: the bomb moves on a right answer and blows up on a whole clan", async () => {
    const qs = Array.from({ length: 2 }, (_, i) =>
      question(`v${i}`, { points: 1, metadata: { bomb: { count: 1, penalty: 20 } } })
    );
    const { room, emitted } = await room3Clans(qs);
    await room.adjustPoints("a", 30);
    await room.adjustPoints("b", 30);
    await room.adjustPoints("c", 30);
    await room.beginQuiz();
    const first = room.snapshot().bomb!;
    expect(first.bombNumber).toBe(1);
    const holder = first.holderId!;

    // Holder answers right → passes it on; nobody else answers.
    room.submitAnswer(holder, "v0", 0);
    await room.reveal();
    const afterPass = room.snapshot().bomb!;
    expect(afterPass.holderId).not.toBe(holder);
    await room.next();

    // Fuse is 2 questions for a single bomb over 2 questions → explodes now.
    const unlucky = afterPass.holderId!;
    await room.reveal();
    const boom = emitted.find((e) => e.event === "bomb:explode")!.payload;
    expect(boom.holderId).toBe(unlucky);
    const pts = Object.fromEntries(room.snapshot().players.map((p) => [p.id, p.points]));
    expect(pts[unlucky]).toBe(10);
    expect(room.snapshot().bomb).toBeUndefined();
  });

  it("manche 4: the manche's winner steals from whoever they pick", async () => {
    const { room } = await room3Clans([
      question("n1", { metadata: { steal: 5 } }),
      question("x1", { roundIndex: 2 }),
    ]);
    await room.adjustPoints("b", 3);
    await room.beginQuiz();
    room.submitAnswer("a", "n1", 0);
    await room.reveal();
    expect(room.snapshot().steal).toMatchObject({ amount: 5, pendingIds: ["a"] });
    expect(await room.next()).toEqual({ error: expect.stringContaining("Alice") });
    expect(await room.stealPoints("b", "c")).toEqual({ error: expect.any(String) });
    expect(await room.stealPoints("a", "b")).toEqual({ ok: true });
    const pts = Object.fromEntries(room.snapshot().players.map((p) => [p.id, p.points]));
    expect(pts).toMatchObject({ a: 4, b: 0 }); // Bob only had 3 to lose
    expect(await room.next()).toEqual({ ok: true });
  });
});
