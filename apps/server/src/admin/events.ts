import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../db/client";

export const eventsRouter = Router();

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

function randomCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

async function generateUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    const existing = await prisma.event.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique event code");
}

// Lightweight shared-secret gate for Rudy's admin surface. Not real auth
// (no per-user accounts) — good enough for a small trusted community event.
// Phase 5's AdminUser model is the place to grow this into real sessions.
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

// Public: the landing page lists events that are still joinable.
eventsRouter.get("/events/open", async (_req, res) => {
  const events = await prisma.event.findMany({
    where: { status: { in: ["draft", "live"] } },
    include: { _count: { select: { players: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(
    events.map((e: (typeof events)[number]) => ({
      code: e.code,
      name: e.name,
      status: e.status,
      playerCount: e._count.players,
      createdAt: e.createdAt,
    }))
  );
});

// Public: aggregated global standings across every finished event, grouped
// by normalized player name (there's no persistent per-user account — a
// player is just a free-text name per event).
eventsRouter.get("/leaderboard", async (_req, res) => {
  const players = await prisma.player.findMany({
    where: { event: { status: "finished" }, placement: { not: null } },
    select: { name: true, placement: true, correctAnswers: true, clan: true },
  });

  const byName = new Map<
    string,
    { name: string; clan: string | null; eventsPlayed: number; wins: number; bestPlacement: number; totalCorrectAnswers: number }
  >();
  for (const p of players) {
    const key = p.name.trim().toLowerCase();
    const placement = p.placement ?? 999;
    const existing = byName.get(key);
    if (existing) {
      existing.eventsPlayed += 1;
      if (placement === 1) existing.wins += 1;
      existing.bestPlacement = Math.min(existing.bestPlacement, placement);
      existing.totalCorrectAnswers += p.correctAnswers ?? 0;
    } else {
      byName.set(key, {
        name: p.name.trim(),
        // Clan is picked per event-join, not a persistent account, but a
        // player switching clans between sessions is rare enough that
        // "whichever event we saw first" is a fine tie-break for display.
        clan: p.clan,
        eventsPlayed: 1,
        wins: placement === 1 ? 1 : 0,
        bestPlacement: placement,
        totalCorrectAnswers: p.correctAnswers ?? 0,
      });
    }
  }

  const leaderboard = [...byName.values()].sort((a, b) => b.wins - a.wins || a.bestPlacement - b.bestPlacement);
  res.json(leaderboard);
});

eventsRouter.get("/question-banks", requireAdminCode, async (_req, res) => {
  const banks = await prisma.questionBank.findMany({
    include: { _count: { select: { questions: true } } },
  });
  res.json(
    banks.map((b: (typeof banks)[number]) => ({
      id: b.id,
      name: b.name,
      questionCount: b._count.questions,
    }))
  );
});

const createEventSchema = z.object({
  name: z.string().min(1).max(80),
  questionBankId: z.string().min(1),
  livesPerPlayer: z.number().int().min(1).max(10).default(3),
});

eventsRouter.post("/events", requireAdminCode, async (req, res) => {
  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const bank = await prisma.questionBank.findUnique({ where: { id: parsed.data.questionBankId } });
  if (!bank) {
    res.status(404).json({ error: "Banque de questions introuvable" });
    return;
  }

  const code = await generateUniqueCode();
  const event = await prisma.event.create({
    data: {
      code,
      name: parsed.data.name,
      questionBankId: parsed.data.questionBankId,
      livesPerPlayer: parsed.data.livesPerPlayer,
    },
  });

  res.status(201).json({ id: event.id, code: event.code, name: event.name });
});

// Public: the player join page needs to validate a code before connecting.
eventsRouter.get("/events/:code", async (req, res) => {
  const event = await prisma.event.findUnique({ where: { code: req.params.code } });
  if (!event) {
    res.status(404).json({ error: "Événement introuvable" });
    return;
  }
  res.json({ id: event.id, code: event.code, name: event.name, status: event.status });
});
