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

## Status (Stand 2026-07-08)

**Fertig (Editor + Engine + Viewer-Parität, headless-Smoke verifiziert):**

- ✅ **#1 Vertex-Editing** — Punkt-Griffe ziehen (mit Snap), Doppelklick fügt Punkt auf Segment ein, Alt+Klick löscht (Min-Guard, geschlossene Ringe gespiegelt); Plot-Refill nach Edit.
- ✅ **#2 Snapping** — Raster-Snap-Toggle (Taste `N`, ½-Kachel-Raster, 🧲 in Statusleiste), Shift hält die Achse beim Ziehen. *Offen: 15°-Winkel-Rast beim Rotieren.*
- ✅ **#3 Duplizieren & Kopieren** — Ctrl+C/V/D auf Selektion, Einfügen mit wachsendem Versatz.
- ✅ **#5 Küstensaum** — Flachwasser-Ring + deterministische Wellenlinien (`coast`-Option in `paintTerrainBlobs`); Editor, Portal-Viewer und Static-Viewer.
- ✅ **#6 Theme-System** — 3 neue Presets (Pergament-Klassik, Nachtkarte, Winterfeldzug) + Theme-Picker im Editor; Persistenz über Bridge-Message `map-style` → `setAtlasMapStyleAction` → `AtlasMap.stylePreset`. *Offen: Preset „Verwittert".*
- ✅ **#20 Brücken-Automatik** — `findBridgePoints` (Engine) + Auto-Platzierung `g_bridge` an Straße×Fluss-Kreuzungen, zur Straße rotiert.
- ✅ **#27 Säum-Ausrichtung** — `alignToPath`-Option in `generatePathAttachments` + „An Pfad ausrichten"-Checkbox (Default an).
- ✅ **#19 Straßen-Autorouting** — `routeRoad` (A* über Biome) + „✦ Auto-Route"-Button im Straßen-Werkzeug: erster/letzter gesetzter Punkt → geländebewusste Route als normales `road`-Feature (Vertex-Editing greift, Brücken-Automatik läuft mit).
- ✅ **#21 Territorien-Vorschlag** — `suggestTerritories` (Grid-Voronoi, Wasser neutral) + „🗺 Territorien vorschlagen" im Region-Werkzeug; Ghost-Review (Übernehmen/Verwerfen) erzeugt editierbare `region`-Features, Namen aus dem gewählten Kulturprofil.
- ✅ **#24 Kulturprofile** — `generatePlaceNames` + 6 Profile; Kultur-Auswahl + „↻ Name"-Würfel im Auswahl-Panel jedes Features (deterministische Roll-Folge in `style.culture`/`style.nameRoll`).
- ✅ **#25 Verfallsgrad** — `generateSettlement`-Option `condition` + Zustand-Auswahl (blühend/belagert/verlassen/Ruine) im Siedlungs-Ghost-Panel der Objektfläche.
- ✅ **#10 Asset-Browser** — Suche + Kategorie-Filter (aus `GOUACHE_CATEGORY_LABELS`, inkl. RTX) + Favoriten (Rechtsklick ★, localStorage) + „zuletzt benutzt" über der Asset-Palette.
- ✅ **#13 Minimap** — Weltübersicht unten rechts über den geteilten `drawScene`-Pfad (gedrosselt), sichtbarer Ausschnitt markiert, Klick/Ziehen zentriert die Kamera. *Offen: Kamera-Lesezeichen.*
- ✅ **#7 Lichtrichtung** — `tileLayer.lightDir` (nw/ne/sw/se, Default nw) dreht Hillshade (`buildHillshadeRGBA`-Option) + Höhen-Schattenwurf (`elevationShadowOffset`) konsistent in Editor, Portal und Static-Viewer; Sidebar-Setting, migrationsfest normalisiert (Default bleibt sparse).
- ✅ **#8 Label-Presets** — `ATLAS_LABEL_PRESETS` (Region gesperrt/Stadt/Fluss kursiv) in `@uwe/atlas/label-layout`; `style.labelPreset` am Label, Typo-Select im Auswahl-Panel; identisches Rendering in allen drei Viewern (Portal via `atlas-label.ts`), ohne Preset byte-identischer Legacy-Look.
- ✅ **#9 Streu-/Spray-Pinsel** — Werkzeug „O": Gouache-Asset aus der Palette gedrückt streuen; Positions-/Größen-/Rotations-Jitter deterministisch pro Strich-Seed, ein Undo-Schritt pro Strich, Rechtsklick löscht.
- ✅ **#11 Asset-Tinting** — `drawGouacheAsset`-Option `tint` (Hue-Rotation + Sättigung via Canvas-Filter); `style.tint` am Objekt, „Tönung °"-Regler im Auswahl-Panel, Parität in Portal- und Static-Viewer.
- ✅ **#12 Ebenen-Panel** — Sichtbarkeits-Schalter (Terrain/Politik/Routen/Objekte/Labels) unten links; filtert `drawScene` (Minimap/Export folgen automatisch). *Offen: Deckkraft + Sperren.*
- ✅ **#18 Fluss-Intelligenz** — `snapPointToWater` + `riverFlowsUphill` in `@uwe/atlas/river-tools`; beim Fluss-Abschluss snappt die Mündung an nahes Wasser (≤ 0.045), Bergauf-Warnung übers Höhenfeld als Hinweis (nie Auto-Korrektur). *Offen: Delta-Verzweigung.*
- ✅ **#22 Klima-Bänder** — `CLIMATE_ZONES`/`climateBands` in `@uwe/atlas/climate` (arktisch → tropisch); Doc-Setting `tileLayer.climateEnabled` (migrationsfest, sparse), Overlay in Editor (mit Zonen-Labels), Portal- und Static-Viewer. *Offen: Biom-Vorschlags-Färbung + Reiseplaner-Kopplung.*
- ✅ **#23 Kartuschen** — `drawCartouche` in `@uwe/atlas/cartouche` (Schriftrolle/Banner/Doppellinien); Titelkartusche wählbar im PNG-Export-Dialog (Titel = Ebenen-Name). *Offen: Live-Deko + weitere Zier-Rahmen/Windrosen-Stile.*
- ✅ **#15 Reiseplaner** — `planTravelRoute` in `@uwe/atlas/travel` (terrain-gewichtete Reisetage `TERRAIN_TRAVEL_FACTOR`, Rastpunkte je Reisetag, deterministisch); Messen-Werkzeug ist jetzt eine Multi-Punkt-Route mit Live-Anzeige (Distanz · Tage · Rast) und Lager-Markern, Enter speichert sie als `road`-Feature mit `style.travel`. *Offen: Encounter-Wurf je Etappe aus dem `dnd`-Package (Proposal → Review über die Bridge).*
- ✅ **#4 Prefabs** — Auswahl als benanntes Prefab (Objekte + Features, Anker-relativ) in einer localStorage-Bibliothek; „★ Als Prefab speichern" im Gruppen-Panel, Prefab-Liste in der Sidebar (Einfügen an Viewport-Mitte, Löschen). Reine Editor-Bibliothek, nie im Doc.
- ✅ **#28 Asset-Wunsch-Queue** — „✎ Asset fehlt?" im Asset-Browser → Bridge-Message `asset-request` (Typ + Whitelist + Guard in `bridge.ts`, unit-getestet) → `AtlasStudioHost.onAssetRequest` öffnet das RTX-Asset-Studio mit vorbelegtem Wunsch (`AtlasAssetProposalStudio initialPrompt`). Bestehender Proposal→Review-Flow unverändert.
- ✅ **#16 Skalierbare Kartengröße** — `TILE/COLS/ROWS/WORLD_W/WORLD_H` sind jetzt dynamisch (`syncWorldDims()` aus `doc.tileLayer`); „Kartengröße"-Auswahl in der Sidebar (64×40 … 192×120, 1.6-Seitenverhältnis). `resizeMap` verankert top-left: Terrain-Zellen + Höhenfeld bleiben, normalisierte Geometrie/Objekte werden ums Größenverhältnis skaliert (Ränder wachsen/schrumpfen); Portal-/Static-Viewer lesen `cols/rows` ohnehin dynamisch. Höhenfeld/Blend/Export-Grid ziehen mit.
- ✅ **#17 Landmassen-Pinsel** — eigenes Werkzeug „K": Land malen (grassland + leichtes Relief 0.12 fürs Hillshade), Rechtsklick malt Wasser (coast, Höhe 0); die Küstenlinie entsteht organisch aus dem grassland↔coast-Rand, den der Küstensaum (#5) rendert. Pinselgröße wie beim Terrain-Pinsel.
- ✅ **#26 Unterwelt-Ebene** — Design-Spike-Ergebnis: Layer-Konvention `style.underworld` am selben Node (kein Schema-Change). „🕳 Unterwelt-Ebene bearbeiten"-Toggle in der Sidebar; neue Inhalte der manuellen Werkzeuge (`tagUnderworld` in Stempel/Pfad/Polygon/Label/Pin) landen auf der aktiven Ebene. `drawScene` filtert nach Ebene (andere Ebene blass als Kontext, im Export nur die aktive), dunkler Wash im Unterwelt-Modus, Hit-Test nur auf der aktiven Ebene. Unterwelt-Inhalte bleiben `dm_only`. *Offen: Portal-Ebenen-Umschalter, eigener Unterwelt-Terrain-Layer.*
- ✅ **#14 Werkstatt-Layout** — vollständiger Chrome-Reflow: **Werkzeug-Schiene** links (nur Werkzeuge), **Canvas** in der Mitte, **andockbarer Inspektor** rechts (Auswahlkarte oben angedockt + Karten-Einstellungen darunter, ein-/ausklappbar), **Asset-Shelf** unten (Terrain-Pinsel + Asset-Browser + horizontal scrollendes Objekt-Grid, ein-/ausklappbar) sowie die **Kontext-Mini-Toolbar** über dem selektierten Objekt. Alle Element-IDs unverändert (JS-Verdrahtung intakt); Einstellungs-Panels hängen jetzt an `#inspector-body`; im Ansichts-Modus bleiben nur Canvas + Legende. Verifiziert per Reflow-Smoke (12 Struktur-/Interaktions-Checks + Screenshots).

**Alle Roadmap-Punkte (Welle 3 + 4) sind umgesetzt.** Kleinere Nachschärfungen
in den Einzeleinträgen oben als *Offen* markiert (z. B. Encounter-Wurf im
Reiseplaner, Portal-Ebenen-Umschalter für die Unterwelt) — optionale Ausbauten,
kein offener Kernumfang mehr.
