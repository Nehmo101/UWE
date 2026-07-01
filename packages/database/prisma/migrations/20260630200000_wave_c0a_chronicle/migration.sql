-- Wave C0a: World calendar, chronicle events, faction state (foundations for World-Clock + Timeline)

CREATE TABLE "world_calendars" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Weltkalender',
    "months" JSONB NOT NULL,
    "days_per_week" INTEGER NOT NULL DEFAULT 7,
    "day_names" JSONB,
    "current_date" JSONB NOT NULL,
    "epoch_label" TEXT,
    "settings" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "world_calendars_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "world_calendars_world_id_key" ON "world_calendars"("world_id");

CREATE TABLE "world_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "calendar_id" TEXT,
    "in_game_date" JSONB NOT NULL,
    "title" TEXT NOT NULL,
    "summary_player" TEXT,
    "summary_dm" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "secret_level" TEXT NOT NULL DEFAULT 'none',
    "source_type" TEXT NOT NULL DEFAULT 'manual',
    "source_ai_proposal_id" TEXT,
    "game_session_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "world_events_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "world_events_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "world_calendars" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "world_events_game_session_id_fkey" FOREIGN KEY ("game_session_id") REFERENCES "game_sessions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "world_events_world_id_sort_order_idx" ON "world_events"("world_id", "sort_order");

CREATE TABLE "world_event_entity_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event_id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'involved',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "world_event_entity_links_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "world_events" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "world_event_entity_links_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "world_event_entity_links_event_id_page_id_role_key" ON "world_event_entity_links"("event_id", "page_id", "role");
CREATE INDEX "world_event_entity_links_page_id_idx" ON "world_event_entity_links"("page_id");

CREATE TABLE "faction_states" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "world_id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "goals" JSONB,
    "resources" JSONB,
    "relationships" JSONB,
    "agenda" TEXT NOT NULL DEFAULT '',
    "power_level" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "faction_states_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "faction_states_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "faction_states_page_id_key" ON "faction_states"("page_id");
CREATE INDEX "faction_states_world_id_idx" ON "faction_states"("world_id");
