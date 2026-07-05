-- AtlasFeatureKind gains `plot` (auto-scatter fill area).
ALTER TYPE "AtlasFeatureKind" ADD VALUE IF NOT EXISTS 'plot';
-- AtlasObject gains a free-form `style` JSON (per-object render params:
-- gouache asset key, line width, blur).
ALTER TABLE "atlas_objects" ADD COLUMN "style" JSONB;
