-- Per-question point value — most are worth 1, some worth more.
ALTER TABLE "Question" ADD COLUMN "points" INTEGER NOT NULL DEFAULT 1;
