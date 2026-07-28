# Terra — Biomkatalog (Roadmap ab Runde H)

Entworfen am 27.07.2026 als Vorlage fuer den Biom-Ausbau. Ergaenzt den
Bearbeitungsplan `terra-bearbeitungsplan.md` (Runden C-G dort abgeschlossen)
und den Objektkatalog `terra-objektkatalog.md`. Bestand zum Zeitpunkt des
Entwurfs: 5 Biome aus Runde G; hier stehen 25.

Setting-Kanon: Der Planet Terra ist auseinandergerissen und wird vom weissen,
leuchtenden Riesenbaum **Arbor** zusammengehalten. Die weissen Ranken sind
seine Triebe; sie spenden Licht und wachsen zur Planetenmitte hin zusammen.
Der Planet sieht aus wie ein zerbissener Apfel, Arbor ist der Apfelkern —
das Biom `aschebrache` (Bruchkante ins Nichts) ist der Setting-Anker.

Registry-Schluessel bleiben ASCII-nah wie im Bestand (`wueste`, `bluetental`),
Fliesstext darf Umlaute verwenden.

---

# Biom-Katalog „Terra" (25 Biome)

## 0. Registry-Erweiterungen, die der Katalog voraussetzt

Der Katalog nutzt die drei bestehenden Blöcke (`terrain`, `veg`, `wasserTint`) unverändert und schlägt vier neue, jeweils optionale Blöcke vor. Fehlt ein Block, verhält sich das Biom exakt wie heute — `wiese` bleibt byteidentisch.

| Feld | Ort | Bedeutung | Nötige Codeänderung |
|---|---|---|---|
| `hoehe: {amp, fein, sockel, randTiefe, randBreite, grat, stufe, senken}` | `terrain`-Nachbar | Höhenprofil je Biom | `genBaseIn()` liest statt der Literale `26 / 4 / -6 / -22 / 55` diese Werte |
| `veg.abstand` | `veg` | Faktor auf `sp` in `genWald`/`genWiese` — **die einzige Möglichkeit, dichter als heute zu werden** | eine Multiplikation in `safeSpacing(...)` |
| `veg.leitfarben` | `veg` | ersetzt die modulweite `LEITFARBEN`-Konstante in `genWiese` | `V.leitfarben \|\| LEITFARBEN` |
| `schnee: {auflage, kante, hoehe, farbe, kuehle, bruch}` | Biom-Wurzel | Schneeauflage-Shader (Abschnitt 27) | ein `onBeforeCompile`-Patch + 1 Uniformsatz |
| `luft: {…}` | Biom-Wurzel | Atmosphäre-Nuance je Biom (Abschnitt 28) | ~12 Zeilen am Ende von `applyTod()` |
| `brandungA/B/staerke` | `terrain` | die Brandung ist heute hart auf `sstep(0.8,0.3,h)` und `0.5` verdrahtet | 3 Literale in `terrainColor` durch `P.*` ersetzen |

**Drei Befunde aus dem Bestand, die den Entwurf einschränken:**

