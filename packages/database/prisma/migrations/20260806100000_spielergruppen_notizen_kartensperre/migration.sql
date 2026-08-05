-- Spielergruppen, Gruppenschatz je Gruppe, Quest-Zuordnung, Notiz-Ausbau,
-- Karten-Sperre — und das Ende der Spielerfragen.
--
-- Der rote Faden: das Portal bekommt Dinge, die einer Tischrunde gehoeren.
-- Bisher gab es genau eine Ebene — die Welt. Wer der Welt zugeordnet war, sah
-- denselben Schatz und dasselbe Questlog wie alle anderen. Die Gruppe zieht
-- eine zweite Ebene darunter, ohne ein fuenftes Haekchen zu erfinden: Lesen
-- bleibt Welt-Sache, Besitzen wird Gruppen-Sache.

-- CreateTable
CREATE TABLE "player_groups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "player_groups_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "player_groups_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "player_groups_world_id_slug_key" ON "player_groups"("world_id", "slug");
CREATE INDEX "player_groups_world_id_idx" ON "player_groups"("world_id");
CREATE INDEX "player_groups_campaign_id_idx" ON "player_groups"("campaign_id");

-- CreateTable
-- ON DELETE CASCADE auf beiden Seiten: verschwindet die Gruppe oder das Konto,
-- ist die Mitgliedschaft gegenstandslos. Der Gruppenschatz haengt an der
-- Gruppe, nicht an der Mitgliedschaft, und ueberlebt einen Personalwechsel.
CREATE TABLE "player_group_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "player_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "player_groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "player_group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "player_group_members_group_id_user_id_key" ON "player_group_members"("group_id", "user_id");
CREATE INDEX "player_group_members_user_id_idx" ON "player_group_members"("user_id");

-- AlterTable: Quests gehoeren einer Tischrunde.
--
-- Vorgabe NULL, und das ist die einzige richtige Vorgabe: Bestandsquests sind
-- niemandem zugeordnet, und genau deshalb verschwinden sie aus dem Portal-
-- Questlog, bis der Spielleiter sie im Kampagnen-Radar vergibt. Das ist die
-- gewuenschte Richtung — das Questlog soll ab jetzt zeigen, was die eigene
-- Runde angeht, nicht alles. Im Studio bleibt jede Quest sichtbar.
ALTER TABLE "pages" ADD COLUMN "quest_group_id" TEXT REFERENCES "player_groups" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "pages_quest_group_id_idx" ON "pages"("quest_group_id");

-- AlterTable: Gruppenschatz je Tischrunde.
--
-- Der welt-weite Schatz (group_id IS NULL) bleibt bestehen; Welten ohne
-- Gruppen merken von dieser Runde nichts. Die alte UNIQUE-Regel auf world_id
-- muss weichen, sonst passt kein zweiter Schatz in dieselbe Welt.
ALTER TABLE "party_treasuries" ADD COLUMN "group_id" TEXT REFERENCES "player_groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
DROP INDEX IF EXISTS "party_treasuries_world_id_key";
CREATE UNIQUE INDEX "party_treasuries_group_id_key" ON "party_treasuries"("group_id");
CREATE UNIQUE INDEX "party_treasuries_world_id_group_id_key" ON "party_treasuries"("world_id", "group_id");
CREATE INDEX "party_treasuries_world_id_idx" ON "party_treasuries"("world_id");

-- AlterTable: Spielernotizen werden ein Logbuch.
--
-- `session_date` ist bewusst nicht `created_at`. Wer den Abend erst am
-- naechsten Tag nachtraegt, will die Notiz unter dem Spielabend sehen.
ALTER TABLE "player_notes" ADD COLUMN "title" TEXT;
ALTER TABLE "player_notes" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'sonstiges';
ALTER TABLE "player_notes" ADD COLUMN "session_date" DATETIME;
CREATE INDEX "player_notes_world_id_session_date_idx" ON "player_notes"("world_id", "session_date");

-- Bestandsnotizen, die an einer Session haengen, erben deren Datum. Alles
-- andere bleibt leer und sortiert sich unter „ohne Spielabend".
UPDATE "player_notes"
   SET "session_date" = (
     SELECT "game_sessions"."date"
       FROM "game_sessions"
      WHERE "game_sessions"."id" = "player_notes"."game_session_id"
   )
 WHERE "game_session_id" IS NOT NULL;

-- AlterTable: Karten-Sperre.
--
-- Vorgabe false — keine Bestandskarte wird durch diese Runde stillgelegt.
ALTER TABLE "terra_karten" ADD COLUMN "gesperrt" BOOLEAN NOT NULL DEFAULT false;

-- DropTable: Spielerfragen.
--
-- „Fragen an den DM" wird ersatzlos entfernt. Der Weg dafuer sind ab jetzt die
-- Spielernotizen mit Sichtbarkeit `dm_only` — dieselbe Zustellung, ein
-- Formular weniger.
DROP TABLE IF EXISTS "player_questions";
