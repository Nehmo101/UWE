-- Wave C0c: Quest lifecycle status on pages + structured statblocks

ALTER TABLE "pages" ADD COLUMN "quest_status" TEXT;

CREATE TABLE "structured_statblocks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "rules_edition" TEXT NOT NULL DEFAULT 'dnd5e_2024',
    "data" JSONB NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "structured_statblocks_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "structured_statblocks_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "structured_statblocks_page_id_key" ON "structured_statblocks"("page_id");
CREATE INDEX "structured_statblocks_world_id_idx" ON "structured_statblocks"("world_id");
