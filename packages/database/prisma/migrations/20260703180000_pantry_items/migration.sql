-- CreateTable
CREATE TABLE "pantry_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT 'pantry',
    "amount" REAL,
    "unit" TEXT NOT NULL DEFAULT 'freeform',
    "unit_label" TEXT,
    "expires_at" DATETIME,
    "low_stock" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "pantry_items_location_idx" ON "pantry_items"("location");
CREATE INDEX "pantry_items_expires_at_idx" ON "pantry_items"("expires_at");