1. `veg.dichte` wirkt **nur nach unten** (`if (V.dichte < 1 && …)`). Werte > 1 sind wirkungslos. Regenwald/Bambus/Pilzwald brauchen deshalb `veg.abstand < 1`.
2. `veg.arten[k]` ist eine Behalte-Wahrscheinlichkeit, also ebenfalls auf 0…1 nutzbar; `blumen` und `unterwuchs` sind echte Multiplikatoren und dürfen > 1 sein.
3. Der Biomwechsel in `editor/io.js` ruft nur `rebuildAll()`, **nicht** `genBase()`. Sobald Biome ein Höhenprofil mitbringen, muss der Wechsel das Basisterrain neu erzeugen (Rückfrage „Höhen neu erzeugen?"). Für das v3-Delta-Format ist das unkritisch: `io.js` setzt `S.biom` in Zeile 234 **vor** `genBase()` in Zeile 240, und `saveBtn` diffed gegen `genBaseIn()` unter demselben `S.biom`. Das Biom muss dafür nur gespeichert bleiben — was es tut.

---

## 1. Übersicht

| Schlüssel | Anzeigename | Kern in drei Worten | Höhenprofil |
|---|---|---|---|
| `wiese` | Wiese | Referenz, unverändert | Standard |
| `kueste` | Küste | breiter heller Strand | Standard |
| `wueste` | Wüste | Dünen, Oasensenken | flach-wellig |
| `sumpf` | Sumpf | Bruchwald, stehendes Wasser | flach |
| `schnee` | Winterwald | Nadelwald unter Schnee | Standard |
| `eis` | Ewiges Eis | Gletscher, Nunatakker | hoch, glatt |
| `moor` | Hochmoor | Torf, Wollgras, Moorauge | sehr flach |
| `meer` | Offenes Meer | Archipel, 12 % Land | tief abgesenkt |
| `hochland` | Hochland | Almen über Wolken | hoch, rau |
| `steppe` | Steppe | Grasmeer, Flussgalerien | weit, flach |
| `vulkan` | Aschekegel | Lapilli, Glutspalten | Grat + Kegel |
| `salzwueste` | Salzpfanne | Krustenpolygone, Sole | fast eben |
| `regenwald` | Regenwald | Kronendach, Dampf | mittel |
| `bambuswald` | Bambuswald | senkrechte Halme, Licht | mittel |
| `mangrove` | Mangrovenküste | Priele, Stelzwurzeln | flach, viel Wasser |
| `kreide` | Kreidefelsen | weiße Wand, grünes Plateau | Kliffstufe |
| `tundra` | Tundra | Flechten, Krüppelfichten | mittel |
| `karst` | Karst | Kalkrippen, Dolinen | Grat + Senken |
| `bluetental` | Blütental | Blütenschnee im Tal | sanft |
| `aschebrache` | Aschebrache | Bruchkante, Staub ins Nichts | Abriss am Rand |
| `pilzwald` | Pilzwald | Sporenlicht im Halbdunkel | mittel |
| `terrassen` | Terrassenland | Stufenfelder auf Blattplateaus | gestuft |
| `nebelwald` | Nebelwald | Moos, Bärte, Milchluft | mittel |
| `klippenmeer` | Klippenmeer | Fjordzungen, Gischt | Grat, abgesenkt |
| `korallenbank` | Korallenbank | Lagune, Motus, Sandbank | sehr flach |

---

## 2. `wiese` — Wiese *(Bestand, präzisiert)*

**Bild:** Sanft gewellte Grasmassen mit Erdadern und Feldwegen, einzelne Baumgruppen als Silhouetten gegen den Himmel.
**Palette (S 0.30–0.37):** unverändert — sie ist der Kalibrieranker aller anderen Biome.
**Präzisierung:** `driftBlau` (#82a87c) ist der einzige Wert, dessen Hue-Abstand zum Grundton größer als ~12° ist; für ruhigere Massen wäre #8aa87e gleichwertig, aber die Byteidentität wiegt schwerer — **nicht ändern**.
**Zonen / Veg / wasserTint:** unverändert. **Neu:** nichts.

## 3. `kueste` — Küste *(Bestand, präzisiert)*

**Bild:** Grasrücken kippt über einen breiten, hellen Strandbogen ins türkise Flachwasser; Treibholz und Stege.
**Präzisierung:** `sandA/B 3.8/0.6` ist gut; ergänzend `brandungA/B 1.1/0.15`, `brandungStaerke 0.65` (Bestand fest 0.8/0.3/0.5), sobald die Brandung parametrisierbar ist.
**Neu:** Pools `treibholz`, `moewe` (Billboard, an `birdMesh`-Muster angelehnt).

## 4. `wueste` — Wüste *(Bestand, präzisiert)*

**Bild:** Entsättigte Sandrücken mit rötlichem Felskern, in den Senken ein Fleck Graugrün mit Zypressen.
**Präzisierung:** `driftBlau` #ab9f82 ist fast identisch mit `grasTrocken` — auf #9c9f8a ziehen, damit die F2-Drift auch in der Wüste noch atmet (S bleibt 0.13).
**Höhe (neu):** `amp 14, fein 6, sockel -2, grat 0` — Dünenwellen statt Gebirge.
**Neu:** Pools `duenenkamm` (Kantenband), `palme` (bis dahin `zypresse`).

## 5. `sumpf` — Sumpf *(Bestand)*

**Bild:** Schwarzbraunes Wasser zwischen Erlenhorsten, Nebelbank knapp über der Fläche.
**Präzisierung:** `luft.fogNah × 0.55` (siehe 28) trägt mehr zum Sumpf bei als jede Farbkorrektur.
**Neu:** Pool `schilf` (Halmkarte wie `gras`, doppelte Höhe), `seerose`.

## 6. `schnee` — Winterwald *(Bestand, umbenannt)*

**Bild:** Fichtenbestand mit weißen Kappen, Graugrün nur noch in den Windkanten.
**Präzisierung:** heißt heute „Schnee", ist aber ein *Winterwald* — `eis` übernimmt den Namensteil „Eis". Label auf **„Winterwald"** ändern, Schlüssel `schnee` behalten (Speicherformat!).
**Neu:** `schnee: { auflage: 0.75, kante: [0.20, 0.70], hoehe: [1, 8], farbe: 0xf0f4f8, kuehle: 0.10, bruch: 0.40 }`

---

## 7. `eis` — Ewiges Eis

**Bild:** Weite Firnfläche mit blau angeschnittenen Spalten, aus der schwarze Nunatak-Rippen und ein paar erstarrte Krüppelfichten stechen.
**Palette (S 0.06–0.22 — bewusst unter dem Korridor; die Farbe kommt hier aus dem Licht, nicht aus dem Pigment):**
`grasKuehl` #9fb2c2 · `grasWarm` #a8bac6 · `grasTrocken` #bcc6c8 · `erde` #7a8894 · `fels` #6f7c88 · `schnee` #eef4f8 · `sand` #cfdde4 · `seegrund` #9fb6c0 · `tiefe` #1b3a52 (Akzent, S 0.67) · `tritt` #a8b2b8 · `brandung` #f2f8fb · `driftGelb` #b8bca8 · `driftBlau` #93a8bc
**Zonen:** sandA/B **1.2 / -0.4** (saum 0.4) · felsA/B **8 / 10** (9) · schneeA/B **-3 / -1** (-2) · oase 0
**Höhe:** `amp 24, fein 2.5, sockel 4, grat 0.15` — große glatte Massen, wenige harte Kanten.
**Veg:** dichte 0.10 · blumen 0 · unterwuchs 0.35 · abstand 1.8 · arten `{baum:0, baum2:0, bluetenbaum:0, sumpfbaum:0, zypresse:0.3}` · ersatz `nadelbaum` · uw `[["fels",8],["stumpf",2],["stammliegend",2],["moos",1],["busch",1]]`
**wasserTint:** `[0.78, 0.95, 1.12]`
**schnee:** `{ auflage: 1.0, kante: [0.05, 0.55], hoehe: [-10, 0], farbe: 0xf2f6fa, kuehle: 0.18, bruch: 0.25 }`
**Neu:** Pools `eisscholle` (flache Platte auf Wasserhöhe), `eiszacke`, `gletscherspalte` (Bandgeometrie wie `bandGeoAusLinie`). Der Kalt-Warm-Kontrast muss von der Tageszeit kommen — Eis unter `morgen`/`abend` ist der stärkste Bildzustand des ganzen Katalogs.

## 8. `moor` — Hochmoor

**Bild:** Ockerbraune Torfflächen mit Wollgrastupfen, schwarze Mooraugen als spiegelnde Löcher, tote Kiefernskelette.
**Palette (S 0.13–0.39):**
`grasKuehl` #6e7a58 · `grasWarm` #8a8458 · `grasTrocken` #9d9264 · `erde` #453a2e · `fels` #8a8578 · `schnee` #eceef0 · `sand` #8f8663 · `seegrund` #4a4636 · `tiefe` #22281f · `tritt` #53483a · `brandung` #9aa294 · `driftGelb` #9c9060 · `driftBlau` #62735e
**Zonen:** sandA/B **2.6 / 0.2** (1.4) · felsA/B **13 / 15** (14) · schneeA/B **30 / 33** (nie) · **oase 0.55, oaseFarbe #574c33** — die Oasenlogik wird hier invertiert genutzt: Senken werden *nasser und dunkler*, nicht grüner.
**Höhe:** `amp 8, fein 3, sockel 1, grat 0` — bretteben, damit die Wasserlinie zur Zeichnung wird.
**Veg:** dichte 0.45 · blumen 0.8 (Wollgras) · unterwuchs 1.1 · arten `{baum:0.15, baum2:0.2, bluetenbaum:0, nadelbaum:0.5, zypresse:0.3}` · ersatz `stumpf`… — **Achtung:** `ersatz` wird als Baumart über `POOLS[kind]` platziert, `stumpf` ist ein gültiger Pool und funktioniert (Radius 0.5) → tote Stümpfe statt Bäume, exakt das gewünschte Bild.
uw `[["moos",7],["farn",3],["busch",3],["stumpf",3],["stammliegend",2],["fels",1]]`
**wasserTint:** `[0.7, 0.72, 0.55]` (Huminsäure-Braunschwarz)
**Neu:** Pools `wollgras` (heller Tupfen-Billboard), `torfstich` (Kantenband).

## 9. `meer` — Offenes Meer

**Bild:** Zwei, drei bewaldete Inselrücken in einem Horizont aus Wasser; die Karte ist zu 85 % Meer, die Ranken Arbors steigen aus der Tiefe auf.
**Palette (S 0.17–0.30):**
`grasKuehl` #7f9370 · `grasWarm` #94a077 · `grasTrocken` #b0ae86 · `erde` #8e7a58 · `fels` #8d8d86 · `schnee` #f4f6f8 · `sand` #e6dcbe · `seegrund` #bfc9a6 · `tiefe` #14384a · `tritt` #8a7554 · `brandung` #f4f8f6 · `driftGelb` #b4b478 · `driftBlau` #7ea092
**Zonen:** sandA/B **4.5 / 0.2** (2.2) · felsA/B **10 / 12** (11) · schneeA/B **26 / 28** (27) · oase 0
**Höhe — das eigentliche Merkmal:** `genBaseIn` rechnet heute `fractal*26 + fractal*4 - 6`, Land ab h > 0. Für `meer`: **`amp 28, fein 3.5, sockel -19, randTiefe -26, randBreite 40`**. Der Sockel −19 verschiebt die gesamte Verteilung nach unten, sodass nur noch die obersten ~12 % der Rauschwerte über den Wasserspiegel brechen → verstreute Inselrücken statt einer Landmasse mit See. `randBreite` 40 statt 55 lässt den Rand steiler abfallen, weil er ohnehin unter Wasser liegt. Die Brandung (`sstep(0.8,0.3,h)`) bekommt dadurch die längste Küstenlinie aller Biome und trägt fast das ganze Bild.
**Veg:** dichte 0.9 · blumen 0.6 · unterwuchs 0.9 · arten `{sumpfbaum:0.2, nadelbaum:0.5}` · ersatz `baum` · uw `[["busch",5],["farn",3],["fels",4],["moos",2],["stammliegend",1],["stumpf",1]]`
**wasserTint:** `[0.95, 1.05, 1.12]`
**Neu:** `riffkante` (Bandgeometrie entlang der 0-Linie), `segel` (Fernobjekt am Horizont), Wellenanimation in `water.js` mit größerer Amplitude — je Biom über `luft`-artiges Feld `wellen` steuerbar.

## 10. `hochland` — Hochland

**Bild:** Ausgekämmte Grasrücken über der Wolkendecke, Steinmauern und ein einzelner Almhof, blaugraue Fernberge.
**Palette (S 0.09–0.26):**
`grasKuehl` #76866a · `grasWarm` #8b9670 · `grasTrocken` #9d9c78 · `erde` #7c6c54 · `fels` #9b9488 · `schnee` #f0f4f6 · `sand` #c9c1a4 · `seegrund` #a8ac92 · `tiefe` #24444e · `tritt` #796a52 · `brandung` #eef4f2 · `driftGelb` #a39c66 · `driftBlau` #6f8a80
**Zonen:** sandA/B **1.4 / 0.4** (0.9) · felsA/B **9 / 11** (10) · schneeA/B **17 / 19.5** (18.2) · oase 0
**Höhe:** `amp 22, fein 6, sockel 2, grat 0.35` — Grate statt Kuppen.
**Veg:** dichte 0.5 · blumen 1.4 (Alpenflora!) · unterwuchs 0.6 · abstand 1.3 · arten `{baum:0.3, baum2:0.3, sumpfbaum:0, bluetenbaum:0.15, zypresse:0.4}` · ersatz `nadelbaum` · uw `[["fels",6],["busch",3],["moos",3],["stumpf",1],["stammliegend",1],["farn",1]]`
**wasserTint:** `[0.92, 1.0, 1.06]`
**schnee:** `{ auflage: 0.5, kante: [0.25, 0.75], hoehe: [14, 20], farbe: 0xeef2f6, kuehle: 0.10, bruch: 0.5 }` — Schnee nur auf den Gipfeln, das Höhenband erledigt es ohne zweites Biom.
**Neu:** `trockenmauer` (Variante von `mauer`), `steinmann`, `weidezaun`.

## 11. `steppe` — Steppe

**Bild:** Endloses hellgoldenes Grasmeer mit einer dunkelgrünen Baumgalerie entlang eines Flusslaufs, Windwellen im Gras.
**Palette (S 0.18–0.31):**
`grasKuehl` #9aa172 · `grasWarm` #b3ac7c · `grasTrocken` #c6b98c · `erde` #a08c66 · `fels` #a39a8c · `schnee` #f2f4f6 · `sand` #d9c9a2 · `seegrund` #c6bd9a · `tiefe` #27505a · `tritt` #94805a · `brandung` #f0f4f0 · `driftGelb` #c4b478 · `driftBlau` #93a184
**Zonen:** sandA/B **2.2 / 0.8** (1.4) · felsA/B **14 / 16** (15) · schneeA/B **28 / 31** · **oase 0.30, oaseFarbe #74845c** (Flussgalerien und Senkenwiesen)
**Höhe:** `amp 12, fein 3, sockel 0, grat 0` — sanfte, sehr lange Wellen.
**Veg:** dichte 0.2 · blumen 0.5 · unterwuchs 0.4 · arten `{nadelbaum:0.1, zypresse:0.2, sumpfbaum:0.1, bluetenbaum:0.2}` · ersatz `baum` · uw `[["busch",6],["fels",3],["stumpf",1],["stammliegend",1],["farn",1],["moos",1]]`
**wasserTint:** `[1.0, 1.0, 0.95]`
**Neu:** `grasWelle` — Windamplitude für `gras` je Biom (heute fest `{amp: 0.4}`); Steppe braucht 0.7. Das ist ein Uniform (`uWindStaerke` existiert schon global) mal Biomfaktor.

## 12. `vulkan` — Aschekegel

**Bild:** Schwarzgrauer Lapillihang mit erstarrten Lavazungen, in den Senken glimmen ockerrote Spalten, Ascheschnee auf dem Kegel.
**Palette (S 0.13–0.38 + ein Akzent):**
`grasKuehl` #5c5450 · `grasWarm` #6b6058 · `grasTrocken` #7d7064 · `erde` #4a423c · `fels` #5b504a · `schnee` #e6e2dc (Ascheschnee, nicht Weiß) · `sand` #6e645a · `seegrund` #4c4640 · `tiefe` #1c2830 · `tritt` #4e453e · `brandung` #d8d2c8 · `driftGelb` #846c52 · `driftBlau` #5a6068
**Zonen:** sandA/B **3.0 / 0.6** (1.8) · felsA/B **6 / 8** (7 — Fels bricht früh durch) · schneeA/B **22 / 24** (23) · **oase 0.50, oaseFarbe #7e4e38** (S 0.56 — der einzige Wert über dem Korridor; er trifft < 5 % der Fläche und ist als Glutakzent gewollt)
**Höhe:** `amp 26, fein 5, sockel -2, grat 0.6` — Grat-Rauschen (`1-|2f-1|`) erzeugt die scharfen Kegelkanten.
**Veg:** dichte 0.08 · blumen 0.05 · unterwuchs 0.3 · arten `{baum:0.05, baum2:0.05, bluetenbaum:0, sumpfbaum:0, nadelbaum:0.15}` · ersatz `null` (Ablehnung lässt die Zelle **leer** — Kahlheit ist hier das Motiv) · uw `[["fels",10],["stumpf",2],["stammliegend",2],["busch",1]]`
**wasserTint:** `[0.72, 0.70, 0.68]`
**Neu:** `lavaspalte` (emissives Band, gleiche Mechanik wie `fensterlicht` mit `emissiveIntensity` je Tageszeit), `fumarole` (Rauchquelle — `el.rauch` kann das bereits, siehe `rauchAus`), `schlackekegel`.

## 13. `salzwueste` — Salzpfanne

**Bild:** Blendend helle, in Polygone gerissene Salzkruste bis zum Horizont, ein Solelake spiegelt den Himmel als exakte zweite Welt.
**Palette (S 0.05–0.22 — das hellste Biom, Werte durchgehend über 0.72):**
`grasKuehl` #d2cdbe · `grasWarm` #dcd6c6 · `grasTrocken` #e6e0cd · `erde` #b8ab90 · `fels` #a89c8c · `schnee` #f6f5ef · `sand` #e8e2d0 · `seegrund` #d6d4c2 · `tiefe` #3e6a70 · `tritt` #b0a68e · `brandung` #f8f8f2 · `driftGelb` #d8ceac · `driftBlau` #bfc8c4
**Zonen:** sandA/B **6.0 / -2.0** (2.0 — praktisch alles ist Kruste) · felsA/B **12 / 14** (13) · schneeA/B **30 / 33** · **oase 0.50, oaseFarbe #7f9a9a** (Solerinnsale)
**Höhe:** `amp 9, fein 1.2, sockel 1, grat 0` — die Ebenheit *ist* das Motiv; jede Erhebung wird zur Landmarke.
**Veg:** dichte 0.04 · blumen 0 · unterwuchs 0.15 · arten alles 0 · ersatz `null` · uw `[["fels",6],["stumpf",1]]`
**wasserTint:** `[1.15, 1.20, 1.05]`
**Neu:** `salzpolygon` (Craquelé-Kantennetz als eine gemergte Bandgeometrie — teuer, wenn instanziert; besser als Textur-Overlay in `terrainColor` über eine zusätzliche Rauschoktave `fractal(x*0.4,z*0.4)` mit harter Schwelle), `salzkrusten-Kante`.

## 14. `regenwald` — Regenwald

**Bild:** Geschlossenes Kronendach in drei Grünstufen, Dampfschwaden zwischen den Stämmen, gelegentlich ein Emergent, der herausragt.
**Palette (S 0.31–0.42 — oberes Ende des Korridors, bewusst):**
`grasKuehl` #4f6b4a · `grasWarm` #63784c · `grasTrocken` #7b8850 · `erde` #674f3c · `fels` #77786c · `schnee` #f0f4f4 · `sand` #9a8f68 · `seegrund` #6f7a56 · `tiefe` #1c3f3c · `tritt` #5e4c38 · `brandung` #dcecdf · `driftGelb` #7b8850 · `driftBlau` #3f6656
**Zonen:** sandA/B **2.0 / 0.4** (1.2) · felsA/B **15 / 17** (16) · schneeA/B **30 / 33** · oase 0
**Höhe:** `amp 20, fein 7, sockel 0, grat 0.3`
**Veg:** dichte 1.0 · **abstand 0.72** (der eigentliche Dichteregler) · blumen 0.4 · unterwuchs 1.7 · arten `{nadelbaum:0.05, zypresse:0.1, bluetenbaum:0.5}` · ersatz `baum` · uw `[["farn",8],["busch",5],["moos",5],["stammliegend",2],["stumpf",2],["fels",1]]`
**wasserTint:** `[0.85, 0.98, 0.82]`
**Neu:** `liane` (Ranken-Geometrie aus `vines.js` in Miniaturmaßstab wiederverwendbar), `brettwurzel`, `emergent` (überhoher Baum, eigener Pool mit Radius 4).

## 15. `bambuswald` — Bambuswald

**Bild:** Ein Wald aus senkrechten Strichen, gelbgrün gegen kühles Schattengrün, das Licht fällt in Streifen auf den Boden.
**Palette (S 0.25–0.36):**
`grasKuehl` #7f9464 · `grasWarm` #99a86c · `grasTrocken` #b2b47e · `erde` #7d6c50 · `fels` #8f9086 · `schnee` #f2f6f6 · `sand` #cfc49e · `seegrund` #adb08c · `tiefe` #27505a · `tritt` #776448 · `brandung` #eef6f2 · `driftGelb` #b6b46e · `driftBlau` #6f9483
**Zonen:** sandA/B **2.0 / 0.8** (1.4) · felsA/B **13 / 15** (14) · schneeA/B **26 / 28** · oase 0
**Höhe:** `amp 18, fein 5, sockel 0, grat 0.25`
**Veg:** dichte 1.0 · **abstand 0.55** (Bambus steht enger als jeder Baum) · blumen 0.2 · unterwuchs 0.5 · arten `{baum:0.1, baum2:0.1, sumpfbaum:0, bluetenbaum:0.15, nadelbaum:0.1}` · ersatz **`zypresse`** — bis der Pool `bambus` existiert, ist die Zypresse die einzige schmale, hohe Silhouette im Bestand und trägt das Bild überraschend gut · uw `[["farn",6],["moos",4],["busch",2],["stumpf",1],["fels",1]]`
**wasserTint:** `[0.95, 1.02, 0.98]`
**Neu:** Pool `bambus` (3–5 Halme je Instanz, Kartentextur `kroneSchmal`-Variante, `wind: {amp: 0.5}` — Bambus schwingt sichtbar stärker als jeder Baum, das ist das Hauptmerkmal).

## 16. `mangrove` — Mangrovenküste

**Bild:** Schlickbraune Priele mäandern durch dunkelgrüne Stelzwurzelinseln, bei Ebbe glänzt das Watt.
**Palette (S 0.13–0.32):**
`grasKuehl` #5e7050 · `grasWarm` #6e7c54 · `grasTrocken` #87895e · `erde` #53483a · `fels` #7c7b70 · `schnee` #eef2f2 · `sand` #9c9070 · `seegrund` #77785c · `tiefe` #1f3c3e · `tritt` #4f4436 · `brandung` #d8e4dc · `driftGelb` #8c8a58 · `driftBlau` #4e7068
**Zonen:** sandA/B **3.6 / -0.8** (1.4 — das Watt reicht unter den Wasserspiegel und bleibt sichtbar) · felsA/B **14 / 16** · schneeA/B **30 / 33** · oase 0
**Höhe:** `amp 11, fein 4, sockel -3, randTiefe -14, grat 0` — flach und wasserdurchsetzt; die Flusswerkzeuge aus `rivers` erzeugen hier die Priele.
**Veg:** dichte 0.9 · abstand 0.85 · blumen 0.15 · unterwuchs 1.2 · arten `{baum:0.2, baum2:0.2, nadelbaum:0, zypresse:0, bluetenbaum:0.1}` · ersatz `sumpfbaum` · uw `[["farn",5],["moos",4],["busch",4],["stammliegend",3],["stumpf",2],["fels",1]]`
**wasserTint:** `[0.95, 1.02, 0.88]`
**Neu:** `stelzwurzel` (Wurzelkorb unter dem `sumpfbaum` — kann als eigener Pool unter derselben Position emittiert werden), `watttümpel`.

## 17. `kreide` — Kreidefelsen

**Bild:** Eine senkrechte weiße Wand fällt aus grüner Weide direkt ins helle Türkis; oben eine einzelne windschiefe Baumreihe.
**Palette (S 0.02–0.36):**
`grasKuehl` #8fa36a · `grasWarm` #a6b078 · `grasTrocken` #bcbb8c · `erde` #a2937a · `fels` **#e4e6e2** (S 0.02 — die weiße Wand ist der Sinn des Bioms) · `schnee` #f4f6f8 · `sand` #e0dbc4 · `seegrund` #cfd6c4 · `tiefe` #2a6270 · `tritt` #8f7d5c · `brandung` #f6faf8 · `driftGelb` #b6b672 · `driftBlau` #84a88a
**Zonen:** sandA/B **1.6 / 0.2** (0.9) · felsA/B **2.5 / 4.5** (3.5 — der Fels beginnt direkt über der Wasserlinie und ist deshalb *die* Küstenwand) · schneeA/B **26 / 28** · oase 0
**Höhe:** `amp 18, sockel -4, fein 3` **plus `stufe: [0.5, 9]`** — unterhalb h 0.5 unverändert, oberhalb wird über ein sehr kurzes `sstep`-Intervall (< 1.5 Einheiten) auf ein Plateau von ~9 gehoben. Das erzeugt die senkrechte Wand; ein breiteres Intervall ergibt nur einen Hang.
**Veg:** dichte 0.6 · blumen 1.3 · unterwuchs 0.5 · arten `{sumpfbaum:0, nadelbaum:0.3, bluetenbaum:0.3}` · ersatz `baum2` · uw `[["busch",5],["fels",3],["moos",2],["farn",2],["stumpf",1],["stammliegend",1]]`
**wasserTint:** `[1.10, 1.15, 1.05]`
**Neu:** `kreidenadel` (freistehender Stack im Wasser), `feuersteinband` (dunkle Horizontallinie in der Wand — über die vorhandene `steil`-Bandlogik in `terrainColor` mit erhöhtem Faktor 0.6 statt 0.34 erreichbar, ohne neues Asset).

## 18. `tundra` — Tundra

**Bild:** Flechtenbraune, windgescheitelte Fläche mit Frostmusterböden, vereinzelte Krüppelfichten in Fahnenform.
**Palette (S 0.07–0.35):**
`grasKuehl` #7c8670 · `grasWarm` #8e9070 · `grasTrocken` #a39a78 · `erde` #6e6656 · `fels` #848e98 · `schnee` #ecf1f4 · `sand` #bdbaa6 · `seegrund` #a2a894 · `tiefe` #24444e · `tritt` #6c6553 · `brandung` #eef4f4 · `driftGelb` #a6996c · `driftBlau` #7c8e8c
**Zonen:** sandA/B **1.6 / 0.4** (1.0) · felsA/B **7 / 9** (8) · schneeA/B **11 / 14** (12.5) · oase 0
**Höhe:** `amp 16, fein 4, sockel 1, grat 0.2`
**Veg:** dichte 0.3 · blumen 0.6 · unterwuchs 0.9 · abstand 1.5 · arten `{baum:0.1, baum2:0.1, sumpfbaum:0, bluetenbaum:0.05, zypresse:0.25}` · ersatz `nadelbaum` · uw `[["moos",7],["fels",5],["busch",3],["stumpf",2],["stammliegend",1],["farn",1]]`
**wasserTint:** `[0.88, 0.96, 1.04]`
**schnee:** `{ auflage: 0.6, kante: [0.20, 0.70], hoehe: [6, 12], farbe: 0xeef2f6, kuehle: 0.14, bruch: 0.45 }`
**Neu:** `frostpolygon` (wie `salzpolygon` als Rauschoktave lösbar), `rentiermoos` (heller Tupfen).

## 19. `karst` — Karst

**Bild:** Nackte weißgraue Kalkrippen mit tiefen Dolinen, dazwischen sattgrüne Grasinseln und eine türkise Karstquelle.
**Palette (S 0.09–0.31 + Quellakzent):**
`grasKuehl` #8a9668 · `grasWarm` #a2a474 · `grasTrocken` #bdb388 · `erde` #9d8a68 · `fels` #b8b4a6 · `schnee` #f4f6f6 · `sand` #dbd2b6 · `seegrund` #c4c6a8 · `tiefe` #2a6a72 · `tritt` #8c7a58 · `brandung` #f2f8f6 · `driftGelb` #bcb474 · `driftBlau` #86a496
**Zonen:** sandA/B **1.2 / 0.2** (0.7) · felsA/B **5 / 7** (6 — sehr früh, das Gestein dominiert) · schneeA/B **24 / 27** · oase 0
**Höhe:** `amp 22, fein 6, sockel 2, grat 0.7` **plus `senken: {dichte: 0.03, tiefe: 7}`** — eine zweite, sehr niederfrequente Rauschoktave mit harter Schwelle subtrahiert runde Dolinen. Grat-Rauschen + Senken zusammen ergeben die Turmkarst-Silhouette.
**Veg:** dichte 0.45 · blumen 0.8 · unterwuchs 0.7 · arten `{sumpfbaum:0, nadelbaum:0.4, baum:0.5, baum2:0.5}` · ersatz `zypresse` (mediterranes Karstbild) · uw `[["fels",8],["busch",4],["moos",2],["farn",2],["stumpf",1],["stammliegend",1]]`
**wasserTint:** `[1.05, 1.15, 1.10]`
**Neu:** `karstrippe` (gerichtete Felsrippe, muss der Hangrichtung folgen — `normalAt` liefert die Ausrichtung wie beim Kontaktschatten), `dolinenrand`.

## 20. `bluetental` — Blütental

**Bild:** Ein geschütztes Tal, in dem Hunderte Blütenbäume in rosa und cremeweißen Wolken stehen; der Boden ist von Blütenblättern hell überzogen.
**Palette (S 0.14–0.30 — die Sättigung liegt in den *Instanzen*, nicht in der Fläche):**
`grasKuehl` #87a06a · `grasWarm` #a2b478 · `grasTrocken` #bcbc8c · `erde` #9a8462 · `fels` #a6a69c · `schnee` #f4f6f8 · `sand` #dccfad · `seegrund` #cfc6a4 · `tiefe` #24505a · `tritt` #8a7554 · `brandung` #f4f8f6 · `driftGelb` **#c4a8ae** (rosa Flor statt Gelb) · `driftBlau` #8fa4b2
**Zonen:** sandA/B **2.0 / 1.0** (1.5) · felsA/B **13 / 15** (14) · schneeA/B **22 / 24** (23) · oase 0
**Höhe:** `amp 18, fein 3, sockel -1, grat 0.1` — weich, muldig, damit ein „Tal" entsteht.
**Veg:** dichte 1.0 · abstand 0.85 · **blumen 2.2** · unterwuchs 0.8 · arten `{baum:0.35, baum2:0.35, nadelbaum:0.1, zypresse:0.15, sumpfbaum:0}` · ersatz **`bluetenbaum`** · uw `[["busch",5],["moos",4],["farn",3],["fels",1],["stumpf",1],["stammliegend",1]]` · **leitfarben** `[[1.30,0.80,0.90],[1.22,1.10,1.05],[1.10,0.95,1.15],[1.25,1.12,0.85]]`
**wasserTint:** `[1.02, 0.99, 1.02]`
**Neu:** `bluetenflug` (Partikel-Billboards analog `rauchMesh` — dieselbe Instanced-Billboard-Mechanik, nur seitlich driftend statt aufsteigend), Blütenteppich als zusätzliche Aufhellung in `terrainColor` unter Bäumen (ließe sich über `wearAt` invertieren, braucht aber ein eigenes Feld).

## 21. `aschebrache` — Aschebrache *(Bruchkante)*

**Bild:** Verbrannte Hochfläche endet an einer Abrisskante, hinter der es nichts gibt außer Staub und einer weiß leuchtenden Arbor-Ranke, die ins Leere hinabwächst.
**Palette (S 0.09–0.33):**
`grasKuehl` #6c6a5c · `grasWarm` #7c7462 · `grasTrocken` #8f8570 · `erde` #574f42 · `fels` #807a70 · `schnee` #e4e4e0 (Ascheflug) · `sand` #9a917c · `seegrund` #6e6a5e · `tiefe` #232a2e · `tritt` #5a5145 · `brandung` #cfd2ca · `driftGelb` #8e8060 · `driftBlau` #6c7a80
**Zonen:** sandA/B **2.4 / 0.4** (1.4) · felsA/B **4 / 6** (5) · schneeA/B **20 / 22** (21) · oase 0
**Höhe — Kernmerkmal:** `amp 14, fein 5, sockel 6, grat 0.4`, **`randTiefe -140, randBreite 10`**. Statt den Kartenrand weich unter Wasser zu ziehen (heute `lerp(-22, h, sstep(0,55,d))`), fällt er über 10 Einheiten fast senkrecht ins Bodenlose. Der Nebel schluckt den Grund — die Karte hat damit eine echte Bruchkante statt einer Küste. Das ist der Setting-Anker des ganzen Katalogs.
**Veg:** dichte 0.12 · blumen 0.05 · unterwuchs 0.4 · arten alle 0.1 · ersatz `stumpf` · uw `[["fels",7],["stumpf",4],["stammliegend",4],["busch",1]]`
**wasserTint:** `[0.6, 0.62, 0.66]` (falls überhaupt Wasser vorkommt)
**Neu:** `schwebefels` (frei fliegende Felsbrocken über dem Abgrund — Instanzen ohne Bodenkontakt; `emit` überspringt den Kontaktschatten bereits automatisch, wenn `|y - heightAt| > 2.2` — die Mechanik ist also schon da), `staubschleier`, `rankenanker` (Arbor-Ranke am Kantenrand). **Pflicht:** mindestens ein `ranke`-Element; ohne Arbor erzählt das Biom nichts.

## 22. `pilzwald` — Pilzwald

**Bild:** Blaugrünes Halbdunkel unter riesigen Hutformen, die von unten sacht kühl leuchten; Sporen stehen als helle Punkte in der Luft.
**Palette (S 0.11–0.30):**
`grasKuehl` #5c6c66 · `grasWarm` #6e7a66 · `grasTrocken` #86886c · `erde` #4e4438 · `fels` #76786e · `schnee` #eef0f0 · `sand` #8c8a70 · `seegrund` #646a58 · `tiefe` #1e3038 · `tritt` #50463a · `brandung` #d0dcd8 · `driftGelb` #8a7a64 · `driftBlau` #5a7a80
**Zonen:** sandA/B **2.4 / 0.4** (1.4) · felsA/B **13 / 15** · schneeA/B **30 / 33** · **oase 0.40, oaseFarbe #4a6270** (kühl leuchtende Senken)
**Höhe:** `amp 17, fein 6, sockel 0, grat 0.2`
**Veg:** dichte 1.0 · abstand 0.8 · blumen 0.3 · unterwuchs 1.5 · arten `{nadelbaum:0.1, zypresse:0.1, baum:0.3, baum2:0.3, bluetenbaum:0.2}` · ersatz `sumpfbaum` (zerzauste Krone, bis `pilzhut` existiert) · uw `[["moos",8],["farn",5],["stumpf",4],["stammliegend",3],["busch",2],["fels",1]]`
**wasserTint:** `[0.8, 0.95, 1.0]`
**Neu:** Pools `pilzhut` (groß, Radius ~2.5) und `pilzklein`, beide mit `emissive` + `emissiveIntensity` — **exakt die `fensterlicht`-Mechanik**: `applyTod` setzt heute schon `POOLS.fensterlicht.mat.emissiveIntensity = glut` aus dem Preset-Feld `fenster`. Ein zweites Preset-Feld `bioLicht` (nacht 2.4, abend 0.9, mittag 0.0) treibt die Pilze auf demselben Weg — kein neues System.

## 23. `terrassen` — Terrassenland

**Bild:** Konzentrische Stufenfelder folgen den Höhenlinien einen Hang hinab, jede Stufe ein schmaler Wasserspiegel, der den Himmel zurückwirft.
**Palette (S 0.09–0.29):**
`grasKuehl` #86a074 · `grasWarm` #9fb27e · `grasTrocken` #bcbe94 · `erde` #8f7c5c · `fels` #9a978c · `schnee` #f2f5f6 · `sand` #d5c9a8 · `seegrund` #b8bc9c · `tiefe` #2b5a60 · `tritt` #82704f · `brandung` #f0f6f2 · `driftGelb` #bdb478 · `driftBlau` #7ea28c
**Zonen:** sandA/B **1.8 / 0.6** (1.2) · felsA/B **14 / 16** (15) · schneeA/B **24 / 26** · oase 0
**Höhe — Kernmerkmal:** `amp 20, fein 3, sockel 1` **plus `terrassen: {stufe: 2.2, kante: 0.35}`**: `h = lerp(h, round(h/stufe)*stufe, kante)`. Der Kantenfaktor bestimmt, wie hart die Stufe wird; 1.0 ergibt eine Treppe mit senkrechten Wangen, 0.35 die gemalte Weichheit. Die Stufenwangen färbt die bestehende `steil`/`rock`-Logik in `terrainColor` automatisch erdig ein — kein Zusatzcode.
**Veg:** dichte 0.35 · blumen 0.7 · unterwuchs 0.4 · arten `{sumpfbaum:0.1, nadelbaum:0.2}` · ersatz `bluetenbaum` · uw `[["busch",4],["farn",3],["moos",2],["fels",2],["stumpf",1],["stammliegend",1]]`
**wasserTint:** `[1.0, 1.05, 1.02]`
**Neu:** `terrassenspiegel` — `water.js` hat nur eine Ebene bei `WATER = 0`; die Stufenspiegel brauchen eigene Quads auf Stufenhöhe. Günstigste Variante: ein Pool aus flachen Platten mit dem Wassermaterial, emittiert entlang der Stufenmitten (deterministisch aus dem Höhenfeld ableitbar). Passt zum Setting: Terrassenstädtchen auf Arbors Blattplateaus.

## 24. `nebelwald` — Nebelwald

**Bild:** Moosbehangene Stämme lösen sich nach hinten in Milch auf; drei Tiefenstaffeln, mehr sieht man nicht.
**Palette (S 0.14–0.23 — das flachste Biom, Kontrast kommt ausschließlich aus der Staffelung):**
`grasKuehl` #6f8272 · `grasWarm` #82907a · `grasTrocken` #99a086 · `erde` #6a5f52 · `fels` #8b8f8a · `schnee` #f0f4f4 · `sand` #b8b8a4 · `seegrund` #939c8a · `tiefe` #22424a · `tritt` #66594a · `brandung` #e6eeea · `driftGelb` #9aa07c · `driftBlau` #6f8a8e
**Zonen:** sandA/B **2.0 / 0.6** (1.3) · felsA/B **11 / 13** (12) · schneeA/B **20 / 23** · oase 0
**Höhe:** `amp 21, fein 6, sockel 1, grat 0.35`
**Veg:** dichte 1.0 · abstand 0.8 · blumen 0.25 · unterwuchs 1.7 · arten `{bluetenbaum:0.1, sumpfbaum:0.6, zypresse:0.2}` · ersatz `nadelbaum` · uw `[["moos",9],["farn",7],["stammliegend",3],["stumpf",3],["busch",2],["fels",1]]`
**wasserTint:** `[0.92, 0.98, 0.98]`
**Luft (siehe 28):** `fogNah × 0.42, fogFern × 0.7, fogCapMax 0.92, satMitte × 0.9` — das Biom, das am stärksten von der Atmosphäre und am wenigsten von der Palette lebt.
**Neu:** `bartflechte` (hängende Karte am Kronenrand), `dampfschwade` (Bodennebel-Billboards, wieder `rauchMesh`-Mechanik).

## 25. `klippenmeer` — Klippenmeer

**Bild:** Schiefergraue Felszungen greifen in ein kaltes Meer, weiße Gischtsäume zeichnen jede Kante nach, oben eine dünne Grasdecke.
**Palette (S 0.11–0.28):**
`grasKuehl` #7d9068 · `grasWarm` #94a074 · `grasTrocken` #afb086 · `erde` #8a7a5e · `fels` #76808a · `schnee` #f2f6f8 · `sand` #c8c2ae (Kies, kein Sand) · `seegrund` #a8ae9e · `tiefe` #1c3e50 · `tritt` #7e6d52 · `brandung` **#f8fbfa** · `driftGelb` #aeae76 · `driftBlau` #77949a
**Zonen:** sandA/B **1.0 / -0.6** (0.2 — kaum Strand) · felsA/B **1.8 / 3.6** (2.6 — Fels beginnt an der Wasserlinie) · schneeA/B **24 / 26** · oase 0 · **brandungA/B 1.4 / -0.3, brandungStaerke 0.8**
**Höhe:** `amp 24, fein 7, sockel -8, grat 0.55, randTiefe -26` — der negative Sockel plus Grat-Rauschen erzeugt Fjordzungen und Halbinseln statt einer Küstenlinie.
**Veg:** dichte 0.35 · blumen 0.9 · unterwuchs 0.5 · arten `{sumpfbaum:0, bluetenbaum:0.1, baum:0.3, baum2:0.4}` · ersatz `nadelbaum` (windzerzaust) · uw `[["fels",7],["busch",4],["moos",3],["stumpf",1],["farn",1],["stammliegend",1]]`
**wasserTint:** `[0.85, 0.98, 1.08]`
**Neu:** `gischtsaum` (animiertes Band entlang der 0-Linie), `felsnadel`, `leuchtturm`. Die Brandungsparametrisierung (Abschnitt 0) ist für dieses Biom **die** Voraussetzung.

## 26. `korallenbank` — Korallenbank

**Bild:** Aus türkisem Flachwasser tauchen blendend helle Sandbänke und winzige Palmen-Motus auf; unter der Oberfläche zeichnen dunklere Korallengärten Muster.
**Palette (S 0.16–0.30 + Tiefenakzent):**
`grasKuehl` #9aa878 · `grasWarm` #b2b884 · `grasTrocken` #c6c294 · `erde` #a89272 · `fels` #a8a294 · `schnee` #f4f6f8 · `sand` #eee2c4 · `seegrund` #cfd2b0 · `tiefe` #1d5e6e (Akzent) · `tritt` #9a8a66 · `brandung` #fafcf8 · `driftGelb` #c9c088 · `driftBlau` #86b0ac
**Zonen:** sandA/B **5.5 / -3.5** (1.0 — die Sandbank reicht weit unter Wasser und bleibt sichtbar) · felsA/B **12 / 14** · schneeA/B **28 / 31** · **oase 0.50, oaseFarbe #6f9aa0** (Korallengärten im Flachwasser — die Oasenlogik greift unter h ≈ 2.4 und liegt damit genau richtig)
**Höhe:** `amp 8, fein 2.5, sockel -4, randTiefe -12, grat 0` — weite Lagunen, minimale Reliefunterschiede.
**Veg:** dichte 0.25 · blumen 0.3 · unterwuchs 0.4 · arten `{nadelbaum:0, zypresse:0.1, sumpfbaum:0.1, bluetenbaum:0.2}` · ersatz `baum` (bis `palme` existiert) · uw `[["busch",5],["fels",3],["moos",1],["stumpf",1],["stammliegend",1]]`
**wasserTint:** `[1.10, 1.25, 1.15]`
**Neu:** `koralle` (Unterwasser-Pool — braucht *keinen* Kontaktschatten, `emit` filtert bei Radius < 0.6 bereits), `palme`, `sandbank-Kante`.

---

## 27. Beschneite Bäume — Optionsabwägung und Empfehlung

### Option (a): eigene Pools `nadelbaumSchnee`, `baumSchnee`, …

| | |
|---|---|
| **Pro** | Volle künstlerische Kontrolle (die Schneekappe wird *gemalt*, nicht berechnet); null Shaderrisiko; funktioniert mit jedem Three-Update; deterministisch per Definition. |
| **Contra** | 6 neue Kronentexturen + 6 Pools = 6 zusätzliche Materialien, Geometrien und InstancedMeshes, die auch dann im Speicher liegen, wenn das Biom nie gewählt wird. `areas.js` bräuchte eine Kind-Umschreibung (`kind = V.schneeArt[kind] \|\| kind`). Und der Kernpunkt: **Dächer, Mauern, Felsen, Stümpfe, Karren bleiben schneefrei** — die Winterkarte zerfällt in verschneite Bäume auf einem unverschneiten Dorf. |

### Option (b): Vertexfarben-Aufhellung im Pool-Aufbau

| | |
|---|---|
| **Pro** | Kein Shadercode; `shadeVertical()` mutiert bereits genau diese Vertexfarben beim `definePool()`. |
| **Contra** | **Disqualifizierend.** `definePool` läuft einmal beim Modulladen; die Geometrien sind global und werden von allen Biomen geteilt. Biomabhängige Vertexfarben erzwängen einen Neuaufbau *aller* Pools beim Biomwechsel (Geometrie neu, `Pool.ensure` neu, alle Instanzen neu gepackt). Dazu kommt: die Kronen bestehen aus wenigen großen Alphatest-Karten — eine Aufhellung pro Vertex ergibt vier fleckige Ecken, die die Blattausschnitte ignorieren. Und wieder: keine Dächer, keine Felsen. |

### Option (c): Shader-Patch „Schneeauflage" per `onBeforeCompile` — **Empfehlung**

Passt exakt in die etablierte Struktur von `render/materials.js`: numerierte Patchblöcke, `ersetze()` mit Ankerprüfung und `console.warn`, Zähler in `patchInfo`, geteilte Uniforms in `terraUniforms`.

**Warum das Problem „Instanz-Pools teilen ihre Materialien" hier keines ist:** Die Steuerung ist ein *globales Uniform-Objekt*, kein Materialzustand. `terraPatch` weist jedem Shader dieselbe Uniform-Referenz zu (`shader.uniforms.uRim = terraUniforms.uRim` — das Muster existiert bereits fünfmal). Ein einziges `terraUniforms.uSchneeAuflage.value = 0.9` beschneit sofort jedes Material der Szene. Kein Pool-Durchlauf, kein Repack, kein Rebuild.

**Umsetzungsskizze**

*1) Uniforms in `terraUniforms` ergänzen:*
```js
uSchneeAuflage: { value: 0 },                              // 0 = aus
uSchneeKante:   { value: new THREE.Vector2(0.20, 0.70) },  // normal.y-Rampe
uSchneeHoehe:   { value: new THREE.Vector2(-99, -98) },    // Welthöhenband
uSchneeFarbe:   { value: new THREE.Color(0xeff4f8) },
uSchneeKuehle:  { value: 0.12 },
uSchneeBruch:   { value: 0.35 }
```

*2) Weltnormale als Varying — Zwilling zu Patch (3), gleicher Aufbau:*
Anker `#include <defaultnormal_vertex>` (existiert in jedem Standardmaterial und behandelt `instanceMatrix` bereits selbst). Angehängt:
```glsl
vec3 terraON = objectNormal;
#ifdef USE_INSTANCING
  terraON = mat3( instanceMatrix ) * terraON;
#endif
vTerraN = normalize( mat3( modelMatrix ) * terraON );
```
*Bekannte Ungenauigkeit:* `emit()` skaliert Instanzen anisotrop (`sy` weicht von `sx/sz` ab), die Normale kippt dadurch um wenige Grad. Für eine Schneemaske irrelevant.

