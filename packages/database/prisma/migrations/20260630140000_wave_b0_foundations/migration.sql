-- Wave B0: Tag/EntityTag, CanonicalStatus lifecycle, ContractExpense source, foundation for maintenance settings

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "entity_tags" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tag_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "world_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "entity_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "contract_expenses" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';

-- CreateIndex
CREATE UNIQUE INDEX "tags_key_key" ON "tags"("key");

-- CreateIndex
CREATE UNIQUE INDEX "entity_tags_tag_id_entity_type_entity_id_key" ON "entity_tags"("tag_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "entity_tags_entity_type_entity_id_idx" ON "entity_tags"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "entity_tags_world_id_idx" ON "entity_tags"("world_id");

-- CanonicalStatus enum extension (SQLite TEXT): prepared, played, discarded accepted on new rows.
