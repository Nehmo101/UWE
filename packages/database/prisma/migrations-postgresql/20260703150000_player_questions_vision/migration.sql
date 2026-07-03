-- AlterEnum
ALTER TYPE "ConnectorJobType" ADD VALUE 'vision_extract';

-- CreateEnum
CREATE TYPE "PlayerQuestionStatus" AS ENUM ('open', 'answered', 'archived');

-- CreateTable
CREATE TABLE "player_questions" (
    "id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "author_user_id" TEXT,
    "author_name" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "status" "PlayerQuestionStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answered_at" TIMESTAMP(3),
    CONSTRAINT "player_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_questions_world_id_status_idx" ON "player_questions"("world_id", "status");

-- AddForeignKey
ALTER TABLE "player_questions" ADD CONSTRAINT "player_questions_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
