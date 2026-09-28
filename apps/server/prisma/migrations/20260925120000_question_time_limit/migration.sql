-- Per-question answer time in seconds; NULL = the server default.
ALTER TABLE "Question" ADD COLUMN "timeLimitSec" INTEGER;
