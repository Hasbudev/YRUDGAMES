// Replaces whole manches of a question bank with the Yrud Games 2 content in
// prisma/data/yrudGames2.ts. Every other manche of the bank is left alone.
//
//   npm run yrud2 --workspace=apps/server                         # lists the banks
//   npm run yrud2 --workspace=apps/server -- --bank "<nom|id>"    # dry run: shows the plan
//   npm run yrud2 --workspace=apps/server -- --bank "<nom|id>" --apply
//   npm run yrud2 --workspace=apps/server -- --create "Yrud Games 2" --apply
//     → creates a brand-new bank holding only the Yrud Games 2 manches (the
//       safest option: an old bank and its past events stay untouched)
//
// Needs DATABASE_URL (point it at production to change the real bank — a dry
// run is the default so nothing is written by accident). Flags:
//   --allow-unverified     write even though some answers are still marked `verify`
//   --delete-answer-logs   also delete the recorded answers of the replaced
//                          questions (past test events). Without it the script
//                          stops if any exist: the database won't let a
//                          question with answers be deleted.
import { PrismaClient } from "@prisma/client";
import { YRUD_GAMES_2_ROUNDS, type NewQuestion, type NewRound } from "./data/yrudGames2";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

interface Scoring {
  points: number;
  wrongPoints: number;
  blankPoints: number | null;
  comboThreshold: number | null;
  comboBonus: number | null;
  timeLimitSec: number | null;
}

function describe(s: Scoring): string {
  const parts = [`+${s.points} pt(s)`, `faux ${s.wrongPoints}`];
  if (s.blankPoints !== null) parts.push(`sans réponse ${s.blankPoints}`);
  if (s.comboThreshold && s.comboBonus) parts.push(`combo ×${s.comboThreshold} : +${s.comboBonus}`);
  parts.push(s.timeLimitSec ? `${s.timeLimitSec} s` : "temps par défaut");
  return parts.join(", ");
}

function metadataOf(q: NewQuestion) {
  const meta = {
    ...(q.whackDurationMs ? { whack: { durationMs: q.whackDurationMs } } : {}),
    ...(q.audioFile ? { audioFile: q.audioFile } : {}),
    ...(q.acceptedAnswers ? { acceptedAnswers: q.acceptedAnswers } : {}),
    ...q.meta,
  };
  return Object.keys(meta).length ? (meta as object) : undefined;
}

