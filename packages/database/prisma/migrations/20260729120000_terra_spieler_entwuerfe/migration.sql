-- Terra-Karten aus dem Portal (J5): Spieler bauen Karten, der Spielleiter
-- nimmt sie ab.
--
-- Der Vorgabewert von `status` ist ABSICHTLICH 'freigegeben' und nicht
-- 'entwurf'. Zwei Dinge haengen daran:
--   1. Bestandszeilen. Jede Karte, die es vor dieser Runde gab, ist eine
--      Karte des Spielleiters und muss im Portal sichtbar bleiben. Mit
--      'entwurf' als Vorgabe waeren sie beim naechsten Seitenaufruf
--      verschwunden — eine stille Datenverdeckung.
--   2. Der Studio-Weg. Was der Spielleiter selbst anlegt, braucht keine
--      Abnahme durch sich selbst.
-- Nur der Portal-Weg setzt beim Anlegen ausdruecklich 'entwurf'.
--
-- SQLite kennt keinen ENUM-Typ; Prisma bildet ihn als TEXT ab. Deshalb reicht
-- hier ALTER TABLE ADD COLUMN — kein Tabellen-Neubau, keine Datenmigration.
--
-- Der Fremdschluessel auf `users` haengt am Spaltenkopf, weil SQLite ihn
-- nachtraeglich nicht anders anbringen kann. Erlaubt ist das nur, weil die
-- Spalte NULL als Vorgabe hat — genau der Fall hier. ON DELETE SET NULL, nicht
-- CASCADE: verlaesst ein Spieler die Runde, bleibt seine abgenommene Karte
-- Teil der Welt und verliert nur ihren Autor.

-- AlterTable
ALTER TABLE "terra_karten" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'freigegeben';
ALTER TABLE "terra_karten" ADD COLUMN "autor_user_id" TEXT REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "terra_karten" ADD COLUMN "autor_name" TEXT;
ALTER TABLE "terra_karten" ADD COLUMN "eingereicht_am" DATETIME;
ALTER TABLE "terra_karten" ADD COLUMN "entschieden_am" DATETIME;
ALTER TABLE "terra_karten" ADD COLUMN "entschieden_von_user_id" TEXT;
ALTER TABLE "terra_karten" ADD COLUMN "rueckmeldung" TEXT;

-- CreateIndex
-- Die Abnahmeliste im Studio und die Spielerliste im Portal filtern beide
-- ueber (Welt, Status); die Portal-Liste zusaetzlich ueber den Autor.
CREATE INDEX "terra_karten_world_id_status_idx" ON "terra_karten"("world_id", "status");
CREATE INDEX "terra_karten_autor_user_id_idx" ON "terra_karten"("autor_user_id");
