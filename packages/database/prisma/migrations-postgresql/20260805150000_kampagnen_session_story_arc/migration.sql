-- Kampagnen-Modul Etappe 2: Session ↔ Kapitel und Akt-Tafel-Pinnen (PostgreSQL).
--
-- `game_sessions.story_arc_page_id` — Kapitel der Session, NULLABLE, SET NULL.
-- `story_arc_entity_links`          — Pinnen einer Seite an ein Kapitel
--                                     (Muster: world_event_entity_links).
-- Gegenstueck: migrations/20260805150000_kampagnen_session_story_arc.

-- CreateEnum
CREATE TYPE "StoryArcEntityRole" AS ENUM ('npc', 'location', 'faction', 'handout');

-- AlterTable
ALTER TABLE "game_sessions" ADD COLUMN "story_arc_page_id" TEXT;

-- CreateIndex
CREATE INDEX "game_sessions_story_arc_page_id_idx" ON "game_sessions"("story_arc_page_id");

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_story_arc_page_id_fkey" FOREIGN KEY ("story_arc_page_id") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "story_arc_entity_links" (
    "id" TEXT NOT NULL,
    "story_arc_page_id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "role" "StoryArcEntityRole" NOT NULL DEFAULT 'npc',
    "sort_index" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_arc_entity_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "story_arc_entity_links_page_id_idx" ON "story_arc_entity_links"("page_id");

-- CreateIndex
CREATE UNIQUE INDEX "story_arc_entity_links_story_arc_page_id_page_id_role_key" ON "story_arc_entity_links"("story_arc_page_id", "page_id", "role");

-- AddForeignKey
ALTER TABLE "story_arc_entity_links" ADD CONSTRAINT "story_arc_entity_links_story_arc_page_id_fkey" FOREIGN KEY ("story_arc_page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_arc_entity_links" ADD CONSTRAINT "story_arc_entity_links_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
