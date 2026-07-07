# Atlas — Editor-Roadmap „Welle 3" (beschlossen)

> Owner-Auswahl vom 2026-07-07: die 13 Editor-Design-/Tool-Punkte aus dem
> Map-Tool-Vergleich **plus Reiseplaner** — alle als „Top" bestätigt.
> Verwandt: [atlas-follow-ups.md](atlas-follow-ups.md) (Status),
> [../design/atlas-redesign/improvement-ideas.md](../design/atlas-redesign/improvement-ideas.md)
> (allgemeiner Ideen-Vorrat).
>
> Leitplanken wie immer: Engine-Logik in `packages/atlas`, deterministisch +
> Golden-Tests; `dm_only` nie ins Portal; KI/RTX nur Proposal → Review; nach
> Engine-Änderungen `build:atlas-engine` + Bundle-Diff committen.

Aufwand: S/M/L. „Andockpunkt" = wo es in der bestehenden Architektur ansetzt.

## Welle 3a — Workflow-Fundament (zuerst; behebt täglichen Frust)

| # | Feature | Aufwand | Andockpunkt |
|---|---|---|---|
| 1 | **Vertex-Editing** — Punkte von Pfaden/Polygonen (Fluss, Straße, Ranke, Plot, Region) nachträglich ziehen, einfügen (Klick auf Segment), löschen (Entf auf Punkt); mit Undo | M | `atlas.html` Selektion → Punkt-Griffe; Geometrie bleibt `Path`/`Polygon`; Plot-Refill nach Edit über bestehenden `fillPlotObjects` |
| 2 | **Snapping** — Raster-Snap-Toggle, Winkel-Rast (15°) beim Rotieren, Shift = Achse halten beim Ziehen | S | `atlas.html` onPointerMove/resizing; Grid aus `tileLayer.tile` |
| 3 | **Duplizieren & Kopieren** — Ctrl+C/V/D auf Selektion (Objekte + Features), Einfügen mit Versatz; CoK-Paritätslücke | S | `atlas.html` Keyboard + Selektionsmodell; neue `_key`/`id` via `nextKey()` |
| 4 | **Prefabs** — Selektion als benannte Gruppe in die Palette speichern („Bauernhof") und wiederverwenden | M | Doc-Feld (JSON) + Palette-Sektion; kein Schema — Persistenz analog `rtxPaletteItems`-Muster, aber user-editierbar |

## Welle 3b — Der Look (Wonderdraft-Klasse)

| # | Feature | Aufwand | Andockpunkt |
|---|---|---|---|
| 5 | **Küstensaum & Wasser-Look** — heller Flachwasser-Ring an Küstenkacheln + deterministische Wellenlinien im offenen Wasser | S/M | `paintTerrainBlobs` kennt Nachbarzellen; Ripples seeded aus Zellkoordinate; Editor/Portal/Static über die geteilte Engine |
| 6 | **Theme-System** — 3–4 neue Style-Presets (Klassisch-Pergament, Nachtkarte, Winter, Verwittert) + Preset-Picker im Editor | M | `style-presets.ts` (`STYLE_PRESETS` hat heute genau 1 Eintrag); `AtlasMap.stylePreset` existiert bereits in der DB |
| 7 | **Globale Lichtrichtung** — Map-Setting dreht Gouache-`shadow()` und Elevation-Schatten konsistent (NW/NE/SW/SE) | M | `assets-toolkit.ts shadow()` + `elevationShadowOffset`; Setting im `tileLayer`-JSON (migrationsfrei) |
| 8 | **Label-Presets** — Typo-Stile pro Label: Größe, Sperrung, Halo/Umriss; 3 Presets (Region/Stadt/Fluss) | S/M | `style`-JSON am Label-Feature; Rendering in allen drei Pfaden |

## Welle 3c — Malgefühl & Bibliothek (Inkarnate-Klasse)

| # | Feature | Aufwand | Andockpunkt |
|---|---|---|---|
| 9 | **Streu-/Spray-Pinsel** — Gouache-Assets malen (gedrückt halten) mit Dichte-/Größen-Jitter, deterministisch pro Strich-Seed | S/M | Neues Tool in `atlas.html`; Platzierung als reguläre `AtlasObject`s; Engine-Streuung existiert |
| 10 | **Asset-Browser** — Suche, Kategorie-Tabs, Favoriten (localStorage), „zuletzt benutzt" statt flacher 60er-Wand | S/M | `buildSidebar`-Umbau; Kategorien aus `GOUACHE_CATEGORY_LABELS`; RTX-Items einsortiert |
| 11 | **Asset-Tinting** — `style.tint` (Hue-Shift/Ton) pro Objekt; Grundlage für Jahreszeiten-Varianten | M | `drawGouacheAsset`-Option; Rezept-Palette durch Tint-Funktion; alle drei Renderer |

## Welle 3d — Orientierung & Hülle

| # | Feature | Aufwand | Andockpunkt |
|---|---|---|---|
| 12 | **Ebenen-Panel** — Terrain/Politik/Routen/Objekte/Labels ein-/ausblenden, Deckkraft, Sperren | M | `LAYER_Z` existiert; UI-Panel + Render-Filter in `drawScene`; View-Mode-Layerset fürs Portal |
| 13 | **Minimap + Lesezeichen** — Übersichtskarte + gespeicherte Kamera-Positionen | S/M | Offscreen-Downscale der Szene; Bookmarks im Doc-`settings` |
| 14 | **Werkstatt-Layout** — Werkzeug-Schiene · Canvas · andockbarer Inspector rechts · Asset-Shelf unten; Kontext-Mini-Toolbar am selektierten Objekt | L | `atlas.html`-Chrome-Umbau (Owner-Frage aus Gap-Analyse damit entschieden); Mockup: `docs/design/atlas-redesign/atlas-ui-proposals.html` |

## Welle 3e — Spielwert

| # | Feature | Aufwand | Andockpunkt |
|---|---|---|---|
| 15 | **Reiseplaner** — Route auf Straßen/Flüssen zusammenklicken → Reisetage (`scaleUnit`), Rastpunkte; pro Etappe Encounter-Wurf aus den DnD-Zufallstabellen; Route als Feature speicherbar | M | Messen-Tool → Multi-Punkt-Route; `dnd`-Package (Zufallstabellen/Encounter-Generator) existiert; Route = `road`-artiges Feature mit `style.travel` |

## Empfohlene Schnitte

- **PR 1 (Quick Wins):** #2 Snapping + #3 Duplizieren (+ ggf. #13 Minimap) — rein `atlas.html`.
- **PR 2:** #1 Vertex-Editing (eigener PR, Editor-Regression-Risiko → manueller Werkzeug-Durchlauf).
- **PR 3:** #5 Küstensaum + #7 Lichtrichtung (geteilte Engine + Bundle-Rebuild + Portal/Static-Parität, `test:security` wegen Payload unverändert nicht nötig).
- **PR 4:** #6 Themes + #8 Label-Presets.
- **PR 5:** #9 Spray + #10 Browser + #11 Tinting.
- **PR 6:** #12 Ebenen + #4 Prefabs.
- **PR 7:** #15 Reiseplaner (Atlas ↔ dnd-Package, eigener Review-Fokus).
- **PR 8:** #14 Werkstatt-Layout (zuletzt — profitiert von allem davor).
