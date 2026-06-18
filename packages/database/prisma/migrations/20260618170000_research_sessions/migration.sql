CREATE TABLE "research_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT,
    "query" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "context_mode" TEXT NOT NULL DEFAULT 'dnd_brain',
    "report_md" TEXT,
    "owner_id" TEXT,
    "ai_run_id" TEXT,
    "error_message" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "research_sessions_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "research_sessions_status_created_at_idx" ON "research_sessions"("status", "created_at");
CREATE INDEX "research_sessions_world_id_created_at_idx" ON "research_sessions"("world_id", "created_at");

CREATE TABLE "research_sources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "snippet" TEXT,
    "fetched_at" DATETIME,
    CONSTRAINT "research_sources_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "research_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "research_sources_session_id_idx" ON "research_sources"("session_id");