*3) Fragmentblock, eingehängt als Patch (5b) — also **vor** der Malschicht (6), damit die Aquarellkörnung auch über den Schnee läuft und die Materialeinheit erhalten bleibt.* Anker: `#include <color_fragment>` (dasselbe Ankermuster wie Wolkenschatten und Malschicht; die Reihenfolge der Einfügungen bestimmt die Reihenfolge der Wirkung).
```glsl
if ( uSchneeAuflage > 0.0 ) {
  float terraNy = gl_FrontFacing ? vTerraN.y : -vTerraN.y;   // DoubleSide-Laub!
  float terraOben = smoothstep( uSchneeKante.x, uSchneeKante.y, terraNy );
  float terraBruch = texture2D( uCloudTex, vTerraW.xz * 0.11 ).r;
  terraOben *= mix( 1.0, smoothstep( 0.30, 0.72, terraBruch ), uSchneeBruch );
  terraOben *= smoothstep( uSchneeHoehe.x, uSchneeHoehe.y, vTerraW.y );
  float terraS = uSchneeAuflage * terraOben;
  diffuseColor.rgb = mix( diffuseColor.rgb, uSchneeFarbe, terraS );
  diffuseColor.rgb = mix( diffuseColor.rgb,
                          diffuseColor.rgb * vec3(0.94,0.98,1.06), terraS * uSchneeKuehle );
}
```
Der zweite `mix` ist die geforderte leichte Kühlung: Schnee im Schatten kippt ins Blaue, ohne die Sättigung über 0.15 zu treiben.

