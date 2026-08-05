/*
  Warnings:

  - You are about to drop the column `caldav_pending` on the `calendar_events` table. All the data in the column will be lost.
  - You are about to drop the column `direction` on the `calendar_feeds` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_calendar_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feed_id" TEXT,
    "world_id" TEXT,
    "session_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "start_at" DATETIME NOT NULL,
    "end_at" DATETIME,
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "kind" TEXT NOT NULL DEFAULT 'personal',
    "external_uid" TEXT,
    "remote_href" TEXT,
    "remote_etag" TEXT,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "calendar_events_feed_id_fkey" FOREIGN KEY ("feed_id") REFERENCES "calendar_feeds" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_calendar_events" ("all_day", "created_at", "description", "end_at", "external_uid", "feed_id", "id", "kind", "location", "metadata", "remote_etag", "remote_href", "session_id", "start_at", "title", "updated_at", "world_id") SELECT "all_day", "created_at", "description", "end_at", "external_uid", "feed_id", "id", "kind", "location", "metadata", "remote_etag", "remote_href", "session_id", "start_at", "title", "updated_at", "world_id" FROM "calendar_events";
DROP TABLE "calendar_events";
ALTER TABLE "new_calendar_events" RENAME TO "calendar_events";
CREATE INDEX "calendar_events_start_at_idx" ON "calendar_events"("start_at");
CREATE INDEX "calendar_events_world_id_start_at_idx" ON "calendar_events"("world_id", "start_at");
CREATE INDEX "calendar_events_feed_id_external_uid_idx" ON "calendar_events"("feed_id", "external_uid");
CREATE TABLE "new_calendar_feeds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "caldav_url" TEXT,
    "username" TEXT,
    "credentials_enc" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "color" TEXT,
    "last_sync_at" DATETIME,
    "sync_error" TEXT,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_calendar_feeds" ("caldav_url", "color", "created_at", "credentials_enc", "enabled", "id", "last_sync_at", "metadata", "name", "sync_error", "type", "updated_at", "url", "username") SELECT "caldav_url", "color", "created_at", "credentials_enc", "enabled", "id", "last_sync_at", "metadata", "name", "sync_error", "type", "updated_at", "url", "username" FROM "calendar_feeds";
DROP TABLE "calendar_feeds";
ALTER TABLE "new_calendar_feeds" RENAME TO "calendar_feeds";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
