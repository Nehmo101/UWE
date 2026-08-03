# PDF zu Kampagnen Importer

## Context

UWE has a working **Import-Zentrale** (`/import`) that extracts PDF text and imports it as
Markdown into Life Brain, Capture, or a single DnD page — but it **cannot import into a
campaign**, and it produces flat text pages with no structure. A DM who has a PDF (adventure
module, prep notes) has no way to turn it into typed, campaign-scoped wiki content.

This feature adds a new **"Kampagne"** import target: upload a PDF → **local AI** extracts the
D&D/campaign entities it contains (NPCs, Orte, Fraktionen, Gegenstände, Quests, Begegnungen,
Lore) → preview them → create one campaign-scoped wiki `Page` per selected entity, under an
**existing** campaign of the chosen world.

**Scope decisions (confirmed with the user):**
1. Structuring = **local AI entity extraction** (not mechanical heading-splitting).
2. Target = an **existing** campaign (world + campaign selector; no campaign creation).
3. Surface = **extend the existing Import-Zentrale** (`/import`), reusing its job / preview /
   undo machinery.

**Non-negotiable privacy invariant:** the AI call is **local-only** (Maschinenraum). Cloud must be
impossible and no campaign/brain context is attached to the prompt.

> **Korrektur (2026-08-01):** Der ursprüngliche Satz versprach hier zusätzlich
> `visibility: "dm_only"` für jede erzeugte Seite. Das gibt es seit dem 26.07.2026 nicht
> mehr — die Per-Item-Sichtbarkeit wurde entfernt, und es gilt genau eine Regel:
> **wer einer Welt zugeordnet ist, sieht alles darin** (`packages/auth/src/permissions.ts`,
> [access-model.md](access-model.md)). Für fremdes Material ist die Welt selbst die Grenze:
> in eine Werkstatt-Welt ohne Spieler-Zuordnung importieren und die kuratierten Teile über
> die Massenaktion „In andere Welt übernehmen" weiterschieben
> (`@uwe/doc-import/transfer`). Die Herkunft steht in den Block-Metadaten
> (`sourceTitle`, `licence`) und wird auf der Seite angezeigt.

## Architecture / data flow

```
[PDF base64] → extractPdfText (reuse) → chunkPdfText → per-chunk routeAiRequest(local_engine)
   → parseCampaignEntities → dedupeEntitiesByTitle → buildCampaignPreview
   → store {items, entities} in ImportJob.previewPayload            ← PREVIEW (AI runs ONCE)

[jobId + selected itemIds] → read entities from previewPayload → entityToCreatePageInput
   → repo.createPage({ campaignId, visibility: dm_only, provenance }) per entity
   → captureImportCentralExecute(createdPageIds) + markCompleted     ← EXECUTE (no AI re-run)
```

Preview does all AI work and persists the extracted entities; **execute never re-runs the AI**
(avoids cost + non-determinism), it only writes the user-selected, already-previewed entities.
Rollback deletes the created pages via the existing undo path.

## New feature package: `packages/pdf-campaign-import`

Per module discipline ("neue Domänen-Services in ein Feature-Package", and
`import-central-service.ts` is already 690/700 lines so it must **not** be grown). Model on
`packages/knoteforge-import` (`package.json` `main`/`types` → `./src/index.ts`, `tsconfig.json`
extends `@uwe/config`). Keep it **pure**: type-only dependency on `@uwe/database`
(`CreatePageInput`, `PageType`), **no** `@uwe/ai-brain` dep and **no** DB writes — the AI call
and persistence live in the Studio action. `pnpm-workspace.yaml` already globs `packages/*`.

Small, independently unit-tested modules:

