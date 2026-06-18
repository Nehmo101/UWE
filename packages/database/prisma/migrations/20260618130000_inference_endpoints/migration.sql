CREATE TABLE "inference_endpoints" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "api_key_enc" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'ollama',
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_probe_at" DATETIME,
    "probe_status" TEXT,
    "cached_models" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE INDEX "inference_endpoints_is_enabled_idx" ON "inference_endpoints"("is_enabled");
