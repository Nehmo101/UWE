-- Keep connector-reported capabilities separate from the host/admin policy.
-- `capabilities` remains the effective, job-claimable set for existing code paths.
ALTER TABLE "connectors" ADD COLUMN "reported_capabilities" JSONB;
ALTER TABLE "connectors" ADD COLUMN "allowed_capabilities" JSONB;

UPDATE "connectors"
SET "reported_capabilities" = "capabilities"
WHERE "capabilities" IS NOT NULL;
