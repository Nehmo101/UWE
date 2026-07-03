-- CreateEnum
CREATE TYPE "MealSlot" AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');

-- CreateEnum
CREATE TYPE "MealEntryType" AS ENUM ('recipe', 'leftovers', 'eating_out', 'routine', 'note');

-- CreateTable
CREATE TABLE "meal_plan_weeks" (
    "id" TEXT NOT NULL,
    "iso_year" INTEGER NOT NULL,
    "iso_week" INTEGER NOT NULL,
    "household_factor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "goals" JSONB,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "meal_plan_weeks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meal_plan_weeks_iso_year_iso_week_key" ON "meal_plan_weeks"("iso_year", "iso_week");

-- CreateTable
CREATE TABLE "meal_plan_entries" (
    "id" TEXT NOT NULL,
    "week_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "slot" "MealSlot" NOT NULL,
    "entry_type" "MealEntryType" NOT NULL DEFAULT 'recipe',
    "recipe_id" TEXT,
    "servings" DOUBLE PRECISION,
    "note" TEXT NOT NULL DEFAULT '',
    "cooked" BOOLEAN NOT NULL DEFAULT false,
    "sort_index" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "meal_plan_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meal_plan_entries_week_id_date_idx" ON "meal_plan_entries"("week_id", "date");

-- CreateTable
CREATE TABLE "shopping_lists" (
    "id" TEXT NOT NULL,
    "week_id" TEXT,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shopping_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_list_items" (
    "id" TEXT NOT NULL,
    "list_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "unit" "IngredientUnit" NOT NULL DEFAULT 'freeform',
    "unit_label" TEXT,
    "category" "ShoppingCategory" NOT NULL DEFAULT 'other',
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "source_recipe_ids" JSONB,
    "sort_index" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "shopping_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shopping_list_items_list_id_category_idx" ON "shopping_list_items"("list_id", "category");

-- AddForeignKey
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_week_id_fkey" FOREIGN KEY ("week_id") REFERENCES "meal_plan_weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_plan_entries" ADD CONSTRAINT "meal_plan_entries_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "shopping_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
