-- AlterTable: add print_status to labels
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_labels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "title" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT,
    "template_id" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "layout_settings" JSONB NOT NULL,
    "print_status" TEXT NOT NULL DEFAULT 'open',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "labels_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "labels_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "labels_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "label_templates" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_labels" ("id", "world_id", "campaign_id", "title", "source_type", "source_id", "template_id", "content", "layout_settings", "print_status", "created_at", "updated_at")
SELECT "id", "world_id", "campaign_id", "title", "source_type", "source_id", "template_id", "content", "layout_settings", 'open', "created_at", "updated_at" FROM "labels";
DROP TABLE "labels";
ALTER TABLE "new_labels" RENAME TO "labels";
CREATE INDEX "labels_world_id_updated_at_idx" ON "labels"("world_id", "updated_at");
CREATE INDEX "labels_source_type_source_id_idx" ON "labels"("source_type", "source_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateTable
CREATE TABLE "print_lists" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "for_next_session" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "print_lists_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "print_lists_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "print_list_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "print_list_id" TEXT NOT NULL,
    "label_id" TEXT NOT NULL,
    "copies" INTEGER NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "print_list_items_print_list_id_fkey" FOREIGN KEY ("print_list_id") REFERENCES "print_lists" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "print_list_items_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "labels" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "print_lists_world_id_updated_at_idx" ON "print_lists"("world_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "print_list_items_print_list_id_label_id_key" ON "print_list_items"("print_list_id", "label_id");

-- CreateIndex
CREATE INDEX "print_list_items_print_list_id_sort_order_idx" ON "print_list_items"("print_list_id", "sort_order");