**Die vier Details, die über Erfolg oder Misserfolg entscheiden:**

1. **`gl_FrontFacing`-Korrektur.** Alle Kronen, `busch`, `gras`, `farn`, `moos` und `rankenblatt` laufen mit `side: DoubleSide`. Three flippt seine eigene `normal` per `gl_FrontFacing`, unser Varying aber nicht. Ohne die Korrektur bekommt jede zweite sichtbare Blattfläche keinen Schnee und das Laub wirkt zerfressen.
2. **Kein neuer Shader-Permutationsbaum.** Der Block wird **unbedingt** eingefügt (nicht über `opts`), damit `customProgramCacheKey` unverändert bleibt und die Programmzahl nicht steigt. Ausgeschlossen wird stattdessen über die *Uniform-Bindung*: `shader.uniforms.uSchneeAuflage = (opts && opts.ohneSchnee) ? { value: 0 } : terraUniforms.uSchneeAuflage;`. Genau ein Material nutzt das: das Terrainmaterial — dessen Schnee kommt aus `terrainColor` (`schneeA/B` + Felsdurchbruch am Steilhang) und bliebe sonst doppelt aufgetragen. Der Bodenschnee bleibt damit vollständig in der Registry, der Shaderschnee macht ausschließlich Aufbauten.
3. **Determinismus.** Der Block liest ausschließlich `vTerraN`, `vTerraW`, `gl_FragCoord`-freie Werte und eine statische Textur — **kein Zeit-Uniform, kein `Math.random`, kein Frame-Zustand**. Zwei Screenshots derselben Karte sind bitgleich, und das Verhalten passt zur Determinismus-Regel, unter der `hashi`/`fractal` in `core/rng.js` stehen.
4. **Schneiende Karte = ein einziger Schreibvorgang.** `setBiomLuft()` (neu, aufgerufen aus dem `biomSel`-Handler, aus dem Ladepfad und am Ende von `applyTod`) kopiert `BIOME[S.biom].schnee` in die Uniforms. Fehlt der Block, wird `uSchneeAuflage = 0` gesetzt — der `if` schaltet den ganzen Zweig ab (uniform-kohärente Verzweigung, praktisch kostenlos).

