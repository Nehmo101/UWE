-- Maschinenraum-Rebranding: der Wartestatus im Scan-Eingang heisst nicht mehr nach
-- einer NVIDIA-Kartenreihe.
--
-- `ScanDocumentStatus.waiting_for_rtx` wird zu `waiting_for_engine`. Gemeint war
-- nie eine bestimmte Karte, sondern „wartet darauf, dass der Maschinenraum Zeit
-- hat" — und dessen OCR-Executor laeuft ohnehin auf der CPU.
--
-- Reine Datenpflege: Prisma bildet Enums auf SQLite als TEXT ohne
-- CHECK-Constraint ab, und der Spalten-Default ist 'unanalyzed' und damit
-- unberuehrt. Es entsteht kein Tabellenumbau.
--
-- Dokumente, die beim Update gerade in der Warteschlange stehen, behalten so
-- ihren Platz; ohne das UPDATE fielen sie in der UI aus jeder bekannten
-- Statusgruppe heraus.

-- UpdateData
UPDATE "scan_documents" SET "status" = 'waiting_for_engine' WHERE "status" = 'waiting_for_rtx';
