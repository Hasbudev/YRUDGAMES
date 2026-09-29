-- Data fix: in the Navidex manche, every question (not just the last one)
-- now lets its fastest right answer steal 5 points. Only touches Navidex
-- questions that already exist; a fresh database gets this from
-- prisma/data/yrudGames2.ts.
UPDATE "Question"
SET "metadata" = jsonb_set(COALESCE("metadata", '{}'::jsonb), '{steal}', '5'::jsonb)
WHERE "mediaUrl" LIKE '/quizz/images/yg2-navidex-%';
