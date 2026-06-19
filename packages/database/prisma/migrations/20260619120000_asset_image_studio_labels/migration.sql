-- Asset / Image Studio / Label workflow extensions
-- SQLite: ImageStudioLinkTargetType values are stored as TEXT (no ALTER needed).

-- Workshop / hardware / contract label templates (global system templates)
INSERT INTO "label_templates" ("id", "world_id", "name", "slug", "description", "layout_settings", "is_system", "created_at", "updated_at")
SELECT 'tpl_miniature_box', NULL, 'Miniatur-Kiste', 'miniature-box', 'Kistenlabel für Miniaturen mit QR', '{"mode":"image_text","truncateToPage":true,"truncateLongWords":true,"maxChars":400,"maxWordLength":20,"widthInches":6,"heightInches":4,"showSafeArea":true,"printFriendly":true}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "label_templates" WHERE "id" = 'tpl_miniature_box');

INSERT INTO "label_templates" ("id", "world_id", "name", "slug", "description", "layout_settings", "is_system", "created_at", "updated_at")
SELECT 'tpl_terrain_box', NULL, 'Terrain-Kiste', 'terrain-box', 'Kistenlabel für Terrain-Stücke mit QR', '{"mode":"image_text","truncateToPage":true,"truncateLongWords":true,"maxChars":500,"maxWordLength":22,"widthInches":6,"heightInches":4,"showSafeArea":true,"printFriendly":true}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "label_templates" WHERE "id" = 'tpl_terrain_box');

INSERT INTO "label_templates" ("id", "world_id", "name", "slug", "description", "layout_settings", "is_system", "created_at", "updated_at")
SELECT 'tpl_filament_spool', NULL, 'Filament-Spule', 'filament-spool', '3D-Druck Filament-Label mit Material und Farbe', '{"mode":"text_only","truncateToPage":true,"truncateLongWords":true,"maxChars":300,"maxWordLength":18,"widthInches":4,"heightInches":2,"showSafeArea":true,"printFriendly":true}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "label_templates" WHERE "id" = 'tpl_filament_spool');

INSERT INTO "label_templates" ("id", "world_id", "name", "slug", "description", "layout_settings", "is_system", "created_at", "updated_at")
SELECT 'tpl_3d_print_project', NULL, '3D-Druck Projekt', '3d-print-project', 'Projektlabel für Druckaufträge mit QR', '{"mode":"image_text","truncateToPage":true,"truncateLongWords":true,"maxChars":600,"maxWordLength":22,"widthInches":6,"heightInches":4,"showSafeArea":true,"printFriendly":true}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "label_templates" WHERE "id" = 'tpl_3d_print_project');
