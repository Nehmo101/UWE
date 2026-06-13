-- Job queue for long-running background tasks (mail, AI, embeddings, import, backup)

CREATE TABLE "jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "title" TEXT NOT NULL,
    "world_id" TEXT,
    "world_slug" TEXT,
    "user_id" TEXT,
    "payload" JSONB,
    "result" JSONB,
    "error_message" TEXT,
    "error_details" JSONB,
    "progress" INTEGER,
    "progress_label" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "related_type" TEXT,
    "related_id" TEXT,
    "started_at" DATETIME,
    "completed_at" DATETIME,
    "cancelled_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "job_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "job_id" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "details" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "job_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "jobs_status_created_at_idx" ON "jobs"("status", "created_at");
CREATE INDEX "jobs_type_created_at_idx" ON "jobs"("type", "created_at");
CREATE INDEX "jobs_world_id_created_at_idx" ON "jobs"("world_id", "created_at");
CREATE INDEX "job_logs_job_id_created_at_idx" ON "job_logs"("job_id", "created_at");
