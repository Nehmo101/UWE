# Terra — Bearbeitungsplan

Stand 26. Juli 2026, auf Basis der Vollanalyse von `terra.html` (main, eingefrorene Referenz), des Arbeitsbranchs `claude/terra-fantasy-map-editor-z0ei9r` (Runde A + B), der Referenzbilder (`Uwe Images/Auswahl`) und der Ghibli-Recherche.

Alle Arbeit passiert auf dem Arbeitsbranch bzw. dessen Nachfolgern; `terra.html` in main bleibt unangetastet. Verbindlich bleiben: Determinismus ohne `Math.random`, Speicherformat abwärtskompatibel, `alphaTest` statt `transparent` beim Flor, `OutputPass` zuletzt, Shader-Patches mit Ankerprüfung, Deutsch als Projektsprache, Werkzeuglogik portieren statt zusammenfassen.

---

## Runde C — Reparatur (merge-blockierend) — ERLEDIGT (26.07.2026)

Ziel: Der Branch zeigt, was Runde B gebaut hat, und leckt nicht. Danach Merge-Kandidat.
Alle Punkte C1-C9 umgesetzt; C10 (WEBGL_debug_renderer_info) als manuelle Pruefung im README dokumentiert, C11-Optikcheck als Checkliste im PR.

| Nr. | Aufgabe | Ort | Größe |
|---|---|---|---|
| C1 | **UV-Fix in `mergeGeos`**: `uv`-Attribut mitkopieren, fehlende mit 0 auffüllen. Im selben Schritt `uvKonst`/`flipY`-Inkonsistenz auflösen (Stamm-Streifen liegt bei v≈0, `uvKonst` zielt auf 0.995) — beides zusammen, sonst verschwinden nach dem UV-Fix die Baumstämme. | `generators/geometry.js:13-47`, `:757`, `:885-890` | S |
| C2 | Sichtprüfung nach C1: Kronen als gemalte Silhouetten, Gras/Farn sichtbar, Wind bewegt Gras/Kronen/Rankenblätter im gleichen Takt. | Browser | S |
| C3 | **Plateau-Hängebewuchs rendern**: die nach dem `vineMesh`-Bau gepushten `tubeGeo`-Stränge landen in keinem Mesh — Reihenfolge fixen. | `generators/vines.js:173, 219` | S |
| C4 | **Materialleck Flüsse**: ein geteiltes `flussMat` auf Modulebene statt neuem Material pro Regenerierung; alternativ Materialien in `clearElement` mit entsorgen. Flusswasser dabei in `tintedMats` aufnehmen (siehe C6). | `generators/paths.js:231-233`, `core/store.js:52-64` | S |
| C5 | **Terrain-Pinsel regeneriert Elemente**: bei `pointerup` alle Elemente per `genElement` neu aufbauen + `markDirty()` (einmalig beim Loslassen, nicht pro Pinselstrich) — behebt schwebende/versinkende Bäume und veraltete Kontaktschatten. | `editor/pointer.js` (pointerup-Pfad), `core/dirty.js` | S |
| C6 | **`tintedMats` vervollständigen**: `wegBandMat`, Meeresboden, Flusswasser — sie bleiben aktuell bei Abendrot neutral. | `generators/paths.js:114`, `world/water.js`, `render/materials.js` | S |
| C7 | **Laden härten**: Datei erst vollständig in temporäre Strukturen parsen/validieren, dann atomar übernehmen; `kamera.dist/yaw/pitch` gegen NaN prüfen; bei kürzerem Höhenarray Rest mit `genBase` auffüllen statt Altzustand stehenzulassen. | `editor/io.js:57-95` | M |
| C8 | **`vineMat` opak**: `transparent: false, opacity: 1` (der Rankenfade-Patch oben braucht Transparenz — prüfen, ob der Fade als eigenes Material nur für das oberste Segment bleibt oder `alphaHash`/dithering reicht). | `render/materials.js:238` | S |
| C9 | **Toten Code entfernen**: `TEX.grain`, `terraUniforms.uMalTex`, `fensterMat`/`setFensterGlut`, Pools `weg`/`blatt`, Legacy-Geometrien (`geoBaum`, `geoZypresse`, `geoHaus`, `geoBlume`, `geoWeg`), leere Schleife in `genViertel`, unbenutzte `S`-Importe (inkl. Beschattung in `moundGeo`), `hoverExport`; Demo-`straenge: 7` auf gültigen Wert. | diverse | S |
| C10 | **Umgebungsfrage klären**: `WEBGL_debug_renderer_info` im Zielbrowser prüfen (llvmpipe/SwiftShader?). Ergebnis im README festhalten — vorher keine GPU-Optimierung über Runde D hinaus. | Browser / `terra/README.md` | S |
| C11 | **Abnahme**: gleiche Seed → Screenshot-Vergleich Einzeldatei ↔ Branch (alle 4 Tageszeiten); `terraPatchInfo`-Zähler vollständig; Konsole ohne `console.warn` der Patches. | — | S |

