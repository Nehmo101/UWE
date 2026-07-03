# Detailplan: Scan Inbox / Dokumentenscanner (`@uwe/scan-inbox`)

Stand: 2026-07-03 · Teil von [feature-roadmap-2026-07.md](feature-roadmap-2026-07.md) (Welle 1–3, Phasen S0–S3).

**Ziel:** Dokument hochladen/fotografieren → OCR → Typ-Erkennung → Feld-Extraktion →
Zielvorschlag → **Bestätigung durch den Owner** → Einsortierung. Niemals Auto-Ablage:
OCR irrt, Handschrift ist unsicher, Dokumente sind sensibel, Kanon darf nicht
versehentlich falsch werden.

> **Umsetzungsstand 2026-07-03:** S0 (Vision-Enabler) + S1-Kern gebaut.
> S0: Connector-Capability `vision_local` + Job `vision_extract` + RTX-Executor.
> S1-Package `@uwe/scan-inbox`: `ScanDocument`-Modell + pure Analyse
> (`field-extraction`, `kind-detection`, `proposal-builder`, `analyze`) + Service
> (create/applyAnalysis/file → Vertrag/Capture, waiting_for_rtx), 19 Tests inkl.
> End-to-End Rechnung→Vertrag. **Offen:** Studio-UI (Upload, Inbox, Detail) +
> OCR-Text-Rückschreiben aus der Connector-Queue; S2 (DnD-Modi); S3 (Rezept-Brücke).

---

## 1. Am Code verifizierte Design-Grundlagen

- **`AiProposal.worldId` ist non-nullable** → private Scans (ohne Welt) können den
  AiRun→AiProposal→Review-Flow nicht nutzen. Private Vorschläge liegen als typisiertes
  JSON auf dem Scan-Datensatz (Muster: `CaptureAiProposal` in `CaptureEntry.metadata`,
  siehe `packages/database/src/capture-triage-service.ts`). Nur die DnD-Scan-Modi
  (immer welt-gebunden) nutzen den echten AiProposal-Flow. Das Schema wird dafür
  **nicht** geändert.
- **RTX-Connector kann heute kein Vision**: `tools/uwe-rtx-connector/src/executors.ts`
  `llm_generate` postet text-only an Ollama `/api/chat`. Der Workflow-Slot `vision`
  (`ConnectorWorkflowSlot`) existiert bereits, wird aber von nichts bedient →
  OCR = neuer Job-Typ + Capability + Executor-Case (Phase S0).
- **Connector-Payloads reisen als JSON** (`connector_jobs.payload_json`; Connector ist
  outbound-only, es gibt keinen Host→Connector-Dateikanal) → Bilder als Base64,
  zwingend server-seitiges Downscale (≤ 1600 px JPEG via `@uwe/assets`
  image-processing) vor dem Enqueue; mehrseitige PDFs seitenweise verarbeiten und
  Seitenzahl cappen.
- **`createConnectorService` / `waitForConnectorJob` sind bereits aus
  `@uwe/database/server` exportiert** (Nutzer: `connectorQueueProvider.ts`) → das
  Feature-Package reiht lokale Jobs direkt ein. **Kein neuer `AiContextMode`, keine
  Änderung an `privacyGuard.ts`** — local-only gilt per Konstruktion, weil
  Queue-Jobs nie einen Cloud-Provider erreichen.
- **Dual-Schema**: jede Migration zusätzlich in `schema.postgresql.prisma` +
  `migrations-postgresql/` spiegeln.

## 2. Phase S0 — Connector-Vision-Enabler (eigenständig shipbar)

