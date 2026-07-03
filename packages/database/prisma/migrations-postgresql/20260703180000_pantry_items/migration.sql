-- CreateEnum
CREATE TYPE "PantryLocation" AS ENUM ('pantry', 'fridge', 'freezer', 'spices');

-- CreateTable
CREATE TABLE "pantry_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "location" "PantryLocation" NOT NULL DEFAULT 'pantry',
    "amount" DOUBLE PRECISION,
    "unit" "IngredientUnit" NOT NULL DEFAULT 'freeform',
    "unit_label" TEXT,
    "expires_at" TIMESTAMP(3),
    "low_stock" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pantry_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pantry_items_location_idx" ON "pantry_items"("location");
CREATE INDEX "pantry_items_expires_at_idx" ON "pantry_items"("expires_at");
