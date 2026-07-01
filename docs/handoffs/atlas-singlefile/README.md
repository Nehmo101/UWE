# Handoff: UWE Atlas — Umbau auf Single-File HTML/CSS/JS (Canvas API)

> Übergabe an Claude Code / Entwickler im Monorepo `Nehmo101/UWE`.
> Ziel: den React-`AtlasEditor` + die `@uwe/atlas`-Engine durch **eine offline-fähige
> Single-File-Runtime (Canvas API)** ersetzen — Editor **und** read-only Portal-Viewer
> aus derselben Datei, kein Parallel-Stack, **kein Feature-Verlust**.

---

## 1. Überblick

Atlas ist der 2D-, hierarchische World-Builder (Globe → Continent → Landscape → City) im
handgezeichneten Tolkien-Tinten-Stil. Heute: React-Editor (`AtlasEditor.tsx`) + TypeScript-
Engine (`@uwe/atlas`) + separater Static-Viewer (`atlas-viewer.js`). Der Umbau konsolidiert
das auf **eine Canvas-Runtime**, die in drei Kontexten läuft:

- **Studio-Editor** (DM, voller Werkzeugsatz, schreibt via Bridge in die DB)
- **Portal-Viewer** (Spieler, read-only, sichtbarkeitsgefiltert)
- **Static-Export** (`atlas/index.html` + `data.json`, offline)

Dieser Prototyp beweist die Architektur end-to-end und liefert die portierte Engine als
lauffähiges Modul.

## 2. Über die Design-Dateien (WICHTIG)

Die `*.dc.html`-Dateien in diesem Paket sind **lauffähige Design-/Architektur-Referenzen**,
die im HTML-Prototyping-Tool entstanden sind — sie zeigen Aussehen, Interaktion und die
Ziel-Architektur. Sie sind **kein 1:1-Produktionscode**. Ausnahme: **`atlas-engine.js` ist
bewusst als produktionsnahes, framework-agnostisches ES-Modul geschrieben** und kann als
Ausgangspunkt für das echte `@uwe/atlas`-Paket übernommen werden (siehe §7).

Die `.dc.html`-Hülle (Template + `class Component extends DCLogic`) ist ein
Prototyping-Format. Für die Endlösung wird die **Canvas-Runtime als eigenständige
`atlas.html`** (bzw. als das Static-Export-Bundle) neu aufgebaut — reines HTML + inline
CSS + inline/importiertes JS, **kein** Prototyping-Framework, **kein** CDN. Die Logik der
`DCLogic`-Klasse (Rendering, Pointer-Handling, Bridge, Tile-Painting) wird dabei nahezu
unverändert übernommen; nur die reaktive Chrome-Anbindung (`renderVals` → Template-Holes)
wird durch direkte DOM-Updates ersetzt.

## 3. Fidelity

**Hi-fi.** Farben, Typografie, Spacing, Radien und Interaktionen sind final und aus dem
gebundenen **UWE Design System (Parchment OS)** + dem Atlas-Preset `tolkien-ink` abgeleitet.
Die Chrome (Top-Bar, dunkle Sidebar, Status-Bar, Panels) 1:1 mit den echten `--uwe-*`-Tokens
nachbauen. Die **Karte selbst** (Canvas) nutzt die `tolkien-ink`-Pergament-Palette, nicht die
Theme-Tokens.

---

## 4. Zielarchitektur (Single-File)

- **Eine Datei** `atlas.html` — alles inline, kein externer CDN, keine separaten Asset-URLs
  für Kern-Tiles/Glyphen. Engine als importiertes ES-Modul (`atlas-engine.js`) ODER inline.
- **Canvas 2D** rendert: Pergament-Grund → Tile-Layer (Blob-Verschmelzung) → Vignette →
  Eltern-Silhouette → Grid → Rahmen → Features (nach `layer` sortiert) → Objekte →
  In-Progress-Zeichnung / KI-Vorschau / Messwerkzeug.
- **Ein Runtime, zwei Modi** über `mode`-Parameter (`editor` | `view`):
  - Prototyp: Prop `mode` (bei Einbettung) **oder** URL `?mode=view`.
  - `view` blendet alle Werkzeuge aus, filtert nach Sichtbarkeit, erlaubt nur Pan/Zoom/Klick.
- **Persistenz:** primär UWE-DB via Studio-Bridge (§6); zusätzlich `localStorage`-Autosave
  alle 10 s als Crash-Puffer (nur Editor-Modus).