| File | Responsibility |
|---|---|
| `src/entity-schema.ts` | `ExtractedCampaignEntity` type + `EXTRACTABLE_KINDS` |
| `src/kind-page-type.ts` | `kindToPageType(kind)` → `PageType` (own map; fallback `"lore"`) |
| `src/prompt.ts` | `buildCampaignExtractionPrompt(chunk)` — German, "Antworte NUR als JSON-Array" |
| `src/parser.ts` | `parseCampaignEntities(aiText)` — tolerant JSON parse (mirrors `parseStructuredGeneratorOutput`), skips bad elements, never throws |
| `src/chunker.ts` | `chunkPdfText(text)` — ~6000 chars/chunk on `\n\n` boundaries, `MAX_CHUNKS≈20` cap |
| `src/dedupe.ts` | `dedupeEntitiesByTitle(entities)` — case/space-insensitive |
| `src/preview.ts` | `buildCampaignPreview(entities)` → `{ items: MarkdownImportPreviewItem[], entities, totalDocuments, errors, canExecute }` |
| `src/page-mapper.ts` | `entityToCreatePageInput(entity, ctx)` → `CreatePageInput` (dm_only page + `rich_text` block, provenance metadata) |
| `src/index.ts` | barrel |
| `src/*.test.ts` | unit tests for parser / chunker / dedupe / page-mapper |

**Entity shape:**
```ts
export const EXTRACTABLE_KINDS =
  ["npc","location","region","faction","item","quest","encounter","lore","note"] as const;
export interface ExtractedCampaignEntity {
  kind: (typeof EXTRACTABLE_KINDS)[number]; // → PageType
  title: string;            // required, non-empty
  summary?: string | null;  // page.summary
  body: string;             // required → dm_only rich_text block
  tags?: string[];
}
```

Then add `"@uwe/pdf-campaign-import": "workspace:*"` to `apps/studio/package.json` and
`pnpm install`.

## The local-only AI call (Studio action, not the package)

```ts
import { routeAiRequest, AiRouterError } from "@uwe/ai-brain";
import { createUweRepository, prisma } from "@uwe/database/server";

const routed = await routeAiRequest(
  { repo: createUweRepository(), prisma },
  {
    providerMode: "local_engine",     // hard local — NO cloud fall-through
    contextMode: "general_chat",   // attaches NO world/brain/campaign context
    taskType: /* a neutral task type, inert for general_chat */,
    userPrompt: buildCampaignExtractionPrompt(chunk),
    useMock,                        // dev/test hook (see Verification)
    maxTokens: 4096,
  },
);
const aiText = routed.result.text;
```

**Why this is provably local** (traced in `packages/ai-brain/src/router/aiRouter.ts`):
`resolveProviderRoute`'s `case "local_engine"` returns the local route if Maschinenraum is ready and
**throws `AiRouterError` otherwise — it never falls through to cloud**. We deliberately
**bypass `executeAiGatewayRequest`**, because the gateway's `resolveEffectiveProviderMode`
can flip a request to cloud when `AiGatewayConfig.routingMode === "CLOUD_ONLY"` (and
`general_chat` is a `CLOUD_ALLOWED` category, so the gateway would not block it). Trade-off to
note in the PR: bypassing the gateway skips its budget check + usage log — acceptable for MVP
(local inference has no $ cost; MAX_CHUNKS + 10 MB caps bound it).

**Maschinenraum offline:** `routeAiRequest` throws `AiRouterError`; the preview action catches it and
returns a clean `errors: ["Der lokale Maschinenraum ist offline — …"]` + `markFailed`. (The `deferred`
`ai_run` job path only applies to `personal_brain`/`mail`, so it is out of scope here.)

## Implementation steps (ordered, file-by-file)

1. **Schema** — `packages/database/prisma/schema.prisma` (~L2988): add `campaign` to
   `enum ImportTargetType`. SQLite stores enums as `TEXT` (no CHECK) → **no DDL**; follow the
   `uwe-database-migrations` skill: `pnpm --filter @uwe/database db:migrate` (likely an empty
   migration — commit it if generated), then `db:generate`, then `db:seed` to confirm.
2. **Label** — `packages/database/src/import-constants.ts` (L30): add
   `IMPORT_TARGET_TYPE_LABELS.campaign = "Kampagne"` (the total `Record` type forces this).
3. **Undo union** — `packages/database/src/undo-service.ts`: widen
   `ImportCentralExecuteSnapshot.targetType` (L118) and `captureImportCentralExecute`'s input
   (L380) to include `"campaign"`. **No restore-path change** — `undoImportCentralExecute`
   (L744) already deletes `createdPageIds` via `page.deleteMany`.
