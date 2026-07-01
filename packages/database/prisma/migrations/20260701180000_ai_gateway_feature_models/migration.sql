-- D9: per-feature model/provider overrides
ALTER TABLE "ai_gateway_config" ADD COLUMN "feature_models" JSONB NOT NULL DEFAULT '{}';
