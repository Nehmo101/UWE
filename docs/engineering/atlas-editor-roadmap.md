# Atlas — Editor-Roadmap „Welle 3 + 4" (beschlossen)

> Owner-Auswahl vom 2026-07-07: die 13 Editor-Design-/Tool-Punkte aus dem
> Map-Tool-Vergleich **plus Reiseplaner** (Welle 3) sowie 13 weitere Punkte
> aus der Ideenrunde (Welle 4, s. unten) — alle vom Owner bestätigt.
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

## Welle 4 — Geografie, Orte & Ökosystem (beschlossen 2026-07-07)

| # | Feature | Aufwand | Andockpunkt |
|---|---|---|---|
| 16 | **Skalierbare Kartengröße** — Gesamtgröße der Karte pro Node/Map wählbar (z. B. 64×40 bis 256×160), nicht mehr fix | M/L | `tileLayer` trägt `cols/rows/tile` bereits als Daten; Editor/Viewer nutzen heute Konstanten `COLS/ROWS/TILE` (`atlas.html` :246ff) — auf Doc-Werte umstellen, Größen-Wahl beim Anlegen + „Karte erweitern"-Aktion (Zellen bleiben, Ränder wachsen); Höhenfeld/Blend/Export-Grid mitziehen |
| 17 | **Landmassen-Pinsel** — Land heben/senken, Küstenlinie entsteht organisch aus dem Pinsel (Wonderdraft-Kernwerkzeug) | L | Höhenfeld (2.5D) existiert; Schwellwert Höhe→Land/Wasser erzeugt `coast`-Zellen; Küstensaum (#5) rendert die Kante |
| 18 | **Fluss-Intelligenz** — Flüsse snappen an See/Küste, verbreitern sich zur Mündung, optional Delta; „fließt bergauf"-Warnung übers Höhenfeld | M | `path-smoothing`/`style.width` + Höhenfeld-Sampling (`sampleElevation`); Validierung als Editor-Hinweis, nie Auto-Korrektur |
| 19 | **Straßen-Autorouting** — Stadt A + B anklicken → Straße folgt Gelände (meidet Berge/Sumpf/Wasser, nimmt Pässe) | M/L | A*-Pathfinding über `tileLayer`-Biome + Höhenfeld in `packages/atlas` (deterministisch, Golden-Tests); Ergebnis als normales `road`-Feature, editierbar (Vertex-Editing #1) |
| 20 | **Brücken-Automatik** — wo Straße Fluss kreuzt, wird `g_bridge` gesetzt, zur Straße ausgerichtet | S | Segment-Schnitt Straße×Fluss (`geometry.ts`); Objekt mit Rotation = Straßennormale; auch beim Autorouting (#19) angewandt |
| 21 | **Territorien-Vorschlag** — Voronoi um Städte → Reichsgrenzen-Entwurf als editierbare `region`-Features | M | Voronoi in `packages/atlas` (deterministisch); Übernahme als Proposal/Ghost analog Settlement-Review; danach Vertex-Editing |
| 22 | **Klima-Bänder** — statisches Klima-Overlay (arktisch→tropisch), färbt Biom-Vorschläge, füttert Reiseplaner-Etappenkosten | S/M | Map-Setting im `tileLayer`-JSON; Overlay-Ebene im Ebenen-Panel (#12); Reiseplaner (#15) liest Zonen |
| 23 | **Kartuschen-Editor** — Titelkartusche, Zier-Rahmen, Windrosen-Stile als wählbare Deko-Sets | M | Erweiterung von `doExport()`-Deko + Live-Deko; Stile in `style-presets.ts.decorations`; Auswahl im Export-Dialog + Map-Settings |
| 24 | **Kulturprofile für Namen** — Silben-Sets pro Region (nordisch/elbisch/wüstenländisch …) → deterministischer Namens-Generator offline; RTX veredelt optional (Proposal) | M | Neues Engine-Modul `packages/atlas/src/name-culture.ts` (mulberry32, Golden-Tests); Region-`style.culture`; Panel neben `atlas_name_regions`-Flow |
| 25 | **Verfallsgrad-Regler** — Settlement mit Zustand blühend → belagert → verlassen → Ruine (Assets tauschen, Mauern brechen) | S/M | `generateSettlement()`-Option `condition`; Asset-Swaps (`g_house`→`g_ruin` …) + Mauer-Lücken deterministisch; Ghost-Review unverändert |
| 26 | **Unterwelt-Ebene pro Karte** — parallele Schattenkarte (Kanalisation/Höhlen/Stollen) am selben Node, per Toggle | M/L | Zweites Feature-/Objekt-Set pro Node über Layer-Konvention (`LAYER_Z` + Ebenen-Panel #12) ODER Schwester-Node mit Link — Design-Spike zuerst; Portal-Sichtbarkeit separat schaltbar |
| 27 | **Säum-Ausrichtung** — beim Säumen entlang Straßen richten sich Häuser zur Pfadnormalen aus | S | `generatePathAttachments` liefert Segmentrichtung bereits intern — Rotation aus Pfadnormale statt Zufall (Option `alignToPath`, Golden-Test additiv) |
| 28 | **Asset-Wunsch-Queue** — „fehlt dir was?" in der Palette → Prompt landet als Auftrag im RTX-Asset-Studio; genehmigt ⇒ erscheint in der Palette | S/M | Palette-Button im Editor → Bridge-Message → `AtlasAssetProposalStudio`-Flow (existiert end-to-end); nur UI-Brücke + Queue-Liste |

**Bewusst abgelehnt (Owner, 2026-07-07 — nicht erneut vorschlagen):**
Karten-Diff-Ansicht · DM-Notizzettel auf der Karte · Content-Lücken-Heatmap ·
Kampagnen-Ausschnitt (Portal-Beschnitt) · Ereignis-Zeitstrahl · Azgaar-Import.

## Empfohlene Schnitte

- **PR 1 (Quick Wins):** #2 Snapping + #3 Duplizieren (+ ggf. #13 Minimap) — rein `atlas.html`.
- **PR 2:** #1 Vertex-Editing (eigener PR, Editor-Regression-Risiko → manueller Werkzeug-Durchlauf).
- **PR 3:** #5 Küstensaum + #7 Lichtrichtung (geteilte Engine + Bundle-Rebuild + Portal/Static-Parität, `test:security` wegen Payload unverändert nicht nötig).
- **PR 4:** #6 Themes + #8 Label-Presets.
- **PR 5:** #9 Spray + #10 Browser + #11 Tinting.
- **PR 6:** #12 Ebenen + #4 Prefabs.
- **PR 7:** #15 Reiseplaner (Atlas ↔ dnd-Package, eigener Review-Fokus).
- **PR 8:** #14 Werkstatt-Layout (zuletzt in Welle 3 — profitiert von allem davor).

### Welle-4-Schnitte (nach Welle 3a/3b; Reihenfolge nach Abhängigkeit)

- **PR 9 (Quick Wins W4):** #27 Säum-Ausrichtung + #20 Brücken-Automatik + #25 Verfallsgrad.
- **PR 10:** #16 Skalierbare Kartengröße (Fundament — vor Landmassen-Pinsel; eigener PR, breite Regressionfläche: Editor/Portal/Static/Export/Höhenfeld).
- **PR 11:** #22 Klima-Bänder + #23 Kartuschen-Editor.
- **PR 12:** #18 Fluss-Intelligenz + #19 Straßen-Autorouting (gemeinsames Höhenfeld-Sampling).
- **PR 13:** #21 Territorien-Vorschlag + #24 Kulturprofile (beide Proposal-Flows).
- **PR 14:** #17 Landmassen-Pinsel (nach #16; größter Einzelbrocken).
- **PR 15:** #26 Unterwelt-Ebene (Design-Spike zuerst) + #28 Asset-Wunsch-Queue.
