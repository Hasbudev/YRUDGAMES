/*
  Warnings:

  - Added the required column `playerId` to the `FinalBattleTeam` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "FinalBattleTeam" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "playerId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "BattleInterferenceLog" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "params" JSONB,
    "turn" INTEGER NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BattleInterferenceLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BattleInterferenceLog" ADD CONSTRAINT "BattleInterferenceLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
