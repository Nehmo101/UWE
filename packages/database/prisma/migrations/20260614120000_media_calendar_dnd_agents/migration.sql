-- Media, Calendar, DnD Integrations & Agent Automation

-- Extend JobType (SQLite: recreate not needed for enum in Prisma — stored as TEXT)

-- Image Studio
CREATE TABLE "image_studio_projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT,
    "title" TEXT NOT NULL,
    "prompt" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "image_studio_projects_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "image_studio_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "operation" TEXT NOT NULL,
    "prompt" TEXT,
    "asset_id" TEXT,
    "parent_version_id" TEXT,
    "provider_mode" TEXT,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "image_studio_versions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "image_studio_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "image_studio_versions_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "image_studio_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "image_studio_links_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "image_studio_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "image_studio_links_project_id_target_type_target_id_key" ON "image_studio_links"("project_id", "target_type", "target_id");
CREATE INDEX "image_studio_links_target_type_target_id_idx" ON "image_studio_links"("target_type", "target_id");
CREATE INDEX "image_studio_projects_world_id_status_idx" ON "image_studio_projects"("world_id", "status");
CREATE INDEX "image_studio_versions_project_id_version_number_idx" ON "image_studio_versions"("project_id", "version_number");

-- Calendar
CREATE TABLE "calendar_feeds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'read_only',
    "url" TEXT,
    "caldav_url" TEXT,
    "username" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "color" TEXT,
    "last_sync_at" DATETIME,
    "sync_error" TEXT,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feed_id" TEXT,
    "world_id" TEXT,
    "session_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "start_at" DATETIME NOT NULL,
    "end_at" DATETIME,
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "kind" TEXT NOT NULL DEFAULT 'personal',
    "external_uid" TEXT,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "calendar_events_feed_id_fkey" FOREIGN KEY ("feed_id") REFERENCES "calendar_feeds" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "calendar_events_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "calendar_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "calendar_events_start_at_idx" ON "calendar_events"("start_at");
CREATE INDEX "calendar_events_world_id_start_at_idx" ON "calendar_events"("world_id", "start_at");
CREATE INDEX "calendar_events_feed_id_external_uid_idx" ON "calendar_events"("feed_id", "external_uid");

-- Dev Agent Jobs
CREATE TABLE "dev_agent_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "provider" TEXT NOT NULL DEFAULT 'github_actions',
    "branch_name" TEXT,
    "pr_url" TEXT,
    "issue_url" TEXT,
    "github_run_id" TEXT,
    "cursor_job_id" TEXT,
    "result" JSONB,
    "error_message" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "completed_at" DATETIME
);

CREATE INDEX "dev_agent_jobs_status_created_at_idx" ON "dev_agent_jobs"("status", "created_at");

-- DnD Beyond References (manual links only)
CREATE TABLE "dnd_beyond_references" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "page_id" TEXT,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "entity_type" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "dnd_beyond_references_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "dnd_beyond_references_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "dnd_beyond_references_world_id_idx" ON "dnd_beyond_references"("world_id");

-- DnD API Cache
CREATE TABLE "dnd_api_cache_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "cache_key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "expires_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "dnd_api_cache_entries_provider_cache_key_key" ON "dnd_api_cache_entries"("provider", "cache_key");
CREATE INDEX "dnd_api_cache_entries_expires_at_idx" ON "dnd_api_cache_entries"("expires_at");
