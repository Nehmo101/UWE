-- CreateTable
CREATE TABLE "game_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "title" TEXT NOT NULL,
    "session_number" INTEGER NOT NULL,
    "date" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "summary_dm" TEXT,
    "summary_player" TEXT,
    "notes" TEXT,
    "open_plots" TEXT,
    "player_decisions" TEXT,
    "recap_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "game_sessions_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "game_sessions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "game_session_page_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "game_session_id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "game_session_page_links_game_session_id_fkey" FOREIGN KEY ("game_session_id") REFERENCES "game_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "game_session_page_links_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "game_sessions_world_id_session_number_idx" ON "game_sessions"("world_id", "session_number");

-- CreateIndex
CREATE UNIQUE INDEX "game_session_page_links_game_session_id_page_id_key" ON "game_session_page_links"("game_session_id", "page_id");
