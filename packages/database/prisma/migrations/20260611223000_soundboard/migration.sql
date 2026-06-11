-- CreateTable
CREATE TABLE "soundboard_buttons" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "title" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_url" TEXT,
    "asset_id" TEXT,
    "thumbnail" TEXT,
    "volume" REAL NOT NULL DEFAULT 1.0,
    "loop" BOOLEAN NOT NULL DEFAULT false,
    "tags" JSONB,
    "visibility" TEXT NOT NULL DEFAULT 'dm_only',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "soundboard_buttons_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "soundboard_buttons_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "soundboard_buttons_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "soundboard_button_page_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "soundboard_button_id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "soundboard_button_page_links_soundboard_button_id_fkey" FOREIGN KEY ("soundboard_button_id") REFERENCES "soundboard_buttons" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "soundboard_button_page_links_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "soundboard_buttons_world_id_campaign_id_idx" ON "soundboard_buttons"("world_id", "campaign_id");

-- CreateIndex
CREATE INDEX "soundboard_buttons_asset_id_idx" ON "soundboard_buttons"("asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "soundboard_button_page_links_soundboard_button_id_page_id_key" ON "soundboard_button_page_links"("soundboard_button_id", "page_id");

-- CreateIndex
CREATE INDEX "soundboard_button_page_links_page_id_idx" ON "soundboard_button_page_links"("page_id");