## Runde D — Performance & Ergonomie — ERLEDIGT (26.07.2026)

Ziel: Der Editor fühlt sich auch auf schwacher Hardware flüssig an.
Alle Punkte D1-D7 umgesetzt (D2 als Depth-only-Pass mit Materialtausch pro Objekt statt overrideMaterial).

| Nr. | Aufgabe | Ort | Größe |
|---|---|---|---|
| D1 | **Debouncing schwerer Commits**: Slider-`input` macht nur noch leichte Vorschau (`regenElement`), der schwere Weltneuaufbau (`rebuildRivers`/`rebuildCorridors`/`refreshTerrainFull`) läuft erst bei `change` (Loslassen). Undo-Punkt-Logik bleibt wie gehabt. | `ui/panels.js:138-141`, `core/dirty.js:100-116` | M |
| D2 | **Tiefen-Prepass billig machen**: `scene.overrideMaterial = MeshDepthMaterial` (oder Composer-Tiefe wiederverwenden) statt vollem zweiten Szenenrendering. Achtung: alphaTest-Flor braucht ggf. eine Depth-Variante mit Map — sonst Kantenartefakte prüfen. | `render/pipeline.js:202-216` | M |
| D3 | **Bereichsbeschränkte Terrain-Updates bei `commit(heavy)`**: die Teilbereichs-APIs (`recomputeHeights`/`computeAO`/`refreshGrid`) existieren und werden vom Pinsel schon genutzt — Bounding-Box des geänderten Elements + Korridorbreite verwenden statt `refreshTerrainFull`. | `core/dirty.js`, `world/terrain.js` | M |
| D4 | **Gassen-/Straßenbänder pro Element zu einer Geometrie mergen** (aktuell 20–40 Draw Calls pro Viertel). | `generators/areas.js:250-255`, `paths.js` | M |
| D5 | **Undo-Speicher**: Zwei-Stack-Modell (Elemente-JSON vs. Höhenfeld) oder Copy-on-Write auf `base` — Höhen nur snapshotten, wenn der Schritt Terrain ändert. | `editor/history.js` | M |
| D6 | **Viertel-`streets` beim Griffziehen invalidieren** oder leichtgewichtig neu berechnen, damit Häuser beim Loslassen nicht springen. | `editor/pointer.js:179`, `generators/areas.js` | S |
| D7 | `S.elementSeedCounter` mitspeichern/laden (verhindert wiedervergebene Seeds nach dem Laden). | `editor/io.js:48-53` | S |

## Runde E — Editierbarkeit & Speicherformat

Ziel: Der Kerncharakter „dauerhaft editierbar" gilt ohne Einschränkung.

