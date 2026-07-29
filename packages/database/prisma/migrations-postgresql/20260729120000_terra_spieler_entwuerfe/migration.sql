-- Terra-Karten aus dem Portal (J5) — Postgres-Zweig, gleichzeitig mit dem
-- SQLite-Zweig angelegt. Begruendung fuer den Vorgabewert 'freigegeben' steht
-- im SQLite-Zweig derselben Migration: Bestandszeilen duerfen nicht still
-- verschwinden, und Studio-Karten brauchen keine Abnahme durch sich selbst.
--
-- Unterschied zum SQLite-Zweig: Postgres bekommt einen echten ENUM-Typ und
-- den Fremdschluessel auf `users` als eigene Anweisung.

-- CreateEnum
CREATE TYPE "TerraKarteStatus" AS ENUM ('entwurf', 'eingereicht', 'freigegeben');

-- AlterTable
ALTER TABLE "terra_karten" ADD COLUMN     "status" "TerraKarteStatus" NOT NULL DEFAULT 'freigegeben',
ADD COLUMN     "autor_user_id" TEXT,
ADD COLUMN     "autor_name" TEXT,
ADD COLUMN     "eingereicht_am" TIMESTAMP(3),
ADD COLUMN     "entschieden_am" TIMESTAMP(3),
ADD COLUMN     "entschieden_von_user_id" TEXT,
ADD COLUMN     "rueckmeldung" TEXT;

-- CreateIndex
CREATE INDEX "terra_karten_world_id_status_idx" ON "terra_karten"("world_id", "status");
CREATE INDEX "terra_karten_autor_user_id_idx" ON "terra_karten"("autor_user_id");

-- AddForeignKey
-- ON DELETE SET NULL, nicht CASCADE: verlaesst ein Spieler die Runde, bleibt
-- seine abgenommene Karte Teil der Welt. Sie verliert nur ihren Autor.
ALTER TABLE "terra_karten" ADD CONSTRAINT "terra_karten_autor_user_id_fkey" FOREIGN KEY ("autor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
