-- AI Gateway: routing config, cloud providers, user grants, usage logs

CREATE TABLE "ai_gateway_config" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "routing_mode" TEXT NOT NULL DEFAULT 'LOCAL_THEN_CLOUD',
    "cloud_fallback_enabled" BOOLEAN NOT NULL DEFAULT false,
    "privacy_rules" JSONB NOT NULL DEFAULT '{}',
    "daily_budget_usd" REAL,
    "monthly_budget_usd" REAL,
    "per_user_daily_budget_usd" REAL,
    "updated_at" DATETIME NOT NULL
);

CREATE TABLE "ai_cloud_providers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "base_url" TEXT,
    "default_model" TEXT,
    "api_key_enc" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "ai_cloud_providers_provider_id_key" ON "ai_cloud_providers"("provider_id");
CREATE INDEX "ai_cloud_providers_is_enabled_priority_idx" ON "ai_cloud_providers"("is_enabled", "priority");

CREATE TABLE "ai_user_grants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "cloud_fallback_allowed" BOOLEAN NOT NULL DEFAULT false,
    "daily_budget_usd" REAL,
    "granted_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ai_user_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ai_user_grants_user_id_key" ON "ai_user_grants"("user_id");

CREATE TABLE "ai_usage_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT,
    "feature" TEXT NOT NULL,
    "task_type" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "context_mode" TEXT,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "estimated_cost_usd" REAL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error_message" TEXT,
    "duration_ms" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_usage_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ai_usage_logs_user_id_created_at_idx" ON "ai_usage_logs"("user_id", "created_at");
CREATE INDEX "ai_usage_logs_created_at_idx" ON "ai_usage_logs"("created_at");
CREATE INDEX "ai_usage_logs_feature_created_at_idx" ON "ai_usage_logs"("feature", "created_at");

INSERT INTO "ai_gateway_config" ("id", "routing_mode", "cloud_fallback_enabled", "privacy_rules", "updated_at")
VALUES (
    'default',
    'LOCAL_THEN_CLOUD',
    false,
    '{"general_chat":"CLOUD_ALLOWED","dnd_world":"CLOUD_FORBIDDEN","personal_brain":"CLOUD_FORBIDDEN","private_notes":"CLOUD_FORBIDDEN","admin_diagnostics":"CLOUD_ALLOWED","image_generation":"CLOUD_ALLOWED"}',
    CURRENT_TIMESTAMP
);
