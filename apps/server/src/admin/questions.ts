import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../db/client";

export const questionsRouter = Router();

// Same lightweight shared-secret gate as events.ts — duplicated rather than
// imported since events.ts doesn't export it; kept identical on purpose.
function requireAdminCode(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.ADMIN_ACCESS_CODE;
  if (!expected) {
    res.status(500).json({ error: "Erreur serveur : ADMIN_ACCESS_CODE n'est pas configuré." });
    return;
  }
  if (req.header("x-admin-code") !== expected) {
    res.status(401).json({ error: "Code d'administrateur invalide" });
    return;
  }
  next();
}

questionsRouter.use(requireAdminCode);

const melodyNoteSchema = z.object({ freq: z.number().positive(), durationMs: z.number().positive() });

// Discriminated on theme so each question type gets the validation it
// actually needs — stats questions are always a 2-way comparison (the UI
// renders them as a special side-by-side pick), the others are 2-6 choices.
const questionInputSchema = z.discriminatedUnion("theme", [
  z.object({
    theme: z.literal("trivia"),
    prompt: z.string().min(1).max(300),
    choices: z.array(z.string().min(1).max(120)).min(2).max(6),
    correctIndex: z.number().int().min(0),
    mediaUrl: z.string().url().optional(),
  }),
  z.object({
    theme: z.literal("speed"),
    prompt: z.string().min(1).max(300),
    choices: z.array(z.string().min(1).max(120)).min(2).max(6),
    correctIndex: z.number().int().min(0),
  }),
  z.object({
    theme: z.literal("ost"),
    prompt: z.string().min(1).max(300),
    choices: z.array(z.string().min(1).max(120)).min(2).max(6),
    correctIndex: z.number().int().min(0),
    mediaUrl: z.string().url().optional(),
    notes: z.array(melodyNoteSchema).min(1).max(64).optional(),
    // Blind test — a real YouTube remix clip, already extracted to a bare
    // video id client-side (no URL parsing needed here).
    youtubeId: z.string().min(6).max(20).optional(),
    startSeconds: z.number().int().min(0).optional(),
    clipDurationMs: z.number().int().min(10_000).max(60_000).optional(),
  }),
  z.object({
    theme: z.literal("stats"),
    prompt: z.string().min(1).max(300),
    choices: z.array(z.string().min(1).max(120)).length(2),
    correctIndex: z.number().int().min(0).max(1),
    stat: z.string().min(1).max(40),
  }),
]);

function toMetadata(data: z.infer<typeof questionInputSchema>) {
  if (data.theme === "ost") {
    if (!data.notes && !data.youtubeId) return undefined;
    return {
      notes: data.notes,
      youtubeId: data.youtubeId,
      startSeconds: data.startSeconds,
      clipDurationMs: data.clipDurationMs,
    };
  }
  if (data.theme === "stats") return { stat: data.stat };
  return undefined;
}

function serialize(q: {
  id: string;
  theme: string;
  order: number;
  prompt: string;
  mediaUrl: string | null;
  choices: unknown;
  correctIndex: number;
  metadata: unknown;
}) {
  return {
    id: q.id,
    theme: q.theme,
    order: q.order,
    prompt: q.prompt,
    mediaUrl: q.mediaUrl,
    choices: q.choices,
    correctIndex: q.correctIndex,
    metadata: q.metadata,
  };
}

