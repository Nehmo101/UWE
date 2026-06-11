-- CreateTable
CREATE TABLE "worlds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "campaigns_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "summary" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'dm_only',
    "publish_status" TEXT NOT NULL DEFAULT 'draft',
    "canonical_status" TEXT NOT NULL DEFAULT 'draft',
    "tags" JSONB,
    "aliases" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "pages_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pages_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "content_blocks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "page_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "visibility" TEXT NOT NULL DEFAULT 'dm_only',
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "content_blocks_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "page_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source_page_id" TEXT NOT NULL,
    "target_page_id" TEXT NOT NULL,
    "relation_type" TEXT NOT NULL,
    "label" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "page_links_source_page_id_fkey" FOREIGN KEY ("source_page_id") REFERENCES "pages" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "page_links_target_page_id_fkey" FOREIGN KEY ("target_page_id") REFERENCES "pages" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "worlds_slug_key" ON "worlds"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_world_id_slug_key" ON "campaigns"("world_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "pages_world_id_slug_key" ON "pages"("world_id", "slug");

-- CreateIndex
CREATE INDEX "content_blocks_page_id_sort_order_idx" ON "content_blocks"("page_id", "sort_order");

-- CreateIndex
CREATE INDEX "page_links_source_page_id_idx" ON "page_links"("source_page_id");

-- CreateIndex
CREATE INDEX "page_links_target_page_id_idx" ON "page_links"("target_page_id");
