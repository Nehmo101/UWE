-- Lesereihenfolge fuer Geschwisterseiten.
--
-- `Page.parentPageId` gibt es seit je, aber keine Ordnung darunter: Kinder
-- wurden nach Titel oder Slug sortiert. Fuer einen Dungeon reicht das zufaellig
-- ("Ebene 1" vor "Ebene 2"), fuer ein Kampagnenbuch nicht — "Akt III" stuende
-- vor "Akt I", und "Szene 10" vor "Szene 2".
--
-- Die Spalte ist bewusst NULLABLE und ohne Vorgabewert: Bestandsseiten
-- bekommen NULL und behalten damit exakt die Sortierung, die sie heute haben.
-- Nur wer eine Reihenfolge setzt (Dokument-Import, spaeter Drag-and-drop),
-- traegt einen Wert ein. Leserichtung ist also "sortIndex zuerst, NULL zuletzt,
-- dann Titel" — das muss die Abfrageseite entscheiden, nicht das Schema.

-- AlterTable
ALTER TABLE "pages" ADD COLUMN "sort_index" INTEGER;

-- CreateIndex
CREATE INDEX "pages_parent_page_id_sort_index_idx" ON "pages"("parent_page_id", "sort_index");
