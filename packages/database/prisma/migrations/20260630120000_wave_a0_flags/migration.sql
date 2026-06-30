-- Wave A0: player-visible session schedule, voice memo capture type, sandbox worlds

-- AlterTable
ALTER TABLE "worlds" ADD COLUMN "is_sandbox" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "game_sessions" ADD COLUMN "player_visible_schedule" BOOLEAN NOT NULL DEFAULT false;

-- CaptureType enum extension (SQLite stores as TEXT; no ALTER needed for existing rows)
-- voice_memo is accepted on new capture_entries.capture_type values.
