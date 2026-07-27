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

## Runde F — Look-Nachschärfung (Ghibli-Befunde) — ERLEDIGT (27.07.2026)

Ziel: die drei günstigsten Look-Gewinne aus der Recherche, kalibriert gegen Referenz.
F1-F4 umgesetzt; F4-Sichtabgleich gegen Filmstills bleibt manueller Punkt in der PR-Checkliste.

| Nr. | Aufgabe | Ort | Größe |
|---|---|---|---|
| F1 | **Kühler Schatten statt dunkler Schatten**: im untersten Band des Wrap-Patches Hue ~15–30° Richtung Blau shiften (Mix zu einer `uSchattenKuehl`-Farbe pro Tageszeit), Untergrenze ~15 % Helligkeit. Wichtigster einzelner Look-Gewinn. | `render/materials.js` (Patch 1), `world/atmosphere.js` (Preset-Feld) | M |
| F2 | **Niederfrequente Farbdrift**: eine sehr grobe Noise-Oktave (Wellenlänge ~20–60 Einheiten, wenige Grad Hue) zusätzlich in `terrainColor` und in der Malschicht — die Nass-in-nass-Signatur der Vorlagen. | `world/terrain.js` (`terrainColor`), `render/materials.js` (Patch 6) | S |
| F3 | **Kronen-Normalen von der Hüllkugel**: Normalen der Kronenkarten als `normalize(position − kronenzentrum)` setzen — Krone shaded als ein weicher Körper, Silhouette bleibt unruhig. Erst nach C1 sinnvoll beurteilbar. | `generators/geometry.js` (`geoBaumArt`) | M |
| F4 | **Kalibrierpass gegen Filmstills**: Abgleich von Grading (Sättigungsfenster S 0,25–0,50 für Landschaftsmassen, Werteumfang ~0,20–0,85, Bloom-Schwellen) gegen 3–4 echte Referenz-Stills je Tageszeit; Ergebnis als Kommentar an den Presets dokumentieren. | `world/atmosphere.js` | M |

## Runde G — Setting-Ausbau (aus den Referenzbildern) — ERLEDIGT (27.07.2026)

Ziel: Terra sieht aus wie die Vorlagen — nicht nur bei Mittag auf der Wiese.
G1-G6 umgesetzt: Nacht-Preset (Sterne, Mond, Rankenglut), Ranken-Parameter (dicke/stil/luftwurzeln), Plateau-Staedte (KULTUR-Stil, Dichte, Gassen), Wendeltreppe + Haengebruecken, 5 Biome, Schwebeinseln als Objekt-Variante.

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

---

# Roadmap ab Runde H — Weltausbau

