-- Maschinenraum-Rebranding: NVIDIA-Kartennamen raus aus den Enum-Werten (PostgreSQL).
--
-- `ConnectorType.rtx_connector`      -> `engine_connector`
-- `ScanDocumentStatus.waiting_for_rtx` -> `waiting_for_engine`
--
-- UWE laeuft auf jeder GPU, die Ollama, LM Studio oder ein OpenAI-kompatibler
-- Server ansprechen kann, und ein guter Teil der Maschinenraum-Executoren (OCR,
-- Audio, Etikettendruck) braucht ueberhaupt keine. Die alten Werte legten das
-- Gegenteil nahe.
--
-- Anders als SQLite kennt PostgreSQL echte Enum-Typen. `ALTER TYPE … RENAME
-- VALUE` benennt das Label an Ort und Stelle um: Bestandszeilen und
-- Spalten-Defaults zeigen weiter auf denselben Wert, ein Daten-UPDATE oder ein
-- Tabellenumbau ist nicht noetig.

-- AlterEnum
ALTER TYPE "ConnectorType" RENAME VALUE 'rtx_connector' TO 'engine_connector';

-- AlterEnum
ALTER TYPE "ScanDocumentStatus" RENAME VALUE 'waiting_for_rtx' TO 'waiting_for_engine';

-- Die KI-Nutzungslogs fuehren den Provider-Modus als freien Text, nicht als
-- Enum. Ohne diese Zeilen zeigt die Gateway-Auswertung im Admin-Bereich Alt- und
-- Neubestand als zwei verschiedene Routen nebeneinander.
UPDATE "ai_usage_logs" SET "provider" = 'local_engine' WHERE "provider" = 'local_rtx';
UPDATE "ai_usage_logs" SET "route" = 'local_engine' WHERE "route" = 'local_rtx';

-- Chatverlauf der Ideen-Werkstatt: der Modus steht je Antwort als `via` im
-- JSONB-Blob.
UPDATE "dev_ideas"
SET "chat_transcript" = replace("chat_transcript"::text, '"local_rtx"', '"local_engine"')::jsonb
WHERE "chat_transcript"::text LIKE '%"local_rtx"%';
