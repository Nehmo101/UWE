-- AtlasFeatureKind gains the new value `vine` (giant skyward vine/root feature).
-- ALTER TYPE ... ADD VALUE must not run in the same transaction that uses the
-- new value, so this migration does nothing else.
ALTER TYPE "AtlasFeatureKind" ADD VALUE IF NOT EXISTS 'vine';
