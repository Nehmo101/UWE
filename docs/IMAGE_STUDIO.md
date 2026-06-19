# Image Studio

Odysseus-inspiriertes Bild-Studio für UWE — Generierung, Bearbeitung, Inpainting, Background Removal, Varianten.

## Features (Phase 1 — nutzbar)

- **Bildgenerierung** per Prompt (Job-Queue) — Operationen `generate`, `variant`, `inpaint`, `edit`, `remove_background` (RTX)
- Provider-Routing: RTX Agent (lokal) → optional Cloud (OpenAI DALL-E, nur generate/variant)
- Projekt-/Versions-Tracking mit **reviewbare Drafts** (`metadata.reviewStatus`)
- Ergebnis als Asset in Medienbibliothek — **automatische Verknüpfung** zu verlinkten Seiten/Entitäten
- **Prompt-Datenschutz:** `contextMode` steuert ob Welt-/Brain-Kontext an Provider geht (Cloud: nur `prompt_only`)
- Medienzuordnung zu Seiten, Labels, Sessions, Capture, Werkstatt, Hardware, Verträge (via `ImageStudioLink`)
- Mobile-first Admin-UI unter `/image-studio`

**Phase 2 (neu):** Asset-Adoption Action, Capture-Bild-Upload, Workshop-Label-Templates.

## ENV

| Variable | Default | Beschreibung |
|----------|---------|--------------|
| `IMAGE_STUDIO_ENABLED` | `true` | Feature aktiv |
| `IMAGE_STUDIO_DEFAULT_PROVIDER` | `auto` | `auto` \| `local_rtx` \| `cloud` |
| `IMAGE_STUDIO_ALLOW_CLOUD` | `false` | Cloud-KI bewusst aktivieren |
| `IMAGE_STUDIO_BG_REMOVAL` | `true` | Background-Removal Task erlaubt |
| `IMAGE_STUDIO_CLOUD_MODEL` | `dall-e-3` | Cloud-Modell |
| `RTX_AGENT_URL` | — | RTX Image Endpoint `/v1/images` |
| `RTX_AGENT_TOKEN` | — | Bearer Token |

## Routing

1. **auto**: RTX Healthcheck → bei Erfolg lokal, sonst Cloud (wenn erlaubt).
2. **local_rtx**: Nur RTX Agent — kein Cloud-Fallback.
3. **cloud**: Nur wenn `IMAGE_STUDIO_ALLOW_CLOUD=true` und API-Key gesetzt.

Brain/Weltdaten werden **nicht** an Cloud gesendet — nur der Bild-Prompt im Modus `prompt_only`.

### Prompt-Kontext (`contextMode`)

| Modus | Cloud | RTX |
|-------|-------|-----|
| `prompt_only` | ✅ | ✅ |
| `page_context` | ❌ | ✅ |
| `brain_context` | ❌ | ✅ |
| `object_context` | ❌ | ✅ |

Implementierung: `packages/image-studio/src/prompt-privacy.ts` — `assembleImageStudioPrompt()`, `validateImageContextForProvider()`.

## RTX Agent Erweiterung

Der RTX Agent (`tools/uwe-rtx-agent`) sollte Endpoint `POST /v1/images` implementieren:

```json
{
  "task": "generate|edit|inpaint|remove_background|variant",
  "prompt": "...",
  "source_image": "<base64 optional>",
  "mask": "<base64 optional>"
}
```

Response: `{ "image": "<base64>", "mime_type": "image/png" }`

## Nutzung

1. `/image-studio` öffnen
2. Welt, Operation, Prompt wählen
3. Job unter `/jobs` verfolgen
4. Fertiges Bild als Asset — in `/worlds/{slug}/assets` sichtbar

## Datenmodelle

- `ImageStudioProject` — Projekt/Session
- `ImageStudioVersion` — Version mit Operation + Asset-Referenz
- `ImageStudioLink` — Verknüpfung zu Page, Label, Session, etc.

## Offene TODOs (Phase 2)

- Canvas-Inpainting-UI mit Maskenzeichnung
- Direkte Verknüpfung aus Seiten-Editor
- Batch-Varianten
- Label-Druck Integration
