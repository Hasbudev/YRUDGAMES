-- Data fix: a bomb explosion now costs 10 points per player of the clan
-- (was 20). Updates the bomb questions of banks that already exist; a fresh
-- database gets this from prisma/data/yrudGames2.ts.
UPDATE "Question"
SET "metadata" = jsonb_set("metadata", '{bomb,penalty}', '10'::jsonb)
WHERE "metadata" ? 'bomb';
