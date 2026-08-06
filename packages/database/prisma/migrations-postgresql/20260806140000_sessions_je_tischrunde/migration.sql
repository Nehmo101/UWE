-- Gegenstueck zur SQLite-Migration gleichen Namens; dieselbe Begruendung dort.
--
-- Unterschied nur handwerklich: PostgreSQL bringt den Fremdschluessel
-- nachtraeglich als CONSTRAINT an.
ALTER TABLE "game_sessions" ADD COLUMN "group_id" TEXT;
CREATE INDEX "game_sessions_group_id_idx" ON "game_sessions"("group_id");

ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "player_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
