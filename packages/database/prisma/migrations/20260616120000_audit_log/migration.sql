-- Security audit log (append-only, manipulation-resistant)

CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_user_id" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "world_id" TEXT,
    "ip_hash" TEXT,
    "user_agent_hash" TEXT,
    "metadata_json" JSONB
);

CREATE INDEX "audit_logs_action_timestamp_idx" ON "audit_logs"("action", "timestamp");
CREATE INDEX "audit_logs_actor_user_id_timestamp_idx" ON "audit_logs"("actor_user_id", "timestamp");
CREATE INDEX "audit_logs_world_id_timestamp_idx" ON "audit_logs"("world_id", "timestamp");
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");
