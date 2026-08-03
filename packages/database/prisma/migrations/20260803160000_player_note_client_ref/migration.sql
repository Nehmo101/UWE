-- Idempotenz-Kennung fuer Notizen, die offline entstanden sind.
--
-- Der Tischmodus im Portal (`/auth/tisch`) schreibt ohne Netz in eine lokale
-- Warteschlange und schickt sie nach, sobald wieder Verbindung besteht. Reisst
-- diese Verbindung ab, nachdem der Server gespeichert, aber bevor die Antwort
-- angekommen ist, schickt der Client denselben Eintrag noch einmal. Ohne
-- Kennung entstuende dabei jedes Mal eine zweite Notiz mit demselben Text.
--
-- Die Spalte ist NULLABLE und ohne Vorgabewert: Bestandsnotizen bleiben
-- unberuehrt, und ueber den Browser angelegte Notizen tragen weiterhin nichts
-- ein. SQLite behandelt NULL im UNIQUE-Index als jeweils eigenen Wert — beliebig
-- viele Notizen ohne Kennung sind also erlaubt, dieselbe Kennung pro Nutzer
-- genau einmal. Der Index steht auf (user_id, client_ref) statt auf client_ref
-- allein, damit die vom Client vergebene Kennung nicht ueber Kontogrenzen
-- hinweg kollidieren kann.

-- AlterTable
ALTER TABLE "player_notes" ADD COLUMN "client_ref" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "player_notes_user_id_client_ref_key" ON "player_notes"("user_id", "client_ref");
