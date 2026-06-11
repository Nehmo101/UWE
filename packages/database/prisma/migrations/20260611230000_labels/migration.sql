-- CreateTable
CREATE TABLE "label_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "layout_settings" JSONB NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "label_templates_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "labels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "title" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT,
    "template_id" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "layout_settings" JSONB NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "labels_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "labels_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "labels_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "label_templates" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "label_templates_world_id_slug_key" ON "label_templates"("world_id", "slug");

-- CreateIndex
CREATE INDEX "labels_world_id_updated_at_idx" ON "labels"("world_id", "updated_at");

-- CreateIndex
CREATE INDEX "labels_source_type_source_id_idx" ON "labels"("source_type", "source_id");

-- Seed system label templates (world_id NULL = global)
INSERT INTO "label_templates" ("id", "world_id", "name", "slug", "description", "layout_settings", "is_system", "created_at", "updated_at")
VALUES
  ('tpl_standard_6x4', NULL, 'Standard 6×4', 'standard-6x4', 'Bild und Text auf 6×4 Zoll', '{"mode":"image_text","truncateToPage":true,"truncateLongWords":true,"maxChars":800,"maxWordLength":24,"widthInches":6,"heightInches":4}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tpl_text_only', NULL, 'Nur Text', 'text-only', 'Kompaktes Text-Label ohne Bild', '{"mode":"text_only","truncateToPage":true,"truncateLongWords":true,"maxChars":1200,"maxWordLength":24,"widthInches":6,"heightInches":4}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tpl_image_only', NULL, 'Nur Bild', 'image-only', 'Vollflächiges Bild-Label', '{"mode":"image_only","truncateToPage":false,"truncateLongWords":false,"widthInches":6,"heightInches":4}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tpl_handout_compact', NULL, 'Handout Kompakt', 'handout-compact', 'Kurzes Spieler-Handout', '{"mode":"text_only","truncateToPage":true,"truncateLongWords":true,"maxChars":500,"maxWordLength":18,"widthInches":6,"heightInches":4}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