- **Koordinaten:** Welt = 64×40 Tiles à 32 px (2048×1280 „Weltpixel"). Features weiterhin
  **normiert 0–1** (Atlas-Bestand). Umrechnung: normiert ↔ Weltpixel ↔ Canvas(zoom/pan).

## 5. Dateien im Paket

| Datei | Rolle |
|---|---|
| `atlas-engine.js` | **Portierte Engine (M0)** — produktionsnah, framework-agnostisch. Ziel: `@uwe/atlas`. |
| `Atlas.dc.html` | Editor + Portal-Runtime (Prototyp). Enthält Rendering, Werkzeuge, Bridge, Tile-Blob-Renderer. |
| `Atlas Portal.dc.html` | Portal-Wrapper (read-only), bettet Atlas mit `mode="view"` ein. |
| `Atlas Studio.dc.html` | Studio-DM-Host, bettet Atlas per `<iframe ?embed=1>` ein, implementiert Host-Seite der Bridge. |
| `Atlas Migrationsplan.dc.html` | Paritäts-Matrix + Schema/Migration + Phasenplan M0–M4 (öffnen zum Lesen). |

Referenz-Bestand (im Repo/Upload, nicht dupliziert): `AtlasEditor.tsx`, `atlas-viewer.js`,
`data.json`, `packages/atlas/src/{glyphs,style-presets,…}.ts`.

> **Zum Ausführen** der `.dc.html`-Prototypen: sie referenzieren das DS-Bundle unter
> `_ds/uwe-design-system-.../` und `./atlas-engine.js` relativ. Am einfachsten im
> Original-Projekt öffnen (Projekt-Root), nicht aus diesem Unterordner.

---

## 6. Bridge-Protokoll (Studio-Einbettung, M3)

`window.postMessage` zwischen eingebettetem Editor (`<iframe>`/`srcDoc`) und Studio-Host.
Jede Nachricht trägt ein `source`-Feld zur Herkunftsprüfung.

**Editor → Host** (`source: "uwe-atlas"`):

| `type` | Payload | Host-Aktion (produktiv) |
|---|---|---|
| `ready` | `{ mode }` | Verbindung registrieren |
| `save` | `{ doc }` (serialisiertes v2-Doc) | `saveAtlasFeaturesAction` + `saveAtlasObjectsAction`; danach `saved` zurück |
| `visibility` | `{ scope:"node", nodeId, visibility }` | `setAtlasNodeVisibilityAction` / `setAtlasMapVisibilityAction` |
| `ai-draft-request` | `{ seed }` | Prozeduralen Entwurf via RTX-Host/Gateway erzeugen → `ai-draft-result` |
| `handout-request` | `{ nodeId, title }` | `createAtlasHandoutPageAction` |

**Host → Editor** (`source: "uwe-studio"`):

| `type` | Payload | Editor-Reaktion |
|---|---|---|
| `saved` | — | Status „In UWE-DB gespeichert ✓", `dirty=false` |
| `ai-draft-result` | `{ features:[…] }` | Als **Proposal** anzeigen (geisterhafte Vorschau + Review-Overlay „Übernehmen/Verwerfen") — **kein Auto-Apply** |
| `load` | `{ doc }` | Doc migrieren + laden |

Opt-in der Bridge nur bei `?embed=1` (nicht anhand `window.parent` raten — Preview-/Host-
iframes sonst false-positive). **Produktiv gilt:** der Portal-/Export-Filter muss
**server-seitig** vor Serialisierung greifen (`pnpm test:security` — kein `dm_only`-Leak);
die Client-Filterung ist nur UX-Spiegel.

---

## 7. Engine-Modul `atlas-engine.js` (M0) — API

Framework-agnostisch (kein DOM außer Canvas2D-Context-Parametern). Zielort: `@uwe/atlas`.
Exporte:

- **Presets:** `TOLKIEN_INK`, `STYLE_PRESETS`, `resolveStylePreset(id)`
- **Glyphen:** `BUILTIN_GLYPHS`, `ATLAS_GLYPH_CATEGORIES`, `getGlyphByKey(key)`,
  `listGlyphsByCategory(cat)`, `BIOME_SCATTER_GLYPH`
- **Geometrie:** `worldToCanvas`, `canvasToWorld`, `pointInPolygon`, `distToSegment`,
  `centroid`, `translateGeometry`
- **Pfad:** `smoothPath` (Catmull-Rom), `pathLength`, `pointAtDistance`
- **Label:** `layoutCharactersOnPath(text, path, letterSpacing, reverse)`
- **Terrain:** `mulberry32(seed)` (deterministischer PRNG), `scatterGlyphsInPolygon(rings,
  biome, density, seed)`, `generatePathAttachments(coords, opts)`
- **Export-Grid:** `buildGridLines(rect, {kind:"square"|"hex", cellSize})`
- **Stempel:** `randomStampVariation(seed, opts)`
- **Prozedural:** `proceduralDraft(seed)` — deterministisch, für KI-Entwurf-Fallback + Regression
- **Serialisierung:** `SCHEMA_VERSION`, `migrateDoc(doc)`, `serializeDoc(doc, extra)`
- **Blob-Renderer (neu):** `roundedRectPath(ctx,x,y,w,h,r)`, `paintTerrainBlobs(ctx, opts)`

**Aufgaben in Claude Code:** Modul nach `packages/atlas/src/` überführen (TS-Typen ergänzen),
Unit-Tests portieren/erweitern (`atlas-single-file.test.ts` oder bestehende `@uwe/atlas`-Tests):
Seed-Determinismus (`proceduralDraft`, `scatterGlyphsInPolygon`, `randomStampVariation`),
`migrateDoc` (v1→v2), `serializeDoc` (Round-Trip).

---

## 8. Datenschema & Migration

**v1 (heute, implizit):** `{ worldSlug, map, preset, builtinGlyphs[], pageLinks{}, nodes[],
features[], objects[] }`. `features`: `Polygon | Path | Point | LabelAnchor`, Geometrie
normiert 0–1. `objects`: `{ paletteItemId, x, y, scale, rotation, layer, visibility }`.

**v2 (Single-File, additiv):**
```
{ schemaVersion: 2, …alles aus v1…,
  tileLayer: { cols: 64, rows: 40, tile: 32, cells: { "c,r": biomeKind } } }
```

- Erkennung: fehlt `schemaVersion` → v1 → `migrateDoc()` setzt `schemaVersion=2`, ergänzt
  leeren `tileLayer`. Features bleiben unverändert (dual gerendert neben Tiles).
- **Prisma:** `AtlasMap.schemaVersion Int @default(1)` + `AtlasMap.tileLayer Json?`
  (additive Migration, kein Breaking-Change).
- Robust: Parse-/Migrationsfehler nie still → sichtbarer Degraded-Status, Roh-JSON bleibt ladbar.
- Regressions-Fixture: `scripts/atlas-cok-demo-seed.ts` / Welt „Terra" laden → migrieren →
  neu serialisieren → gegen Erwartung prüfen.

**Biome-Kinds** (Tile + Feature): `grassland, coast, hills, desert, forest, mountains,
swamp, snow`. CoK-Pinsel-Mapping: Gras→`grassland`, Wasser→`coast`, Erde→`hills`, Sand→`desert`.

---

## 9. Sichtbarkeits- & Sicherheitsmodell

Dreistufig, **alle** müssen `player_visible` sein, damit ein Spieler etwas sieht:
`AtlasMap` (Karte) **+** `AtlasNode` (Ebene) **+** einzelnes `AtlasFeature`/`AtlasObject`.
Tiles (Terrain-Basis) sind nicht einzeln gegatet.

- Werte: `dm_only` (Terrakotta `--uwe-dm-only`) | `player_visible` (Teal `--uwe-player-visible`) | `public`.
- **Produktiv server-seitig filtern** (`packages/database/src/permissions.ts`), vor
  Serialisierung; `pnpm test:security` muss `dm_only`-Leak ausschließen.
- Empty-State im Portal, wenn Ebene nicht freigegeben: *„Für deine Rolle sind derzeit keine
  Inhalte sichtbar. Wende dich an deinen Spielleiter."* (verbatim, DS-Microcopy).
- `personal_brain` bleibt hart lokal; Welt-/Kampagnenkontext folgt UWE-Gateway-Policy (W0).
- **Kein Auto-Apply** von KI an Canon: Ergebnisse stets Proposal → Review → manuell übernehmen.

---

## 10. Screens / Views

### 10.1 Studio-Editor (`Atlas.dc.html`, mode=editor)

**Layout:** Vollhöhe Flex-Spalte: Top-Bar (54 px) → [dunkle Sidebar 212 px | Canvas-Bühne flex | (Auswahl-Panel als Overlay)] → Status-Bar (30 px).

- **Top-Bar** (`--uwe-panel`, 2 px `--uwe-fg` Unterkante): Marke ◆ + „UWE Atlas" (+ Badge
  „Portal"/„Studio-Bridge" je nach Modus) · Breadcrumb (klickbare Eltern-Ebenen `--uwe-accent`
  + aktueller Titel in Newsreader) · rechts: Pinselgröße-Segment (S/M/L) · „▦ Gitter"-Toggle ·
  „🔒 Ebene privat/🌐 sichtbar"-Toggle · „✦ KI-Entwurf" · „↗ Handout" · „↓ JSON" · „↓ PNG" ·
  „Leeren" (`--uwe-danger`). Buttons: `.tb-btn` — 32 px hoch, 9 px Radius, 1.5 px `--uwe-border`,
  Hover → Rand `--uwe-accent` + `--uwe-accent-muted`, aktiv `translateY(1px)`.
- **Sidebar** (`--uwe-sidebar-bg` #211d17, Text `--uwe-sidebar-fg`): Gruppen „Werkzeuge"
  (Auswahl, Terrain-Pinsel, Objekt/Bau, Region, Biom-Fläche, Fluss, Straße, Label, Pin,
  Messen, Löschen — je Icon + Label + Shortcut-Kbd), „Terrain-Pinsel" (8 Biom-Swatches,
  2-spaltig, Farbchip + Name), „Objekte & Bauten" (Glyph-Grid 4-spaltig). Aktives Tool:
  Fill `--uwe-accent`, Text #fff.
- **Canvas-Bühne:** Canvas (100 %), Kompassrose (SVG, oben rechts), Maßstabsleiste
  (0–100 leagues, unten rechts), Kontext-Sub-Bar (oben mittig, Werkzeug-Hinweise),
  Auswahl-Panel (oben links, Overlay), KI-Review-Overlay, Toast.
- **Status-Bar** (`--uwe-panel`): aktives Werkzeug (`--uwe-accent`) · Tile-Koord · Welt-Koord
  · Zoom-% · rechts Speicherstatus.

### 10.2 Portal-Viewer (`Atlas Portal.dc.html` → Atlas mode=view)

Portal-Header („← Wiki", ◆, Welt-Titel, „Portal · read-only"). Sidebar zeigt statt Werkzeugen
eine **Legende** (sichtbare Glyphen) + Hinweistext. Top-Bar reduziert (nur Gitter + „↓ Karte
speichern"). Canvas: nur Pan/Zoom + Klick (Drill-down zu Kind-Ebene / Wiki-Link-Toast).
Features/Objekte nach `visibility` gefiltert; nicht freigegebene Ebene → Empty-State.

### 10.3 Studio-Host (`Atlas Studio.dc.html`)

DM-Cockpit: Top-Bar (◆ UWE Studio · Welt „Terra" · ⌘K-Pille · „● RTX bereit"-Badge) ·
dunkle Nav-Sidebar (Heute, Welten, NPCs, Orte, **Atlas** aktiv, Fraktionen, Quests, Sessions,
Handouts, Brain, Einstellungen) · Main = `<iframe src="atlas.html?mode=editor&embed=1">` ·
rechte Leiste 288 px „Bridge-Aktivität" (Live-Log der Server-Action-Aufrufe, farbcodiert:
ok=Teal, save/ai=Terrakotta, warn=`--uwe-dm-only`).

---

## 11. Interaktionen & Verhalten

- **Pan:** Ziehen mit Mittel-/Rechtsklick (bei Zeichentools) bzw. Ziehen auf Leerfläche (Auswahl).
- **Zoom:** Scroll (0.25×–8×), auf Cursor zentriert.
- **Malen/Platzieren:** Linksklick. **Löschen:** Rechtsklick (Terrain/Stempel) bzw. Eraser-Tool.
- **Terrain-Pinsel:** Radius S/M/L = 0/1/2 Tiles; malt `tileLayer.cells`.
- **Zeichentools** (Region/Biom/Fluss/Straße): Punkte klicken, Doppelklick/Enter abschließen,
  Esc abbrechen. Flüsse verjüngen sich, Straßen gestrichelt, Biom-Polygone streuen Glyphen.
- **Label/Curved Label:** gerade + pfadgeführte Beschriftung (`layoutCharactersOnPath`),
  zwei Tintenfarben (schwarz/rot). *(Curved-Label-Tool im Prototyp noch nicht als eigenes
  Werkzeug — Engine unterstützt es; im Produktivbau ergänzen.)*
- **Measure:** zwei Punkte → Distanz in leagues (Weltdiagonale = 100).
- **Drill-down:** Region mit `childNodeId` → Klick wechselt Ebene; Eltern-Silhouette als
  gedämpfter Underlay.
- **Fließende Kanten (CoK-Stil):** `paintTerrainBlobs` — jedes Tile ein Rounded-Rect
  (Radius ≈ 0.4 × Kante); gleich-biomige Nachbarn per Brücken-Rechteck (rechts/unten) +
  Innenecken-Fill verschmolzen → organische Flächen, echte Biom-Grenzen bleiben rund.
- **KI-Entwurf:** Proposal geisterhaft (α 0.5) vorschauen → „Übernehmen" hängt Features an
  (visibility `dm_only`), „Verwerfen" verwirft. Nie automatisch.
- **Shortcuts:** S/G/T/P/B/R/D/L/I/M/E (Tools), Entf/Backspace (löschen), Esc (abbrechen),
  Enter (Pfad/Polygon abschließen). Im view-Modus deaktiviert.

---

## 12. Design-Tokens

**Chrome (UWE Parchment OS, `--uwe-*`):**
- bg `#f1e8d4` · bg-elevated `#fbf6ea` · panel `#ece1c9` · surface `rgba(251,246,234,.95)`
- border `#e0d4ba` · fg `#211d17` · fg-muted `#574e40` · fg-subtle `#665d4f`
- accent `#c2622b` · accent-hover `#d47030` · accent-muted `rgba(194,98,43,.12)` · on-accent `#fbf6ea`
- **dm-only `#c2622b`** · **player-visible `#2f6f63`** · danger (DS) · sidebar-bg `#211d17` · sidebar-fg `#e9dcc0`
- Radius: Buttons 9 px, Cards/Panels 11–14 px · Border 1.5 px · Topbar 54 px, Sidebar 212 px, Rail 288 px, Status 30 px
- Fonts: **Space Mono** (UI/mono), **Newsreader** (serif — Titel, Karten-Labels). Eyebrows UPPERCASE, `0.12em`.

**Karte (`tolkien-ink`-Preset):** parchment `#f2e8c9` · ink `#1a1008` · inkAccent (rot) `#8b1a10`
· water `#a8c4d4` · road `#6b4a2a`. Tile-Füllungen (deckend): grassland `#a9c47f`, coast
`#9fc0d2`, hills `#c2a878`, desert `#dcc47c`, forest `#7a9463`, mountains `#b4a487`,
swamp `#8a9b78`, snow `#dde6f0`. Vignette `rgba(80,50,20,.16)`.

## 13. Assets / Glyphen

Keine Bild-Assets. Alle Piktogramme sind **inline SVG-Pfade** (24×24 viewBox, stroke-only) in
`BUILTIN_GLYPHS` (`atlas-engine.js`) — Relief (Berg, Fels), Biom (Wald, Nadelwald), Marker
(Stadt, Dorf, Burg, Turm, Ruine, Brücke, Hafen, Tempel) + CoK-Erweiterung (Zelt, Marktstand,
Stadtmauer, Tor). Werkzeug-Icons sind separate Lucide-artige inline-SVGs (Chrome, `currentColor`).
Icon-System im Produktivbau: **Lucide** (wie restliches UWE).

---

## 14. Phasenplan & Gate (für Claude Code)

| Phase | Inhalt | Status hier |
|---|---|---|
| **M0** | `atlas-engine.js` → `@uwe/atlas` (TS-Typen, Unit-Tests) | Modul liegt vor |
| **M1** | `atlas.html`-Editor (Chrome + Canvas + Werkzeuge + Blob-Tiles + Autosave + JSON/PNG-Export) | Prototyp lauffähig |
| **M2** | Portal read-only (`mode=view`), **server-seitiger** Filter, `pnpm test:security` | Prototyp (Client-Filter) |
| **M3** | Studio-Einbettung (`<iframe>`/`srcDoc`), Bridge an echte Server-Actions, KI an RTX-Host | Prototyp (simuliert) |
| **M4** | React-Editor entfernen: `AtlasEditor.tsx`, `ProceduralDraftPanel`, `RegionDescribePanel`, `AtlasStampGenerator` + verwaiste Imports löschen; Studio-Route auf `<iframe>` umstellen | offen (Repo) |

**Gate:** `pnpm quality:quiet` / `pnpm ci:light` grün · `pnpm test:security` (kein dm_only-Leak)
· manuell: alle Werkzeuge, Drill-down, Export JSON/PNG, Static-Export offline · Dev-CSP-Gotcha
(`unsafe-eval` temporär, vor Commit zurücknehmen — siehe `AGENTS.md`).

**Pflichtlektüre:** `docs/prompts/atlas-orchestrator.md`, `docs/prompts/atlas-style-reference.md`,
`packages/static-export/static/atlas-viewer.js`, `apps/studio/src/components/atlas/AtlasEditor.tsx`,
`AGENTS.md`, `.cursor/rules/security.mdc`, `SECURITY.md`.
