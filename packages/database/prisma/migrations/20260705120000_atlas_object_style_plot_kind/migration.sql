-- AtlasObject gains a free-form `style` JSON (per-object render params:
-- gouache asset key, line width, blur). SQLite stores Json as TEXT.
ALTER TABLE "atlas_objects" ADD COLUMN "style" TEXT;
-- AtlasFeatureKind gains `plot` (auto-scatter fill area). SQLite enums are TEXT
-- → no DDL for the enum value itself.
