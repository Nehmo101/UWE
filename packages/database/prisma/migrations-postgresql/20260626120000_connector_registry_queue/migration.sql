-- RTX Host Connector: worker registry + outbound job queue (PostgreSQL).
-- The host owns this data; connectors are optional outbound workers.

CREATE TYPE "ConnectorType" AS ENUM ('rtx_connector');
CREATE TYPE "ConnectorStatus" AS ENUM ('online', 'offline', 'degraded', 'disabled');
CREATE TYPE "ConnectorJobType" AS ENUM ('sound_play', 'sound_stop', 'sound_stop_all', 'sound_volume', 'spotify_play', 'spotify_pause', 'spotify_volume', 'spotify_transfer_device', 'llm_generate', 'image_generate', 'embedding_generate', 'connector_refresh_models');
CREATE TYPE "ConnectorJobStatus" AS ENUM ('pending', 'claimed', 'running', 'completed', 'failed', 'cancelled', 'expired');
CREATE TYPE "ConnectorLane" AS ENUM ('audio', 'spotify', 'gpu', 'maintenance');

CREATE TABLE "connectors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ConnectorType" NOT NULL DEFAULT 'rtx_connector',
    "token_hash" TEXT NOT NULL,
    "status" "ConnectorStatus" NOT NULL DEFAULT 'offline',
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "queue_enabled" BOOLEAN NOT NULL DEFAULT true,
    "capabilities" JSONB,
    "models" JSONB,
    "version" TEXT,
    "current_jobs" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "last_heartbeat_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connectors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "connector_jobs" (
    "id" TEXT NOT NULL,
    "type" "ConnectorJobType" NOT NULL,
    "status" "ConnectorJobStatus" NOT NULL DEFAULT 'pending',
    "lane" "ConnectorLane" NOT NULL,
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
    "claimed_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connector_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "connectors_token_hash_key" ON "connectors"("token_hash");
CREATE INDEX "connectors_status_idx" ON "connectors"("status");
CREATE INDEX "connector_jobs_status_priority_created_at_idx" ON "connector_jobs"("status", "priority", "created_at");
CREATE INDEX "connector_jobs_lane_status_idx" ON "connector_jobs"("lane", "status");
CREATE INDEX "connector_jobs_claimed_by_connector_id_idx" ON "connector_jobs"("claimed_by_connector_id");

ALTER TABLE "connector_jobs" ADD CONSTRAINT "connector_jobs_claimed_by_connector_id_fkey" FOREIGN KEY ("claimed_by_connector_id") REFERENCES "connectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
