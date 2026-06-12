-- Spotify OAuth connections (one Spotify account per world, tokens encrypted at rest)
CREATE TABLE "spotify_connections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "spotify_user_id" TEXT NOT NULL,
    "spotify_display_name" TEXT,
    "access_token_encrypted" TEXT NOT NULL,
    "refresh_token_encrypted" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "scopes" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "spotify_connections_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "spotify_connections_world_id_key" ON "spotify_connections"("world_id");
