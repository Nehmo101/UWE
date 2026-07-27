# Terra — Orchestrator-Prompt für Vertragus

(Zum Kopieren in Vertragus; Arbeitsverzeichnis: C:\git\UWE)

---

Du orchestrierst die vollständige Abarbeitung des Terra-Bearbeitungsplans im Repo `C:\git\UWE`. Terra ist ein Fantasy-Karteneditor in Three.js (schräge Aufbauspiel-Aufsicht; Setting: kolossale weiße Ranken tragen Städtchen auf Blattplateaus). Projektsprache ist Deutsch — Code, Bezeichner, Kommentare, Commits, PR-Texte.

## Ausgangslage

- **Arbeitsbasis ist der Branch `claude/terra-fantasy-map-editor-z0ei9r`** (origin). Er enthält den Ordner `terra/`: 26 ES-Module (~5.600 Zeilen), Three 0.185.1 gepinnt per Import Map (jsDelivr), kein Bundler, kein npm. Start: statischer Server im Ordner `terra/`, z. B. `python3 -m http.server 8000`.
- `terra.html` im Repo-Root auf main ist die **eingefrorene Einzeldatei-Referenz** (PR #793). Sie wird unter keinen Umständen verändert.
- Falls `docs/engineering/terra-bearbeitungsplan.md` noch nicht committet ist: als erstes auf dem Arbeitsbranch committen.

## Verbindliche Invarianten (gelten für jede Teilaufgabe, jeder Subagent bekommt sie mit)

1. **Determinismus:** Kein `Math.random`, nirgends — auch nicht in Texturgeneratoren. Alles Zufällige läuft über `hashi`/`rngOf` (mulberry32) aus `core/rng.js`. Gleiche Seed ⇒ exakt dieselbe Karte. Auch `Date.now()`/`new Date()` haben im Generierungspfad nichts verloren.
2. **Speicherformat bleibt abwärtskompatibel.** Karten der Versionen 1 (Einzeldatei) und 2 müssen weiter laden. Formatänderungen erhöhen das `version`-Feld, der Loader bleibt tolerant.
3. **Bodenflor/Vegetation:** `alphaTest: ~0.4` mit `transparent: false`. Niemals `transparent: true` für instanzierte Vegetation.
4. **Post-Pipeline:** `OutputPass` steht immer als letzter Pass (Tone Mapping + Farbraum).
5. **Shader nur über `onBeforeCompile`** patchen, nie eigene `ShaderMaterial` für Weltobjekte. Jede String-Ersetzung prüft ihren Anker; bei Misserfolg bleibt der Shader unverändert + `console.warn`. Diagnosezähler auf `window.terraPatchInfo` pflegen.
6. **Kein Material zwischen instanzierten und nicht-instanzierten Meshes teilen.**
7. **`InstancedMesh.count`** immer auf die Belegung setzen, nie auf die Kapazität.
8. **Texturen in Welteinheiten skalieren**, nicht mit der Objektgröße.
9. Bei Änderung eines Elements wird nur dieses neu berechnet (Dirty-Tracking in `core/dirty.js` respektieren).
10. Platzierungsregeln (`tryPlace` in `generators/objects.js`): nichts unter Wasser, nichts über ~40° Hang, nichts in Straßen-/Flusskorridoren.
11. **Vorhandene Logik portieren, nicht zusammenfassen** — eine 60-Zeilen-Generatorfunktion hat nach einem Umbau wieder ~60 Zeilen.
12. Kunstrichtung: japanische Anime-Hintergrundmalerei. Sättigung nie global anheben (nur luminanzgewichtet in den Mitten, in Lichtern zurücknehmen); Kalt-Warm-Kontrast ist der Kern; keine einfarbige Fläche; Nebelfarbe passt zur Horizontfarbe; Wolken oben hart/unten weich; Kanten nur andeuten (Sobel nie als Linie erkennbar); Detaildichte durch Nester/Lücken, nicht Menge.

## Arbeitsmodus

- **Eine Runde = ein PR** gegen den Arbeitsbranch (bzw. nach dessen Merge gegen main). Runden strikt in Reihenfolge C → D → E → F → G; innerhalb einer Runde dürfen unabhängige Aufgaben parallel an Subagents gehen (getrennte Dateien beachten — `generators/geometry.js` ist der häufigste Konfliktpunkt, Aufgaben daran sequenzialisieren).
- Jeder Subagent-Task nennt: Ziel, betroffene Dateien mit Zeilenbereichen, Akzeptanzkriterium, die Invarianten oben.
- **Abnahme pro Runde (Pflicht, vor dem PR):**
  - `grep -rn "Math.random" terra/` liefert nur Kommentare.
  - `terra/index.html` per statischem Server starten; Konsole frei von Patch-`console.warn`; `window.terraPatchInfo`-Zähler vollständig (`versuche` == jeder Einzelzähler).
  - Demo-Karte lädt; Speichern → Laden → identische Szene; eine v2-Karte (vor der Runde gespeichert) lädt weiter.
  - Statuszeile (fps/calls/tris/Instanzen) vor/nach der Runde im PR-Text dokumentieren.
  - Was headless nicht prüfbar ist (Optik), als manuelle Checkliste in den PR-Text schreiben.
- Am Ende jeder Runde: Abschnitt „Offener Stand" in `terra/README.md` und den Plan (`docs/engineering/terra-bearbeitungsplan.md`) aktualisieren (erledigte Punkte abhaken).

## Runde C — Reparatur (merge-blockierend)

| Nr. | Aufgabe | Ort |
|---|---|---|
| C1 | **UV-Fix in `mergeGeos`**: kopiert bisher nur position/normal/color/index — `uv` mitkopieren, fehlende mit (0,0) auffüllen. Im selben Schritt die `uvKonst`/flipY-Inkonsistenz beheben: `uvKonst(stamm, 0.5, 0.995)` zielt auf „unterste Zeile opak", der opake Streifen liegt bei flipY aber bei v≈0 (`fillRect(0, img.height-4, …)`). Beides zusammen fixen, sonst tauscht man unsichtbares Gras gegen unsichtbare Baumstämme. Folgen des Bugs (zur Verifikation): Kronen der 6 Baumarten flächig opak, `gras`/`farn` unsichtbar (alphaTest verwirft alles bei uv(0,0)), Wind-Patch (gewichtet mit `uv.y`) wirkungslos für alle `mergeGeos`-Pools. | `terra/src/generators/geometry.js:13-47`, `:757`, `:885-890` |
| C2 | Sichtprüfung nach C1 (manuelle Checkliste im PR): Kronen als gemalte Silhouetten, Gras/Farn sichtbar, Wind bewegt Gras/Kronen/Rankenblätter gemeinsam. | Browser |
| C3 | **Plateau-Hängebewuchs rendern**: `vineMesh` wird aus `geos` gebaut, die Hängebewuchs-`tubeGeo`s werden erst danach gepusht und landen in keinem Mesh. Reihenfolge fixen. | `terra/src/generators/vines.js:173, 219` |
| C4 | **Materialleck Flüsse**: `genFluss` erzeugt pro Regenerierung ein neues Material, `clearElement` disposed nur Geometrien. Ein geteiltes `flussMat` auf Modulebene (Muster: `vineMat`). | `terra/src/generators/paths.js:231-233`, `core/store.js:52-64` |
| C5 | **Terrain-Pinsel regeneriert Elemente**: `applyBrush` ändert Höhen, aber Elemente/Kontaktschatten bleiben auf alter Höhe (schwebende Bäume). Bei `pointerup` des Terrain-Werkzeugs alle Elemente per `genElement` neu erzeugen + `markDirty()` — einmalig beim Loslassen. | `terra/src/editor/pointer.js`, `core/dirty.js` |
| C6 | **`tintedMats` vervollständigen**: `wegBandMat`, Meeresboden-Material, Flusswasser fehlen und bleiben bei Abendrot neutral. | `paths.js:114`, `world/water.js`, `render/materials.js` |
| C7 | **Laden härten**: Datei erst vollständig in temporäre Strukturen parsen/validieren, dann atomar übernehmen (aktuell hinterlässt eine kaputte Datei einen halb überschriebenen Zustand); `kamera.dist/yaw/pitch` gegen NaN prüfen; bei kürzerem Höhenarray Rest über `genBase` auffüllen. | `terra/src/editor/io.js:57-95` |
| C8 | **`vineMat`**: `transparent: true` bei opacity 0.95 kostet Sortierung für fast nichts. Auf opak umstellen; der Rankenfade-Patch (Patch 7) braucht eine Lösung ohne globale Transparenz (z. B. eigenes Material nur fürs oberste Segment oder Dither/alphaHash). | `render/materials.js:238` |
| C9 | **Toten Code entfernen**: `TEX.grain` (Korn ist prozedural), `terraUniforms.uMalTex`, `fensterMat`/`setFensterGlut` (No-Op; echte Glut läuft über `POOLS.fensterlicht`), Pools `weg` und `blatt` (nie befüllt), Legacy-Geometrien `geoBaum`/`geoZypresse`/`geoHaus`/`geoBlume`/`geoWeg`, leere Schleife in `genViertel` (areas.js:256-266), unbenutzte `S`-Importe (inkl. Beschattung durch lokales `var S` in `moundGeo`), `hoverExport`; Demo-Wert `straenge: 7` auf das Clamp-Maximum 5. | diverse |
| C10 | **Umgebungsfrage klären**: `WEBGL_debug_renderer_info` im Zielbrowser abfragen (steht dort llvmpipe/SwiftShader, liegt die 3–4-fps-Messung an der Umgebung, nicht am Code). Ergebnis im README dokumentieren. | Browser / `terra/README.md` |
| C11 | **Abnahme + PR**: gleiche Seed → Screenshots Einzeldatei ↔ Branch über alle 4 Tageszeiten (manuelle Checkliste), Standard-Abnahme aus „Arbeitsmodus". Danach diesen Stand als PR Richtung main bringen. | — |

## Runde D — Performance & Ergonomie

| Nr. | Aufgabe | Ort |
|---|---|---|
| D1 | **Debouncing schwerer Commits**: Slider-`input` an Straße/Fluss/Mauer/Viertel löst aktuell pro Pixel den kompletten Weltneuaufbau aus (`rebuildRivers` + `rebuildCorridors` + volles 257²-Terrain + alle Elemente + alle Pools). Umbauen: `input` ⇒ nur leichte Vorschau (`regenElement`), `change` (Loslassen) ⇒ schwerer Commit. Undo-Punkt-Logik (erster `input` setzt, `change` löst) beibehalten. | `ui/panels.js:138-141`, `core/dirty.js:100-116` |
| D2 | **Tiefen-Prepass billig machen**: rendert die ganze Szene ein zweites Mal mit voller Fragmentarbeit. Auf `scene.overrideMaterial` (MeshDepthMaterial) umstellen oder Composer-Tiefe wiederverwenden; alphaTest-Flor braucht ggf. Depth-Material mit Map — Kanten auf Artefakte prüfen. | `render/pipeline.js:202-216` |
| D3 | **Bereichsbeschränkte Terrain-Updates bei `commit(heavy)`**: Teilbereichs-APIs (`recomputeHeights`/`computeAO`/`refreshGrid` mit `addUpdateRange`) existieren und werden vom Pinsel genutzt — Bounding-Box des geänderten Elements + Korridorbreite statt `refreshTerrainFull`. | `core/dirty.js`, `world/terrain.js` |
| D4 | **Straßen-/Gassenbänder pro Element zu einer Geometrie mergen** (ein Viertel erzeugt aktuell 20–40 Band-Meshes = Draw Calls). | `generators/areas.js:250-255`, `paths.js` |
| D5 | **Undo-Speicher**: jeder Schnappschuss kopiert das volle Höhenfeld (264 KB × 40). Höhen nur snapshotten, wenn der Schritt Terrain ändert (Zwei-Stack oder Copy-on-Write). | `editor/history.js` |
| D6 | **Viertel-`streets` beim Griffziehen**: Cache wird beim Ziehen nicht invalidiert, Häuser springen beim Loslassen. Invalidieren oder leichtgewichtig aktualisieren. | `editor/pointer.js:179`, `generators/areas.js` |
| D7 | `S.elementSeedCounter` mitspeichern/laden (sonst nach Laden wiedervergebene Seeds). | `editor/io.js:48-53` |

## Runde E — Editierbarkeit & Speicherformat (ein Versionssprung auf `version: 3`)

| Nr. | Aufgabe | Ort |
|---|---|---|
| E1 | **Ortsstabiler Zufall für Straße/Mauer/Fluss/Hecke/Feld/Viertel/Ranke**: statt einem sequentiellen `rngOf(el.seed)`-Strom (Punkt verschoben ⇒ gesamte Bestückung würfelt um) Hash über (Bogenlängen-Index, Seite, `el.seed`) — Muster: Wald/Wiese hashen die Rasterzelle (`hashi(cx,cz,seed)`). Konsequenz: bestehende Karten behalten Form+Parameter, die Bestückung würfelt beim ersten Laden einmalig um ⇒ Teil des v3-Sprungs, Toast weist darauf hin. Determinismus (gleiche Seed ⇒ gleiche Karte) muss danach wieder exakt gelten. | `generators/paths.js`, `areas.js`, `vines.js` |
| E2 | **Punkte einfügen/löschen** an bestehenden Elementen: Doppelklick auf ein Segment fügt einen Punkt ein, Entf auf einem gegriffenen Punkt löscht ihn (Element-Löschung nur, wenn kein Punkt gegriffen). | `editor/selection.js`, `pointer.js` |
| E3 | **Höhen als Delta speichern**: nur vom Pinsel berührte Zellen (Rest reproduzierbar aus `seed`) statt 66.049 JSON-Zahlen. Loader bleibt tolerant für v1 (Einzeldatei) und v2 (Vollarray). Zusammen mit E1 als ein `version: 3`. | `editor/io.js`, `world/terrain.js` |
| E4 | **`nurTyp`** (verstecktes Feature in `genObjekt`): entweder ins Objekt-Schema aufnehmen (Select über Poolnamen) oder entfernen. | `generators/objects.js`, `editor/tools.js` |

## Runde F — Look-Nachschärfung (Ghibli-Befunde)

| Nr. | Aufgabe | Ort |
|---|---|---|
| F1 | **Kühle Schatten**: im untersten Band des Wrap-Patches Farbton 15–30° Richtung Blau shiften (Mix zu neuem Preset-Feld `schattenKuehl` je Tageszeit), Helligkeits-Untergrenze ~15 %. Ghibli-Schatten sind kühl und aufgehellt, nie nur dunkler. | `render/materials.js` (Patch 1), `world/atmosphere.js` |
| F2 | **Niederfrequente Farbdrift**: zusätzliche sehr grobe Noise-Oktave (Wellenlänge ~20–60 Welteinheiten, wenige Grad Hue, einige % Value) in `terrainColor` und der Malschicht (Patch 6) — die „Nass-in-nass"-Signatur der Anime-Hintergründe. Deterministisch über `fractal` mit festem Seed. | `world/terrain.js`, `render/materials.js` |
| F3 | **Kronen-Normalen von der Hüllkugel**: Normalen der Kronenkarten pro Baum als `normalize(position − kronenzentrum)` setzen — Krone shaded als ein weicher Körper, Silhouette bleibt unruhig. (Erst nach C1 optisch beurteilbar.) | `generators/geometry.js` (`geoBaumArt`) |
| F4 | **Kalibrierpass**: Grading-/Preset-Werte gegen Zielkorridore prüfen und als Kommentar an den Presets dokumentieren: Landschaftsmassen S ≈ 0,25–0,50; Werteumfang ~0,20–0,85 (reines Weiß nur Wolkenlichter); Sättigung luminanzgewichtet Mitten ↑ / Lichter ↓ (ist vorhanden — Werte verifizieren); Bloom schwach mit hoher Schwelle; Abendrot behält den größten Tonwertumfang (dunkle lesbare Silhouetten gegen warmen Himmel, kein brauner Einheitsschleier — `fogCap` + Zweifarb-Nebel nutzen). | `world/atmosphere.js`, `render/pipeline.js` |

## Runde G — Setting-Ausbau (Referenzbilder als Leitbild)

Referenzen liegen in `C:\Users\lasse\Documents\Downloads\Uwe Images\Auswahl` (Tag/Nacht). Bildsprache: Ranken sind immer der hellste Wert im Bild; nachts selbstleuchtend-gazehaft gegen warmes Fensterglühen; Wolken oben hart/unten weich; Nebel sammelt sich in Senken.

| Nr. | Aufgabe | Ort |
|---|---|---|
| G1 | **Fünfte Tageszeit „Nacht"**: dunkelblauer Fünf-Stufen-Himmel, Sterne + Mond auf der Kuppel (deterministisch geseedet), Fensterglut hoch (≥ Abend), Kontaktschatten fast aus, kühler Nebel — und die Ranken selbstleuchtend (emissive deutlich hoch, ggf. Lichtpunkte im Geflecht). Fünfter Button in der Leiste, Preset-Blending wie gehabt, `tageszeit`-Feld im Speicherformat bleibt ein String (kompatibel). | `world/atmosphere.js`, `sky.js`, `render/materials.js`, `ui/panels.js`, `editor/io.js` |
| G2 | **Ranken-Parameter**: `dicke` (ersetzt die globale Konstante `VINE_R = 6` pro Element — 400er-Ranken wirken sonst fadendünn; Steigungsformel `TURNS = H/(steigung*2*R)` mitziehen), `stil` (geflochten/wurzelig vs. glatt/bandartig — beide Typen kommen in den Vorlagen vor), Pflanzort-Prüfung (nicht im Wasser/am Steilhang), optional Luftwurzeln unter den Plateaus. Neue Parameter mit Defaults ⇒ alte Karten laden unverändert. | `generators/vines.js`, `core/store.js`, `editor/tools.js` |
| G3 | **Plateau-Städtchen aufwerten**: wählbarer `KULTUR`-Baustil statt hartkodierter Tabelle, `districtStreets`-Gassennetz in Blattkoordinaten (u,v), Dichte-Parameter statt fixer 5–18 Gebäude. | `generators/vines.js:191-230`, `areas.js` |
| G4 | **Erschließung**: Wendeltreppe am Strang entlang (Pfad aus den vorhandenen Parallel-Transport-Rahmen der `tubeGeo`) und/oder Hängebrücken zwischen Plateaus benachbarter Ranken. | `generators/vines.js`, `geometry.js` |
| G5 | **Biome**: Kartenparameter `biom` ∈ {wiese, wueste, kueste, sumpf, schnee} — steuert `terrainColor`-Palette, Baumarten-Gewichte, Wasserfarbe, Preset-Nuancen. Default `wiese` ⇒ alte Karten unverändert. | `world/terrain.js`, `generators/areas.js`, `atmosphere.js`, `io.js` |
| G6 | **Freie Schwebeinseln** als eigene Objektvariante (`islandGeo` existiert), unabhängig von Ranken; Kontaktschatten-Ausschluss über die bestehende Höhenregel. | `generators/objects.js`, `geometry.js` |

## Fertig-Kriterium (Gesamtabnahme)

Alles ist abgearbeitet, wenn:
1. Alle Runden C–G als gemergte PRs vorliegen (C zuerst Richtung main, Rest darauf aufbauend).
2. Alle Abnahmen aus „Arbeitsmodus" pro Runde dokumentiert sind (inkl. Statuszeilen-Vergleich und manueller Optik-Checkliste im jeweiligen PR).
3. Eine v1-Karte (aus `terra.html`) und eine v2-Karte laden im Endstand fehlerfrei; eine im Endstand gespeicherte Karte lädt nach Reload identisch (gleiche Seed ⇒ gleiche Szene).
4. `grep -rn "Math.random" terra/` liefert ausschließlich Kommentare; `window.terraPatchInfo` meldet alle Patches als gegriffen.
5. `terra/README.md` beschreibt den Endstand (Start, Struktur, Biome, 5 Tageszeiten, Formatversion 3) und `docs/engineering/terra-bearbeitungsplan.md` ist vollständig abgehakt.

Melde am Ende eine Zusammenfassung: was pro Runde geändert wurde, PR-Nummern, offene Punkte (falls etwas begründet nicht umsetzbar war — dann mit Begründung statt stillschweigend weggelassen).
