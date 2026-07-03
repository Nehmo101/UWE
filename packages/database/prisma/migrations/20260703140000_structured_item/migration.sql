-- CreateTable
CREATE TABLE "structured_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "structured_items_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "structured_items_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "structured_items_page_id_key" ON "structured_items"("page_id");

-- CreateIndex
CREATE INDEX "structured_items_world_id_idx" ON "structured_items"("world_id");
