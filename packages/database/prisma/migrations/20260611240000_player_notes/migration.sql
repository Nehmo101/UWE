-- Player notes and comments for Portal / Studio review workflow

ALTER TABLE "worlds" ADD COLUMN "guest_comments_enabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "player_notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "page_id" TEXT,
    "game_session_id" TEXT,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "player_notes_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "player_notes_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "player_notes_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "player_notes_game_session_id_fkey" FOREIGN KEY ("game_session_id") REFERENCES "game_sessions" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "player_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "player_notes_world_id_status_idx" ON "player_notes"("world_id", "status");
CREATE INDEX "player_notes_world_id_campaign_id_idx" ON "player_notes"("world_id", "campaign_id");
CREATE INDEX "player_notes_user_id_world_id_idx" ON "player_notes"("user_id", "world_id");
CREATE INDEX "player_notes_page_id_idx" ON "player_notes"("page_id");
CREATE INDEX "player_notes_game_session_id_idx" ON "player_notes"("game_session_id");
