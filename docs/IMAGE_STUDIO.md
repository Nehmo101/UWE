# Image Studio

Odysseus-inspiriertes Bild-Studio für UWE — Generierung, Bearbeitung, Inpainting, Background Removal, Varianten.

## Features (Phase 1 — nutzbar)

- **Bildgenerierung** per Prompt (Job-Queue) — Operationen `generate`, `variant`, `inpaint`, `edit`, `remove_background`
- Ein Weg: die outbound RTX-Host-Connector-Queue. Cloud-Anbieter gibt es seit N.3 nicht mehr
- Projekt-/Versions-Tracking mit **reviewbare Drafts** (`metadata.reviewStatus`)
- Ergebnis als Asset in Medienbibliothek — **automatische Verknüpfung** zu verlinkten Seiten/Entitäten
- **Prompt-Kontext:** `contextMode` steuert, ob Welt-/Brain-Kontext im Prompt landet — er verlässt den Host ohnehin nicht
- Medienzuordnung zu Seiten, Labels, Sessions, Capture, Werkstatt, Hardware, Verträge (via `ImageStudioLink`)
- Mobile-first Admin-UI unter `/image-studio`

**Phase 2 (neu):** Asset-Adoption Action, Capture-Bild-Upload, Workshop-Label-Templates.

## ENV

| Variable | Default | Beschreibung |
|----------|---------|--------------|
| `IMAGE_STUDIO_ENABLED` | `true` | Feature aktiv |
| `IMAGE_STUDIO_BG_REMOVAL` | `true` | Background-Removal Task erlaubt |
| `RTX_USE_CONNECTOR_IMAGE` | `true` | Connector-Queue benutzen; `false` schaltet Image Studio praktisch ab |
| `RTX_BASE_URL` | — | Direkter RTX Worker Endpoint `/v1/images` |
| `RTX_SERVICE_TOKEN` | — | Bearer Token |

## Routing

Es gibt nur einen Weg: die outbound RTX-Host-Connector-Queue. Ist sie nicht da,
meldet Image Studio das und tut nichts — ein Ausweichweg wäre genau der
Cloud-Weg, den es nach N.3 nicht mehr geben soll.

### Prompt-Kontext (`contextMode`)

`prompt_only` schickt nur den Prompt, die anderen Modi hängen einen Welt-,
Brain- oder Objekt-Ausschnitt an. Alle sind erlaubt: der Prompt geht an den
eigenen Host.

Implementierung: `packages/image-studio/src/prompt-privacy.ts` — `assembleImageStudioPrompt()`.

## RTX Bild-Endpoint (Legacy)

> Image Studio ist **Beta** — Masken-Canvas für Inpainting vorhanden, das
> Fehlerhandling ist stellenweise dünn — siehe [FEATURE_MATURITY_MATRIX.md](FEATURE_MATURITY_MATRIX.md).

Der lokale Bild-Worker sollte Endpoint `POST /v1/images` implementieren. Der aktive
Weg ist der outbound Maschinenraum ([rtx-connector.md](rtx-connector.md));
für direkte Worker-Endpunkte sind `RTX_BASE_URL` / `RTX_SERVICE_TOKEN` die aktuellen
Namen:

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

## Offene TODOs

- `failed`-Handling in allen Pfaden vereinheitlichen

**Erledigt:** Generate/Variant/Inpaint-API, Masken-Canvas (`ImageStudioMaskCanvas`), Seiten-Link aus Editor, Label-Druck-Integration (Basis).
