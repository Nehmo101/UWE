-- Atlas 3D entfaellt vollstaendig; Terra hat den Karteneditor uebernommen
-- (Owner-Entscheid 27.07.2026, nach ausdruecklicher Rueckfrage).
--
-- Alte Atlas-Welten werden VERWORFEN, nicht migriert. In der geprueften
-- Datenbank standen 1 Welt, 1 Ebene, 1 Terrain, 12 Objekte, 1 Lesezeichen
-- und 0 Features — der Zustand nach dem Demo-Seed, keine gewachsene Welt.
--
-- ACHTUNG fuer andere Umgebungen: `packages/backup` hat diese Tabellen NIE
-- gesichert (der logische Export kennt sie nicht). Wer sie behalten will,
-- muss vor dem Deploy uwe.db + uwe.db-wal + uwe.db-shm als Dateikopie
-- sichern. `pnpm backup:create` reicht dafuer nicht.
--
-- Reihenfolge Kinder -> Eltern. Keine Nicht-Atlas-Tabelle hat einen
-- Fremdschluessel auf diese Tabellen (geprueft 27.07.2026): worlds, pages
-- und assets trugen nur Prisma-Rueckrelationen, und die haben keine Spalte.
-- Es bleiben also keine verwaisten Verweise zurueck.
--
-- `IF EXISTS` mit Absicht, anders als bei 20260721150000_drop_legacy_atlas:
-- eine frisch aufgebaute Datenbank hat diese Tabellen nie gesehen, und eine
-- Migration, die daran scheitert, blockiert jeden Neuaufbau.

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "atlas3d_camera_bookmarks";
DROP TABLE IF EXISTS "atlas3d_objects";
DROP TABLE IF EXISTS "atlas3d_features";
DROP TABLE IF EXISTS "atlas3d_terrains";
DROP TABLE IF EXISTS "atlas3d_nodes";
DROP TABLE IF EXISTS "atlas3d_worlds";
PRAGMA foreign_keys=on;

-- Das Enum AtlasNodeLevel ist in SQLite kein Datenbankobjekt (Prisma bildet
-- es als TEXT ab). Es genuegt, den Block aus schema.prisma zu streichen —
-- hier ist nichts zu tun.
