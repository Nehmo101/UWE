# Brain-Datenmigration — Cutover-Runbook (Welle 5)

Stand: 2026-07-22. Verbindliche, sichere Reihenfolge für die physische Trennung
der owner-privaten Brain-Daten aus `uwe.db` in eine eigene `uwe-brain.db`.
Ergänzt [ADR 003](../adr/003-data-layers.md) und den
[Masterplan](../rework/uwe-portal-studio-brain-masterplan.md) (Invariante 7).

## Leitprinzip

**Additiv, verifiziert, umkehrbar bis zum letzten Schritt.** Es wird nichts an
der Quelle gelöscht, solange nicht Export, Import, Integritätsvergleich,
Restore-Test und ein Dry-Run grün sind — und selbst dann ist das Droppen der
Alt-Tabellen ein **separater, einzeln abgenommener** Schritt.

## Autoritative Modellmenge

Die zu migrierenden Modelle sind `BRAIN_MODEL_NAMES` aus
`@uwe/product-contracts` (45 Modelle, `targetDatabase === "uwe-brain.db"`). Der
Export ist per Compile-Type und Test (`brain-export.test.ts`) an diese Menge
gepinnt — ein neues Brain-Modell kann nicht stillschweigend entkommen.

## Reihenfolge (jede Stufe muss grün sein, bevor die nächste beginnt)

1. **Vollbackup + Restore-Test der bestehenden `uwe.db`.** Ohne bewiesenen
   Restore beginnt keine Migration.
2. **Export (non-destruktiv).** `collectBrainExport(db)` (`@uwe/backup`) liest
   alle 45 Brain-Modelle aus `uwe.db` in ein portables Bundle. Quelle bleibt
   unangetastet. `counts` festhalten.
3. **`uwe-brain.db` anlegen.** Separate Prisma-Datasource/-Schema nur mit den
   Brain-Modellen. **Achtung — echte Design-Arbeit, kein Copy-Paste:**
   Cross-DB-Fremdschlüssel (z. B. auf `User`/`platform_auth`) und polymorphe
   Links (`AdminEntityLink`, `ScanDocument`-Ziele, Kalender-/Mail-Weltbezug)
   müssen vorher zu opaken IDs/Ports aufgelöst werden (Streitgruppen G2/G3/G9
   aus O02). Erst danach ist ein valides standalone Schema möglich.

   ### 3a — Konkrete Cross-Domain-FK-Auflösung (15 Kanten, autoritativ)

   Ein Scan der 45 Brain-Modelle gegen `schema.prisma` ergibt **genau 15
   Fremdschlüssel aus Brain in die D&D-Domäne** (und spiegelbildlich 15
   Rück-Relationen auf `World`/`Page`/`User`/`GameSession`). Jede Kante wird
   beim DB-Split zu einem **opaken, nullbaren Skalar** (kein `@relation`, keine
   DB-seitige Referenzintegrität über die DB-Grenze); die Rück-Relation auf der
   D&D-Seite entfällt. Die Verknüpfung bleibt semantisch erhalten (die ID wird
   weiter gespeichert), Lookups über die Grenze werden App-seitig aufgelöst.

   | Brain-Modell → Ziel | Auflösung im Brain-Schema |
   |---|---|
   | `MailTemplate.world` → `World` | `worldId String?` (opak) |
   | `MailRecipientGroup.world` → `World` | `worldId String?` (opak) |
   | `MailMessageLog.world` → `World` | `worldId String?` (opak) |
   | `MailDraft.world` → `World` | `worldId String?` (opak) |
   | `MailRecipient.user` → `User` | `userId String?` (opak) |
   | `CaptureEntry.world` → `World` | `worldId String?` (opak) |
   | `CaptureEntry.page` → `Page` | `pageId String?` (opak) |
   | `PersonalProject.world` → `World` | `worldId String?` (opak) |
   | `PersonalProject.page` → `Page` | `pageId String?` (opak) |
   | `WorkshopProject.world` → `World` | `worldId String?` (opak) |
   | `WorkshopProject.page` → `Page` | `pageId String?` (opak) |
   | `CalendarEvent.world` → `World` | `worldId String?` (opak) |
   | `CalendarEvent.session` → `GameSession` | `sessionId String?` (opak) |
   | `ResearchSession.world` → `World` | `worldId String?` (opak) |
   | `ScanDocument.world` → `World` | `worldId String?` (opak) |

   **Offene Produktentscheidung (nicht rein technisch):** Mail, Capture,
   Kalender und Research/Scan tragen heute einen echten `World`-Bezug — sie sind
   damit teilweise D&D-*welt*-skopiert, nicht rein owner-privat. Default unter
   dem erteilten GO: Sie ziehen **nach Brain** um, `worldId` bleibt als opake
   Referenz erhalten (Brain besitzt die Zeile; die referenzierte Welt ist
   informativ). Soll ein Feature stattdessen als *Studio/Welt-*Feature in
   `uwe.db` bleiben, ist das ein **Ein-Zeilen-Flip** in `BRAIN_MODEL_NAMES`
   (`@uwe/product-contracts`) plus das Weglassen aus dieser Tabelle — keine
   Neu-Architektur. Diese Umkehrbarkeit ist der Grund, warum die Auflösung hier
   deklarativ an die Contracts gepinnt ist.
