-- Round grouping (for the "MANCHE N" banner) and richer per-question scoring.
ALTER TABLE "Question" ADD COLUMN "roundIndex" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Question" ADD COLUMN "roundLabel" TEXT;
ALTER TABLE "Question" ADD COLUMN "wrongPoints" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Question" ADD COLUMN "blankPoints" INTEGER;
ALTER TABLE "Question" ADD COLUMN "comboThreshold" INTEGER;
ALTER TABLE "Question" ADD COLUMN "comboBonus" INTEGER;
-- Per-player streak (for the combo bonus) is tracked in-memory only, same
-- as the rest of live game state — it's a within-round mechanic, never
-- read back from the DB, so it doesn't need a column here.
