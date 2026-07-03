-- CreateEnum
CREATE TYPE "SessionLiveEntryKind" AS ENUM ('note', 'loot', 'quest_update', 'npc_update', 'initiative', 'bookmark');

-- CreateEnum
CREATE TYPE "RecipeStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "IngredientUnit" AS ENUM ('gram', 'milliliter', 'piece', 'tbsp', 'tsp', 'pinch', 'bunch', 'pack', 'freeform');

-- CreateEnum
CREATE TYPE "ShoppingCategory" AS ENUM ('produce', 'chilled', 'frozen', 'dry', 'drugstore', 'household', 'other');

-- AlterEnum
ALTER TYPE "EntityTagEntityType" ADD VALUE 'recipe';

-- CreateTable
CREATE TABLE "session_live_entries" (
    "id" TEXT NOT NULL,
    "game_session_id" TEXT NOT NULL,
    "kind" "SessionLiveEntryKind" NOT NULL DEFAULT 'note',
    "content" TEXT NOT NULL DEFAULT '',
    "ref_page_id" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_live_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_live_entries_game_session_id_created_at_idx" ON "session_live_entries"("game_session_id", "created_at");

-- CreateTable
CREATE TABLE "recipes" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "RecipeStatus" NOT NULL DEFAULT 'active',
    "description" TEXT NOT NULL DEFAULT '',
    "servings_base" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "duration_minutes" INTEGER,
    "effort_rating" INTEGER,
    "taste_rating" INTEGER,
    "kid_rating" INTEGER,
    "partner_rating" INTEGER,
    "steps" JSONB NOT NULL,
    "variants" JSONB,
    "image_storage_key" TEXT,
    "source_url" TEXT,
    "source_scan_id" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recipes_status_idx" ON "recipes"("status");

-- CreateTable
CREATE TABLE "recipe_ingredients" (
    "id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "unit" "IngredientUnit" NOT NULL DEFAULT 'freeform',
    "unit_label" TEXT,
    "category" "ShoppingCategory" NOT NULL DEFAULT 'other',
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "sort_index" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recipe_ingredients_recipe_id_idx" ON "recipe_ingredients"("recipe_id");

-- CreateIndex
CREATE INDEX "recipe_ingredients_normalized_name_idx" ON "recipe_ingredients"("normalized_name");

-- AddForeignKey
ALTER TABLE "session_live_entries" ADD CONSTRAINT "session_live_entries_game_session_id_fkey" FOREIGN KEY ("game_session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
