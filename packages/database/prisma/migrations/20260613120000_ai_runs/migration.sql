-- AI Run History: traceable KI executions (results are proposals, never auto-applied)

CREATE TABLE "ai_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT,
    "page_id" TEXT,
    "game_session_id" TEXT,
    "user_id" TEXT,
    "source" TEXT,
    "task_type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "system_prompt" TEXT,
    "user_prompt" TEXT,
    "context_data" JSONB,
    "result_text" TEXT,
    "result_meta" JSONB,
    "error_message" TEXT,
    "error_details" JSONB,
    "duration_ms" INTEGER,
    "target_type" TEXT,
    "target_id" TEXT,
    "proposals" JSONB,
    "applied_at" DATETIME,
    "discarded_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ai_runs_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ai_runs_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ai_runs_game_session_id_fkey" FOREIGN KEY ("game_session_id") REFERENCES "game_sessions" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ai_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ai_runs_world_id_created_at_idx" ON "ai_runs"("world_id", "created_at");
CREATE INDEX "ai_runs_status_created_at_idx" ON "ai_runs"("status", "created_at");
CREATE INDEX "ai_runs_page_id_idx" ON "ai_runs"("page_id");
