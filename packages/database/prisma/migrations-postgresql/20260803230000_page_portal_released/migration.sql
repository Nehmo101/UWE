-- Freigegeben fuer das Portal — ein Haken je Wiki-Seite.
-- Gegenstueck zur SQLite-Migration gleichen Namens; dieselbe Begruendung.
--
-- **Vorgabe `false`, mit Absicht.** Das ist die fail-closed Richtung: Was neu
-- entsteht oder frisch importiert wird, ist erst einmal DM-Material, bis jemand
-- es ausdruecklich freigibt. Bestandsseiten wandern damit ebenfalls auf `false`
-- und muessen einmal freigegeben werden.

-- AlterTable
ALTER TABLE "pages" ADD COLUMN "portal_released" BOOLEAN NOT NULL DEFAULT false;