- `packages/connector/src/capabilities.ts`: Capability `vision_local`
  („Lokale Vision/OCR").
- `packages/connector/src/job-types.ts`: `vision_extract`
  (lane `gpu`, capability `vision_local`, nicht latency-sensitiv).
- Schema: `vision_extract` in `enum ConnectorJobType` (+ Postgres-Mirror, Migration).
- `tools/uwe-rtx-connector/src/local-capabilities.ts`: `vision_local` melden, wenn ein
  Ollama-Vision-Modell vorhanden ist (llava, minicpm-v, qwen2.5-vl — Erkennung über
  die Model-Families in `llm-discovery.ts`).
- `tools/uwe-rtx-connector/src/executors.ts`: neuer Case `vision_extract` → Ollama
  `/api/chat` mit `messages: [{ role: "user", content: prompt, images: [base64] }]`;
  Modellauflösung über `ConnectorWorkflowDefault`-Slot `vision`.
- Tests: `capabilities.test.ts`, Job-Typ-Descriptor-Abdeckung, `executors.test.ts`
  mit gemocktem Ollama.

## 3. Modell-Entscheidung: neues `ScanDocument`, kein `CaptureEntry`-Reuse

Abgewogen: CaptureEntry-Reuse brächte Triage-UI gratis, aber die 4-Status-Maschine
(`inbox/triaged/linked/archived`) kann die 7-Status-Pipeline nicht abbilden; OCR-Text,
erkannter Typ, extrahierte Felder, Unsicherheiten und Connector-Job-Referenz wären
unqueryable-JSON in `metadata`; die Capture-Inbox würde mit halb-analysierten Scans
geflutet. → **Neues Modell**, und „Als Capture ablegen" bleibt eines der Ablage-Ziele
(erzeugt `CaptureEntry`, bestehende Triage übernimmt) — Bestes aus beiden Welten.

```prisma
enum ScanDocumentStatus {
  unanalyzed      // hochgeladen, noch keine Analyse
  analyzing       // Connector-Job eingereiht/läuft
  waiting_for_rtx // kein vision_local-Connector online; Auto-Retry
  proposal_ready  // Vorschlag gebaut, wartet auf Owner
  uncertain       // Analyse lief, aber geringe Konfidenz / fehlende Felder
  filed           // Owner hat bestätigt, Ziel angelegt
  rejected
  archived
}

enum ScanDocumentKind {
  letter | invoice | contract_doc | warranty | receipt
  handwritten_note | recipe
  dnd_session_note | dnd_dungeon_note | dnd_handout
  unknown
}

enum ScanPrivacyLevel { private | dnd }   // private = hart lokal-only

model ScanDocument {
  id                  String @id @default(cuid())
  title               String @default("")
  status              ScanDocumentStatus @default(unanalyzed)
  privacyLevel        ScanPrivacyLevel   @default(private)
  storageKey          String              // Originaldatei (Namespace "_scan")
  mimeType            String
  fileSize            Int
  pageCount           Int?
  ocrText             String @default("")
  ocrEngine           String?             // "vision_llm" | "pdf_text"
  detectedKind        ScanDocumentKind @default(unknown)
  detectionConfidence String?             // low|medium|high
  extractedFields     Json?               // Schema pro Kind, s. u.
  proposal            Json?               // ScanFilingProposal
  uncertainties       Json?               // string[]
  connectorJobId      String?
  errorMessage        String?
  worldId             String?             // nur privacyLevel=dnd
  filedTargetType     String?             // AdminLinkTargetType-Wert oder "calendar_event"
  filedTargetId       String?
  filedAt / rejectedAt / createdAt / updatedAt ...
  @@index([status, createdAt]) @@index([detectedKind]) @@index([worldId])
  @@map("scan_documents")
}
```

Enum-Erweiterungen: `scan_document` in `AdminLinkSourceType`, `AdminLinkTargetType`,
`EntityTagEntityType` — Cross-Linking (`AdminEntityLink`) und Tagging gibt es damit
gratis; Vertrag↔Scan ist ein normaler `AdminEntityLink` (Target `contract_expense`
und `asset` existieren bereits).

## 4. Package `packages/scan-inbox` (`@uwe/scan-inbox`)

Services mit injiziertem PrismaClient (`createScanInboxService(db)`, Muster
`createCaptureTriageService`). Abhängig von `@uwe/database` (nur bestehende
Server-Barrel-Symbole), `@uwe/assets`, `@uwe/connector` (Typen), `@uwe/shared-utils`.
Jede Datei < 300 Zeilen:

- `scan-types.ts` — `ScanFilingProposal`, Status-Labels (deutsch), client-safe
  (keine Server-Deps; Muster `@uwe/database/capture-constants`).
- `field-schemas.ts` — Extraktions-Contract je Kind, manuelle Validatoren (Repo-Stil,
  kein zod):
  - `invoice`: vendor, amountCents, currency, dueDate, invoiceNumber, customerNumber, iban?
  - `contract_doc`: vendor, contractNumber, customerNumber, startDate, cancelByDate,
    renewalDate, amountCents, billingInterval
  - `warranty`: vendor, product, purchaseDate, warrantyEndDate, receiptRef
  - `receipt`: vendor, date, totalCents, lineItems?
  - `letter` / `handwritten_note`: sender, date, deadlines[], summary
  - `recipe`: title, servings, ingredients[{name, amount, unit}], steps[]
  - `dnd_*`: worldHint, sessionDateHint, entities[], playerSafeText vs. dmSecrets (Handout)
- `scan-upload.ts` — `saveScanUploadFile()` via `@uwe/assets`-Storage, Namespace
  `"_scan"` (Sibling von `packages/database/src/capture-upload.ts`, das unangetastet
  bleibt); Downscale vor OCR.
- `ocr-pipeline.ts` — `analyzeScanDocument(db, id)`:
  1. PDF mit Textlayer → `extractPdfText` (`packages/database/src/pdf-text-extract.ts`),
     `ocrEngine="pdf_text"`; Klassifikation/Extraktion dann via `llm_generate`
     (bestehender Job-Typ).
  2. Sonst: Connector-Summary auf `vision_local` prüfen; keiner online → Status
     `waiting_for_rtx` (kein toter Job in der Queue; Retry-Action + Auto-Redispatch,
     wenn die Inbox-Seite lädt und ein Connector online ist).
  3. `vision_extract` einreihen (ein Prompt: Volltranskript + Kind-Klassifikation +
     Kind-spezifische Felder + Unsicherheiten als JSON), `waitForConnectorJob` mit
     großzügigem Timeout (~180 s), parsen/validieren → `proposal_ready` oder `uncertain`.
- `proposal-builder.ts` — Felder → `ScanFilingProposal` (Zielvorschlag + vorausgefülltes
  Payload); nutzt Heuristiken/Labels aus `capture-triage-service.ts` statt zu duplizieren.
- `deadline-detection.ts` — pure Functions über Felder/Text → Reminder-Vorschläge
  `{ kind: "contract_cancel_by" | "calendar_event" | "todo_capture", date, label }`.
- `filing-service.ts` — läuft **nur auf explizite Owner-Aktion**, dünne Orchestrierung
  über bestehende Services:
  - **Vertrag**: `ContractExpense` anlegen/aktualisieren via `createLifeAdminService`;
    `cancelByDate`/`renewalDate` setzen (Fristen erscheinen dann gratis via
    `buildContractAlerts()` auf `/today`); `AdminEntityLink`
    `contract_expense → scan_document` („Beleg/Original").
  - **Capture**: `CaptureEntry` (content = ocrText, metadata trägt Scan-Referenz) →
    weiter im bestehenden Triage-/Konvertierungs-Flow.
  - **Life-Brain**: `PersonalBrainDocument` (gleicher Pfad wie Capture→Brain-Promotion).
  - **Todo/Termin**: `CaptureEntry` `uwe_todo` bzw. `CalendarEvent` (`kind: personal`).
  - **Rezept** (S3): `Recipe`-Draft in `@uwe/kitchen`.
  - Jede Ablage schreibt `filedTargetType/Id`, einen `AdminEntityLink` und Status `filed`.
- `index.ts` — Package-Barrel; neue Symbole **nicht** über `@uwe/database/server`.

## 5. Studio-UI

- `apps/studio/app/scan-inbox/page.tsx` — Status-Spalten (Unanalysiert / Wird
  analysiert / Wartet auf RTX / Vorschlag bereit / Unsicher / Abgelegt / Abgelehnt).
- `apps/studio/app/scan-inbox/[id]/page.tsx` — Original-Preview, editierbarer OCR-Text,
  erkannter Typ, Felder-Formular (vorausgefüllt), Unsicherheiten, Aktionen
  (Bestätigen & Ablegen / Ziel ändern / Erneut analysieren / Ablehnen / Archivieren).
- `apps/studio/app/scan-inbox-actions.ts` — dünne Server Actions (analyze, re-analyze,
  Felder editieren, Ablage bestätigen, reject, archive).
- `apps/studio/app/api/scan/upload/route.ts` — Multipart-Upload (API-Route per
  Konvention); `apps/studio/app/api/scan/[id]/file/route.ts` — Signed-Media-Serving
  (gleicher Mechanismus wie Capture-Medien).
- Nav-Eintrag in `apps/studio/src/navigation/studio-nav.ts` (+ `navigation.test.ts`).

## 6. Privacy

- `privacyLevel=private` (Default): Pipeline nutzt ausschließlich Connector-Queue-Jobs
  (`vision_extract`/`llm_generate`) — Cloud ist per Konstruktion unerreichbar; es gibt
  keinen Codepfad zu `cloudProvider.ts`. Package-Test im Geist von
  `personal-brain-privacy.test.ts`: die Pipeline-Module importieren keine
  Cloud-Provider-Symbole.
- Kein neuer `AiContextMode` für S1 (vermeidet Eingriffe in `privacyGuard.ts` /
  `contextBuilder.ts`). Falls später Scan-Q&A gewünscht: nach Ablage ins Life-Brain
  über den `personal_brain`-Modus.
- `privacyLevel=dnd` darf später der bestehenden Gateway-Policy folgen; S2 default lokal.

## 7. Phase S2 — DnD-Scan-Modi

- Scan als `privacyLevel=dnd` markieren + Welt-Picker.
- `dnd_session_note` → `AiRun` (taskType `scan_session_recap`, worldId gesetzt) +
  `AiProposal` mit strukturiertem Recap-Patch (Formen aus
  `structured-generator-schemas.ts` wiederverwenden) → Review/Apply über die
  bestehende `ai-review-service.ts`-UI inkl. Undo. **Kein Auto-Kanon.**
- `dnd_dungeon_note` → Vorschlag zielt auf Draft-`Page` (`publishStatus: draft`) mit
  Raumliste/Encounter/Fallen/Loot.
- `dnd_handout` → Extraktion trennt player-safe Text vs. DM-Geheimnisse; Ablage erzeugt
  Draft-Page mit SecretLevel-Content-Blocks (bestehende Mechanik); Portal-Filterung
  bleibt allein bei `packages/database/src/permissions.ts`.
- Charakterbögen: explizit out of scope (im Package-README dokumentieren).

## 8. Phasen & Verifikation

| Phase | Inhalt | Shipbar wenn |
|-------|--------|--------------|
| S0 | Vision-Capability/Job-Typ/Executor + Scope-Docs | Connector-Tests grün, Capability im Connector-Admin sichtbar |
| S1 | Schema + Upload + Pipeline private Kinds + Ablage (Vertrag/Capture/Life-Brain/Todo/Termin) + `/scan-inbox`-UI + Fristen-Erkennung | manuell: Foto → Vorschlag → Bestätigen → Vertrag mit `cancelByDate` erscheint auf `/today` |
| S2 | DnD-Modi (Welt-Picker, Recap via AiProposal, Dungeon-Zettel, Handout-Split) | Recap erscheint in AI-Review-UI, Apply/Undo funktioniert |
| S3 | Rezept-Brücke → `@uwe/kitchen`-Drafts (braucht Kitchen K1) | gescannte Kochbuchseite wird editierbarer Rezept-Entwurf |

Verifikation: Feld-Validator-Tests mit deutschen Fixture-Transkripten (Rechnungen/Briefe
inkl. Datumsformen wie „zum 31.03."), Proposal-Builder-Zielwahl, Deadline-Detection,
`waiting_for_rtx`-Übergänge mit Fake-Connector-Summary; isolierte Prisma-Service-Tests
(Muster `connectorQueueProvider.test.ts` / `@uwe/database/test-helpers`): Enqueue +
simulierte Completion → Statusübergänge, Ablage erzeugt `ContractExpense` +
`AdminEntityLink`. Gate: `pnpm quality` (inkl. File-Size-Budget); manuell E2E mit echtem
RTX-Connector + Vision-Modell und RTX-offline-Pfad.
