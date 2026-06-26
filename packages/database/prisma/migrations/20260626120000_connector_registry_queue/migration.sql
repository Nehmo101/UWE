-- RTX Host Connector: worker registry + outbound job queue.
-- The host owns this data; connectors are optional outbound workers.

CREATE TABLE "connectors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'rtx_connector',
    "token_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "queue_enabled" BOOLEAN NOT NULL DEFAULT true,
    "capabilities" JSONB,
    "models" JSONB,
    "version" TEXT,
    "current_jobs" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "last_heartbeat_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE TABLE "connector_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lane" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "target_capability" TEXT NOT NULL,
    "target_connector_id" TEXT,
    "claimed_by_connector_id" TEXT,
    "world_id" TEXT,
    "payload_json" JSONB,
    "result_json" JSONB,
    "failed_reason" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 0,
    "created_by_user_id" TEXT,
    "claimed_at" DATETIME,
    "started_at" DATETIME,
    "completed_at" DATETIME,
    "expires_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "connector_jobs_claimed_by_connector_id_fkey" FOREIGN KEY ("claimed_by_connector_id") REFERENCES "connectors" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "connectors_token_hash_key" ON "connectors"("token_hash");
CREATE INDEX "connectors_status_idx" ON "connectors"("status");
CREATE INDEX "connector_jobs_status_priority_created_at_idx" ON "connector_jobs"("status", "priority", "created_at");
CREATE INDEX "connector_jobs_lane_status_idx" ON "connector_jobs"("lane", "status");
CREATE INDEX "connector_jobs_claimed_by_connector_id_idx" ON "connector_jobs"("claimed_by_connector_id");
