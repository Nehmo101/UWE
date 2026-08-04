-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_shopping_list_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "list_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "amount" REAL,
    "unit" TEXT NOT NULL DEFAULT 'freeform',
    "unit_label" TEXT,
    "category" TEXT NOT NULL DEFAULT 'other',
    "trip" TEXT NOT NULL DEFAULT 'main',
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "source_recipe_ids" JSONB,
    "sort_index" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "shopping_list_items_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "shopping_lists" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_shopping_list_items" ("amount", "category", "checked", "id", "list_id", "name", "normalized_name", "recurring", "sort_index", "source_recipe_ids", "unit", "unit_label") SELECT "amount", "category", "checked", "id", "list_id", "name", "normalized_name", "recurring", "sort_index", "source_recipe_ids", "unit", "unit_label" FROM "shopping_list_items";
DROP TABLE "shopping_list_items";
ALTER TABLE "new_shopping_list_items" RENAME TO "shopping_list_items";
CREATE INDEX "shopping_list_items_list_id_category_idx" ON "shopping_list_items"("list_id", "category");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
