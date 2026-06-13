-- P08 Review/Apply/Undo: structured AI proposals and apply audit log

CREATE TABLE "ai_proposals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ai_run_id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "suggested_mode" TEXT NOT NULL,
    "patch" JSONB NOT NULL,
    "result_text" TEXT NOT NULL,
    "edited_text" TEXT,
    "source_page_id" TEXT,
    "session_id" TEXT,
    "applied_target_type" TEXT,
    "applied_target_id" TEXT,
    "applied_at" DATETIME,
    "discarded_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ai_proposals_ai_run_id_fkey" FOREIGN KEY ("ai_run_id") REFERENCES "ai_runs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ai_proposals_ai_run_id_idx" ON "ai_proposals"("ai_run_id");
CREATE INDEX "ai_proposals_world_id_status_idx" ON "ai_proposals"("world_id", "status");

CREATE TABLE "ai_apply_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proposal_id" TEXT NOT NULL,
    "ai_run_id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "details" JSONB,
    "undo_entry_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_apply_logs_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "ai_proposals" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ai_apply_logs_undo_entry_id_fkey" FOREIGN KEY ("undo_entry_id") REFERENCES "undo_entries" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ai_apply_logs_proposal_id_created_at_idx" ON "ai_apply_logs"("proposal_id", "created_at");
CREATE INDEX "ai_apply_logs_ai_run_id_idx" ON "ai_apply_logs"("ai_run_id");
CREATE INDEX "ai_apply_logs_world_id_created_at_idx" ON "ai_apply_logs"("world_id", "created_at");
CREATE INDEX "ai_apply_logs_undo_entry_id_idx" ON "ai_apply_logs"("undo_entry_id");
