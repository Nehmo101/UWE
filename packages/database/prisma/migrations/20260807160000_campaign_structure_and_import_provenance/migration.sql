-- Kampagnenstruktur explizit machen, ohne die bestehende Wiki-Hierarchie zu
-- brechen. parent_page_id bleibt Navigation; quest_story_arc_id ist die
-- fachliche Quest-Zuordnung.
ALTER TABLE "pages" ADD COLUMN "quest_story_arc_id" TEXT REFERENCES "pages" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "pages_quest_story_arc_id_idx" ON "pages"("quest_story_arc_id");

UPDATE "pages"
SET "quest_story_arc_id" = "parent_page_id"
WHERE "type" = 'quest'
  AND "parent_page_id" IN (SELECT "id" FROM "pages" WHERE "type" = 'story_arc');

-- Dungeon als Domänenobjekt. Die root_page_id verweist auf den weiterhin für
-- Wiki, Cockpit und Inhalte führenden Page-Baum.
CREATE TABLE "dungeons" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "root_page_id" TEXT NOT NULL,
    "story_arc_page_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "prep_status" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "dungeons_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "dungeons_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "dungeons_root_page_id_fkey" FOREIGN KEY ("root_page_id") REFERENCES "pages" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "dungeons_story_arc_page_id_fkey" FOREIGN KEY ("story_arc_page_id") REFERENCES "pages" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "dungeons_root_page_id_key" ON "dungeons"("root_page_id");
CREATE UNIQUE INDEX "dungeons_world_id_slug_key" ON "dungeons"("world_id", "slug");
CREATE INDEX "dungeons_campaign_id_idx" ON "dungeons"("campaign_id");
CREATE INDEX "dungeons_story_arc_page_id_idx" ON "dungeons"("story_arc_page_id");

INSERT INTO "dungeons" (
  "id", "world_id", "campaign_id", "root_page_id", "story_arc_page_id",
  "name", "slug", "prep_status", "created_at", "updated_at"
)
SELECT
  'migrated-dungeon-' || p."id", p."world_id", p."campaign_id", p."id",
  CASE WHEN parent."type" = 'story_arc' THEN parent."id" ELSE NULL END,
  p."title", p."slug", p."prep_status", p."created_at", p."updated_at"
FROM "pages" p
LEFT JOIN "pages" parent ON parent."id" = p."parent_page_id"
WHERE p."type" = 'dungeon';

-- Eine Session darf mehrere fachlich typisierte Fokusse tragen. is_current
-- wird vom Service auf höchstens einen Datensatz pro Session begrenzt.
CREATE TABLE "game_session_focuses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "game_session_id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'reference',
    "sort_index" INTEGER NOT NULL DEFAULT 0,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "game_session_focuses_game_session_id_fkey" FOREIGN KEY ("game_session_id") REFERENCES "game_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "game_session_focuses_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "game_session_focuses_game_session_id_page_id_role_key" ON "game_session_focuses"("game_session_id", "page_id", "role");
CREATE INDEX "game_session_focuses_game_session_id_is_current_idx" ON "game_session_focuses"("game_session_id", "is_current");
CREATE INDEX "game_session_focuses_page_id_idx" ON "game_session_focuses"("page_id");

INSERT OR IGNORE INTO "game_session_focuses" (
  "id", "game_session_id", "page_id", "role", "sort_index", "is_current"
)
SELECT 'legacy-chapter-' || "id", "id", "story_arc_page_id", 'chapter', 0, true
FROM "game_sessions"
WHERE "story_arc_page_id" IS NOT NULL;

INSERT OR IGNORE INTO "game_session_focuses" (
  "id", "game_session_id", "page_id", "role", "sort_index", "is_current"
)
SELECT
  'legacy-link-' || l."id", l."game_session_id", l."page_id",
  CASE p."type"
    WHEN 'story_arc' THEN 'chapter'
    WHEN 'dungeon' THEN 'dungeon'
    WHEN 'room' THEN 'room'
    WHEN 'quest' THEN 'quest'
    ELSE 'reference'
  END,
  1, false
FROM "game_session_page_links" l
JOIN "pages" p ON p."id" = l."page_id";

-- Versionierte, überprüfbare Importherkunft. Bindings unterscheiden eigene
-- Importseiten von Ergänzungen bestehender Kanonseiten.
CREATE TABLE "doc_import_sources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "source_path" TEXT NOT NULL,
    "repository" TEXT,
    "source_revision" TEXT,
    "content_hash" TEXT NOT NULL,
    "imported_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "doc_import_sources_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "doc_import_sources_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "doc_import_sources_world_id_source_path_key" ON "doc_import_sources"("world_id", "source_path");
CREATE INDEX "doc_import_sources_campaign_id_idx" ON "doc_import_sources"("campaign_id");

CREATE TABLE "doc_import_page_bindings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source_id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "source_key" TEXT NOT NULL,
    "source_hash" TEXT NOT NULL,
    "owned_page" BOOLEAN NOT NULL DEFAULT false,
    "last_revision" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "doc_import_page_bindings_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "doc_import_sources" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "doc_import_page_bindings_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "doc_import_page_bindings_source_id_source_key_key" ON "doc_import_page_bindings"("source_id", "source_key");
CREATE INDEX "doc_import_page_bindings_page_id_idx" ON "doc_import_page_bindings"("page_id");
