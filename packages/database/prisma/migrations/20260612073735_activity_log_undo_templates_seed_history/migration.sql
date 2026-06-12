-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT,
    "world_slug" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "target_label" TEXT,
    "target_href" TEXT,
    "summary" TEXT NOT NULL,
    "details" JSONB,
    "undo_entry_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_logs_undo_entry_id_fkey" FOREIGN KEY ("undo_entry_id") REFERENCES "undo_entries" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "undo_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT,
    "operation" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "undone_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "page_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "page_type" TEXT NOT NULL,
    "default_visibility" TEXT NOT NULL DEFAULT 'dm_only',
    "title_placeholder" TEXT NOT NULL DEFAULT '',
    "blocks" JSONB NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "seed_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "applied_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_pages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "parent_page_id" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "summary" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'dm_only',
    "publish_status" TEXT NOT NULL DEFAULT 'draft',
    "canonical_status" TEXT NOT NULL DEFAULT 'draft',
    "prep_status" TEXT,
    "tags" JSONB,
    "aliases" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "pages_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pages_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pages_parent_page_id_fkey" FOREIGN KEY ("parent_page_id") REFERENCES "pages" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_pages" ("aliases", "campaign_id", "canonical_status", "created_at", "id", "parent_page_id", "prep_status", "publish_status", "slug", "summary", "tags", "title", "type", "updated_at", "visibility", "world_id") SELECT "aliases", "campaign_id", "canonical_status", "created_at", "id", "parent_page_id", "prep_status", "publish_status", "slug", "summary", "tags", "title", "type", "updated_at", "visibility", "world_id" FROM "pages";
DROP TABLE "pages";
ALTER TABLE "new_pages" RENAME TO "pages";
CREATE INDEX "pages_parent_page_id_idx" ON "pages"("parent_page_id");
CREATE UNIQUE INDEX "pages_world_id_slug_key" ON "pages"("world_id", "slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "activity_logs_world_id_created_at_idx" ON "activity_logs"("world_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");

-- CreateIndex
CREATE INDEX "activity_logs_undo_entry_id_idx" ON "activity_logs"("undo_entry_id");

-- CreateIndex
CREATE INDEX "undo_entries_world_id_created_at_idx" ON "undo_entries"("world_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "page_templates_slug_key" ON "page_templates"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "seed_history_key_key" ON "seed_history"("key");
