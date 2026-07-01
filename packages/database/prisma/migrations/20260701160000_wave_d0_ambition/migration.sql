-- Wave D0: BugReport, MiniatureCollectionItem, DevIdea extensions, ImportJob, DocumentTemplate

ALTER TABLE "dev_ideas" ADD COLUMN "idea_type" TEXT NOT NULL DEFAULT 'feature';
ALTER TABLE "dev_ideas" ADD COLUMN "lifecycle" TEXT NOT NULL DEFAULT 'planned';
ALTER TABLE "dev_ideas" ADD COLUMN "module" TEXT;
ALTER TABLE "dev_ideas" ADD COLUMN "maturity_level" TEXT;

CREATE INDEX "dev_ideas_idea_type_lifecycle_idx" ON "dev_ideas"("idea_type", "lifecycle");

CREATE TABLE "bug_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "module" TEXT,
    "screenshot_asset_id" TEXT,
    "reporter_user_id" TEXT,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "bug_reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "bug_reports_status_updated_at_idx" ON "bug_reports"("status", "updated_at");
CREATE INDEX "bug_reports_severity_idx" ON "bug_reports"("severity");

CREATE TABLE "miniature_collection_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "game_system" TEXT,
    "faction" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'purchased',
    "notes" TEXT NOT NULL DEFAULT '',
    "reference_image_asset_id" TEXT,
    "compare_photo_asset_ids" JSONB,
    "workshop_project_id" TEXT,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "miniature_collection_items_workshop_project_id_fkey" FOREIGN KEY ("workshop_project_id") REFERENCES "workshop_projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "miniature_collection_items_status_idx" ON "miniature_collection_items"("status");
CREATE INDEX "miniature_collection_items_manufacturer_idx" ON "miniature_collection_items"("manufacturer");
CREATE INDEX "miniature_collection_items_game_system_idx" ON "miniature_collection_items"("game_system");

CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source_type" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_world_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "file_name" TEXT,
    "preview_payload" JSONB,
    "result_summary" JSONB,
    "undo_token" TEXT,
    "error_message" TEXT,
    "created_by_user_id" TEXT,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "import_jobs_target_world_id_fkey" FOREIGN KEY ("target_world_id") REFERENCES "worlds" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "import_jobs_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "import_jobs_status_created_at_idx" ON "import_jobs"("status", "created_at");
CREATE INDEX "import_jobs_target_type_idx" ON "import_jobs"("target_type");

CREATE TABLE "document_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "body" TEXT NOT NULL DEFAULT '',
    "variables" JSONB,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE INDEX "document_templates_category_idx" ON "document_templates"("category");
