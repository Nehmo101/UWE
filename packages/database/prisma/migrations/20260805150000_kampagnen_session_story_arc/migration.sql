-- Kampagnen-Modul Etappe 2: Session ↔ Kapitel und Akt-Tafel-Pinnen.
--
-- `game_sessions.story_arc_page_id` — welcher Akt/welches Kapitel (Page vom
-- Typ story_arc) in dieser Session gespielt wird. NULLABLE ohne Vorgabewert:
-- Bestands-Sessions bleiben unberuehrt, der DM ordnet bei Bedarf zu; beim
-- Loeschen des Kapitels faellt die Session auf NULL zurueck (SET NULL),
-- nichts stirbt mit.
--
-- `story_arc_entity_links` — explizites Pinnen einer Seite (NSC, Ort,
-- Fraktion, Handout) an ein Kapitel, Muster world_event_entity_links.
-- Ergaenzt die aus [[Wiki-Links]] abgeleiteten Beziehungen der Akt-Tafel um
-- Seiten, die im Text (noch) nicht verlinkt sind. Beide FKs CASCADE: ein
-- Pin ist reine Verknuepfung, er darf mit jeder Seite sterben.
-- `role` ist ein Prisma-Enum (StoryArcEntityRole: npc/location/faction/
-- handout) — SQLite speichert ihn als TEXT ohne Check-Constraint.
-- Gegenstueck: migrations-postgresql/20260805150000_kampagnen_session_story_arc.

-- AlterTable
ALTER TABLE "game_sessions" ADD COLUMN "story_arc_page_id" TEXT REFERENCES "pages" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "game_sessions_story_arc_page_id_idx" ON "game_sessions"("story_arc_page_id");

-- CreateTable
CREATE TABLE "story_arc_entity_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "story_arc_page_id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'npc',
    "sort_index" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "story_arc_entity_links_story_arc_page_id_fkey" FOREIGN KEY ("story_arc_page_id") REFERENCES "pages" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "story_arc_entity_links_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "story_arc_entity_links_page_id_idx" ON "story_arc_entity_links"("page_id");

-- CreateIndex
CREATE UNIQUE INDEX "story_arc_entity_links_story_arc_page_id_page_id_role_key" ON "story_arc_entity_links"("story_arc_page_id", "page_id", "role");