4. **New package** — scaffold `packages/pdf-campaign-import` (above) + tests; add dep to
   `apps/studio/package.json`; `pnpm install`.
5. **Support matrix** — `apps/studio/src/lib/import-central-utils.ts`:
   - `isImportCentralComboSupported`: in the `pdf` branch →
     `return MARKDOWN_TARGET_TYPES.has(t) || t === "campaign";` (campaign is **PDF-only**).
   - `importCentralUsesWorldTarget`: also return true for `"campaign"` (needs a world).
   - add `export function isImportCampaignTarget(t) { return t === "campaign"; }`.
   - **Leave `MARKDOWN_TARGET_TYPES` unchanged** so campaign is NOT routed through the
     markdown/PDF-markdown execute path.
6. **Job creation** — `apps/studio/app/import-central-actions.ts`:
   - add `"campaign"` to `VALID_TARGET_TYPES` (L41).
   - in `createImportCentralJobAction`: read `campaignSlug` from the form; when
     `targetType === "campaign"`, require it and validate the campaign belongs to the world via
     `repo.getCampaignBySlug(worldSlug, campaignSlug)`; store
     `metadata: { worldSlug, campaignSlug, campaignId: campaign.id }`
     (metadata JSON — **no new column**).
7. **New actions** — `apps/studio/app/import-campaign-actions.ts` (new, `"use server"`, each
   guarded by `requireStudioActionAuth()`):
   - `previewImportCampaignPdfJobAction(jobId, contentBase64)` — assert pdf+campaign; 10 MB
     cap; `extractPdfText` → `chunkPdfText` → per-chunk `routeAiRequest` → `parseCampaignEntities`
     → `dedupeEntitiesByTitle` → `buildCampaignPreview`; `updateJob({ status:"preview",
     previewPayload:{ kind:"campaign_entities", items, entities, totalDocuments, errors,
     canExecute, extractionMeta } })`; catch `AiRouterError` → Maschinenraum-offline error + `markFailed`.
   - `executeImportCampaignPdfJobAction(jobId, itemIds)` — read `previewPayload.entities` +
     `{worldId, campaignId}` from metadata; `markExecuting`; for each selected `ent-<i>` compute
     a unique slug (`slugifyPageTitle` + `pickUniqueSlug` against existing world+campaign slugs)
     → `repo.createPage(entityToCreatePageInput(...))`; collect `createdPageIds`; own finalize
     = `captureImportCentralExecute({ targetType:"campaign", worldId, jobId, createdPageIds })`
     + `markCompleted`; on error `markFailed`. **Signature takes only `jobId` + `itemIds`** (no
     base64 — entities are already stored).
8. **Panel** — `apps/studio/app/import/CampaignPdfImportPanel.tsx` (new): copy
   `PdfCentralImportPanel.tsx` (file→base64 via `arrayBufferToBase64`, per-item checkboxes,
   execute, undo hint). Columns **Art · Titel · Zusammenfassung**; execute calls the new action
   with `[...selectedIds]`.
9. **Page loader** — `apps/studio/app/import/page.tsx`: load each world **with its campaigns**
   (`repo.listCampaignsByWorld(world.slug)` → `{id,name,slug}[]`) and pass down.
10. **Workspace wiring** — `apps/studio/app/import/ImportCentralWorkspace.tsx`:
    - `WorldOption` gains `campaigns: {id;name;slug}[]`.
    - add `"campaign"` to the target `<select>` options (L311).
    - add a `campaignSlug` state + a campaign `<select>` (from `selectedWorld.campaigns`) shown
      when `isImportCampaignTarget(targetType)`; set `campaignSlug` on the form in
      `handleCreateJob`; disable start if campaign target with no campaign selected (hint:
      "Erst eine Kampagne in der Welt anlegen").
    - in `renderActiveJobImport`, add a branch for `isImportCampaignTarget(targetType) &&
      sourceType === "pdf"` → render `<CampaignPdfImportPanel jobId onComplete />`.
11. **Tests + quality gate** (see Verification).

