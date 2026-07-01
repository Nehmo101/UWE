-- Additive: version the persisted Atlas document and add an optional terrain tile layer.
-- Non-breaking. Existing atlas_maps rows backfill to schema_version = 1 (v1 legacy docs,
-- migrated to v2 on load); tile_layer stays NULL until a map is painted.

-- AlterTable
ALTER TABLE "atlas_maps" ADD COLUMN "schema_version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "atlas_maps" ADD COLUMN "tile_layer" JSONB;
