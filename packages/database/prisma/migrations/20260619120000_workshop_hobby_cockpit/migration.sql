-- Workshop hobby cockpit: paint recipes, print profiles, terrain rental, result photos

ALTER TABLE "workshop_projects" ADD COLUMN "result_photos" JSONB;

CREATE TABLE "workshop_paint_recipes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "target_type" TEXT NOT NULL DEFAULT 'other',
    "primer" TEXT NOT NULL DEFAULT '',
    "basecoat" TEXT NOT NULL DEFAULT '',
    "wash" TEXT NOT NULL DEFAULT '',
    "highlights" TEXT NOT NULL DEFAULT '',
    "colors_used" JSONB,
    "result_photo_url" TEXT,
    "rating" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "workshop_project_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "workshop_paint_recipes_workshop_project_id_fkey" FOREIGN KEY ("workshop_project_id") REFERENCES "workshop_projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "workshop_paint_recipes_target_type_idx" ON "workshop_paint_recipes"("target_type");
CREATE INDEX "workshop_paint_recipes_workshop_project_id_idx" ON "workshop_paint_recipes"("workshop_project_id");

CREATE TABLE "workshop_print_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT '',
    "printer" TEXT NOT NULL DEFAULT '',
    "nozzle" TEXT NOT NULL DEFAULT '',
    "filament" TEXT NOT NULL DEFAULT '',
    "layer_height" TEXT NOT NULL DEFAULT '',
    "supports" TEXT NOT NULL DEFAULT '',
    "result" TEXT NOT NULL DEFAULT '',
    "errors" TEXT NOT NULL DEFAULT '',
    "improvements" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "workshop_project_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "workshop_print_profiles_workshop_project_id_fkey" FOREIGN KEY ("workshop_project_id") REFERENCES "workshop_projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "workshop_print_profiles_workshop_project_id_idx" ON "workshop_print_profiles"("workshop_project_id");

CREATE TABLE "workshop_terrain_rentals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "terrain_set_name" TEXT NOT NULL,
    "box_label" TEXT NOT NULL DEFAULT '',
    "replacement_value_cents" INTEGER,
    "rental_price_cents" INTEGER,
    "deposit_cents" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'available',
    "damages" TEXT NOT NULL DEFAULT '',
    "handover_checklist" JSONB,
    "return_checklist" JSONB,
    "notes" TEXT NOT NULL DEFAULT '',
    "workshop_project_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "workshop_terrain_rentals_workshop_project_id_fkey" FOREIGN KEY ("workshop_project_id") REFERENCES "workshop_projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "workshop_terrain_rentals_status_idx" ON "workshop_terrain_rentals"("status");
CREATE INDEX "workshop_terrain_rentals_workshop_project_id_idx" ON "workshop_terrain_rentals"("workshop_project_id");