## Key existing code to reuse (do not reinvent)

- `packages/database/src/pdf-text-extract.ts` → `extractPdfText(buffer)` (pdf-parse, 10 MB cap,
  rejects scanned/no-text PDFs).
- `packages/database/src/repository.ts` → `createPage(CreatePageInput)` (accepts `campaignId`,
  creates page + nested `contentBlocks`), `getCampaignBySlug`, `listCampaignsByWorld`;
  `slugifyPageTitle`, `pickUniqueSlug` (`page-templates.ts` / `slug-utils.ts`).
- `packages/database/src/import-job-service.ts` → `createImportJobService(prisma)` (job states,
  `previewPayload`/`metadata` JSON), `createUndoService(prisma)` capture/undo, existing
  `rollbackImportCentralJobAction`.
- `packages/database/src/structured-generator-schemas.ts` → `parseStructuredGeneratorOutput`
  pattern to mirror for the tolerant JSON parser.
- `apps/studio/app/import/PdfCentralImportPanel.tsx` → panel template;
  `apps/studio/src/lib/file-base64.ts` → `arrayBufferToBase64`.
- `apps/studio/src/lib/studio-action-auth.ts` → `requireStudioActionAuth()`.
- `packages/ai-brain/src/router/aiRouter.ts` → `routeAiRequest` (+ `AiRouterError`).

## Privacy / security (uwe-security-invariants)

- AI route pinned to `local_engine`; cloud is unreachable (traced). No brain/campaign context
  attached (`general_chat`). This satisfies "Cloud-AI ohne Kampagnen/Brain-Kontext".
- Every created `Page` and `ContentBlock` defaults to `visibility: "dm_only"` → never surfaces
  in the Portal.
- Provenance in block metadata: `{ source: "pdf-campaign-import", importJobId, sourceFile,
  extractedKind, aiRoute: "local_engine" }`.
- All new server actions call `requireStudioActionAuth()`. (Note: the `rateLimit:"ai"` preset
  applies to API routes, not Server Actions; MVP mitigations = local-only, MAX_CHUNKS, 10 MB.)

## Verification