| Nr. | Aufgabe | Ort | Größe |
|---|---|---|---|
| E1 | **Ortsstabiler Zufall für Pfade/Viertel/Ranke**: Bestückung aus Hash über (Bogenlängen-Index, Seite, Elementseed) statt sequentiellem `rngOf`-Strom — wie es Wald/Wiese mit der Rasterzelle vormachen. Punktverschiebung reorganisiert dann nicht mehr die gesamte Bebauung. **Konsequenz:** gleiche Seed ergibt eine andere (aber weiterhin deterministische) Bestückung als vorher → `version: 3` im Speicherformat; alte Karten laden weiter (Form + Parameter bleiben, Bestückung würfelt einmalig um; Toast weist darauf hin). | `generators/paths.js`, `areas.js` (Viertel), `vines.js` | L |
| E2 | **Punkte einfügen/löschen** an bestehenden Elementen: Doppelklick auf ein Segment fügt einen Punkt ein, Entf auf einem gegriffenen Punkt löscht ihn (Element-Löschung bleibt auf „nichts gegriffen" beschränkt). | `editor/selection.js`, `pointer.js` | M |
| E3 | **Speicherformat v3 — Höhen als Delta**: nur vom Pinsel berührte Zellen speichern (Rest aus `seed` reproduzierbar); Loader bleibt tolerant für v1 (Einzeldatei) und v2 (Vollarray). Erledigt zusammen mit E1 in einem Versionssprung. | `editor/io.js`, `world/terrain.js` | M |
| E4 | **`nurTyp` entscheiden**: ins Objekt-Schema aufnehmen (Select über Poolnamen) oder aus `genObjekt` entfernen — aktuell verstecktes, nicht bedienbares Feature. | `generators/objects.js`, `editor/tools.js` | S |

## Runde F — Look-Nachschärfung (Ghibli-Befunde)

Ziel: die drei günstigsten Look-Gewinne aus der Recherche, kalibriert gegen Referenz.

| Nr. | Aufgabe | Ort | Größe |
|---|---|---|---|
| F1 | **Kühler Schatten statt dunkler Schatten**: im untersten Band des Wrap-Patches Hue ~15–30° Richtung Blau shiften (Mix zu einer `uSchattenKuehl`-Farbe pro Tageszeit), Untergrenze ~15 % Helligkeit. Wichtigster einzelner Look-Gewinn. | `render/materials.js` (Patch 1), `world/atmosphere.js` (Preset-Feld) | M |
| F2 | **Niederfrequente Farbdrift**: eine sehr grobe Noise-Oktave (Wellenlänge ~20–60 Einheiten, wenige Grad Hue) zusätzlich in `terrainColor` und in der Malschicht — die Nass-in-nass-Signatur der Vorlagen. | `world/terrain.js` (`terrainColor`), `render/materials.js` (Patch 6) | S |
| F3 | **Kronen-Normalen von der Hüllkugel**: Normalen der Kronenkarten als `normalize(position − kronenzentrum)` setzen — Krone shaded als ein weicher Körper, Silhouette bleibt unruhig. Erst nach C1 sinnvoll beurteilbar. | `generators/geometry.js` (`geoBaumArt`) | M |
| F4 | **Kalibrierpass gegen Filmstills**: Abgleich von Grading (Sättigungsfenster S 0,25–0,50 für Landschaftsmassen, Werteumfang ~0,20–0,85, Bloom-Schwellen) gegen 3–4 echte Referenz-Stills je Tageszeit; Ergebnis als Kommentar an den Presets dokumentieren. | `world/atmosphere.js` | M |

## Runde G — Setting-Ausbau (aus den Referenzbildern)

Ziel: Terra sieht aus wie die Vorlagen — nicht nur bei Mittag auf der Wiese.

| Nr. | Aufgabe | Ort | Größe |
|---|---|---|---|
| G1 | **Fünfte Tageszeit „Nacht"**: dunkelblauer Fünf-Stufen-Himmel, Sterne + Mond auf der Kuppel, Fensterglut hoch, Kontaktschatten fast aus — und die Ranken **selbstleuchtend** (emissive hoch, Lichtpunkte im Geflecht), als Gegenpol zum warmen Ortslicht. Das stärkste Motiv der Nacht-Referenzen. | `world/atmosphere.js`, `sky.js`, `render/materials.js`, `ui` (5. Button) | L |
| G2 | **Ranken-Parameter erweitern**: `dicke` (statt globalem `VINE_R` — 400er-Ranken wirken fadendünn), `stil` (geflochten/wurzelig vs. glatt/bandartig, beides in den Vorlagen), Pflanzort-Prüfung (Wasser/Steilhang), optional Luftwurzeln unter den Plateaus. | `generators/vines.js`, `core/store.js`, `editor/tools.js` | L |
| G3 | **Plateau-Städtchen aufwerten**: wählbarer `KULTUR`-Baustil, `districtStreets`-Gassennetz in Blattkoordinaten, Dichte-Parameter statt fixer 5–18 Gebäude. | `generators/vines.js:191-230`, `areas.js` | M |
| G4 | **Erschließung**: Wendeltreppe am Strang entlang (Pfad aus den vorhandenen Parallel-Transport-Rahmen) und/oder Hängebrücken zwischen Plateaus benachbarter Ranken. | `generators/vines.js`, `geometry.js` | L |
| G5 | **Biome**: Kartenparameter `biom` (wiese/wueste/kueste/sumpf/schnee) — steuert `terrainColor`-Palette, Baumarten-Gewichte, Wasserfarbe und Preset-Nuancen. Referenzen zeigen alle fünf. | `world/terrain.js`, `generators/areas.js`, `atmosphere.js`, `io.js` (Format) | L |
| G6 | **Freie Schwebeinseln** als eigene Objektvariante (unabhängig von Ranken), mit Kontaktschatten-Ausschluss wie gehabt. | `generators/objects.js`, `geometry.js` | S |

---

## Reihenfolge und Abhängigkeiten

1. **Runde C zuerst und vollständig** — C1 blockiert die Beurteilung von allem Optischen (auch F3, G-Runde). Nach C: Branch mergen, damit main den echten Stand trägt.
2. **Runde D** unabhängig davon beginnbar (D1–D3 lohnen auch auf Software-Rasterizer); C10 entscheidet, ob darüber hinaus GPU-Arbeit nötig ist.
3. **Runde E** vor Runde G: E1/E3 ändern das Format (v3) — besser ein Versionssprung vor dem Setting-Ausbau als zwei danach.
4. **Runde F** nach C, parallel zu D/E möglich; F4 zuletzt in der Runde.
5. **Runde G** zum Schluss; innerhalb der Runde zuerst G1 (Nacht) — größter Stimmungsgewinn pro Aufwand — dann G2/G3, dann G4/G5/G6 nach Lust.

Jede Runde endet mit dem C11-Abnahmemuster: gleiche Seed, vier (ab G1: fünf) Tageszeiten-Screenshots, `terraPatchInfo` sauber, Statuszeile (Calls/Tris/Instanzen) notiert.
