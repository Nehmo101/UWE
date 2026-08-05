-- Gegenstueck zur SQLite-Migration gleichen Namens; dieselbe Begruendung dort.
--
-- Unterschiede zur SQLite-Fassung sind nur handwerklich: PostgreSQL kennt
-- echte ENUM-Typen (Notiz-Kategorie), TIMESTAMP(3) statt DATETIME und
-- nachtraeglich anbringbare Fremdschluessel.

-- CreateEnum
CREATE TYPE "PlayerNoteCategory" AS ENUM ('session', 'npc', 'ort', 'quest', 'beute', 'idee', 'sonstiges');

-- CreateTable
CREATE TABLE "player_groups" (
    "id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_groups_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "player_groups_world_id_slug_key" ON "player_groups"("world_id", "slug");
CREATE INDEX "player_groups_world_id_idx" ON "player_groups"("world_id");
CREATE INDEX "player_groups_campaign_id_idx" ON "player_groups"("campaign_id");

ALTER TABLE "player_groups" ADD CONSTRAINT "player_groups_world_id_fkey"
  FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "player_groups" ADD CONSTRAINT "player_groups_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "player_group_members" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_group_members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "player_group_members_group_id_user_id_key" ON "player_group_members"("group_id", "user_id");
CREATE INDEX "player_group_members_user_id_idx" ON "player_group_members"("user_id");

ALTER TABLE "player_group_members" ADD CONSTRAINT "player_group_members_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "player_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "player_group_members" ADD CONSTRAINT "player_group_members_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Quests gehoeren einer Tischrunde.
ALTER TABLE "pages" ADD COLUMN "quest_group_id" TEXT;
CREATE INDEX "pages_quest_group_id_idx" ON "pages"("quest_group_id");
ALTER TABLE "pages" ADD CONSTRAINT "pages_quest_group_id_fkey"
  FOREIGN KEY ("quest_group_id") REFERENCES "player_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Gruppenschatz je Tischrunde.
ALTER TABLE "party_treasuries" ADD COLUMN "group_id" TEXT;
DROP INDEX IF EXISTS "party_treasuries_world_id_key";
CREATE UNIQUE INDEX "party_treasuries_group_id_key" ON "party_treasuries"("group_id");
CREATE UNIQUE INDEX "party_treasuries_world_id_group_id_key" ON "party_treasuries"("world_id", "group_id");
CREATE INDEX "party_treasuries_world_id_idx" ON "party_treasuries"("world_id");
ALTER TABLE "party_treasuries" ADD CONSTRAINT "party_treasuries_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "player_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Spielernotizen werden ein Logbuch.
ALTER TABLE "player_notes" ADD COLUMN "title" TEXT;
ALTER TABLE "player_notes" ADD COLUMN "category" "PlayerNoteCategory" NOT NULL DEFAULT 'sonstiges';
ALTER TABLE "player_notes" ADD COLUMN "session_date" TIMESTAMP(3);
CREATE INDEX "player_notes_world_id_session_date_idx" ON "player_notes"("world_id", "session_date");

UPDATE "player_notes"
   SET "session_date" = "game_sessions"."date"
  FROM "game_sessions"
 WHERE "game_sessions"."id" = "player_notes"."game_session_id";

-- AlterTable: Karten-Sperre.
ALTER TABLE "terra_karten" ADD COLUMN "gesperrt" BOOLEAN NOT NULL DEFAULT false;

-- DropTable: Spielerfragen.
DROP TABLE IF EXISTS "player_questions";
DROP TYPE IF EXISTS "PlayerQuestionStatus";