Aufgenommen am 27.07.2026 aus Nutzerwünschen (Kartengröße, Biome, Objektmenge, Ranken-Mechanik) plus eigenen Vorschlägen. Die Runden C–G sind abgeschlossen (PRs #800–#804), diese Themen bauen darauf auf.

## Kanon: Arbor und der zerbissene Apfel

Das Setting bekommt damit erstmals eine verbindliche Erzähllogik, und die hat unmittelbare technische Folgen:

> Der Planet **Terra** ist auseinandergerissen. Zusammengehalten wird er vom weißen Riesenbaum **Arbor** — die kolossalen weißen Ranken sind seine Triebe. Sie leuchten aus sich heraus und spenden der Welt Licht. Der Planet sieht aus wie ein zerbissener Apfel; Arbor ist der Apfelkern. Die Ranken wachsen deshalb **zur Mitte hin zusammen**, nicht parallel in den Himmel.

Daraus folgt für den Editor (jeder Punkt ist eine echte Änderung, keine Deko):

| Folge | Was sich ändert |
|---|---|
| **Ranken sind Lichtquellen** | Bisher sind sie nur emissiv (hellster Wert im Bild). Künftig müssen sie die Umgebung tatsächlich aufhellen — sonst wirkt die Nacht unglaubwürdig. Umsetzung siehe H3. |
| **Wuchs zur Mitte** | Ranken laufen nicht senkrecht, sondern neigen sich mit der Höhe zu einem gemeinsamen Fluchtpunkt über der Kartenmitte (bzw. zu einem einstellbaren „Kernpunkt"). Die Mittelachse in `vines.js` bekommt eine Neigungskomponente proportional zur Höhe und zum Abstand vom Kern. |
| **Zusammenwachsen** | Treffen sich zwei Ranken, verschmelzen sie zu einer dickeren (Nutzerwunsch, siehe H4) — genau das Bild des Apfelkerns, in dem alle Stränge zusammenlaufen. |
| **Bruchkanten** | Ein zerrissener Planet hat Abbruchkanten: Klippen ins Nichts, abgerissene Landbrücken, schwebende Trümmer. Das ist ein eigenes Terrain-Thema (H6) und speist Biome („Aschebrache") und Objekte (Ruinen an der Bruchkante). |
| **Licht als Ressource** | Erzählerisch naheliegend und spielerisch nutzbar: Nähe zu Arbor = Licht = Siedlungsdichte. Die Auto-Bestückung kann das auswerten (H3, Punkt 3). |

## H1 — Kartengröße

Heute: `MAP = 256` Kacheln, 257² = 66.049 Vertices in **einem** Terrain-Mesh, `corridor`/`wear` als Uint8Array derselben Größe.

Naiv auf 512 zu gehen vervierfacht alles (263k Vertices, ~524k Dreiecke pro Mesh, 1 MB pro Undo-Höhenkopie) und macht jeden Teil-Upload teurer. Deshalb gestaffelt:

1. **H1a — Kachelung des Terrains.** Das eine Mesh wird in Patches zerlegt (z. B. 8×8 Patches à 64 Kacheln). Gewinne: echtes Frustum-Culling, Teil-Uploads betreffen nur die berührten Patches (`refreshGrid` arbeitet dann patchweise), und die Kartengröße wird zur Konfiguration statt zur Konstante. Das ist die Voraussetzung für alles Weitere.
2. **H1b — Kartengröße als Parameter** (256 / 512 / 1024) im Speicherformat (`kartenGroesse`, v4; Loader tolerant, fehlend = 256). `HALF`/`MAP`/`VW` sind heute `const`-Exporte — sie müssen zu Laufzeitwerten werden; alle Importeure prüfen (`terrain.js`, `objects.js` Kartenrand, `camera.js` Schwenkgrenzen, `pools.js` Hüllkugel `radius: 460`, `water.js` 2000er-Ebene, Nebel-Fernwerte der Presets).
3. **H1c — Detailstufen (LOD).** Ferne Patches mit halber/viertel Auflösung zeichnen. Erst sinnvoll, wenn H1a steht.
4. **H1d — Instanz-Budget mitziehen.** `MAX_INST_PER_EL = 24000` und die `safeSpacing`-Deckel (Wald 14k, Wiese 20k) sind auf 256er-Karten kalibriert; auf 1024er-Karten müssen sie flächenproportional mitwachsen, sonst wird eine große Wiese dünner statt größer.
5. **H1e — Undo-Speicher.** Mit Copy-on-Write aus Runde D kostet ein Terrainschritt schon 1 MB bei 512². Bei 1024² (4 MB) muss der Snapshot auf die berührte Patch-Region beschränkt werden.

**Reihenfolge:** H1a → H1d → H1b → H1e → H1c. Vorher `WEBGL_debug_renderer_info` klären (offener Punkt C10) — auf einem Software-Rasterizer bringt Kachelung wenig, LOD dagegen viel.

## H2 — Biome in die Breite

Ausgearbeitet in **`terra-biomkatalog.md`**: 25 Biome (die 5 aus Runde G präzisiert, 20 neu) mit Paletten, Zonenschwellen, Höhenprofilen, Vegetationsgewichten und Wasser-Tints. Enthalten sind die vom Nutzer genannten Eis, Wüste, Moor und Meer sowie u. a. Hochland, Steppe, Vulkan/Aschekegel, Salzpfanne, Regenwald, Bambuswald, Mangrovenküste, Kreidefelsen, Tundra, Karst, Blütental, Aschebrache, Pilzwald, Terrassenland, Nebelwald, Klippenmeer und Korallenbank.

Drei Punkte daraus gehören in die Reihenfolge, weil sie Code ändern statt nur Werte:

1. **Höhenprofil je Biom.** `genBaseIn` rechnet heute mit festen Literalen (`26 / 4 / -6 / -22 / 55`). Erst wenn diese Werte aus der Registry kommen, unterscheiden sich Meer (12 % Land), Aschebrache (senkrechte Bruchkante statt Küste), Karst (Dolinen) und Terrassenland (Stufen) wirklich — sonst ist jedes Biom nur ein Anstrich. Achtung: Der Biomwechsel muss dann das Basisterrain neu erzeugen (Rückfrage im UI), und das v3-Delta diffst weiterhin gegen `genBaseIn` unter demselben Biom — das passt bereits.
2. **`veg.abstand`.** Der vorhandene `dichte`-Faktor wirkt nur nach unten; Regenwald, Bambuswald und Pilzwald brauchen dichter als heute, also einen Faktor auf `safeSpacing`.
3. **Beschneite Bäume** (Nutzerwunsch): siehe H2a.

### H2a — Schneeauflage (beschneite Bäume, Dächer, Felsen)

Der Katalog wägt drei Wege ab und empfiehlt begründet den **Shader-Patch**: ein `onBeforeCompile`-Block mit Ankerprüfung, der nach oben zeigende Flächen aufhellt und leicht kühlt, gesteuert über globale Uniforms (`uSchneeAuflage`, Kanten-Rampe, Höhenband, Farbe, Bruch-Rauschen). Vorteile gegenüber eigenen Schnee-Pools: kein Pool-Neuaufbau beim Biomwechsel, keine sechs zusätzlichen Kronentexturen — und vor allem werden **Dächer, Mauern, Felsen und Karren mitbeschneit**, sodass die Winterkarte als Ganzes winterlich wird statt fleckweise. Zwei Details sind kritisch und stehen im Katalog ausformuliert: die `gl_FrontFacing`-Korrektur für das DoubleSide-Laub und die Uniform-Bindung (statt `opts`-Schalter), damit die Shader-Permutationen nicht wachsen. Das Terrainmaterial wird ausgenommen — dessen Schnee kommt weiterhin aus `terrainColor`.

### H2b — Biom-Flächen statt einer Karte = ein Biom

Ebenfalls im Katalog: Stufe 1 ist ein Flächen-Element `variant: "biom"` und braucht **null Formatänderung** (die Elementserialisierung ist generisch, alte Fassungen ignorieren die unbekannte Variante). Stufe 2 wäre ein Biompinsel, gespeichert als Striche statt als Maske. Wichtig fürs Rendering: Biomgrenzen über die vorhandene Störrauschen-Oktave ausfransen und gemischte Paletten in 16 Stufen cachen, damit `terrainColor` ein Durchlauf bleibt.

## H3 — Arbor als Lichtquelle

1. **Bodenlicht um die Ranke.** Ein Shader-Patch (onBeforeCompile, Ankerprüfung wie alle anderen) addiert auf Terrain und Objekte einen kühl-weißen Lichtbeitrag, der mit dem Abstand zur nächsten Ranke abfällt. Die Rankenpositionen kommen als kleines Uniform-Array (z. B. bis 8 nächste Ranken: `vec4(x, z, radius, staerke)`), aktualisiert beim Commit — kein Per-Pixel-Suchen, kein echtes Punktlicht (Phong mit vielen Lichtern kompiliert neu und kostet).
2. **Nachts dominant, tags fast unsichtbar.** Stärke wird wie alles andere über das Tageszeit-Preset geblendet (`arborLicht`: nacht 1.0, abend 0.35, morgen/nebel 0.15, mittag 0.0).
3. **Licht steuert Besiedlung.** Optional in der Auto-Bestückung: in Rankennähe höhere Haus-/Fensterdichte, weiter weg Ruinen und Wildwuchs. Das macht die Lore ohne ein einziges neues Asset sichtbar.
4. **Bodennebel leuchtet mit.** Der Höhennebel bekommt in Rankennähe einen Anteil der Rankenfarbe — der Klassiker „Lichtsäule im Dunst", und in den Nachtreferenzen genau das, was die Bilder trägt.

## H4 — Ranken: Formkontrolle und Zusammenwachsen

Die vorhandenen Parameter (`dicke`, `steigung`, `stil`, `straenge` aus Runde G) reichen für die Silhouette, aber nicht für gezielte Form.

1. **Windungsgrad differenziert.** `steigung` wirkt global. Neu: `windungUnten` / `windungOben` (die Ranke dreht unten enger, oben weiter — oder umgekehrt), interpoliert über die Höhe. Ebenso `dickeOben` als eigener Wert statt der festen Verjüngung auf 45 %.
2. **Zugpunkte auf der Achse.** Die Ranke bekommt sichtbare Griffe **auf ihrer Höhe** (heute existiert nur der Fußpunkt): 2–5 Kontrollpunkte, die im Raum gezogen werden können (horizontale Verschiebung per Maus, Höhe per Modifier). Die Mittelachse wird dann nicht mehr aus Rauschen allein gebildet, sondern als CatmullRom durch Fuß → Zugpunkte → Spitze, mit dem Rauschen als Überlagerung. Speicherformat: `zugpunkte: [{x, y, z}]` am Element (v4, fehlend = bisheriges Verhalten). Das ist die Umsetzung von „an markierten Stellen ziehen".
3. **Kernneigung.** Neuer Parameter `kernzug` (0–1): Wie stark neigt sich die Ranke mit der Höhe zum Kernpunkt der Karte (Apfelkern-Logik). 0 = senkrecht wie bisher.
4. **Zusammenwachsen zweier Ranken.** Der anspruchsvollste Punkt, weil Elemente einander bisher **nicht kennen** (jedes generiert isoliert — das ist eine Architektur-Invariante). Vorschlag in zwei Stufen:
   - **H4a (billig, deckt 90 %):** Ein Ranken-Element bekommt **mehrere Fußpunkte** (wie ein Pfad). Aus jedem Fuß wächst ein Strang; ab einer einstellbaren Höhe `vereinigung` laufen alle Achsen auf eine gemeinsame Achse zu und der Durchmesser addiert sich (Flächenaddition, nicht Radienaddition: `r = sqrt(Σ r²)`, sonst wird es unförmig fett). Oberhalb wächst eine Ranke weiter. Kein Element muss ein anderes kennen, Determinismus bleibt, die Editierbarkeit über Punktgriffe kommt gratis.
   - **H4b (echte Fusion):** Beim Commit prüft ein Nachlauf, ob Fußpunkte verschiedener Ranken-Elemente näher als (r₁+r₂)·k beieinander liegen, und verschmilzt sie zu einem Element mit mehreren Fußpunkten (also automatisch zu H4a). Das ist eine bewusste Ausnahme von der Isolation und braucht ein sauberes Undo (Verschmelzen = ein Undo-Schritt, Trennen per Punkt-Löschen).
5. **Verwachsungsknoten.** An der Vereinigungsstelle ein sichtbarer Knoten (Wulst, Rindenfalten, Moos, herabhängende Flechten) — sonst sieht die Addition nach Bug aus.

## H5 — Objekte in die Breite

Ausgearbeitet in **`terra-objektkatalog.md`**: 230 neue Pools in 15 Kategorien, jeweils mit Bauweise aus vorhandenen Primitiven, Platzierungsradius, Materialfamilie, Instanzkosten und Platzierungsregel. Die vom Nutzer genannten Mauern, Schloss, Burg, Werft und Schiffe sind vollständig ausgearbeitet — inklusive der Erkenntnis, dass Burg, Werft, Kreuzgang/Karawanserei und Blattstadt **Struktur-Generatoren** im Stil von `genViertel` brauchen statt einzelner Pools, weil ihr Layout dem Gelände folgt.

Drei Voraussetzungen, die vor der Fleißarbeit stehen:

1. **`tryPlaceWasser` und `tryPlaceUfer`** als Gegenstücke zu `tryPlace` — ohne sie ist die gesamte Maritim-Kategorie unplatzierbar (Schiffe brauchen die invertierte Regel: nur *auf* Wasser).
2. **Zwölf neue Bauhelfer** (Zinnenkranz, Bogenreihe, Schiffsrumpf, Takelage, Dachlandschaft, Fachwerk-Raster, Treppe, Bruchkante, Zeltbahn, Aufsatz-Anker, Leucht-Adern). Der `bruchkante`-Helfer ist der wirtschaftlichste: er macht aus jedem Bestandsobjekt seine Ruine.
3. **Aufsatz-Anker** verallgemeinern das vorhandene `FENSTER_ANKER`/`emitFensterlicht`-Muster auf Gauben, Kamine, Erker, Banner — sonst wird jedes Dach ein Sonderfall.

Der Katalog schlägt sechs Umsetzungsbündel vor (Wehrbau-Kit → Burg/Schloss/Kloster → Maritim komplett → Arbor-Welt → Biome & Wirtschaft → Ruinen/Natur/Requisiten). Empfehlung für die Reihenfolge: **Arbor-Welt vorziehen**, weil sie das Setting als Erstes sichtbar macht und auf H3/H4 aufsetzt.

## H6 — Bruchkanten: die Form des zerbissenen Planeten

Aus dem Kanon folgt ein Terrain-Thema, das es heute gar nicht gibt: Der Kartenrand läuft aktuell weich unter Wasser aus (`lerp(-22, h, sstep(0, 55, d))`). Ein zerrissener Planet endet aber an einer **Abrisskante**.

1. **Randprofil je Biom** (`randTiefe`, `randBreite` aus dem Biomkatalog): Die Aschebrache fällt über 10 Einheiten fast senkrecht ins Bodenlose statt über 55 Einheiten ins Meer. Der Nebel schluckt den Grund — mehr braucht es für den Abgrund nicht.
2. **Bruchkanten-Werkzeug** mitten in der Karte: eine gezeichnete Linie, an der das Terrain abreißt (eine Seite bleibt, die andere fällt ins Nichts), mit hängenden Wurzelvorhängen und schwebenden Trümmern am Saum. Technisch ein Pfad-Element mit einseitigem Höhenstempel — dieselbe Mechanik wie der Flusseinschnitt, nur asymmetrisch.
3. **Schwebende Trümmer** existieren seit Runde G als Objektvariante (`inseln`); sie bekommen hier ihren erzählerischen Ort.
4. **Blick über die Kante:** Die Kamera darf über den Rand hinausschwenken, ohne dass eine leere Fläche sichtbar wird — unterhalb der Kante braucht es Dunst, Wolken von oben gesehen und tiefere Trümmerlagen.

## Eigene Verbesserungsvorschläge (über die Wunschliste hinaus)

### Werkzeug und Bedienung
- **Ebenen/Gruppen:** Bei 100+ Objekttypen und großen Karten braucht der Editor eine Elementliste mit Suche, Sichtbarkeits- und Sperrschaltern. Ohne das wird eine 1024er-Karte unbedienbar.
- **Kopieren/Spiegeln/Rotieren von Elementen** (inkl. Mehrfachauswahl per Rahmen). Heute muss jedes Viertel neu gezeichnet werden.
- **Pinsel für Biom-Flächen** statt „eine Karte = ein Biom" (siehe Biom-Katalog): dieselbe Polygon-Mechanik wie Wald/Wiese, nur dass die Fläche die Palette lokal umschaltet — mit weichem Saum, sonst entstehen Teppichkanten.
- **Referenzbild als Untergrund** (Bild einblenden, Deckkraft regeln) — zum Nachzeichnen vorhandener Kartenentwürfe.
- **Messwerkzeug + Maßstabsanzeige**, sobald Karten 1024 Einheiten groß sind.

### Bild und Stimmung
- **Wetter als zweite Achse neben der Tageszeit:** klar / bewölkt / Regen / Schneefall / Sturm. Regen ist in der Vorlage ein Kernmotiv (die berühmten Ghibli-Regenszenen) und ist billig: Streifen-Billboards, dunklere nasse Bodenfarbe, gedämpfte Sättigung, Ringe auf dem Wasser.
- **Jahreszeiten** als Palettenschieber über alle Biome (Frühlingsblüte, Sommergrün, Herbstgold, Winterkahl) — technisch ein Farbmultiplikator plus Blüten-/Laubdichte, erzählerisch enorm ergiebig.
- **Vogelperspektiven-Vorschau (Postkartenmodus):** Kamera fährt auf einen komponierten Blickwinkel, blendet UI aus, rendert in hoher Auflösung. Der PNG-Export ist heute ein Bildschirmfoto; das hier wäre ein Bild.
- **Kamerafahrten aufzeichnen** (Wegpunkte + Zeit) und als GIF/WebM exportieren — für ein Werkzeug, dessen Ergebnis geteilt wird, der größte Mehrwert pro Aufwand.

### Technik und Verlässlichkeit
- **Automatischer Determinismus-Test:** ein kleines Node-Skript, das zwei Läufe derselben Seed hasht und vergleicht (heute nur manuell behauptet). Läuft ohne Browser, wenn die Generatoren three-frei gehalten werden — oder headless über Playwright.
- **Regressions-Screenshots:** je Tageszeit/Biom ein Referenzbild, Vergleich per Pixel-Diff im CI. Fängt genau die Klasse Fehler, die uns Runde B gekostet hat (UV-Bug war headless unsichtbar).
- **Fehlerbudget im UI:** Wenn ein Element seinen Instanzdeckel reißt (`MAX_INST_PER_EL`), sollte das sichtbar sein statt stumm zu kappen.
- **Autosave in den LocalStorage** (letzte 3 Stände) — ein Absturz kostet heute die ganze Sitzung.

## Näher an Studio Ghibli — konkrete Vorschläge

Grundlage ist die Deep-Research vom 26.07. (Oga-Maltechnik, gemessene Farbwerte, Breakdowns Ghibli-inspirierter Spiele). Die Runde F hat die drei billigsten Hebel gezogen (kühle Schatten, Farbdrift, Kronen-Normalen). Was danach am meisten bringt, nach Wirkung sortiert:

### 1. Kantenhierarchie statt gleichmäßiger Schärfe (größter Hebel)
Ogas Bilder leben davon, dass **zwei Kantensorten koexistieren**: weich verlaufene Nass-in-nass-Übergänge (Himmel, Ferne, Wolkenunterseiten) gegen hart gesetzte, deckende Details (Grasbüschel, Blattcluster, Silhouetten). Unser Bild ist überall gleich scharf.
Umsetzung: distanz- und materialabhängige Weichzeichnung im Post-Pass — Ferne und Himmel bekommen einen sehr leichten Blur, der Vordergrund bleibt hart. Faktisch ein „malerischer Tiefenschärfe"-Pass, gesteuert über die vorhandene Tiefentextur (existiert seit Runde D), aber ohne Bokeh-Optik: nur 2–3 px, damit es nach Papier aussieht und nicht nach Kamera.

### 2. Sichtbare Pinselführung in den Massen
Die Aquarelltextur moduliert heute Helligkeit, aber ohne **Richtung**. Gemalte Flächen haben Strichrichtung: Gras nach oben, Wege längs, Hänge dem Gefälle folgend.
Umsetzung: eine gerichtete Rauschtextur (anisotrop, z. B. 1:6 gestreckt), im Shader entlang der Hangrichtung bzw. der Pfadrichtung orientiert. Kostet eine Textur und ein paar Zeilen im Malschicht-Patch.

### 3. Silhouetten-Disziplin
Ghibli-Bäume lesen auch als schwarze Fläche noch als Baum. Unsere Kronen sind gute Cluster, aber die Umrisse sind zu gleichmäßig gefiedert.
Umsetzung: pro Baum 1–3 „Ausreißer"-Blattgruppen, die deutlich aus der Krone ragen (der klassische Oga-Kniff), plus gelegentlich ein toter Ast. Determinismus über den vorhandenen Baum-Seed.

### 4. Wolken mit Volumen statt Deckkraft
Aktuell 40 Cumulus × 4 Puffs in drei Tiefenlagen, Kanten aus der Textur. Was fehlt: **Selbstverschattung** (Unterseite trägt die Schattenfarbe, Oberkante Streulicht) und **Verformung über die Zeit** (Wolken bauen sich um, statt starr zu driften).
Umsetzung: Puff-Instanzen bekommen zwei Farben (oben/unten) über die Instanzfarbe plus einen langsamen Verformungs-Offset aus dem Wind-Uniform.

### 5. Bodenkontakt und Verschmutzung
In den Vorlagen ist nichts sauber aufgesetzt: um jeden Baumfuß Gras und Laub, an Mauern Moos, unter Dächern Schmutzstreifen, an Wegrändern zertretene Zonen (Letzteres haben wir schon als `wear`).
Umsetzung: „Saum-Emitter" — jedes größere Objekt streut beim Setzen automatisch ein paar Kleinteile um seinen Fuß. Billig, weil es die vorhandenen Pools nutzt, und es tilgt den Eindruck platzierter Requisiten.

### 6. Menschliche Spur
Ghibli-Landschaften sind **bewohnt**: Wäscheleinen, Zäune mit Lücken, Karren, Feldwege, die irgendwo hinführen, Rauch aus genau einem Schornstein. Ein Teil davon existiert; was fehlt, ist die **Absicht** — Wege, die Orte verbinden, statt frei gezeichnet zu werden.
Umsetzung: „Wegfindung" zwischen zwei gesetzten Punkten entlang des Terrains (A* auf dem Höhenfeld mit Steigungskosten). Der Nutzer setzt Anfang und Ende, der Weg sucht sich den plausiblen Verlauf — das ist der Unterschied zwischen einer gezeichneten Linie und einem gewachsenen Pfad.

### 7. Farbdramaturgie statt konstanter Palette
Die Recherche zeigt: Sättigung ist bei Ghibli **erzählerisch** (hoch in freudigen, gedämpft in stillen Momenten). Unsere Presets sind statisch.
Umsetzung: pro Karte ein Stimmungsregler (0 = gedämpft/melancholisch, 1 = leuchtend/festlich), der Sättigung, Bloom und Fensterglut gemeinsam verschiebt — ein Regler, der die ganze Karte umfärbt, ohne die Presets zu duplizieren.

### 8. Der eine „Ma"-Moment
Miyazakis Leerstellen: Jede Karte sollte eine große ruhige Fläche haben dürfen. Der Editor verführt heute zum Vollstellen (jede Fläche wird bestückt).
Umsetzung: eine unaufdringliche Anzeige „Belegte Fläche: 68 %" mit Zielkorridor — Design-Feedback statt Zwang. Klingt klein, ändert aber das Verhalten beim Bauen.


---

## Sichtprüfung (27.07.2026, automatisiert)

Die Chrome-Erweiterung war nicht verbunden; stattdessen lädt ein Playwright-Skript
(`scratchpad/sichtpruefung.mjs`) den Editor in Chromium, schaltet alle Tageszeiten,
drei Wetterlagen und fünf Biome durch, schießt Screenshots und protokolliert Konsole
und Diagnose.

**Ergebnis:** 0 Konsolenmeldungen, 0 Seitenfehler; `terraPatchInfo` meldet alle
Patches über 47 Materialien vollständig; 12 Screenshots.

**Punkt C10 ist damit geklärt:** `WEBGL_debug_renderer_info` liefert
`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)` —
ein reiner Software-Rasterizer. Die niedrige Bildrate (1–3 fps bei 138 Draw Calls,
~300k Dreiecken) liegt an der Umgebung, nicht am Code. Auf einer echten GPU ist
diese Last unkritisch.

**Gefundener Fehler (behoben, Commit f8b514df):** Die Palettenbindung war mit 0.34
zu stark und ihre Rampe biomblind — Mittag und Abendrot wirkten wie durch
Milchglas, der Aschekegel bekam cremefarbene Flecken. Die Rampe kommt jetzt aus
`BIOME[S.biom].terrain` (nach Luminanz sortierte Terrainfarben), Stärke 0.16,
Multiplane 0.5 → 0.3.

**Weiterhin nur von Hand prüfbar:** Bedienabläufe (Zugpunkte ziehen, Stempel setzen,
Wegsuche klicken) und die künstlerische Beurteilung gegen echte Filmstills (F7:
Übermalen).