async function main() {
  const createName = option("create");
  if (createName) {
    const total = YRUD_GAMES_2_ROUNDS.reduce((n, r) => n + r.questions.length, 0);
    console.log(`Nouvelle banque "${createName}" — ${YRUD_GAMES_2_ROUNDS.length} manches, ${total} questions :`);
    for (const r of YRUD_GAMES_2_ROUNDS) console.log(`  Manche ${r.roundIndex} « ${r.roundLabel} » : ${r.questions.length} questions`);
    if (!flag("apply")) {
      console.log("\nEssai à blanc — rien n'a été écrit. Ajoute --apply pour créer la banque.");
      return;
    }
    const bank = await prisma.questionBank.create({ data: { name: createName } });
    console.log(`Banque créée : ${bank.id}`);
    args.push("--bank", bank.id);
  }

  const bankArg = option("bank");
  if (!bankArg) {
    const banks = await prisma.questionBank.findMany({ include: { _count: { select: { questions: true } } } });
    console.log("Banques de questions :");
    for (const b of banks) console.log(`  ${b.id}  "${b.name}"  (${b._count.questions} questions)`);
    console.log('\nRelance avec --bank "<nom ou id>" pour voir le plan.');
    return;
  }

  const banks = await prisma.questionBank.findMany({ where: { OR: [{ id: bankArg }, { name: bankArg }] } });
  if (banks.length !== 1) {
    throw new Error(banks.length === 0 ? `Banque introuvable : ${bankArg}` : `Plusieurs banques nommées "${bankArg}" : utilise l'id.`);
  }
  const bank = banks[0];
  const existing = await prisma.question.findMany({ where: { questionBankId: bank.id }, orderBy: { order: "asc" } });

  const replaced = new Set(YRUD_GAMES_2_ROUNDS.map((r) => r.roundIndex));
  const old = existing.filter((q) => replaced.has(q.roundIndex));
  const kept = existing.filter((q) => !replaced.has(q.roundIndex));
  const answerCount = old.length
    ? await prisma.answerLog.count({ where: { questionId: { in: old.map((q) => q.id) } } })
    : 0;

  // A manche keeps the scoring it already had in this bank (taken from its
  // first existing question); the file's neutral default only applies to a
  // manche the bank doesn't have yet.
  function scoringFor(round: NewRound): { scoring: Scoring; inherited: boolean } {
    const first = old.find((q) => q.roundIndex === round.roundIndex);
    if (first && !round.ownScoring) {
      return {
        inherited: true,
        scoring: {
          points: first.points,
          wrongPoints: first.wrongPoints,
          blankPoints: first.blankPoints,
          comboThreshold: first.comboThreshold,
          comboBonus: first.comboBonus,
          timeLimitSec: first.timeLimitSec,
        },
      };
    }
    const s = round.scoring;
    return {
      inherited: false,
      scoring: {
        points: s.points,
        wrongPoints: s.wrongPoints,
        blankPoints: s.blankPoints ?? null,
        comboThreshold: s.comboThreshold ?? null,
        comboBonus: s.comboBonus ?? null,
        timeLimitSec: s.timeLimitSec ?? null,
      },
    };
  }

  console.log(`Banque "${bank.name}" (${bank.id}) — ${existing.length} questions\n`);
  const unverified: string[] = [];
  const plans = YRUD_GAMES_2_ROUNDS.map((round) => {
    const plan = scoringFor(round);
    const oldCount = old.filter((q) => q.roundIndex === round.roundIndex).length;
    console.log(`Manche ${round.roundIndex} « ${round.roundLabel} » : ${oldCount} → ${round.questions.length} questions`);
    console.log(`  score ${plan.inherited ? "hérité de la manche actuelle" : round.ownScoring ? "défini dans yrudGames2.ts" : "par défaut (manche absente de la banque)"} : ${describe(plan.scoring)}`);
    const perQuestion = round.questions.filter((q) => q.points !== undefined).map((q) => q.points);
    if (perQuestion.length) console.log(`  points par question : ${perQuestion.join(", ")}`);
    round.questions.forEach((q, i) => {
      if (q.verify) unverified.push(`  Manche ${round.roundIndex}, question ${i + 1} — ${q.prompt}\n    ⚠ ${q.verify}`);
    });
    return { round, ...plan };
  });
  console.log(`\nConservées telles quelles : ${kept.length} questions (manches ${[...new Set(kept.map((q) => q.roundIndex))].sort().join(", ") || "—"})`);
  if (answerCount > 0) console.log(`Réponses déjà enregistrées sur les questions remplacées : ${answerCount}`);

  if (unverified.length) {
    console.log(`\n${unverified.length} réponse(s) à confirmer :\n${unverified.join("\n")}`);
  }

  if (!flag("apply")) {
    console.log("\nEssai à blanc — rien n'a été écrit. Ajoute --apply pour appliquer.");
    return;
  }
  if (unverified.length && !flag("allow-unverified")) {
    throw new Error("Des réponses sont encore marquées `verify` : corrige-les dans yrudGames2.ts, ou passe --allow-unverified.");
  }
  if (answerCount > 0 && !flag("delete-answer-logs")) {
    throw new Error(`${answerCount} réponse(s) enregistrée(s) bloquent la suppression : supprime les événements de test depuis l'admin, ou passe --delete-answer-logs.`);
  }

  // The new block goes where the first replaced question used to sit (or at
  // the very start if the bank had none of these manches), and the whole bank
  // is renumbered so `order` stays a clean 0..n sequence.
  const firstOldOrder = old[0]?.order;
  const before = kept.filter((q) => firstOldOrder !== undefined && q.order < firstOldOrder);
  const after = kept.filter((q) => !before.includes(q));

  await prisma.$transaction(async (tx) => {
    if (old.length) {
      if (answerCount > 0) await tx.answerLog.deleteMany({ where: { questionId: { in: old.map((q) => q.id) } } });
      await tx.question.deleteMany({ where: { id: { in: old.map((q) => q.id) } } });
    }

    // Order is assigned up front (kept-before, then the new block, then
    // kept-after) rather than read back, so it can't depend on id ordering.
    let order = before.length;
    const created = plans.flatMap(({ round, scoring }) =>
      round.questions.map((q) => ({
        questionBankId: bank.id,
        theme: round.theme ?? ("trivia" as const),
        order: order++,
        prompt: q.prompt,
        choices: q.choices,
        correctIndex: q.correctIndex,
        mediaUrl: q.mediaUrl ?? null,
        metadata: metadataOf(q),
        roundIndex: round.roundIndex,
        roundLabel: round.roundLabel,
        points: q.points ?? scoring.points,
        wrongPoints: scoring.wrongPoints,
        blankPoints: scoring.blankPoints,
        comboThreshold: scoring.comboThreshold,
        comboBonus: scoring.comboBonus,
        timeLimitSec: scoring.timeLimitSec,
      }))
    );
    await tx.question.createMany({ data: created });

    for (const [i, q] of before.entries()) await tx.question.update({ where: { id: q.id }, data: { order: i } });
    for (const [j, q] of after.entries()) await tx.question.update({ where: { id: q.id }, data: { order: order + j } });
  });

  console.log("\n✓ Appliqué.");
}

main()
  .catch((e) => {
    console.error(`\n✗ ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
