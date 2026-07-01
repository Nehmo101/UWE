-- CreateTable
CREATE TABLE "asset_albums" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "asset_albums_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "asset_album_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "album_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asset_album_items_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "asset_albums" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "asset_album_items_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "asset_albums_world_id_idx" ON "asset_albums"("world_id");

-- CreateIndex
CREATE INDEX "asset_album_items_album_id_sort_order_idx" ON "asset_album_items"("album_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "asset_album_items_album_id_asset_id_key" ON "asset_album_items"("album_id", "asset_id");
