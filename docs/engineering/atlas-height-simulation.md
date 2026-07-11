# Atlas — Höhen-Simulation (2.5D auf Canvas 2D)
> **Owner-Entscheidung 2026-07-11:** WebGL-Sperre aufgehoben.

Die ursprüngliche Entscheidung „kein WebGL“ in diesem historischen 2.5D-Plan ist aufgehoben.
Das bestehende v3-Höhenfeld bleibt kanonisch; `@uwe/atlas-3d` projiziert es nun optional
mit Three.js. 2D bleibt Default sowie PNG-/Minimap-Pfad. Aktuelle Architektur:
[atlas-3d.md](atlas-3d.md).


> Status: **Umgesetzt (Phasen A–F).** Elevation-Engine
> `packages/atlas/src/elevation.ts` (Sampling, Hillshade, Marching-Squares-
> Konturen, Parallax/Schatten), Doc v3 (`tileLayer.elevation` +
> Höhen-Settings, normalisiert in `migrateDoc`), Höhen-Pinsel + Settings-UI
> im Editor (`atlas.html`), Rendering in allen drei Pfaden (Editor,
> Portal `atlas-elevation.ts`/`AtlasViewer.tsx`, Static-Export
> `atlas-viewer.js`), Objekt-Höhe (`style.elevation`, 0 = auto) und
> Ridge-Glyphen-Kopplung. Engine-Bundle neu generiert.
> Owner-Entscheidungen (fix): **Licht fest NW** · **Parallax pro Karte
> einstellbar** (`tileLayer.parallaxStrength`, Default 0.35) ·
> **Höhenlinien toggelbar** (`tileLayer.contoursEnabled` + `contourSteps`).
> Die Höhen-Settings liegen mit im Tile-Layer (statt `AtlasMap.settings`),
> damit sie den bestehenden Save-/Datenfluss aller drei Renderer mitnutzen.
> Anlass: YouTube-Short-Referenz (Höheneindruck auf einer 2D-Karte). Das Video
> selbst war aus der Agent-Umgebung nicht abrufbar (Netzwerk-Policy); das
> Konzept deckt daher die etablierte Technik-Familie ab, die solche Karten-
> Shorts zeigen: **Schummerung, Schattenwurf, Höhenlinien, Parallax** —
> plus die Foundry-VTT-üblichen Muster (Token-/Objekt-Elevation, Hillshading
> aus einem Höhenfeld).
> Verwandt: [atlas-gouache-plan.md](atlas-gouache-plan.md) ·
> [atlas-cok-gap-analysis.md](atlas-cok-gap-analysis.md) ·
> [atlas-follow-ups.md](atlas-follow-ups.md)

## 0 · Kernidee

Historischer Stand: Atlas blieb in dieser Ausbaustufe strikt 2D. Seit der Owner-Entscheidung vom 2026-07-11 ist diese Leitplanke für den optionalen 3D-Modus aufgehoben; Datenmodell und 2D-Renderer bleiben bestehen.
„Höhe" wird als **skalares Höhenfeld auf dem bestehenden Tile-Layer**
gespeichert und rein visuell simuliert — genau wie im Referenz-Video:
das Auge liest Licht/Schatten, Konturen und Bewegungs-Parallax als Relief.

Die gute Nachricht: Atlas hat bereits alle Andockpunkte —

| Vorhandener Baustein | Wo | Rolle für Höhe |
|---|---|---|
| Tile-Layer (Biom-Grid, sparse JSON) | `packages/atlas/src/doc.ts:30-43`, `AtlasMap.tileLayer` | Träger des Höhenfelds (gleiches Grid, gleiche Persistenz) |
| Relief-Schummerung (NW-Licht, per Biom) | `packages/atlas/src/terrain.ts` (`buildReliefShading`, `BIOME_SHADING`) | wird von „per Biom geraten" auf „aus Höhenfeld berechnet" umgestellt |
| `heightMetadata` an Ridge-Glyphen | `packages/atlas/src/terrain.ts` (`scatterGlyphsAlongPath`) | Glyphen-Skalierung künftig aus dem Höhenfeld sampeln statt manuell |
| Z-Draw-Layer | `packages/atlas/src/constants.ts` (`LAYER_Z`) | neue Overlays (Shading, Konturen) sortieren sich ein |
| Catmull-Rom-Glättung | `packages/atlas/src/path-smoothing.ts` | Höhenlinien glätten |
| Drei Render-Pfade | Editor (`atlas-engine.js`), Portal (`AtlasViewer.tsx`), Static Export | alle konsumieren dieselben puren Funktionen aus `@uwe/atlas` |

## 1 · Datenmodell: Höhenfeld im Tile-Layer (Doc v3)

**Keine Prisma-Migration nötig** — `AtlasMap.tileLayer` ist `Json`.
Nur das Doc-Schema wächst (v2 → v3 in `migrateDoc`, `doc.ts`):

```ts
type AtlasTileLayer = {
  // … bestehend: cols, rows, tile, cells, intensity, blendWidth
  elevation?: Record<string, number>; // "c,r" → 0..1, sparse (0 = Meeresspiegel)
  elevationScale?: number;            // Meter pro 1.0, nur Anzeige/Beschriftung
};
```

- Sparse wie `cells`: nur Zellen ≠ 0 werden gespeichert.
- Sampling-Helfer `sampleElevation(layer, x, y)` (bilinear interpoliert,
  normalisierte Weltkoordinaten) in einem neuen puren Modul
  `packages/atlas/src/elevation.ts` — DOM-frei, damit Editor, Portal und
  Export ihn identisch nutzen.