questionsRouter.post("/question-banks", async (req, res) => {
  const parsed = z.object({ name: z.string().min(1).max(80) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Nom de banque invalide." });
    return;
  }
  const bank = await prisma.questionBank.create({ data: { name: parsed.data.name } });
  res.status(201).json({ id: bank.id, name: bank.name, questionCount: 0 });
});

questionsRouter.get("/question-banks/:bankId/questions", async (req, res) => {
  const questions = await prisma.question.findMany({
    where: { questionBankId: req.params.bankId },
    orderBy: { order: "asc" },
  });
  res.json(questions.map(serialize));
});

async function nextOrder(bankId: string): Promise<number> {
  const top = await prisma.question.findFirst({ where: { questionBankId: bankId }, orderBy: { order: "desc" } });
  return (top?.order ?? -1) + 1;
}

questionsRouter.post("/question-banks/:bankId/questions", async (req, res) => {
  const parsed = questionInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Question invalide.", details: parsed.error.flatten() });
    return;
  }
  const bank = await prisma.questionBank.findUnique({ where: { id: req.params.bankId } });
  if (!bank) {
    res.status(404).json({ error: "Banque de questions introuvable." });
    return;
  }

  const data = parsed.data;
  const order = await nextOrder(bank.id);
  const question = await prisma.question.create({
    data: {
      questionBankId: bank.id,
      theme: data.theme,
      order,
      prompt: data.prompt,
      mediaUrl: "mediaUrl" in data ? (data.mediaUrl ?? null) : null,
      choices: data.choices,
      correctIndex: data.correctIndex,
      metadata: toMetadata(data),
    },
  });
  res.status(201).json(serialize(question));
});

questionsRouter.put("/questions/:id", async (req, res) => {
  const parsed = questionInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Question invalide.", details: parsed.error.flatten() });
    return;
  }
  const existing = await prisma.question.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "Question introuvable." });
    return;
  }

  const data = parsed.data;
  const question = await prisma.question.update({
    where: { id: existing.id },
    data: {
      theme: data.theme,
      prompt: data.prompt,
      mediaUrl: "mediaUrl" in data ? (data.mediaUrl ?? null) : null,
      choices: data.choices,
      correctIndex: data.correctIndex,
      metadata: toMetadata(data),
    },
  });
  res.json(serialize(question));
});

questionsRouter.delete("/questions/:id", async (req, res) => {
  const existing = await prisma.question.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "Question introuvable." });
    return;
  }
  await prisma.question.delete({ where: { id: existing.id } });
  res.status(204).end();
});

const moveSchema = z.object({ direction: z.enum(["up", "down"]) });

questionsRouter.post("/questions/:id/move", async (req, res) => {
  const parsed = moveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Direction invalide." });
    return;
  }
  const current = await prisma.question.findUnique({ where: { id: req.params.id } });
  if (!current) {
    res.status(404).json({ error: "Question introuvable." });
    return;
  }

  const neighbor = await prisma.question.findFirst({
    where: {
      questionBankId: current.questionBankId,
      order: parsed.data.direction === "up" ? { lt: current.order } : { gt: current.order },
    },
    orderBy: { order: parsed.data.direction === "up" ? "desc" : "asc" },
  });
  if (!neighbor) {
    res.json(serialize(current)); // already at the edge — no-op, not an error
    return;
  }

  await prisma.$transaction([
    prisma.question.update({ where: { id: current.id }, data: { order: neighbor.order } }),
    prisma.question.update({ where: { id: neighbor.id }, data: { order: current.order } }),
  ]);
  res.json({ ok: true });
});

const bulkImportSchema = z.object({ questions: z.array(questionInputSchema).min(1).max(300) });

questionsRouter.post("/question-banks/:bankId/questions/bulk", async (req, res) => {
  const parsed = bulkImportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Import invalide.", details: parsed.error.flatten() });
    return;
  }
  const bank = await prisma.questionBank.findUnique({ where: { id: req.params.bankId } });
  if (!bank) {
    res.status(404).json({ error: "Banque de questions introuvable." });
    return;
  }

  let order = await nextOrder(bank.id);
  const rows = parsed.data.questions.map((data) => ({
    questionBankId: bank.id,
    theme: data.theme,
    order: order++,
    prompt: data.prompt,
    mediaUrl: "mediaUrl" in data ? (data.mediaUrl ?? null) : null,
    choices: data.choices,
    correctIndex: data.correctIndex,
    metadata: toMetadata(data),
  }));
  await prisma.question.createMany({ data: rows });
  res.status(201).json({ created: rows.length });
});
