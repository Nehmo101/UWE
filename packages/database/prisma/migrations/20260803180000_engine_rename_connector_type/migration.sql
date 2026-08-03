-- Maschinenraum-Rebranding: der Connector-Typ heisst nicht mehr nach einer NVIDIA-Kartenreihe.
--
-- `ConnectorType.rtx_connector` wird zu `engine_connector`. UWE laeuft auf jeder
-- GPU, die Ollama, LM Studio oder ein OpenAI-kompatibler Server ansprechen kann,
-- und ein guter Teil der Maschinenraum-Executoren (OCR, Audio, Etikettendruck)
-- braucht ueberhaupt keine. Der alte Name legte das Gegenteil nahe.
--
-- Prisma bildet Enums auf SQLite als TEXT ohne CHECK-Constraint ab. Die
-- Umbenennung ist deshalb zweigeteilt: ein UPDATE fuer die Bestandszeilen und
-- ein Tabellenumbau fuer den neuen Spalten-Default, weil SQLite Defaults nicht
-- per ALTER TABLE aendern kann.
--
-- 'rtx_connector' war der einzige Wert, den das Enum je hatte. Das UPDATE greift
-- also entweder auf alle Zeilen oder — bei einer frisch angelegten DB — auf keine.

-- UpdateData
UPDATE "connectors" SET "type" = 'engine_connector' WHERE "type" = 'rtx_connector';

-- Derselbe Namenswechsel in den KI-Nutzungslogs. `provider` und `route` sind
-- freie TEXT-Spalten, in denen der Provider-Modus als Vokabel steht; ohne diese
-- Zeilen zeigt die Gateway-Auswertung im Admin-Bereich Alt- und Neubestand als
-- zwei verschiedene Routen nebeneinander.
UPDATE "ai_usage_logs" SET "provider" = 'local_engine' WHERE "provider" = 'local_rtx';
UPDATE "ai_usage_logs" SET "route" = 'local_engine' WHERE "route" = 'local_rtx';

-- Und im Chatverlauf der Ideen-Werkstatt: dort steht der Modus je Antwort als
-- `via` in einem JSON-Blob. SQLite haelt JSON als TEXT, `replace` genuegt.
UPDATE "dev_ideas"
SET "chat_transcript" = replace("chat_transcript", '"local_rtx"', '"local_engine"')
WHERE "chat_transcript" LIKE '%"local_rtx"%';

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_connectors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'engine_connector',
    "token_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "queue_enabled" BOOLEAN NOT NULL DEFAULT true,
    "capabilities" JSONB,
    "reported_capabilities" JSONB,
    "allowed_capabilities" JSONB,
    "models" JSONB,
    "printers" JSONB,
    "version" TEXT,
    "current_jobs" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "last_heartbeat_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_connectors" ("allowed_capabilities", "capabilities", "created_at", "current_jobs", "disabled", "id", "last_error", "last_heartbeat_at", "models", "name", "printers", "queue_enabled", "reported_capabilities", "status", "token_hash", "type", "updated_at", "version") SELECT "allowed_capabilities", "capabilities", "created_at", "current_jobs", "disabled", "id", "last_error", "last_heartbeat_at", "models", "name", "printers", "queue_enabled", "reported_capabilities", "status", "token_hash", "type", "updated_at", "version" FROM "connectors";
DROP TABLE "connectors";
ALTER TABLE "new_connectors" RENAME TO "connectors";
CREATE UNIQUE INDEX "connectors_token_hash_key" ON "connectors"("token_hash");
CREATE INDEX "connectors_status_idx" ON "connectors"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
