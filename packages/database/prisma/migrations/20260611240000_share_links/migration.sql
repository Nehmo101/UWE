-- CreateTable
CREATE TABLE "share_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" DATETIME,
    "password_hash" TEXT,
    "read_only" BOOLEAN NOT NULL DEFAULT true,
    "log_access" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "share_links_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "share_access_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "share_link_id" TEXT NOT NULL,
    "accessed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "user_agent" TEXT,
    CONSTRAINT "share_access_logs_share_link_id_fkey" FOREIGN KEY ("share_link_id") REFERENCES "share_links" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "share_links_token_key" ON "share_links"("token");

-- CreateIndex
CREATE INDEX "share_links_world_id_idx" ON "share_links"("world_id");

-- CreateIndex
CREATE INDEX "share_links_target_type_target_id_idx" ON "share_links"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "share_access_logs_share_link_id_accessed_at_idx" ON "share_access_logs"("share_link_id", "accessed_at");
