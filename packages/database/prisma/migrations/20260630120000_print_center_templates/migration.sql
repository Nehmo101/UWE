-- Print Center: NPC and Item card templates (6×4)
INSERT INTO "label_templates" ("id", "world_id", "name", "slug", "description", "layout_settings", "is_system", "created_at", "updated_at")
SELECT 'tpl_npc_card_6x4', NULL, 'NPC-Karte 6×4', 'npc-card-6x4', 'Kompakte NPC-Referenzkarte mit Name, Rolle und Stichpunkten', '{"mode":"text_only","truncateToPage":true,"truncateLongWords":true,"maxChars":650,"maxWordLength":22,"widthInches":6,"heightInches":4,"printFriendly":true}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "label_templates" WHERE "slug" = 'npc-card-6x4' AND "world_id" IS NULL);

INSERT INTO "label_templates" ("id", "world_id", "name", "slug", "description", "layout_settings", "is_system", "created_at", "updated_at")
SELECT 'tpl_item_card_6x4', NULL, 'Item-Karte 6×4', 'item-card-6x4', 'Magic-Item-/Loot-Karte mit Name, Seltenheit und Effekt', '{"mode":"text_only","truncateToPage":true,"truncateLongWords":true,"maxChars":600,"maxWordLength":20,"widthInches":6,"heightInches":4,"printFriendly":true}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "label_templates" WHERE "slug" = 'item-card-6x4' AND "world_id" IS NULL);
