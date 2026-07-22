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
- **Schema-Split (Stufe 3), blind geschrieben:**
  `scripts/generate-brain-schema-split.mjs` (deterministisch, an
  `BRAIN_MODEL_NAMES` gepinnt) erzeugt `prisma/brain/schema.prisma`
  (+`.postgresql.prisma`) und schreibt die 45 Brain-Modelle + 15
  Rück-Relationen aus den Haupt-Schemas heraus. 15 Cross-Domain-FKs → opake,
  nullbare Skalare (siehe 3a), Enums werden mitkopiert.
- **Brain-Client:** `packages/database/src/brain-client.ts`
  (`getSharedBrainPrismaClient`/`brainPrisma`, `uwe-brain.db`, SQLite,
  loopback-only), Subpath `@uwe/database/brain-client`. `db:generate` erzeugt
  den `prisma-brain`-Client mit; `db:deploy:brain`/`db:migrate:brain` +
  `BRAIN_DATABASE_URL` verdrahtet.
- **Leaf-Service-Repoint (Stufe 6, Teil 1):** `scripts/repoint-brain-services.mjs`
  (verschiebt nur Import-Quellen, keine Logik) hat 13 eindeutig owner-private
  Brain-Services auf den Brain-Client umgestellt: `continue-work`,
  `finance-overview`, `personal-brain`, `research`, `document-template`,
  `miniature-collection` + `life-admin/{brain,capture,contract,hardware,
  project,today,workshop}`. Statement-level leak-verifiziert, Codemod idempotent.
  Zusätzlich `mail-account-service` (Owner-Inbox, Single-Client).
- **Zwei-Client-Services (Stufe 6, Teil 2):** `life-admin-links-service`
  (brainDb: admin-links/captures, coreDb: Generator-Presets/Outputs) inkl.
  `create-life-admin-sub-services` / `LifeAdminService` /
  `createLifeAdminService` auf `(brainDb, coreDb)`. `calendar-service`
  (brainDb: feeds/events/contract-deadlines, coreDb: gameSession) inkl.
  Auflösung der severierten `session`/`calendarEvents`-Includes.
- **`apps/brain` (Stufe 6 D):** alle **11** Seiten am Brain-Client
  (`scripts/repoint-brain-app-pages.mjs` + calendar/mail von Hand). Zwei-Client-
  Seiten reichen `(brainPrisma, prisma)`, Single-Client `brainPrisma`.

## Stufe 6 — restliche Service-Repoint-Worklist (Host-geführt)

Alles Folgende ist **nicht** blind ausgeführt, weil es echte Zwei-Client-
Design-Entscheidungen (DB-übergreifende Joins) bzw. eine offene
Produktentscheidung (Mail) enthält. Auf dem Host führt `pnpm typecheck` nach
`db:generate` **jede** offene Stelle punktgenau auf (Brain-Delegates/-Typen
existieren dann nicht mehr am Core-Client). Reihenfolge:

- **A — Brain-Modelltyp-Import-Flip:** Jeder `import type { <BrainModel/Enum> }
  from "@uwe/database/server" | ".../generated/prisma/client"` außerhalb der 13
  Leaf-Services muss auf `.../generated/prisma-brain/client` zeigen (der
  `server`-Barrel re-exportiert nur Core-Typen). Mechanisch, tsc-geführt; der
  Codemod deckt das Muster `generated/prisma/client` bereits ab.
- **B — Aggregatoren:** `createLifeAdminService` /
  `createLifeAdminSubServices` auf **Zwei-Client** umstellen (`brainDb`,
  `coreDb`): Leaf-Subservices an `brainDb`, der gemischte `links`-Resolver an
  beide.
- **C — restliche Cross-DB-Services (Zwei-Client + opake-ID-Join):**
  `calendar-aggregation-service`, `admin-entity-link-resolver`,
  `admin-search-service`, `entity-tag-search-service`, `tag-service`,
  `asset-link-service`, `mail-compose-service`, `mail-recipient-service`,
  `maintenance/log-retention-service`, `undo-service`,
  `secrets-status-service`, `admin-status`, `stress-seed`,
  `apps/studio/app/integration-actions.ts`, `kitchen/recipe-service`
  (+`apps/studio/app/kitchen/recipe-image-file.ts`),
  `scan-inbox/scan-service` (+`apps/studio/app/scan-inbox/scan-file.ts`).
  (`life-admin-links-service`, `calendar-service` und `backup` collect/restore
  sind bereits erledigt — Vorlage für das Muster; backup zeigt zusätzlich das
  Dual-Store-Muster mit zwei getrennten Full-Reads.) **Muster:** Brain-Zeilen
  über `brainPrisma`
  lesen/schreiben; die referenzierte Core-Entität über die **opake ID**
  (`worldId`/`pageId`/`userId`/`sessionId`) separat am Core-Client nachladen.
  Keine DB-übergreifende FK, kein Dual-Store-Client in einer einzelnen Query.
- **Call-Site-Ripple (tsc-geführt):** die Zwei-Client-Signaturen brechen ihre
  Aufrufer. `createLifeAdminService` (67 Sites) und `createCalendarService`
  (~24 Sites) brauchen `(brainPrisma, prisma)`; Services, die `db` als Parameter
  bekommen (`knowledge-assistant`, `capture-triage`, `scan-service`,
  `import-central`, `game-session`), müssen `brainDb` durch ihre **eigene**
  Signatur reichen. Studio-Brain-Routen, die ohnehin nach `apps/brain` umziehen,
  werden dabei retired statt durchgereicht.
- **D — `apps/brain`-Seiten:** **erledigt** — alle 11 Seiten am Brain-Client.
- **E — Contested Mail-Entscheidung (G2/G3, VOR Mail-Repoint):** Die 5
  campaign-mail-Modelle (`MailTemplate`, `MailRecipientGroup`,
  `MailRecipient`, `MailMessageLog`, `MailDraft`) tragen `world`/`user`-FK und
  sind brain-vs-studio zu entscheiden. Der Owner-**Inbox**-Teil (IMAP/SMTP,
  `mail-account`/`mail-portal-*`) ist Brain. Bleiben die campaign-mail-Modelle
  **Studio**, aus `BRAIN_MODEL_NAMES` + der 3a-Tabelle entfernen und
  `generate-brain-schema-split.mjs` neu laufen lassen (Ein-Zeilen-Flip).
- **F — Erst danach:** Cutover-Drop (Stufe 9) anwenden.

## Was bewusst NICHT vorab ausgeführt wird

Das standalone `uwe-brain.db`-Schema (Relation-Auflösung), der zweite
Prisma-Client und der Leaf-Service-Repoint **sind** inzwischen blind geschrieben
(siehe „Was bereits gebaut ist"). Bewusst **nicht** vorab ausgeführt bleiben:
die DB-übergreifenden Zwei-Client-Services (Stufe 6 C, echte Join-Design-
Entscheidung), die Mail-Boundary-Entscheidung (6 E, Produktentscheidung) und vor
allem der **destruktive Drop** (Stufe 9). Ohne generierten Client + `tsc`-Lauf
auf dem Host sind diese nicht verifizierbar; blind erzwungen würden sie
Spieler-Mail owner-privat verschieben bzw. Cross-DB-Logik erfinden. Sie sind als
geordnete, tsc-geführte Worklist festgehalten und benötigen die Stufen-für-
Stufen-Abnahme.
