-- AtlasFeatureKind gains the new value `vine` (giant skyward vine/root feature).
-- SQLite stores Prisma enums as TEXT, so no DDL is required here; this
-- migration exists to keep the SQLite and PostgreSQL histories in step.
SELECT 1;
