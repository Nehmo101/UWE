-- Restore the connector capability-policy columns. They were added in
-- 20260626143000_connector_capability_policy but existed only as raw SQL —
-- the Prisma schema did not declare them, so the generated sync migration
-- 20260701220000_sync_sqlite_waves dropped them again. Both columns are now
-- declared on the Connector model, which prevents future drops.
ALTER TABLE "connectors" ADD COLUMN "reported_capabilities" JSONB;
ALTER TABLE "connectors" ADD COLUMN "allowed_capabilities" JSONB;

-- Backfill like the original migration: until the next heartbeat reports
-- fresh capabilities, treat the effective set as the reported set.
UPDATE "connectors"
SET "reported_capabilities" = "capabilities"
WHERE "capabilities" IS NOT NULL;
