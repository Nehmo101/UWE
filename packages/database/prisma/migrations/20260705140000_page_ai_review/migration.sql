-- AlterTable
ALTER TABLE "pages" ADD COLUMN "ai_reviewed_at" DATETIME;

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
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "publish_status" TEXT NOT NULL DEFAULT 'draft',
    "secret_level" TEXT NOT NULL DEFAULT 'none',
    "reveal_state" TEXT NOT NULL DEFAULT 'hidden',
    "canonical_status" TEXT NOT NULL DEFAULT 'draft',
    "prep_status" TEXT,
    "quest_status" TEXT,
    "tags" JSONB,
    "aliases" JSONB,
    "ai_reviewed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "pages_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pages_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pages_parent_page_id_fkey" FOREIGN KEY ("parent_page_id") REFERENCES "pages" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_pages" ("id", "world_id", "campaign_id", "parent_page_id", "title", "slug", "type", "summary", "visibility", "publish_status", "secret_level", "reveal_state", "canonical_status", "prep_status", "quest_status", "tags", "aliases", "created_at", "updated_at") SELECT "id", "world_id", "campaign_id", "parent_page_id", "title", "slug", "type", "summary", "visibility", "publish_status", "secret_level", "reveal_state", "canonical_status", "prep_status", "quest_status", "tags", "aliases", "created_at", "updated_at" FROM "pages";
DROP TABLE "pages";
ALTER TABLE "new_pages" RENAME TO "pages";
CREATE INDEX "pages_parent_page_id_idx" ON "pages"("parent_page_id");
CREATE UNIQUE INDEX "pages_world_id_slug_key" ON "pages"("world_id", "slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
