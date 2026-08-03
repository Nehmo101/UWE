-- Idempotenz-Kennung fuer Notizen, die offline entstanden sind.
-- Gegenstueck zur SQLite-Migration gleichen Namens; dieselbe Begruendung.
--
-- PostgreSQL behandelt NULL im UNIQUE-Index wie SQLite als jeweils eigenen
-- Wert: beliebig viele Notizen ohne Kennung, dieselbe Kennung pro Nutzer
-- genau einmal.

-- AlterTable
ALTER TABLE "player_notes" ADD COLUMN "client_ref" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "player_notes_user_id_client_ref_key" ON "player_notes"("user_id", "client_ref");
