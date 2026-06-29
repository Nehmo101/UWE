-- CreateTable
CREATE TABLE "dev_ideas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'in_planning',
    "chat_transcript" JSONB,
    "generated_prompt" TEXT,
    "dev_agent_job_id" TEXT,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "dev_ideas_status_updated_at_idx" ON "dev_ideas"("status", "updated_at");
