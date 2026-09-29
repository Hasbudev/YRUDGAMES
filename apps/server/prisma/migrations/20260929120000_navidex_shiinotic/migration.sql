-- Data fix: Lampignon's English name is Shiinotic, not Morelull (that's
-- Spododo). Only touches the Navidex question if it already exists — a fresh
-- database gets the right value from prisma/data/yrudGames2.ts instead.
UPDATE "Question"
SET "metadata" = jsonb_set("metadata", '{acceptedAnswers}', '["Lampignon", "Shiinotic"]'::jsonb)
WHERE "prompt" = 'Quel Pokémon manque sur la Route 11 (Alola, USUL) ?'
  AND "metadata" ? 'acceptedAnswers';