4. **Import.** Bundle in `uwe-brain.db` einspielen (Reihenfolge nach
   Abhängigkeiten). Danach `counts` gegen Schritt 2 vergleichen — jede
   Abweichung stoppt die Migration.
5. **Integritäts- und Beziehungsprüfung.** Mengen, Fremdschlüssel innerhalb der
   Brain-DB, Datei-Referenzen (`brain-*-files`-Resolver) und Owner-Zuordnung.
6. **Brain-App auf `uwe-brain.db` umstellen.** Eigener Prisma-Client für Brain;
   `apps/brain` liest owner-private Daten aus `uwe-brain.db`, D&D/Portal
   weiterhin aus `uwe.db`. Kein Dual-Store-Client in Apps/Shared Engines.
7. **Backup-Trennung.** `uwe-brain.db` erhält eigene Backups/Retention/Restore-
   Rechte. Der D&D-/Portal-Backup-Zweig darf danach **keine** Brain-Zeilen mehr
   enthalten (L-2). Bis dahin bleibt das Full-Backup gemischt — das ist der
   Übergangszustand, nicht der Zielzustand.
8. **Dry-Run + Rollback-Probe.** Vollständiger Durchlauf auf Kopien; Rollback
   dokumentiert und getestet.
9. **Separater, owner-abgenommener Cutover (destruktiv, letzte Stufe).** Erst
   wenn 1–8 grün sind und der Owner diesen Schritt einzeln freigibt, werden die
   Alt-Brain-Tabellen aus `uwe.db` entfernt. Vorher bleibt `uwe.db` die
   vollständige, funktionierende Quelle.
   Die exakte Drop-SQL ist ausführbereit erzeugt:
   `deploy/migrations/brain-cutover-drop.sql` (45 Tabellen, via
   `node scripts/generate-brain-cutover-sql.mjs` aus den Contracts abgeleitet).
   **Warum nicht früher anwenden:** `schema.prisma` deklariert die Tabellen bis
   Stufe 3–8 weiter; ein Drop davor führt zu `no such table`-Laufzeitfehlern in
   allen Brain-Services (die 11 migrierten Routen, Studio-Brain, Backup, Export)
   — Brain wäre gelöscht, nicht verschoben, und nichts zeigt auf `uwe-brain.db`.

## Was bereits gebaut ist

- **Export (Stufe 2):** `collectBrainExport` + Drift-Guard in `@uwe/backup`
  (`brain-export.ts`), read-only, an die Contracts gepinnt.
- **Modell-Autorität:** `BRAIN_MODEL_NAMES`/`isBrainModelName` in
  `@uwe/product-contracts`.

## Was bewusst NICHT vorab ausgeführt wird

Das standalone `uwe-brain.db`-Schema (Relation-Auflösung), der zweite
Prisma-Client, der Import und vor allem der **destruktive Drop** (Stufe 9)
werden hier **nicht** blind ausgeführt: ohne echte Owner-Daten und ohne
verifizierbare Ziel-DB wäre ein Datenverlust-Schritt in der Sandbox
unverantwortlich. Sie sind hier als ausführbereite, geordnete Runbook-Schritte
festgehalten und benötigen die dokumentierte Stufen-für-Stufe-Abnahme.
