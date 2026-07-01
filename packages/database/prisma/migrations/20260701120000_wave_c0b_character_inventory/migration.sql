-- Wave C0b: Character sheet, spells, party treasury, inventory (foundations for C6/C7)

CREATE TABLE "characters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "page_id" TEXT,
    "owner_user_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "display_name" TEXT NOT NULL,
    "rules_edition" TEXT NOT NULL DEFAULT 'dnd5e_2024',
    "level" INTEGER NOT NULL DEFAULT 1,
    "abilities" JSONB NOT NULL,
    "skills" JSONB,
    "combat" JSONB,
    "spellcasting" JSONB,
    "classes" JSONB,
    "species" JSONB,
    "background" JSONB,
    "features" JSONB,
    "bio" JSONB,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "characters_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "characters_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "characters_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "characters_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "characters_page_id_key" ON "characters"("page_id");
CREATE INDEX "characters_world_id_owner_user_id_idx" ON "characters"("world_id", "owner_user_id");

CREATE TABLE "character_spells" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "character_id" TEXT NOT NULL,
    "spell_key" TEXT NOT NULL,
    "spell_level" INTEGER NOT NULL DEFAULT 0,
    "prepared" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "character_spells_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "character_spells_character_id_spell_key_key" ON "character_spells"("character_id", "spell_key");
CREATE INDEX "character_spells_character_id_idx" ON "character_spells"("character_id");

CREATE TABLE "party_treasuries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Gruppenschatz',
    "currencies" JSONB NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "party_treasuries_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "party_treasuries_world_id_key" ON "party_treasuries"("world_id");

CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "character_id" TEXT,
    "treasury_id" TEXT,
    "page_id" TEXT,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "weight" REAL,
    "value" JSONB,
    "properties" JSONB,
    "notes" TEXT NOT NULL DEFAULT '',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "inventory_items_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventory_items_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventory_items_treasury_id_fkey" FOREIGN KEY ("treasury_id") REFERENCES "party_treasuries" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventory_items_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "inventory_items_world_id_idx" ON "inventory_items"("world_id");
CREATE INDEX "inventory_items_character_id_idx" ON "inventory_items"("character_id");
CREATE INDEX "inventory_items_treasury_id_idx" ON "inventory_items"("treasury_id");
