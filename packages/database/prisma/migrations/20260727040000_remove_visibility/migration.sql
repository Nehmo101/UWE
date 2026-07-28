-- Visibility removed.
--
-- Notiz Lasse: „Das ganze nur dm sichtbar nur spieler sichtbar soll bitte
-- entfernt werden. Ein spieler darf alles wissen einer welt sehen in der er
-- zugeordnet ist."
--
-- With that, world membership is the only access rule inside a world. Every
-- per-item gate below has nothing left to hold back:
--   * `visibility` on pages, blocks, assets, world events, soundboard buttons
--   * `default_visibility` on page templates
--   * `visibility` on brain documents and brain facts
--   * the `gm_note` block type (a dm_only block by definition)
--   * `page_player_access` (the `specific_players` grant table)
--   * `session_unlocks` (the `unlock_after_session` grant table)
--
-- Player notes keep their own `visibility` column: that is the note author's
-- own sharing choice (private / dm_only / party), not a gate on world content.

-- gm_note blocks were dm_only by definition and have no successor type.
DELETE FROM "content_blocks" WHERE "type" = 'gm_note';

ALTER TABLE "pages" DROP COLUMN "visibility";
ALTER TABLE "content_blocks" DROP COLUMN "visibility";
ALTER TABLE "assets" DROP COLUMN "visibility";
ALTER TABLE "world_events" DROP COLUMN "visibility";
ALTER TABLE "soundboard_buttons" DROP COLUMN "visibility";
ALTER TABLE "page_templates" DROP COLUMN "default_visibility";
-- SQLite refuses DROP COLUMN while an index still references the column.
DROP INDEX "brain_documents_world_id_visibility_idx";
DROP INDEX "brain_facts_world_id_visibility_idx";
ALTER TABLE "brain_documents" DROP COLUMN "visibility";
ALTER TABLE "brain_facts" DROP COLUMN "visibility";

DROP TABLE "page_player_access";
DROP TABLE "session_unlocks";
