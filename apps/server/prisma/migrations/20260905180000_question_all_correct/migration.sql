-- A joke/gotcha question where every listed choice scores as correct.
ALTER TABLE "Question" ADD COLUMN "allCorrect" BOOLEAN NOT NULL DEFAULT false;
