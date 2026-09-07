-- Replace the lives/elimination system with a running points score.
ALTER TABLE "Player" ADD COLUMN "points" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Player" DROP COLUMN "lives";
ALTER TABLE "Player" DROP COLUMN "eliminated";
ALTER TABLE "Player" DROP COLUMN "eliminatedRound";
ALTER TABLE "Event" DROP COLUMN "livesPerPlayer";
