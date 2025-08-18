/*
  Warnings:

  - You are about to drop the `messages` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ConversationState" AS ENUM ('INITIAL', 'WAITING_OPTION', 'OPTION_1_DETAILS', 'OPTION_2_DETAILS', 'OPTION_3_DETAILS', 'OPTION_4_DETAILS', 'OPTION_5_DETAILS', 'FORWARDED_TO_HUMAN', 'COMPLETED');

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "bot_disabled_until" TIMESTAMP(3),
ADD COLUMN     "last_activity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "state" "ConversationState" NOT NULL DEFAULT 'INITIAL',
ADD COLUMN     "user_data" JSONB,
ADD COLUMN     "waiting_for" TEXT;

-- DropTable
DROP TABLE "messages";
