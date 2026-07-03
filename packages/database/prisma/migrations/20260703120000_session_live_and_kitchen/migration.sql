-- CreateTable
CREATE TABLE "session_live_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "game_session_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'note',
    "content" TEXT NOT NULL DEFAULT '',
    "ref_page_id" TEXT,
    "payload" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "session_live_entries_game_session_id_fkey" FOREIGN KEY ("game_session_id") REFERENCES "game_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "session_live_entries_game_session_id_created_at_idx" ON "session_live_entries"("game_session_id", "created_at");

-- CreateTable
CREATE TABLE "recipes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "description" TEXT NOT NULL DEFAULT '',
    "servings_base" REAL NOT NULL DEFAULT 2,
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
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "recipes_status_idx" ON "recipes"("status");

-- CreateTable
CREATE TABLE "recipe_ingredients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipe_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "amount" REAL,
    "unit" TEXT NOT NULL DEFAULT 'freeform',
    "unit_label" TEXT,
    "category" TEXT NOT NULL DEFAULT 'other',
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "sort_index" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "recipe_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "recipe_ingredients_recipe_id_idx" ON "recipe_ingredients"("recipe_id");

-- CreateIndex
CREATE INDEX "recipe_ingredients_normalized_name_idx" ON "recipe_ingredients"("normalized_name");
