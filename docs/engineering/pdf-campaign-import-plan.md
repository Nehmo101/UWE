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

**Non-negotiable privacy invariant:** the AI call is **local-only** (RTX). Cloud must be
impossible, no campaign/brain context is attached to the prompt, and every created page +
content block defaults to `visibility: "dm_only"` (so it never reaches the Portal).

## Architecture / data flow

```
[PDF base64] → extractPdfText (reuse) → chunkPdfText → per-chunk routeAiRequest(local_rtx)
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
    providerMode: "local_rtx",     // hard local — NO cloud fall-through
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
`resolveProviderRoute`'s `case "local_rtx"` returns the local route if RTX is ready and
**throws `AiRouterError` otherwise — it never falls through to cloud**. We deliberately
**bypass `executeAiGatewayRequest`**, because the gateway's `resolveEffectiveProviderMode`
can flip a request to cloud when `AiGatewayConfig.routingMode === "CLOUD_ONLY"` (and
`general_chat` is a `CLOUD_ALLOWED` category, so the gateway would not block it). Trade-off to
note in the PR: bypassing the gateway skips its budget check + usage log — acceptable for MVP
(local inference has no $ cost; MAX_CHUNKS + 10 MB caps bound it).

**RTX offline:** `routeAiRequest` throws `AiRouterError`; the preview action catches it and
returns a clean `errors: ["Lokale RTX ist offline — …"]` + `markFailed`. (The `deferred`
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
     canExecute, extractionMeta } })`; catch `AiRouterError` → RTX-offline error + `markFailed`.
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

- AI route pinned to `local_rtx`; cloud is unreachable (traced). No brain/campaign context
  attached (`general_chat`). This satisfies "Cloud-AI ohne Kampagnen/Brain-Kontext".
- Every created `Page` and `ContentBlock` defaults to `visibility: "dm_only"` → never surfaces
  in the Portal.
- Provenance in block metadata: `{ source: "pdf-campaign-import", importJobId, sourceFile,
  extractedKind, aiRoute: "local_rtx" }`.
- All new server actions call `requireStudioActionAuth()`. (Note: the `rateLimit:"ai"` preset
  applies to API routes, not Server Actions; MVP mitigations = local-only, MAX_CHUNKS, 10 MB.)

## Verification

**Unit tests (pure, no RTX)** in `packages/pdf-campaign-import`:
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

- **RTX-less testing:** thread a dev-only `useMock` flag from the preview action —
  `checkRtxReadiness({useMock:true})` returns ready and `createLocalRtxProvider(...,{useMock:true})`
  returns `MockAiProvider`, so preview works without an RTX host.
- **RTX-offline check:** with `useMock:false` and no RTX, preview must surface the clean
  "RTX offline" error (not a crash).

**Quality gate:** `pnpm ci:light` (db:generate + lint + typecheck + test:ci + secret:scan +
docs:check) or `pnpm quality:quiet`. The file-size budget check confirms all new files < 700
lines and that `import-central-service.ts` is untouched.

## Risks & explicit MVP exclusions

- **RTX dependency** — unusable when RTX is offline (by privacy design); mitigated by clear
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

Ausbau nach dem MVP (gleiche Privacy-Invarianten — alles weiterhin `local_rtx`, `dm_only`):

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

Rein (kein Prisma, kein AI-Router), Tests ohne RTX:

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
                                    routeAiRequest(local_rtx) wie bisher
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

- **Kein Fortschritt innerhalb eines Batches.** Vier Seiten sind eine Einheit;
  der Balken springt pro Block, nicht pro Seite.
- **`MAX_OCR_PAGES = 120`.** Darüber wird abgeschnitten und in `notes` gemeldet —
  nicht still. Grund: `LANE_CONCURRENCY.gpu = 1`, ein 400-Seiten-Band würde den
  Connector für alle anderen Aufgaben blockieren.
- **Die Analyse läuft weiterhin synchron in der Server Action.** Für große
  Bände wäre der `Job`-Runner der richtige Ort; das ist bewusst nicht Teil
  dieser Runde.
- **`regions` werden erfasst, aber noch nicht zugeschnitten.** Karten und
  Abbildungen landen als Zähler in `extractionMeta`; der Zuschnitt über
  `@uwe/assets` ist der nächste sinnvolle Schritt.
- **Ollama muss llama.cpp ≥ Build 168 tragen**, sonst lädt das Modell nicht.
