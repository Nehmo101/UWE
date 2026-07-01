# Claude Design — Atlas & UWE Export-Bundle

Dieses Verzeichnis bündelt die wichtigsten **Atlas-Implementierungsdateien** und **Design-Dokumente** aus dem UWE-Repo für Arbeit mit Claude (Design, UI, Kartografie-Stil).

> **Hinweis:** `data.json` wird nicht im Quellcode versioniert, sondern als **repräsentatives Beispiel** erzeugt (portal-gefiltert, mit Biom, Fluss, Straße, Region und Stadt-Pin). Neu erzeugen:
> `pnpm --filter @uwe/static-export exec tsx scripts/generate-claude-design-data.ts`

## Schnellstart für Claude

1. **`source/`** — Primärdateien hochladen oder verlinken:
   - `AtlasEditor.tsx` — Studio-Editor (~3.7k Zeilen, Canvas2D + SVG-Overlay)
   - `atlas-viewer.js` — Statischer read-only Viewer (lädt `data.json`)
   - `data.json` — Export-Payload (Preset, Glyphen, Nodes, Features, Objects)
2. **`docs/atlas/`** — Stilvorgaben Tinten-Kartografie + Piktogramm-Katalog
3. **`reference/`** — Glyphen-Registry, Style-Presets, Portal-Viewer, Design-Tokens
4. **`docs/uwe-design/`** — UWE Design V2, Theme-System, Design-System-README

Lokale Vorschau des statischen Viewers (ohne Portal-CSS):

```bash
cd docs/design/claude-design-export/source
python3 -m http.server 8765
# http://localhost:8765/preview.html
```

## Verzeichnisstruktur

```
claude-design-export/
├── README.md                 ← diese Datei
├── source/
│   ├── AtlasEditor.tsx       ← Studio Atlas-Editor (apps/studio/…)
│   ├── atlas-viewer.js       ← Statischer Viewer (packages/static-export/static/…)
│   ├── data.json             ← Beispiel-Export (atlas/data.json Format)
│   └── preview.html          ← Minimale HTML-Hülle für lokale Vorschau
├── docs/
│   ├── atlas/                ← Kartografie-Stil & Orchestrator
│   └── uwe-design/           ← UWE Shell, Themes, Design-System
└── reference/
    ├── glyphs.ts             ← Kanonische Piktogramm-Registry (@uwe/atlas)
    ├── style-presets.ts      ← tolkien-ink Preset (Farben, Typo, Deko)
    ├── AtlasViewer.tsx       ← Portal read-only Gegenstück zum Editor
    ├── design-v2-tokens.css  ← UWE Design-V2 CSS-Variablen
    └── colors.css, typography.css, spacing.css  ← design-system/tokens
```

## Original-Pfade im Repo

| Export-Datei | Quelle |
|---|---|
| `source/AtlasEditor.tsx` | `apps/studio/src/components/atlas/AtlasEditor.tsx` |
| `source/atlas-viewer.js` | `packages/static-export/static/atlas-viewer.js` |
| `source/data.json` | Erzeugt via `writeAtlasStaticBundle` / `export-atlas.ts` |
| `reference/glyphs.ts` | `packages/atlas/src/glyphs.ts` |
| `reference/style-presets.ts` | `packages/atlas/src/style-presets.ts` |
| `reference/AtlasViewer.tsx` | `apps/portal/src/components/atlas/AtlasViewer.tsx` |

## Empfohlene Claude-Prompts

**Atlas UI polieren:** Lade `AtlasEditor.tsx`, `atlas-style-reference.md`, `atlas-pictogram-styleguide.md`, `glyphs.ts`, `style-presets.ts`.

**Statischer Export / Handout:** Lade `atlas-viewer.js`, `data.json`, `atlas-pictogram-styleguide.md`.

**UWE Shell konsistent halten:** Lade `design-v2-reference.md`, `design-system-README.md`, `design-v2-tokens.css`, `uwe-theme-system.md`.

## ZIP-Archiv

Fertiges Archiv (falls vorhanden): `claude-design-export.zip` im gleichen Ordner — enthält den gesamten `claude-design-export/`-Baum.
