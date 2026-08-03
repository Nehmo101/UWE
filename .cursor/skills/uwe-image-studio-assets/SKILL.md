# Image Studio, Assets & Labels

Skill für durchgängige Medien-Workflows in UWE: Image Studio, Asset-Verknüpfungen, Capture-Upload, Label-Druck.

## Architektur

| Schicht | Paket / Ort | Verantwortung |
|---------|-------------|---------------|
| **Assets** | `packages/assets` | Storage Keys, Upload-Validierung, Signed Media |
| **Asset-Links** | `packages/database/src/asset-link-service.ts` | Verknüpfung Asset ↔ Page, Capture, Workshop, Hardware, Contract |
| **Image Studio** | `packages/image-studio` | Provider-Routing, Prompt-Datenschutz |
| **Labels** | `packages/database/src/label-*.ts` | 6×4 Editor, Workshop/Filament-Templates |
| **Studio UI** | `apps/studio` | `/image-studio`, `/capture`, `/worlds/.../labels` |

## Asset-Verknüpfungen

```typescript
import { linkAssetToTarget, adoptAssetToTarget } from "@uwe/database/server";

// Seite (NPC, Location, Handout)
await linkAssetToTarget(db, { assetId, targetType: "page", targetId: pageId });

// Werkstatt, Capture, Hardware, Vertrag
await linkAssetToTarget(db, { assetId, targetType: "workshop_project", targetId: workshopId });
```

Image-Studio-Jobs verknüpfen Ergebnisse automatisch über `syncImageStudioProjectLinksToAsset` wenn `ImageStudioLink` gesetzt ist.

## Image Studio Datenschutz

**Harte Regel:** Kein privater Welt-/Brain-/Objekt-Kontext an Cloud-Provider.

- `contextMode: "prompt_only"` — einziger Cloud-sicherer Modus
- `page_context`, `brain_context`, `object_context` — nur Maschinenraum/lokal
- `assembleImageStudioPrompt()` strippt Kontext für Cloud
- `scanPromptForPrivateDataLeak()` warnt bei verdächtigen Prompt-Markern

```typescript
import { validateImageContextForProvider } from "@uwe/image-studio";

validateImageContextForProvider("cloud", contextMode, { cloudContextApproved });
```

## Label-Workflows

| Use Case | Template-Slug | Builder |
|----------|---------------|---------|
| DnD Handout | `handout-compact` | `buildLabelContentFromPage` |
| Miniatur-Kiste | `miniature-box` | `buildWorkshopLabelContent` |
| Terrain-Kiste | `terrain-box` | `buildWorkshopLabelContent` |
| Filament-Spule | `filament-spool` | `buildFilamentLabelContent` |
| 3D-Druck Projekt | `3d-print-project` | `buildWorkshopLabelContent` |

QR-Elemente nutzen `buildUwePageQrUrl(baseUrl, worldSlug, pageSlug)`.

## Capture Mobile Upload

- UI: `apps/studio/components/CaptureImageUpload.tsx`
- API: `POST /api/capture/upload` (multipart, `capture="environment"`)
- Mit `worldSlug`: erstellt Asset + `AdminEntityLink` capture → asset

## Quality Gate

```bash
pnpm --filter @uwe/database db:generate
pnpm quality
```

Relevante Tests:
- `packages/database/src/asset-link-service.test.ts`
- `packages/database/src/label-workshop-service.test.ts`
- `packages/image-studio/src/prompt-privacy.test.ts`

## Docs

- `docs/IMAGE_STUDIO.md`
- `docs/LABELS.md`
- `docs/FEATURE_MATURITY_MATRIX.md`