**Unit tests (pure, no Maschinenraum)** in `packages/pdf-campaign-import`:
- `parser.test.ts`: valid array, ```` ```json ```` fences, trailing prose, `[]`, malformed
  element skipped, unknown `kind` → `note`.
- `chunker.test.ts`: long text → chunks ≤ cap, oversized paragraph hard-split, `MAX_CHUNKS` cap.
- `dedupe.test.ts`: case/space-insensitive title dedupe.
- `page-mapper.test.ts`: `visibility:"dm_only"` on page + block, `kindToPageType`, provenance,
  tags.

**End-to-end (manual)**:
```bash
cp -n .env.example .env
pnpm --filter @uwe/database db:deploy && pnpm --filter @uwe/database db:seed  # dm@uwe.local / uwe-dev
pnpm --filter @uwe/database db:generate
pnpm dev   # Studio :3000 → /import
```
Ensure the chosen world has ≥1 campaign. Source **PDF** → Target **Kampagne** → pick world +
campaign → start job → upload a text-layer PDF → **Vorschau** (entities show Art/Titel/
Zusammenfassung) → select → **Import ausführen** → confirm pages exist under the campaign with
`visibility: dm_only` → **Zurückrollen** deletes them.

- **Maschinenraum-less testing:** thread a dev-only `useMock` flag from the preview action —
  `checkEngineReadiness({useMock:true})` returns ready and `createLocalEngineProvider(...,{useMock:true})`
  returns `MockAiProvider`, so preview works without a Maschinenraum host.
- **Maschinenraum-offline check:** with `useMock:false` and no Maschinenraum, preview must surface the clean
  "Maschinenraum offline" error (not a crash).

**Quality gate:** `pnpm ci:light` (db:generate + lint + typecheck + test:ci + secret:scan +
docs:check) or `pnpm quality:quiet`. The file-size budget check confirms all new files < 700
lines and that `import-central-service.ts` is untouched.

## Risks & explicit MVP exclusions

- **Maschinenraum dependency** — unusable when Maschinenraum is offline (by privacy design); mitigated by clear
  error + `useMock` for tests.
- **Chunking / non-determinism** — cross-chunk entities may fragment; large PDFs may hit
  `MAX_CHUNKS` (surface `extractionMeta.truncated`); small local models may emit bad JSON.
  Mitigated by title dedupe, tolerant parser, "Erfinde nichts hinzu" prompt, and human
  preview + per-item selection + full undo before/after any write.

**Left out of MVP** (der OCR-Punkt ist inzwischen erledigt, siehe „Update: Unlimited-OCR"
unten)**:** OCR for scanned PDFs; D&D statblock/mechanics schemas (free-text `body`
only); any cloud opt-in; **new-campaign creation** (existing only); the async `ai_run` deferred
job; a `targetCampaignId` FK column (metadata JSON instead); markdown/obsidian → campaign
(PDF only).

## Update: große PDFs, Fortschritt, Einordnungs-Chat

Ausbau nach dem MVP (gleiche Privacy-Invarianten — alles weiterhin `local_engine`, `dm_only`):

- **300-MB-PDFs.** Der Upload läuft nicht mehr als Base64 durch die Server Action
  (15-MB-Action-Limit), sondern als `multipart/form-data` über
  `apps/studio/app/api/import/campaign-pdf-upload/route.ts` auf die Festplatte
  (`<uploadsRoot>/import-tmp/<jobId>.pdf`, Helper: `apps/studio/src/lib/campaign-pdf-storage.ts`).
  `extractPdfText` akzeptiert ein `maxBytes`-Override; `MAX_CAMPAIGN_PDF_BYTES = 300 MB`
  (Package). Die Roh-PDF wird nach erfolgreicher Analyse bzw. nach dem Execute gelöscht.
  Kontextfeld: `MAX_CAMPAIGN_CONTEXT_CHARACTERS = 32 000`; Chunk-Cap: `MAX_CHUNKS = 400`.
  Hinweis: Ein Reverse-Proxy vor dem Host (z. B. Cloudflare) kann eigene Upload-/Timeout-Limits
  setzen — im LAN gilt das 300-MB-Limit direkt.
- **Fortschrittsbalken.** Die Analyse schreibt nach jedem Chunk einen
  `campaign_analysis_progress`-Payload in `ImportJob.previewPayload`; das Panel pollt
  `getImportCampaignJobStatusAction` (2 s) und rendert Upload- (XHR-`onprogress`) und
  Analyse-Fortschritt. Der Zustand übersteht Seiten-Reloads und Verbindungsabbrüche; eine
  >3 min stille Analyse gilt als abgebrochen und kann neu gestartet werden. Bei leerem
  Ergebnis oder Fehlschlag bleibt die PDF liegen, damit ein neuer Versuch ohne Re-Upload geht.
- **Einordnungs-Konversation.** `campaignFitChatAction`
  (`apps/studio/app/import-campaign-chat-actions.ts`) + `CampaignFitChatCard`: Chat mit der
  lokalen KI darüber, wie sich die Kampagne in die Welt einfügt. Prompt-Builder
  `buildCampaignFitChatPrompt` (Package, `fit-chat.ts`) hängt Welt-/Kampagnenbeschreibung,
  Nutzer-Kontext und die extrahierten Entitäten an — bewusst **nur** an die lokale Inferenz;
  der Verlauf wird in `ImportJob.metadata.fitChat` persistiert (Reload-fest).
  Geteilte Payload-Reader liegen in `apps/studio/src/lib/campaign-import-payloads.ts`.

## Update: Unlimited-OCR als Extraktionspfad

Bewertung und Begründung: [docs/analysis/2026-07-28-unlimited-ocr-pdf-import.md](../analysis/2026-07-28-unlimited-ocr-pdf-import.md).

Die Textgewinnung war die Qualitätsgrenze des Imports — nicht das lokale Modell.
`extractPdfText` las nur den Textlayer: Scans scheiterten hart, und mehrspaltige
Abenteuerbände wurden zu flachem Text in kaputter Lesereihenfolge, den der Chunker
blind alle 6 000 Zeichen schnitt. Beides ist jetzt ersetzt.

### Neues Package `packages/pdf-ocr`

Rein (kein Prisma, kein AI-Router), Tests ohne Maschinenraum:

| Datei | Aufgabe |
|---|---|
| `src/model.ts` | `UNLIMITED_OCR_MODEL`, `buildOcrPrompt`, `isUnlimitedOcrModel`, `resolveDocumentOcrModel` |
| `src/text-layer.ts` | `assessTextLayer` — `usable` / `absent` / `sparse` / `garbled` |
| `src/render.ts` | `renderPdfPages`, `readPdfPageCount` (pdf-parse `getScreenshot`) |
| `src/plan.ts` | `planOcrPages` — `MAX_OCR_PAGES = 120`, `OCR_PAGES_PER_JOB = 4` |
| `src/markers.ts` | `stripDetectionMarkers` — trennt Markdown von `<|det|>`-Boxen |

**Keine neue Abhängigkeit.** `pdf-parse@2.4.5` war bereits im Baum und bringt
`@napi-rs/canvas` mit; das Rendern von PDF-Seiten braucht weder pdfjs-dist noch
mupdf noch poppler. Verkleinert wird mit dem vorhandenen `downscaleImageForVision`.

### Datenfluss

```
PDF → readPdfTextLayer  ──usable──→  Text (schneller Weg, unverändert)
          │
          └─absent/sparse/garbled─→ planOcrPages → renderPdfPages
                → downscaleImageForVision → vision_extract (Unlimited-OCR)
                → stripDetectionMarkers → joinOcrPages → Markdown
                                                    ↓
                              chunkCampaignText (Überschriften statt 6 000 Zeichen)
                                                    ↓
                                    routeAiRequest(local_engine) wie bisher