**Erwünschter Nebeneffekt, ausdrücklich einplanen:** Dächer (`haus*`, `scheune`, `windmuehle`), Mauern, Felsen, Stümpfe, Karren und Stege werden ebenfalls beschneit. Für `eis`, `schnee` und `tundra` ist das genau das Ziel; die Karten werden dadurch als Ganzes winterlich statt fleckweise. Für `hochland` sorgt `uSchneeHoehe = [14, 20]` dafür, dass nur die Gipfelbauten weiß werden — der Höhenparameter ersetzt ein separates Gipfelbiom.

**Kombinierte Empfehlung:** (c) als Basis für alle Biome; (a) später *zusätzlich* und nur für einen einzigen Heldenbaum („verschneite Tanne" mit dick gemalten Kappen), falls die Kunstrichtung mehr Masse will. (b) verwerfen.

---

## 28. Biom-abhängige Atmosphäre

**Prinzip: fünf Presets bleiben fünf Presets.** Das Biom liefert kein zweites Presetset, sondern einen kleinen Nachkorrekturblock, der *nach* der fertigen Tageszeit-Blende angewandt wird — genau dort, wo `wasserTint` heute schon steht (`atmosphere.js`, direkt hinter `mixHex(a.wasser, b.wasser, e, waterMat.color)`).

```js
luft: {
  fogWarmTint: [1.00, 1.00, 1.00],   // multiplikativ auf die geblendete Preset-Nebelfarbe
  fogCoolTint: [1.00, 1.00, 1.00],
  fogNah: 1.00, fogFern: 1.00,       // Faktoren auf die Distanzen
  fogCapMax: 1.00,                   // min() gegen den Preset-Deckel
  hemiBoden: null, hemiMisch: 0.0,   // Bodenlicht Richtung Biomboden ziehen
  satMitte: 1.00,                    // Faktor auf grade.satMitte
  wolkenschatten: 1.00,              // Faktor auf uCloudAmt
  empfohlen: "mittag"                // reiner UI-Hinweis, ändert nichts automatisch
}
```

**Warum nach der Blende und nicht in die Presets hinein:** `schnappschuss()` friert beim Tageszeitwechsel den Ist-Zustand als Blendquelle ein, indem es über die Preset-Felder iteriert. Läge die Biom-Nuance in den Presets, würde sie beim Überblenden doppelt eingerechnet. Post-Blend angewandt bleibt sie über jeden Übergang hinweg stabil — und `io.js` ruft nach jedem Biomwechsel ohnehin `setTod(getTodName(), true)`.

**Das wirksamste einzelne Feld ist `hemiBoden`.** Der `HemisphereLight`-Bodenanteil ist physikalisch das vom Boden zurückgeworfene Licht; heute steht darin ein warmes Beige aus dem Preset (`0xcbb896` mittags). In der Salzpfanne muss es fast weiß sein, im Regenwald grün, auf der Aschebrache grau. Ein `lerp(presetHemiBoden, biomHemiBoden, hemiMisch)` mit `hemiMisch` 0.4–0.7 verkoppelt Terrainpalette und Beleuchtung mit einer einzigen Zeile und ist für die Kalt-Warm-Logik mehr wert als jede weitere Farbkonstante.

**Richtwerte (Auszug):**

| Biom | fogCoolTint | fogNah | fogCapMax | hemiBoden / Misch | satMitte |
|---|---|---|---|---|---|
| `nebelwald` | [0.98,1.00,0.99] | 0.42 | 0.92 | #7e8a76 / 0.55 | 0.90 |
| `eis` | [0.95,0.99,1.06] | 0.85 | 1.00 | #c8d6e0 / 0.70 | 0.95 |
| `salzwueste` | [1.04,1.03,0.99] | 1.35 | 1.00 | #e2ddc9 / 0.75 | 0.92 |
| `moor` | [0.97,0.99,0.97] | 0.55 | 0.94 | #7d7357 / 0.55 | 0.95 |
| `vulkan` | [0.94,0.92,0.92] | 0.70 | 0.95 | #5e564e / 0.65 | 0.98 |
| `regenwald` | [0.96,1.00,0.96] | 0.60 | 0.96 | #566b48 / 0.60 | 1.05 |
| `meer` | [0.99,1.01,1.04] | 1.25 | 1.00 | #9fb0a8 / 0.45 | 1.00 |
| `aschebrache` | [0.95,0.95,0.96] | 0.75 | 0.90 | #6a655c / 0.65 | 0.88 |

Sonderfall `nacht`: Der `luft`-Block darf die Nacht nicht aufhellen. Deshalb `fogWarmTint/fogCoolTint` nur multiplikativ und nie über 1.10, `satMitte`-Faktor nie über 1.10 — dann bleibt die Kalibrierregel (Massen S 0.25–0.50, Werteumfang 0.20–0.85) über alle 5 × 25 Kombinationen erhalten, ohne 125 Einzelabstimmungen.

---

## 29. Von „eine Karte = ein Biom" zu Biom-Flächen

**Stufe 1 — Polygon, ohne jede Formatänderung.** Ein neues Element `{kind: "flaeche", variant: "biom", params: {biom: "eis", weich: 8}}`. `serializeElements`/`hydrate` sind generisch, die Validierung in `io.js` prüft nur `kind`/`points`/`params` — es ist **null Formatarbeit**. Ältere Editoren ignorieren die unbekannte Variante still (`genFlaeche` fällt durch alle vier `else if`), die Karte lädt trotzdem. `S.biom` bleibt das Basisbiom der Karte, die Polygone überschreiben es lokal.

**Stufe 2 — Pinsel.** Ein `Uint8Array(VW*VW)` mit Biom-Indizes, exakt gebaut wie `wear`/`corridor`, bemalt über eine Kopie von `stampWear`. Gespeichert wird es *nicht* als Feld (65 kB), sondern nach dem Vorbild von `hoehenDelta`: eine Kartenkopfliste `biomListe: ["wiese","eis","kreide"]` (Index 0 = Basis) plus ein RLE-Lauflängenpaar-Array `biomDelta: [start, laenge, index, …]`. Eine typische Karte mit drei bemalten Zonen kostet damit wenige hundert Bytes. Alternativ — und noch billiger — werden die Pinselstriche selbst als Elemente gespeichert (`{kind:"pfad", variant:"biompinsel", points:[…], params:{biom, radius}}`) und beim Laden deterministisch nachgestempelt; das erbt Undo, Selektion und das Delta-freie Format geschenkt.

**Rendering — der kritische Punkt.** `terrainColor` liest `P` einmal pro Vertex und benutzt es an 20 Stellen. Zwei Aufrufe pro Vertex zu mischen kostet doppelt und würde außerdem die Rauschoktaven zweimal auswerten. Besser:

1. Gewicht am Vertex bestimmen: `w = biomGewichtAt(i, j)`, dabei `w` mit **der bereits vorhandenen `stoer`-Oktave** verrauschen (`w += (fractal(x*0.09,z*0.09,seed+606)-0.5)*0.35`). Die Biomgrenze franst dann genauso aus wie die Sand- und Felsgrenzen — kein zusätzliches Rauschen, keine sichtbare Polygonkante.
2. `w` auf 16 Stufen quantisieren und je Biompaar **16 fertig gemischte Palettenobjekte cachen** (`THREE.Color.lerp` über alle Farbfelder, `lerp` über alle Schwellen). `terrainColor` bleibt damit ein einziger Durchlauf mit unveränderter Laufzeit; die 16 Stufen sind hinter dem Grenzrauschen unsichtbar. Cache-Invalidierung: nur bei Biomwechsel oder Kartenladen.
3. Höchstens zwei Biome pro Vertex (dominantes + zweites). Das deckelt Speicher und Rechenzeit hart und ist bildlich nie eine Einschränkung.

**Vegetation.** In `genWald`/`genWiese` wandert `var V = BIOME[S.biom].veg` aus dem Funktionskopf **in die Kandidatenschleife**: `var V = vegAt(x, z)`. Dort wird *hart* entschieden (dominantes Biom, kein Mischen) — ein halb verschneiter Blütenbaum ergibt kein Bild. Der Determinismus bleibt vollständig erhalten, weil `vegAt` eine reine Funktion der Position ist und die ortsstabilen Ablehnungsschlüssel `el.seed+57`/`+58` unverändert bleiben. Ein Waldpolygon, das über eine Biomgrenze reicht, wechselt dann mitten im Bestand die Baumarten — genau das gewünschte Verhalten.

**Höhenprofile bei gemischten Biomen.** Nicht mischen. Das Höhenprofil bleibt an `S.biom` (Kartenbasis) gebunden, weil `genBaseIn` einmal über das ganze Feld läuft und das v3-Delta gegen genau dieses Ergebnis diffed. Lokale Abweichungen macht der Nutzer mit den Terrainpinseln, die im Delta landen. Das hält das Speicherformat stabil und vermeidet, dass ein Pinselstrich das halbe Terrain umwirft.

**Globale Effekte (Nebel, Wasserfarbe, Schneeauflage, Bloom)** haben keine Ortsauflösung. Sie folgen dem Biom unter `cam.focus`, weich nachgezogen über eine Blende von ~1 s, aufgehängt an derselben Stelle wie `tickAtmosphere` die Tageszeitblende führt. Praktisch heißt das: Man fährt über die Grenze und die Luft dreht mit — ohne dass irgendwo ein zweites Presetsystem entsteht.
