-- Sessions gehoeren einer Tischrunde.
--
-- Befund aus dem Portal: Spieler sahen die Spieltermine und Recaps *aller*
-- Runden derselben Welt. Die Welt-Zuordnung sagt aber nur, WAS jemand lesen
-- darf — nicht, an welchem Tisch er sitzt. Genau dafuer gibt es seit
-- 20260806100000 die Spielergruppe, und sie ist ab hier auch fuer Sessions
-- fuehrend: die Zuordnung im Studio entscheidet, wer einen Abend sieht.
--
-- Vorgabe NULL, und anders als bei den Quests ist das hier die richtige
-- Vorgabe: eine Session ohne Runde ist die welt-weite Session — dieselbe
-- Lesart wie beim Gruppenschatz (`party_treasuries.group_id IS NULL`). Welten
-- ohne Gruppen merken von dieser Migration nichts, ihre Bestands-Sessions
-- bleiben fuer alle sichtbar. Sobald eine Runde eingetragen ist, sehen den
-- Abend nur deren Mitglieder — und wer in keiner Runde sitzt, sieht ihn nicht.
--
-- ON DELETE SET NULL: loest der Spielleiter eine Runde auf, verschwindet nicht
-- ihre Spielgeschichte. Die Sessions fallen auf die welt-weite Sicht zurueck.
ALTER TABLE "game_sessions" ADD COLUMN "group_id" TEXT REFERENCES "player_groups" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "game_sessions_group_id_idx" ON "game_sessions"("group_id");
