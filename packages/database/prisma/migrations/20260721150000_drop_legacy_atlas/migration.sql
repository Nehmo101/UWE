-- Phase 5b: Der alte 2D-Atlas ist vollständig durch Atlas 3D ersetzt.
-- Owner-Entscheid (2026-07-21, nach expliziter Rückfrage): Alt-Daten löschen.
-- Achtung: Handgeprüfter Diff — die mail_messages_fts*-Virtualtabellen aus dem
-- rohen prisma migrate diff wurden entfernt (FTS5 lebt außerhalb des Schemas).

-- DropTable (Kinder zuerst: features/objects → nodes → maps/palette)
PRAGMA foreign_keys=off;
DROP TABLE "atlas_features";
PRAGMA foreign_keys=on;

PRAGMA foreign_keys=off;
DROP TABLE "atlas_objects";
PRAGMA foreign_keys=on;

PRAGMA foreign_keys=off;
DROP TABLE "atlas_nodes";
PRAGMA foreign_keys=on;

PRAGMA foreign_keys=off;
DROP TABLE "atlas_maps";
PRAGMA foreign_keys=on;

PRAGMA foreign_keys=off;
DROP TABLE "atlas_palette_items";
PRAGMA foreign_keys=on;