- Persistenz über die bestehende `saveAtlasTileLayerAction`
  (`apps/studio/app/atlas-actions.ts`) — nur Validierung erweitern.

## 2 · Feature-Bausteine (Phasen)

| Phase | Feature | Aufwand | Umsetzung |
|---|---|---|---|
| **A** | **Höhen-Pinsel im Editor** | S | Neues Werkzeug analog zum Biom-Pinsel im `atlas.html`-Editor: anheben/absenken/glätten, Stärke-Regler. Vorschau als Heat-Overlay (transparentes Rot→Weiß) nur im Editor. Speichern über den bestehenden TileLayer-Save-Pfad der postMessage-Bridge. |
| **B** | **Hillshading aus dem Höhenfeld** | M | In `elevation.ts`: Gradient pro Zelle (Sobel/zentrale Differenz) → Lambert-Beleuchtung mit fester NW-Lichtrichtung (konsistent mit heutiger Schummerung). Ausgabe als Offscreen-Canvas in Grid-Auflösung, weichgezeichnet hochskaliert, als Multiply-/Overlay-Layer bei `LAYER_Z.relief` gezeichnet. `buildReliefShading` bleibt Fallback für Karten ohne Höhenfeld. |
| **C** | **Höhenlinien (Konturen)** | M | Marching Squares über das Höhenfeld (N Iso-Stufen, konfigurierbar), Pfade mit Catmull-Rom glätten, als dünne Tuschelinien im `TOLKIEN_INK`-Stil rendern (jede 5. Linie kräftiger, optional Höhenzahl via `label-layout.ts`). Eigener Draw-Layer zwischen Biom und Relief, per Map-Setting an/aus. |
| **D** | **Parallax + Schattenwurf beim Pan/Zoom** (der „Video-Effekt") | M | Im Render-Loop: Objekte/Glyphen mit Elevation `e` werden um `e · k · zoom` entgegen dem Kamera-Offset verschoben und werfen einen um `e` versetzten, weichen Ellipsen-Schatten am Boden. Ergebnis: beim Schwenken „steht" ein Berg/Turm sichtbar über der Ebene. Rein visuell, Hit-Testing bleibt an der Boden-Position (Foundry-Muster „tactical anchor": Logik am Boden, Optik erhöht). |
| **E** | **Objekt-Elevation** | S | `AtlasObject.style` (Json, migrationsfrei) bekommt optional `elevation`; Default: beim Platzieren aus dem Höhenfeld gesampelt, manuell überschreibbar (fliegende Inseln!). Skaliert Glyphe leicht (+`e · 10 %`) und speist Phase D. |
| **F** | **Ridge-Glyphen ans Höhenfeld koppeln** | S | `scatterGlyphsAlongPath`/`scatterGlyphsInPolygon` sampeln `heightMetadata` automatisch aus `sampleElevation` statt (nur) manueller Werte — Berg-Piktogramme wachsen dort, wo die Karte hoch ist. |

Empfohlene Reihenfolge: **A → B** ist das MVP (sichtbares Relief wie im
Video-Standbild), **D** liefert den eigentlichen Wow-Effekt in Bewegung,
**C/E/F** sind unabhängige Ausbaustufen.

## 3 · Architektur-Regeln (Repo-Konventionen)

- **Alle Berechnungen pur in `@uwe/atlas`** (`elevation.ts` neu, < 300 Zeilen
  Ziel): Sampling, Hillshade-Raster, Marching Squares, Parallax-Offset-Formel.
  Canvas-Aufrufe nur in `canvas-render.ts` bzw. den drei Render-Pfaden.
- **Historisch (aufgehoben 2026-07-11): keine neue Dependency, kein WebGL.** Hillshade in Grid-Auflösung
  (64×40 default) ist trivial billig; Offscreen-Canvas cachen und nur bei
  Höhenfeld-Änderung neu rechnen (Parallax braucht kein Re-Rendering des
  Shadings, nur Draw-Offsets).
- **Doc-Migration v3** additiv und abwärtskompatibel: fehlendes `elevation`
  ⇒ Verhalten exakt wie heute (Fallback `buildReliefShading`).
- **Alle drei Render-Pfade** nachziehen: `atlas.html`/`atlas-engine.js`
  (danach `pnpm --filter @uwe/static-export build:atlas-engine`),
  `apps/portal/src/components/atlas/AtlasViewer.tsx`, `atlas-viewer.js`.
- **Portal-Sicherheit unverändert:** Höhenfeld ist Teil des Map-Docs und
  unterliegt der bestehenden `Visibility`-Filterung; keine neuen
  DM-only-Leckpfade.
- Datei-Budget beachten (neue Dateien ≤ 700 Zeilen): `AtlasViewer.tsx` und
  `atlas-engine`-Quellen nur minimal erweitern, Logik ins Package ziehen.

## 4 · Owner-Entscheidungen (getroffen)

1. **Lichtrichtung: fix NW** (Azimut 315°, Höhe 45°) — konsistent mit der
   bestehenden Schummerung; kein Regler.
2. **Parallax-Stärke: pro Karte einstellbar** über
   `tileLayer.parallaxStrength` [0..1], Default `0.35` (dezent), `0` = aus.
   Portal rendert identisch, damit Spieler dasselbe Bild sehen.
3. **Höhenlinien: toggelbar** über `tileLayer.contoursEnabled` (Default aus)
   plus `contourSteps` (2–24, Default 5).