```

Orchestrierung: `apps/studio/src/lib/campaign-pdf-ocr.ts` (`acquireCampaignPdfText`).
Das Package bleibt rein; Prisma und Connector hängen nur an der Studio-Seite.

### Ersetzte Standards

| Vorher | Jetzt |
|---|---|
| `PdfExtractError` ohne Code | `PdfExtractErrorCode` + `isMissingTextLayerError` — der OCR-Fallback hängt nicht mehr an einer Fehlermeldung |
| Harter Abbruch bei textloser PDF | `readPdfTextLayer` liefert Text + Seitenzahl, ohne zu werfen |
| `chunkPdfText` blind alle 6 000 Zeichen | `chunkCampaignText` → Überschriften-Schnitt, sobald Struktur da ist |
| `vision_extract` Default `llava` | Unlimited-OCR; `VISION_MODEL_PATTERNS` kennt `unlimited-ocr` und `deepseek-ocr` |
| Scan-Inbox mit generischem Vision-Prompt | derselbe `buildOcrPrompt` + dasselbe Modell wie der Kampagnen-Import |
| Vorschau kannte nur `errors` (rot) | zusätzlich `notes` (`tone="info"`) für OCR-Herkunft, Seiten-Cap, leere Seiten |

### Betrieb (Self-Service)

Die Modellwahl läuft über den **bestehenden `vision`-Workflow-Slot**
(Command Center → Modelle). Kein neues Setting, keine host-lesbare Datei: der
Modellname reist im `vision_extract`-Payload zum Connector. Einziger manueller
Host-Schritt bleibt einmalig:

```bash
ollama pull frob/unlimited-ocr:q8_0
```

Ohne gesetzten Slot gilt `UNLIMITED_OCR_MODEL` als Vorgabe. Steht dort ein
generisches Vision-Modell, läuft der Import weiter — die Vorschau weist dann
aber darauf hin, dass die Layout-Treue eingeschränkt ist.

### Grenzen

- **`MAX_OCR_PAGES = 120`.** Darüber wird abgeschnitten und in `notes` gemeldet —
  nicht still. Grund: `LANE_CONCURRENCY.gpu = 1`, ein 400-Seiten-Band würde den
  Connector für alle anderen Aufgaben blockieren.
- **Ollama muss llama.cpp ≥ Build 168 tragen**, sonst lädt das Modell nicht.
- **Abbildungen hängen an der PDF-Seite, nicht am Absatz.** Trägt eine Seite eine
  Karte und drei Absätze, bekommen alle daraus erzeugten Wiki-Seiten die Karte.
  Welcher Absatz zu welcher Karte gehört, ist aus dem Layout nicht sicher
  ableitbar — lieber einmal zu viel angehängt (`dm_only`, per Undo entfernbar)
  als die Karte zu verlieren.

## Update: Hintergrund-Job, Bild-Zuschnitt, Command-Center-Einrichtung

### Analyse läuft als `Job`, nicht mehr in der Server Action

`apps/studio/src/lib/campaign-import-job.ts` — `runCampaignPdfAnalysis` trägt die
komplette Analyse. `previewImportCampaignPdfJobAction` prüft nur noch (Auth,
PDF vorhanden, Kontextlänge, läuft schon?) und legt einen `Job` vom Typ `import`
mit der Payload `{ kind: "campaign_pdf_analysis", … }` an; `runImportJob`
verzweigt über `isCampaignPdfAnalysisPayload` dorthin.

Warum: OCR über ein Abenteuerbuch ist Minuten- bis Stundenarbeit auf der
seriellen GPU-Lane. Synchron hieß das Timeouts, ein abgebrochener Request ließ
die Analyse verwaist weiterlaufen, und ein Neustart hinterließ hängenden
Fortschritt. Jetzt greifen Cancel (`isCancelled` zwischen den Chunks), der
Boot-Sweep für unterbrochene Jobs und `Job.progress` in der Job-Übersicht.

Die Action gibt `{ preview: null, started: true }` zurück, wenn der Lauf startet;
das Panel verfolgt den Fortschritt über das bereits vorhandene Polling. Liegt
schon eine Vorschau vor, kommt sie unverändert sofort zurück.

### Karten und Abbildungen werden Assets

`OCR_PAGES_PER_JOB` ist jetzt **1**. Nur so ist jede Ausgabe — und damit jede
`<|det|>`-Box — eindeutig einer PDF-Seite zuzuordnen; das ist die Voraussetzung
für den Zuschnitt. Nebeneffekt: der Fortschritt zählt echte Seiten.

Kette: `boxToPixelRect` (normierte 0–999-Koordinaten → Pixel, auf die Seite
beschnitten) → `isCroppableRegionType` (nur `figure`/`image`/`map`/`chart`/
`diagram`, kein Text) → `cropImageRegion` (`@uwe/assets`, sharp → JPEG) →
Ablage neben der PDF unter `import-tmp/<jobId>-fig-<n>.jpg`.

Beim Execute übernimmt `apps/studio/src/lib/campaign-figure-assets.ts` sie als
`Asset` (dm_only, Provenienz in `metadata`) und hängt sie per `image`-Block an
die Seiten, deren Quell-Chunk dieselbe PDF-Seite abdeckte.

Die Zuordnung Chunk → PDF-Seite läuft über unsichtbare Marker
(`<!-- uwe:page N -->`), die `joinOcrPages` einfügt. Sie überstehen das Chunking,
werden per `readPageNumbers` ausgelesen und per `stripPageMarkers` entfernt,
**bevor** der Chunk an die lokale KI geht — das Modell sieht sie nie.

### Bildblöcke werden jetzt auch angezeigt

Beim Nachprüfen fiel auf, dass der Zuschnitt zwar in der DB landete, auf der
Seite aber **unsichtbar** blieb: `buildPageViewForViewer` reichte nur
`block.content` an den Renderer, und ein Bildblock hat dort nichts stehen — er
wurde am Ende von `filter(Boolean)` verworfen. Das betraf alle Bildblöcke, nicht
nur die aus dem Import; der Editor (`ContentBlockImageField`) konnte sie seit
jeher anlegen, die Leseansicht zeigte sie nie.

`page-viewer-service.ts` rendert Blöcke mit `assetId` jetzt als
`<figure class="wiki-figure"><img src="/api/assets/<id>/file"></figure>`, mit dem
Blocktext als Bildunterschrift und Alternativtext. Beides HTML-maskiert, die
Asset-ID zusätzlich URL-kodiert.

Sichtbarkeit ändert sich dadurch nicht: `filterBlocksForViewer` entfernt vorher
schon alles, was der Betrachter nicht sehen darf, und die Regel ist pro Welt
alles-oder-nichts. Ein Bildblock erscheint damit genau dann, wenn die Textblöcke
derselben Seite erscheinen.

Dazu eine globale CSS-Begrenzung in `apps/studio/app/wiki.css`. Die vorhandene
`.wiki-content img`-Regel steckt in `@media (max-width: 960px)` — auf dem Desktop
hätte ein 1600 px breiter Seiten-Zuschnitt das Layout gesprengt.

### Das Portal zeigt Bildblöcke ebenfalls

Der erste Wurf hatte nur den Studio-Pfad erwischt: Das Portal rendert über
`renderBlockContentForViewer` direkt statt über `buildPageViewForViewer`. Ein DM,
der eine Seite für Spieler freigibt, hätte ihnen den Text ohne die Karten gezeigt.

Die Auszeichnung liegt deshalb jetzt in `packages/database/src/content-block-html.ts`
und wird von beiden Apps benutzt. Die Asset-URL kommt vom Aufrufer, weil die
Verträge sich unterscheiden:

| App | URL | Zugriffsregel |
|---|---|---|
| Studio | `/api/assets/<id>/file` | Studio-Häkchen (DM sieht ohnehin alles) |
| Portal | `/api/assets/<id>/file?world=<slug>` | Welt-Zuordnung |

Die Portal-Route (`apps/portal/app/api/assets/[assetId]/file/route.ts`) **gab es
bereits**. Sie bindet das Asset über `getAssetForViewer` per
`where: { id, world: { slug } }` an die Welt und prüft `canReadAsset` — eine
Asset-ID aus einer fremden Welt läuft ins Leere, auch wenn der Nutzer für die
angegebene Welt berechtigt ist. Der `world`-Parameter ist deshalb Pflicht, und
`portalAssetUrl(worldSlug)` setzt ihn.

Sichtbarkeit bleibt unverändert: `filterBlocksForViewer` greift vor dem Rendern.
Ein Bildblock erscheint genau dann, wenn die Textblöcke derselben Seite
erscheinen — es entsteht kein neuer Pfad, über den dm_only-Inhalt ins Portal
gelangt. Auch das Portal bekam die globale `figure.wiki-figure`-CSS-Regel, aus
demselben Grund wie Studio.

### Miniaturbilder in der Import-Vorschau

Neue Route `apps/studio/app/api/import/campaign-figure/route.ts`. Nötig, weil die
Zuschnitte zum Vorschau-Zeitpunkt noch kein Asset sind — sie liegen als
Zwischenmaterial in `import-tmp` und haben keine reguläre URL.

Damit daraus kein beliebiger Datei-Leser wird, greifen zwei Prüfungen: Der Job
muss ein PDF-zu-Kampagne-Job sein, **und** der angefragte Index muss in dessen
`extractionMeta.figures` stehen. Pfad-Traversal deckt `assertSafeJobId` im
Storage-Helper ab. `Cache-Control: no-store`, weil das Material nach dem Execute
verschwindet.

Das Panel zeigt die Zuschnitte als Karte „Gefundene Abbildungen" mit Seitenzahl
und Typ. Der Zustand kommt über `CampaignPdfJobStatus.figures`, also denselben
Poll-Endpunkt wie der Fortschritt — die Galerie übersteht damit einen Reload.

### Command Center: Einrichtungsansicht

`apps/engine-connector-client/src/components/DocumentOcrPanel.tsx`, ganz oben unter
*Modelle*. Drei Schritte mit Status-Badge: Modell laden (Pull-Befehl im Klartext,
Kopierknopf, Ein-Klick-Pull mit Fortschrittsbalken), für UWE freigeben, im
Studio als Vision-Slot wählen. Dazu Unlimited-OCR als Katalog-Eintrag in
`@uwe/cookbook` mit neuem Anwendungsfall `document_ocr`.
