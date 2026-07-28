-- Atlas 3D entfaellt vollstaendig; Terra hat den Karteneditor uebernommen
-- (Owner-Entscheid 27.07.2026). Gegenstueck zum SQLite-Zweig.
--
-- Dieser Ordner hinkt bei Atlas in ZWEI Richtungen hinterher:
--   * die atlas3d_*-Tabellen wurden hier nie angelegt (der SQLite-Zweig hat
--     20260721120000_atlas3d_foundation, der Postgres-Zweig nicht),
--   * die alten 2D-Tabellen und ihre Enums wurden hier nie gedroppt (der
--     SQLite-Zweig hat 20260721150000_drop_legacy_atlas, dieser nicht),
--     obwohl schema.postgresql.prisma sie seit dem 21.07. nicht mehr kennt.
--
-- Beides wird hier in einem Zug eingeholt, damit der Abbau die Drift nicht
-- weiter vergroessert. Alle Anweisungen sind `IF EXISTS` und damit fuer beide
-- Ausgangslagen richtig: eine Datenbank, die die Tabellen nie hatte, laeuft
-- durch, ohne zu scheitern.

-- DropTable (Atlas 3D, Kinder zuerst — im Postgres-Zweig meist gar nicht da)
DROP TABLE IF EXISTS "atlas3d_camera_bookmarks" CASCADE;
DROP TABLE IF EXISTS "atlas3d_objects" CASCADE;
DROP TABLE IF EXISTS "atlas3d_features" CASCADE;
DROP TABLE IF EXISTS "atlas3d_terrains" CASCADE;
DROP TABLE IF EXISTS "atlas3d_nodes" CASCADE;
DROP TABLE IF EXISTS "atlas3d_worlds" CASCADE;

-- DropTable (Reste des 2D-Atlas, hier nie gedroppt)
DROP TABLE IF EXISTS "atlas_features" CASCADE;
DROP TABLE IF EXISTS "atlas_objects" CASCADE;
DROP TABLE IF EXISTS "atlas_nodes" CASCADE;
DROP TABLE IF EXISTS "atlas_maps" CASCADE;
DROP TABLE IF EXISTS "atlas_palette_items" CASCADE;

-- DropEnum (in Postgres sind Enums echte Objekte und ueberleben ihre Tabellen)
DROP TYPE IF EXISTS "AtlasNodeLevel";
DROP TYPE IF EXISTS "AtlasFeatureKind";
DROP TYPE IF EXISTS "AtlasLabelColor";
DROP TYPE IF EXISTS "AtlasPaletteSource";
DROP TYPE IF EXISTS "AtlasPaletteReviewStatus";
