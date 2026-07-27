# Terra — Objektkatalog (Roadmap ab Runde H)

Entworfen am 27.07.2026 als Vorlage fuer den Asset-Ausbau. Ergaenzt den
Bearbeitungsplan `terra-bearbeitungsplan.md`; die Runden C-G sind dort
abgeschlossen. Bestand zum Zeitpunkt des Entwurfs: 54 Pools, hier kommen
230 dazu.

Setting-Kanon: Der Planet Terra ist auseinandergerissen und wird vom weissen,
leuchtenden Riesenbaum **Arbor** zusammengehalten. Die weissen Ranken sind
seine Triebe; sie spenden Licht und wachsen zur Planetenmitte hin zusammen.
Der Planet sieht aus wie ein zerbissener Apfel, Arbor ist der Apfelkern.

Poolnamen bleiben ASCII-nah wie im Bestand (z. B. `wuestenzelt`,
`koehlermeiler`), Fliesstext darf Umlaute verwenden.

# Objektkatalog Terra — 230 neue Pools

**Spaltenlegende**

- **r** — grober Platzierungsradius für `tryPlace`/`occ` (Weltmeter, Maßstab wie Bestand: `haus` 2.9, `tempel` 4.2, `fels` 1.1, `laterne` 0.35)
- **Typ** — `P` = einfacher `definePool`; `K` = Komposit, das nur als Teil einer größeren Struktur Sinn ergibt; `G` = eigener Struktur-Generator (wie `genViertel`), kein Pool
- **F** — Instanzkosten/Häufigkeit: `S` = Streuware (viele Instanzen, kleine Geometrie), `M` = mittel, `E` = Einzelstück (selten, teure Geometrie erlaubt)
- **Regel** — Platzierung: `–` = Standard `tryPlace` (kein Wasser, kein Steilhang, kein Korridor); **`W` = invertiert, nur AUF Wasser** (`h < WATER`, Höhe = `WATER`); `U` = Uferband (`|h − WATER| < ~0.8`, Muster `dorfUfer`); `Fr` = frei/schwebend, keine Bodenregeln (Muster `genInseln`); `St` = Steilhang erlaubt (`COS40`-Prüfung aus); `Ko` = Korridor erlaubt (`ignoreCorridor`)

Alle Bauweisen nutzen ausschließlich `part`/`M`/`mergeGeos` mit `BX`/`CY`/`CO`/`IC`/`PL`/`SphereGeometry`/`TorusGeometry` plus die Bestandshelfer `prismGeo`, `tubeGeo`, `leafGeo`, `moundGeo`, `islandGeo`, `dach()`, `fenster()`, `tuer()`, `sockel()`, `saeulen()`, `uvKonst()`, `geoBaumArt()`. Determinismus überall über `hashi(i,j,seed)` / `rngOf(seed)` — nie `Math.random`.

---

## 1. Wehrbau — Mauern, Tore, Türme, Burg, Schloss

| Pool | Beschreibung | Bauweise | r | Familie | Typ | F | Regel |
|---|---|---|---|---|---|---|---|
| `mauerstueck` | gerades Wehrmauer-Segment mit Zinnen | `BX` Kern + `BX` Wehrgang + Zinnenschleife 6× `BX` (neuer Helfer `zinnen()`) | 1.6 | stein | P | S | Ko |
| `mauerecke` | 90°-Ecksegment mit Ecktürmchen | 2× Mauerkern `BX` über Eck + `CY` Türmchen + Zinnen | 1.9 | stein | P | M | Ko |
| `mauerdurchlass` | Mauer mit kleiner Pforte | `mauerstueck` + 2 `BX` Laibung + halber `TorusGeometry` + `tuer()` | 1.8 | stein | P | M | Ko |
| `mauerbogen` | Mauerabschnitt auf Blendbögen (Hanglage) | 3× `Torus`-Halbbogen + `BX` Riegel + Zinnen | 2.4 | stein | P | M | St |
| `schildmauer` | hohe fensterlose Wand mit Strebepfeilern | `BX` hoch + 3 `BX` Streben + `BX` Kranzgesims | 2.4 | stein | P | M | – |
| `zwingermauer` | niedrige Vormauer vor der Hauptmauer | flacher `BX` + kleine Zinnen + `sockel()` | 1.2 | stein | P | S | Ko |
| `mauertreppe` | Treppenlauf an der Mauerinnenseite | 9× `BX` gestaffelt + `BX` Wange | 1.3 | stein | P | S | Ko |
| `pechnase` | auskragender Wurferker (Aufsatz) | `BX` Kasten + 2 `CY` Konsolen + `BX` Boden mit Schlitz | 0.8 | stein | K | S | Fr |
| `wehrturm` | runder Flankierungsturm mit Kegeldach | `CY` konisch + `CY` Kragplatte + Zinnenkranz + `CO` Dach + `fenster()` als Scharte | 2.2 | stein | P | M | – |
| `geschuetzturm` | breites Rondell mit Scharten | `CY` breit + 5 dunkle `BX` Scharten + `CY` Plattform + Zinnen | 2.6 | stein | P | M | – |
| `bergfried` | quadratischer Hauptturm | `sockel()` + `BX` hoch + `BX` Gesims + Zinnen + `prismGeo` Walmspitze + 4× `fenster()` | 2.6 | stein | K | E | – |
| `torhaus` | Doppelturmtor mit Fallgitter | 2× `CY` Türme + `BX` Riegel + `Torus`-Torbogen + `tuer()` + Gitterraster 8× `BX` | 3.6 | stein | K | E | Ko |
| `barbakane` | halbrundes Vorwerk vor dem Tor | `CY`-Halbschale (Segmentwinkel) + Zinnen + `BX` Rampe | 3.2 | stein | K | E | Ko |
| `bastion` | keilförmige Eckbastion mit Böschung | 2 schräge `BX` Facen + `CY` Böschungsfuß + Kordongesims `BX` + Zinnen | 3.4 | stein | K | E | – |
| `zugbruecke` | Zugbrücke mit Ketten am Torhaus | `BX` Planken + 2 `CY` Ketten schräg + 2 `BX` Widerlager | 2.2 | holz | K | E | Ko |
| `burgpalas` | Wohnbau der Burg, Saalgeschoss | `BX` groß + `BX` Gesims + 5× `fenster()` + `dach()` + `BX` Erker + `tuer()` | 4.0 | putz | K | E | – |
| `burgkapelle` | kleine Kapelle mit Apsis im Hof | `BX` + `CY`-Halbapsis + `prismGeo` Dach + `CY` Dachreiter + Rundfenster | 2.2 | stein | K | M | – |
| `burgkueche` | Rundbau mit großem Rauchfang | `CY` + `CO` Rauchhaube + `CY` Schlot + `tuer()` | 2.0 | stein | K | M | – |
| `palisade` | Holzpalisadenreihe | 8× `CY` mit `CO`-Spitze + 2 Querriegel `BX` | 1.4 | holz | P | S | Ko |
| `palisadentor` | Tor im Palisadenring | `palisade` + `BX` Sturz + 2 `CY` Pfosten + `tuer()` | 1.8 | holz | P | M | Ko |
| `wachturm` | Gerüstturm auf vier Beinen | 4× `BX` Beine + Kreuzstreben `BX` + `BX` Kanzel + `prismGeo` Dach + Leiter | 1.5 | holz | P | M | – |
| `schlossfluegel` | Barockflügel mit Mansarddach | `BX` lang + 2 `BX` Gesimse + 8× `fenster()` + flaches `prismGeo` + `CY`-Eckpavillon | 4.6 | putz | K | E | – |
| `schlossturmhaube` | Turm mit Zwiebelhaube | `CY` + gestauchte `SphereGeometry` + `CO` + `CY` Fahnenstange + `PL` Fahne | 2.0 | putz | K | M | – |
| `schlossportal` | Prunkportal mit Freitreppe | 3× `BX` Stufen + `saeulen(4)` + `Torus`-Bogen + `prismGeo` Giebel + `tuer()` | 3.0 | stein | K | E | Ko |
| `kettenturm` | Hafenturm, hält die Sperrkette | `CY` + Zinnen + `Torus`-Kettenglieder + `BX` Ankerstein | 1.6 | stein | P | M | U |
| `wehrbanner` | Banner an Mauerstange | `CY` Stange + `PL` Tuch (leichter `wind`) | 0.4 | stoff | P | S | Fr |
| `wappenstein` | Wappenrelief für Torlaibungen | `BX` Tafel + `IC` Relief + gefärbtes `PL` | 0.4 | stein | P | S | Fr |

## 2. Maritim — Werft, Schiffe, Kai, Leuchtturm

| Pool | Beschreibung | Bauweise | r | Familie | Typ | F | Regel |
|---|---|---|---|---|---|---|---|
| `werfthalle` | offene Bootshalle über der Helling | 8× `CY` Ständer + `BX` Pfetten + `prismGeo` Dach (offene Giebelseite zum Wasser) | 4.4 | holz | K | E | U |
| `helling` | Schiffsgerüst mit halbfertigem Rumpf | `BX` Kiel + 7 gebogene Spanten (`BX` rotiert) + Gerüstleitern | 3.6 | holz | K | E | U |
| `slipbahn` | schräge Holzrampe ins Wasser | 6× `BX` Längsbalken + 8 Querschwellen, geneigt | 2.6 | holz | P | M | U |
| `kaimauer` | Steinkai mit Pollern und Ringen | `BX` Blockmauer + 3 `CY` Poller + `Torus` Ringe + `BX` Kante | 2.2 | stein | P | S | U |
| `kaitreppe` | ins Wasser führende Kaitreppe | 8× `BX` gestuft + `BX` Wange | 1.2 | stein | P | S | U |
| `kaikran` | Tretradkran am Kai | `BX` Turm + `prismGeo` Haube + `BX` Ausleger + `CY` Trommel + Seil `CY` | 2.6 | holz | P | M | U |
| `anleger` | L-förmiger Bootsanleger auf Pfählen | `steg`-Muster erweitert: 12 `BX` Planken + 8 `CY` Pfähle + Poller | 2.4 | holz | P | M | U |
| `bootshaus` | Haus mit Wasserdurchfahrt | `BX` auf 6 `CY` Pfählen + `dach()` + dunkler `BX` Durchlass + `PL` Tor | 2.8 | holz | P | M | U |
| `leuchtturm` | gebänderter Turm mit Laternenhaus | `CY` konisch + 3 `BX` Farbringe + `CY` Galerie + `CY` Laterne (`emissive`) + `CO` Dach | 2.4 | putz | P | E | U |
| `leuchtfeuer` | einfaches Feuerkorb-Baken | `CY` Mast + `IC` Korb + `emissive` `IC` Glut | 0.6 | metall | P | S | U |
| `bake` | Holzbake mit Dreieckstafel | `CY` + `PL` Dreieck + 2 Querstreben `BX` | 0.7 | holz | P | S | **W** |
| `boje` | Fahrwassertonne mit Topzeichen | `CY` + `CO` + `CY` Stange + `IC` Topzeichen | 0.5 | metall | P | S | **W** |
| `netzgestell` | Trockengestell mit hängenden Netzen | 2× `CY` Böcke + `BX` Firststange + 3 `PL` Netz (alphaTest, `wind`) | 1.4 | stoff | P | S | U |
| `fischtrockner` | Stockfischgerüst | Gerüst 6× `BX` + Reihe kleiner `BX`/`IC` Fische | 1.5 | holz | P | S | U |
| `reusenstapel` | gestapelte Korbreusen | 3× offene `CY` (kein Deckel) + `BX` Latte | 0.6 | holz | P | S | U |
| `tauhaufen` | aufgeschossenes Tau | `TorusGeometry` flach gestapelt ×3 | 0.4 | stoff | P | S | – |
| `fischerboot` | Kahn mit einzelnem Segel | Rumpf-Helfer (Trapez-`BX`) + `CY` Mast + `PL` Segel | 1.8 | holz | P | M | **W** |
| `kutter` | Fischerschiff mit Kajüte | Rumpf + `BX` Kajüte + `dach()` klein + Mast + 2 `PL` Segel + `BX` Ruder | 2.6 | holz | P | M | **W** |
| `kogge` | bauchiger Frachtsegler mit Kastellen | Rumpf-Generator + 2 `BX` Kastelle + Zinnenband + `CY` Mast + `PL` Rahsegel | 3.6 | holz | K | E | **W** |
| `dreimaster` | großes Segelschiff | Rumpf + 3 `CY` Masten + 6 `PL` Segel + Bugspriet + Wanten (`tubeGeo`) | 5.0 | holz | K | E | **W** |
| `ruderschiff` | schlanke Galeere mit Riemenreihen | Rumpf schmal + 2× 8 `BX` Riemen + Mast + `BX` Rammsporn | 4.0 | holz | K | E | **W** |
| `floss` | Baumstammfloß mit Hütte | 6× `CY` quer + `BX` Hütte + `CY` Stakstange | 1.9 | holz | P | M | **W** |
| `wrack` | halb versunkener, gekippter Rumpf | Rumpf-Geo gekippt + gebrochener `CY` Mast + `PL` Tang | 3.0 | holz | P | E | **W** |
| `salzgarten` | Verdunstungsbecken am flachen Ufer | 4 flache `BX` Wannen + `BX` Dämme + 3 weiße `CO` Salzhaufen | 2.8 | erde | P | M | U |
| `hafenlaterne` | hohe Kailaterne | `laterne`-Muster, 1.6× Höhe + `Torus` Ausleger | 0.4 | metall | P | S | U |

## 3. Landwirtschaft

| Pool | Beschreibung | Bauweise | r | Familie | Typ | F | Regel |
|---|---|---|---|---|---|---|---|
| `ackerscholle` | frisch gepflügte Scholle | 5× `BX` Furchen wechselnder Höhe (`hashi`-Wellung) | 1.8 | erde | P | S | – |
| `rebenreihe` | Weinspalier | 2× `CY` Pfosten + `BX` Draht + 5 `IC` Laubkugeln | 1.0 | laub | P | S | – |
| `hopfengeruest` | hohes Rankgerüst | 4× `CY` + `BX` Kopfrahmen + 6 `PL` Rankenbahnen (`wind`) | 1.4 | holz | P | M | – |
| `obstbaum` | niedriger Obstbaum mit Früchten | `geoBaumArt()`-Preset (klein, breit) + 8 kleine `IC` Früchte | 1.6 | laub | P | S | – |
| `garbe` | Getreidegarbe | `CO` + 2 `BX` Bänder | 0.4 | stoff | P | S | – |
| `heuschober` | Diemen unter verschiebbarem Dach | 4× `CY` Ständer + `CO` Heu + `prismGeo` Dach | 1.5 | stoff | P | M | – |
| `taubenschlag` | Turm mit Fluglöchern | `CY` + 12 kleine dunkle `BX` + `CO` Dach + `BX` Anflugbrett | 1.0 | holz | P | S | – |
| `bienenstand` | Reihe Strohkörbe unter Pultdach | 4× `CO`/`CY` Körbe + `BX` Bank + schräges `BX` Dach | 1.2 | stoff | P | S | – |
| `pferch` | Umzäunung mit Gattertor | 10× `pfosten`-Muster im Ring + Querlatten `BX` + `BX` Gatter | 2.6 | holz | P | M | – |
| `viehstall` | niedriger Stall mit Freilauf | `BX` + `dach(reet)` + `BX` Zaun + `tuer()` breit | 2.6 | holz | P | M | – |
| `kornspeicher` | Stelzenspeicher mit Mäusescheiben | `BX` Kasten auf 4 `CY` + 4 `CY` Scheiben + `prismGeo` Dach + Leiter | 1.8 | holz | P | M | – |
| `dreschtenne` | offener Rundplatz mit Walze | flacher `CY` Lehmboden + `CY` Steinwalze + 2 `BX` Gabeln | 2.0 | erde | P | M | – |
| `terrassenfeld` | Trockenmauer-Terrasse mit Beeten | 2× `BX` Stützmauer + 3 gestufte `BX` Beete + Treppe | 3.0 | stein | P | M | St |
| `vogelscheuche` | Kreuz mit Kittel und Hut | 2× `BX` Kreuz + `PL` Kittel (`wind`) + `CO` Hut | 0.4 | stoff | P | S | – |
| `wassermuehle` | Mühlenhaus mit unterschlächtigem Rad | `geoHausB`-Kern + `CY` Rad mit 12 `BX` Schaufeln + `BX` Gerinne | 3.0 | holz | P | M | U |

## 4. Handwerk / Industrie

| Pool | Beschreibung | Bauweise | r | Familie | Typ | F | Regel |
|---|---|---|---|---|---|---|---|
| `schmiede` | offene Esse mit Amboss | `BX` + `prismGeo` Dach + `CY` Esse + `emissive` `BX` Glut + `IC` Amboss | 2.2 | stein | P | M | – |
| `koehlermeiler` | Kohlenmeiler mit Rauchloch | `CO` Erdkegel + `CY` Rauchöffnung + `BX` Holzstapel daneben | 1.8 | erde | P | M | – |
| `ziegelofen` | Flaschenofen mit Ziegelstapeln | `CY` konisch + `CO` Haube + `emissive` `BX` Ofenmaul + 6 `BX` Stapel | 2.2 | stein | P | M | – |
| `kalkofen` | Trichterofen am Hang mit Rampe | `CY` + `BX` Rampe + `BX` Feuerloch + Steinhaufen `IC` | 2.0 | stein | P | M | St |
| `gerbergruben` | Grubenreihe mit Häuterahmen | 4× dunkle `CY` Gruben + 2 `BX` Rahmen + `PL` Häute | 2.4 | holz | P | M | – |
| `faerbergestell` | Trockengestell mit Farbbahnen | Gerüst `BX` + 4 lange `PL` Stoffbahnen (`wind`) | 1.8 | stoff | P | M | – |
| `seilerbahn` | lange Bahn mit Haspelrad | 2× `CY` Böcke + 3 lange `CY` Seile + `CY` Rad + `BX` Schlitten | 3.2 | holz | P | E | Ko |
| `saegewerk` | Gattersäge mit Wasserrad | offene `BX` Halle + `CY` Rad + `BX` Sägeblatt + Bretterstapel `BX` | 3.2 | holz | K | M | U |
| `steinmetzhof` | Werkplatz mit Rohblöcken | 4× `BX` Blöcke + halbfertige `CY` Säule + `BX` Bock + Späne | 2.2 | stein | P | M | – |
| `glashuette` | Ofenhaus mit Glutschein | `BX` + `CO` Ofen + `emissive` Öffnung + `CY` Schlot + `fenster()` | 2.6 | stein | P | M | – |
| `lagerhaus` | Speicher mit Ladeluke und Ausleger | `BX` hoch + 6× `fenster()` + `dach()` + `BX` Auslegerbalken + `CY` Rolle | 3.0 | holz | P | M | – |
| `hochschlot` | Backsteinschlot mit Ringen | `CY` stark konisch + 3 `CY` Ringe + dunkle Mündung | 1.0 | stein | P | M | – |
| `wasserrad` | freistehendes Schöpfrad | `CY` Felge + 12 `BX` Schaufeln + `CY` Achse + `BX` Bock | 2.0 | holz | P | M | U |
| `windpumpe` | Bock-Windpumpe des Flachlands | Gerüst 4× `BX` + 4 `PL` Flügel + `BX` Pumpenkasten | 1.6 | holz | P | M | – |

## 5. Sakral / Kult — inkl. Arbor-Kult

| Pool | Beschreibung | Bauweise | r | Familie | Typ | F | Regel |
|---|---|---|---|---|---|---|---|
| `kapelle` | Dorfkapelle mit Dachreiter | `sockel()` + `BX` + `prismGeo` Dach + `CY` Reiter + `Torus` Rundfenster | 2.0 | putz | P | M | – |
| `glockenturm` | freistehender Campanile | `BX` hoch + 4 `BX` Schallöffnungen + `prismGeo` Dach + `IC` Glocke | 1.6 | putz | P | M | – |
| `kathedralenschiff` | Langhaus mit Strebewerk | `BX` + 6 `BX` Strebepfeiler + 6 `Torus`-Strebebögen + `prismGeo` Dach + `rosette` | 5.0 | stein | K | E | – |
| `rosette` | Radfenster als Fassadenaufsatz | `Torus` + 8 `BX` Speichen + `emissive` `PL` | 0.6 | stein | K | S | Fr |
| `kreuzgang` | quadratischer Arkadenhof | 4× Arkadenflügel (`saeulen()` + `Torus`-Bogenreihe) um Innenhof | 6.0 | stein | **G** | E | Ko |
| `bildstock` | Wegsäule mit Nischenaufsatz | `CY` + `BX` Nische + `CO` Dächlein | 0.4 | stein | P | S | – |
| `steinkreis` | Ring aus Menhiren | 9× verzerrte `BX`/`IC` auf Kreisbahn (`hashi`-Neigung) | 3.4 | stein | P | E | – |
| `menhir` | einzelner Steinfinger mit Moosband | verjüngter `BX` + `PL` Moos | 0.8 | stein | P | S | – |
| `feuerschale` | Dreifuß mit Glut | 3× `CY` Beine + `CY` Schale + `emissive` `IC` | 0.7 | metall | P | S | – |
| `opferstein` | flacher Altarblock mit Rinnen | `BX` + eingekerbte `BX` Rinnen + Moos | 0.9 | stein | P | S | – |
| `arborschrein` | Rankenschlaufe über einem Altar | `tubeGeo` (weiß, `emissive`) als Schlaufe + `BX` Altar + 3× `leafGeo` klein | 1.6 | rinde | P | M | – |
| `rankenaltar` | Altarstein mit eingewachsener Ranke | `BX` + `tubeGeo` durchstoßend + `leafGeo` | 1.2 | stein | P | M | – |
| `lichtsammler` | Trichterschale, die Arbor-Licht bündelt | invertierter `CO` + `CY` Stiel + `emissive` `PL` Scheibe + 3 Streben | 1.4 | metall | P | M | – |
| `samenreliquiar` | Glasgehäuse über leuchtendem Samen | 4× `CY` Streben + `SphereGeometry` dünn + `emissive` `IC` Kern | 1.0 | metall | P | E | – |
| `blattkanzel` | Kanzel aus einem einzelnen Blatt | `leafGeo(L, W, cup, thick)` + `tubeGeo` Stiel + `BX` Geländer | 2.0 | laub | P | M | – |
| `gebetsband` | Stoffbänder zwischen zwei Pfosten | 2× `CY` + Leine `BX` + 6 `PL` Bänder (starker `wind`) | 1.2 | stoff | P | S | – |
| `rankentor` | Torbogen aus zwei verwachsenen Ranken | 2× `tubeGeo`, oben verflochten + 4× `leafGeo` + `emissive` Adern | 2.4 | rinde | P | M | Ko |
| `grabhuegel` | bewachsener Hügel mit Steintür | `moundGeo(r,h,x,z,seed)` + `BX` Türstein + 2 `menhir` | 2.6 | erde | P | M | – |

## 6. Wohnbau je Kultur

| Pool | Beschreibung | Bauweise | r | Familie | Typ | F | Regel |
|---|---|---|---|---|---|---|---|
| `langhaus` | nordisches Langhaus mit Grasdach | `BX` lang + `dach(…, reet)` + 6 `BX` Stützböcke außen + `tuer()` | 3.8 | reet | P | M | – |
| `grubenhaus` | halb eingegrabene Kate | `moundGeo` + `prismGeo` Dach bis Boden + `tuer()` | 1.8 | reet | P | S | – |
| `turmhaus` | schmales viergeschossiges Stadthaus | `sockel()` + `BX` hoch + 6× `fenster()` + `dach()` + 2 `BX` Gesimse | 2.0 | putz | P | S | Ko |
| `giebelhaus` | Treppengiebelhaus | `BX` + 5× `BX` Giebelstufen beidseits + `dach()` + 4× `fenster()` | 2.6 | putz | P | S | Ko |
| `laubenhaus` | Haus mit Arkadenlaube im Erdgeschoss | `BX` + `saeulen(4)` + `BX` Laubendecke + `dach()` + `fenster()` | 3.0 | putz | P | M | Ko |
| `hofdurchfahrt` | Wohnhaus mit Torbogendurchfahrt | 2× `BX` Pfeilerteile + `BX` Riegel darüber + `Torus`-Bogen + `dach()` | 3.0 | putz | P | M | Ko |
| `pfahlhaus` | Haus auf Pfählen über der Uferzone | `BX` + 6× `CY` Pfähle + `dach(reet)` + `BX` Leiter + Plattform | 2.4 | holz | P | M | U/**W** |
| `baumhaus` | Wohnkabine in der Krone | `CY` Stamm + `BX` Kabine schräg + `dach()` + `tubeGeo` Leiterseil | 2.2 | holz | P | M | – |
| `rankenhaus` | Haus, das an einer Ranke hängt | `BX` + 2× `tubeGeo` Aufhängung + `leafGeo` Terrasse + `fenster()` | 2.6 | holz | P | M | Fr |
| `elfenlaube` | offener Wohnpavillon mit Segeltüchern | `saeulen(6)` + 4 `PL` Tücher (`wind`) + `CO` Dach + `PL` Boden | 2.4 | stoff | P | M | – |
| `stollenhaus` | Zwergenfassade vor der Felswand | `BX` Fassade + `Torus`-Torbogen + 2× `fenster()` + `IC` Felsrücken | 2.8 | stein | P | M | St |
| `lehmkuppelhaus` | Wüstenlehmhaus mit Kuppel und Außentreppe | `CY` + `SphereGeometry`-Halbkugel + kleine `fenster()` + 6 `BX` Treppenstufen | 2.2 | putz | P | M | – |
| `wohnblock` | mehrstöckiger Mietblock mit Flachdach | `BX` + 12× `fenster()` + `BX` Attika + 3× `kamin` | 3.6 | putz | P | M | Ko |
| `gaube` | Dachgaube als Aufsatz | kleines `prismGeo` + `fenster()` | 0.5 | dachziegel | K | S | Fr |
| `kamin` | Schornstein mit Rauchhaube | `BX` + `BX` Kappe + dunkle Mündung | 0.3 | stein | K | S | Fr |

*Alle Wohnbauten mit Fenstern bekommen einen Eintrag in `FENSTER_ANKER`, damit `emitFensterlicht` greift.*

## 7. Verkehr / Infrastruktur

| Pool | Beschreibung | Bauweise | r | Familie | Typ | F | Regel |
|---|---|---|---|---|---|---|---|
| `steinbruecke` | dreibogige Steinbrücke | 3× `Torus`-Halbbogen + `BX` Fahrbahn + `BX` Brüstung + 2 Pfeiler mit Eisbrecher | 4.0 | stein | K | E | **W**/Ko |
| `holzbruecke` | Balkenbrücke auf Jochen | `BX` Planken + 2 Joche `CY` + `BX` Geländer | 2.6 | holz | P | M | **W**/Ko |
| `haengebruecke` | Seilbrücke über eine Bruchkante | 2× `tubeGeo` Tragseile mit Durchhang + 16 `BX` Planken + 2 `BX` Pylone | 4.0 | holz | K | E | St/Ko |
| `aquaedukt` | kachelbares Aquädukt-Joch | 2× `BX` Pfeiler + `Torus`-Bogen + `BX` Rinne oben | 3.0 | stein | P | S | Ko |
| `aquaeduktkopf` | Wasserschloss mit Auslaufbecken | `BX` Kasten + `CY` Becken + `CY` Auslauf + `dach()` | 2.0 | stein | K | E | – |
| `seilbahnmast` | Gittermast mit Umlenkrollen | Gitterturm aus 12 `BX` + `BX` Ausleger + 2 `CY` Rollen | 1.2 | holz | P | S | St |
| `seilbahngondel` | hängende Lastengondel | `BX` Kabine + `CY` Bügel + `CY` Rolle | 1.0 | holz | P | M | Fr |
| `felsentreppe` | in den Fels gehauene Treppe | 12× `BX` gestuft + 4 `CY` Geländerposten | 1.6 | stein | P | S | St/Ko |
| `wegweiser` | Pfosten mit drei Schildern | `CY` + 3× `BX` Schilder in Winkeln | 0.35 | holz | P | S | Ko |
| `meilenstein` | Steinsäule mit Kerbzahl | `CY` + `BX` Kappe + gekerbte `BX` | 0.3 | stein | P | S | Ko |
| `zollhaus` | Wachhäuschen mit Schranke | `BX` klein + `dach()` + `CY` Schranke gestreift + `CY` Gegengewicht | 1.8 | holz | P | M | Ko |
| `tunnelportal` | Portal in den Berg | `BX` Rahmen + `Torus`-Bogen + dunkles `PL` + 2 `BX` Flügelmauern | 2.4 | stein | P | E | St |
| `kanalschleuse` | Schleusenkammer mit Stemmtoren | 2× `BX` Wangen + 2 `BX` Tore + 2 `CY` Spindeln + `BX` Steg | 3.0 | stein | K | E | U |
| `uferdamm` | Steinschüttung als Böschung | schräger `BX` + 12 gestreute `IC` Blöcke | 2.0 | stein | P | S | U |

## 8. Ruinen / Bruchkanten des zerrissenen Planeten

| Pool | Beschreibung | Bauweise | r | Familie | Typ | F | Regel |
|---|---|---|---|---|---|---|---|
| `mauerruine` | halb eingestürztes Mauerstück | 2× `BX` unterschiedlicher Höhe + `IC` Schutt + `PL` Moos | 1.6 | stein | P | S | – |
| `saeulenstumpf` | abgebrochene Säule mit Trommeln | `CY` + `IC` Bruchkante + 2 liegende `CY` | 0.8 | stein | P | S | – |
| `giebelruine` | stehende Giebelwand mit Fensterloch | `BX` + `prismGeo`-Umriss + 2 `BX` (Lochrahmen) + Efeu `PL` | 2.2 | stein | P | M | – |
| `gewoelbekeller` | offen liegendes Tonnengewölbe | halber `Torus`/`CY`-Schale + 2 `BX` Wangen + Schutt | 2.4 | stein | P | M | – |
| `bruchkante` | abgerissene Geländekante mit Wurzelvorhang | `BX`/`IC` Klippenblock + 5× `tubeGeo` Wurzeln nach unten | 3.4 | erde | P | M | St |
| `schwebescholle` | kleiner losgerissener Landbrocken | `islandGeo(r, seed)` + gestreutes `gras` obendrauf | 2.5 | erde | P | M | **Fr** |
| `truemmerhaufen` | Trümmer aus Balken und Stein | 6× `BX` kreuz + 4 `IC` + `PL` Staub | 1.4 | stein | P | S | – |
| `statuentorso` | kopflose Statue auf Sockel | `BX` Sockel + `CY`/`IC` Torso + Bruchfläche | 0.9 | stein | P | S | – |
| `treppenruine` | Treppe, die im Nichts endet | 7× `BX` Stufen, oben abgebrochen + `IC` Bruch | 1.8 | stein | P | M | St |
| `rissspalt` | klaffender Bodenriss mit Lichtschein | 2× `BX` Kanten versetzt + `emissive` `PL` im Grund | 2.8 | erde | P | M | Ko |
| `sturzwurzel` | von der Kante hängende Wurzelvorhänge | 5× `tubeGeo` abwärts + `PL` Moosfetzen (`wind`) | 1.6 | rinde | P | S | Fr |
| `ruinenturm` | Turmstumpf mit Efeu | gebrochener `CY` (halbhoch) + 3 `PL` Efeu + Schutt | 2.0 | stein | P | M | – |
| `tempelruine` | Podium mit gefallenen Säulen | `BX` Podium + 4 liegende `CY` + 2 stehende `saeulen()` + `prismGeo`-Fragment | 4.0 | stein | K | E | – |

## 9. Arbor-spezifisch — Ranken, Blattplateaus, Lichtsammler

| Pool | Beschreibung | Bauweise | r | Familie | Typ | F | Regel |
|---|---|---|---|---|---|---|---|
| `rankenstamm` | kolossaler weißer Rankenabschnitt | `tubeGeo(pts, radiusAt, 12, colorAt)` weiß, `emissive`-Adern über `colorAt` | 3.5 | rinde | P | E | St/Fr |
| `rankenknoten` | Verzweigungsknoten dreier Ranken | 3× `tubeGeo` + `IC` Verschmelzungsknoten | 3.0 | rinde | P | E | Fr |
| `blattplateau` | Blattplattform als Siedlungsboden | `leafGeo(L≈16, W, cup, thick)` + `tubeGeo` Stiel + Randgeländer | 8.0 | laub | **G** | E | **Fr** |
| `blattsteg` | schmales Blatt als Brücke zwischen Plateaus | schmales `leafGeo` + 2 `tubeGeo` Halteseile | 3.0 | laub | P | M | Fr |
| `rankentreppe` | Wendeltreppe um eine Ranke | 16× `BX` Stufen auf Helix + `tubeGeo` Handlauf | 2.2 | holz | P | M | Fr |
| `rankenleiter` | Strickleiter an der Rankenflanke | 2× `tubeGeo` Holme + 12 `BX` Sprossen | 0.8 | holz | P | S | Fr |
| `saftzapfer` | Zapfstelle mit Eimer an der Ranke | `BX` Kasten + `CY` Rohr + `fass`-Muster + `emissive` Tropfen | 1.0 | holz | P | S | Fr |
| `lichtbluete` | leuchtende Blüte an der Ranke | `PL` alphaTest (`TEX.bluete`) + `emissive` `IC` Kern, starker `wind` | 0.5 | laub | P | S | Fr |
| `sporenlaterne` | schwebende Leuchtsphäre | `emissive` `IC` + `PL` Halo (alphaTest) | 0.3 | laub | P | S | **Fr** |
| `wurzelbogen` | begehbarer Wurzelbogen über dem Weg | 2× `tubeGeo` + `PL` Moos + Erdanschüttung `moundGeo` | 2.6 | rinde | P | M | Ko |
| `wurzelanker` | Wurzel, die sich im Fels verkrallt | 4× `tubeGeo` fingerförmig + `IC` Felsblock | 2.8 | rinde | P | M | St |
| `samenkapsel` | aufgeplatzte Riesenkapsel als Behausung | 2 Halbschalen aus `SphereGeometry` (Phi-Segment) + `tuer()` + `emissive` Innenlicht | 2.2 | rinde | P | M | – |
| `rankenkai` | Landeplattform für Gleiter an der Ranke | `leafGeo` Plattform + 4 `CY` Poller + 2 `CY` Masten + `PL` Wimpel | 3.4 | laub | K | E | Fr |
| `huetersaeule` | weiße Stele mit Rankenrelief | `CY` + geschnitzte `BX` Bänder + `emissive` Rillen (`colorAt`) | 0.8 | stein | P | S | – |

## 10. Biom Eis / Schnee

| Pool | Beschreibung | Bauweise | r | Familie | Typ | F | Regel |
|---|---|---|---|---|---|---|---|
| `iglu` | Schneekuppel mit Tunneleingang | `SphereGeometry`-Halbkugel + `CY` Tunnel + 16 `BX` Blockfugen (flach aufgesetzt) | 1.8 | putz | P | M | – |
| `eisfischerhuette` | Hütte auf dem Eis mit Angelloch | `BX` + `prismGeo` Dach + dunkles `PL` Loch + Schlittenspuren | 1.6 | holz | P | M | **W** (Eisfläche) |
| `schlitten` | Hundeschlitten mit Ladung | 2× `CY` Kufen + `BX` Korb + `BX` Bügel + Sackballen `IC` | 1.2 | holz | P | S | – |
| `eisfels` | vergletscherter Felszahn | `IC` verzerrt + 5 `CO` Eiszapfen + weißer Overlay-Tint | 1.6 | stein | P | S | – |
| `eisscholle` | treibende Scholle | flaches, verzerrtes `IC` (Quantisierung wie `islandGeo`) | 2.4 | stein | P | S | **W** |
| `gletschertor` | Eishöhlenportal mit blauem Inneren | `Torus`-Bogen + 6 `IC` Eisblöcke + dunkelblaues `PL` | 3.0 | stein | P | E | St |
| `pelzzelt` | kegelförmiges Fellzelt | `CO` + 5 `CY` Stangen oben herausragend + `BX` Eingangsklappe | 1.6 | stoff | P | M | – |
| `schneewall` | Windschutzmauer aus Schneeblöcken | 8× versetzte `BX` + abgerundete Krone `CY` | 2.0 | putz | P | S | – |
| `thermalquelle` | dampfendes Becken im Schnee | `CY` Becken + `IC` Sinterrand + 2 `PL` Dampfschwaden (`wind`) | 2.0 | stein | P | M | – |
| `geweihgestell` | Trockengestell mit Geweihen und Fellen | Gerüst `BX` + 4 verzweigte `CY` Geweihe + 2 `PL` Felle | 1.2 | holz | P | S | – |

## 11. Biom Wüste

| Pool | Beschreibung | Bauweise | r | Familie | Typ | F | Regel |
|---|---|---|---|---|---|---|---|
| `karawanserei` | ummauerter Hof mit Torturm und Arkaden | `BX`-Ring + `torhaus`-Variante + Arkadenreihe innen + Eckkuppeln | 6.0 | putz | **G** | E | Ko |
| `wuestenzelt` | großes Spannzelt der Nomaden | 4 schräge `BX`/`PL` Bahnen + 3 `CY` Stangen + `tubeGeo` Abspannseile | 2.2 | stoff | P | M | – |
| `kleinzelt` | einfaches Rundzelt | `CO` + `BX` Eingangsklappe | 1.0 | stoff | P | S | – |
| `zisterne` | Stufenbrunnen mit Schutzkuppel | `CY` Schacht + 12 `BX` Stufen + `SphereGeometry`-Kuppel auf 4 `CY` | 2.4 | stein | P | M | – |
| `windfaenger` | Badgir-Kühlturm | `BX` hoch + 4 `BX` Schlitze + `BX` Kappe | 1.2 | putz | P | S | Fr (Aufsatz) |
| `lehmspeicher` | bienenkorbförmiger Lehmspeicher | gerundeter `CO` + 4 `CY` Ringrillen + kleine Öffnung | 1.4 | putz | P | S | – |
| `palme` | Palme mit Fiederwedeln | gebogener `CY` (Segmentversatz) + 7 `PL` Wedel (alphaTest, `wind`) | 1.6 | laub | P | S | – |
| `oasenbecken` | gefasstes Wasserbecken | `CY` Becken + `BX` Randfassung + dunkles `PL` Wasser | 2.2 | stein | P | M | – |
| `traenke` | Viehtränke-Trog mit Zulauf | `BX` Trog + `CY` Rohr + Pfütze `PL` | 0.8 | stein | P | S | – |
| `sandwehe` | Sandschanze mit Halmbüscheln | flacher `moundGeo` + 6 `PL` Halme (alphaTest) | 2.6 | erde | P | S | – |
| `obelisk` | schlanker Steinobelisk | stark verjüngter `BX` + `CO` Spitze (gold) + `sockel()` | 0.7 | stein | P | M | – |
| `gebein` | gebleichter Rippenbogen im Sand | 6× gebogene `CY` Rippen + `CY` Wirbelsäule + `IC` Schädel | 1.8 | stein | P | S | – |

## 12. Biom Moor / Sumpf

| Pool | Beschreibung | Bauweise | r | Familie | Typ | F | Regel |
|---|---|---|---|---|---|---|---|
| `torfstich` | abgestochene Torfkante mit Soden | `BX` Stufenkante dunkel + 8 `BX` Soden + `PL` Wasserrinne | 2.2 | erde | P | M | – |
| `torfstapel` | Trockenstapel aus Soden | 12× versetzte `BX` zu einem `CO`-Volumen gestapelt | 0.9 | erde | P | S | – |
| `moorsteg` | Bohlenweg über den Sumpf | 12× `BX` Bohlen + 6 `CY` Pfähle, leicht wellig (`hashi`) | 2.6 | holz | P | S | **W**/U |
| `moorhuette` | schiefe Kate mit Torfdach | leicht gekippter `BX` + `dach(…, reet)` + `PL` Moos + `tuer()` | 1.8 | reet | P | M | – |
| `aalreuse` | Reuse an einer Stange im Wasser | `CY` Korbgeflecht + `CY` Stange + `PL` Wasserring | 0.6 | holz | P | S | **W** |
| `irrlicht` | Leuchtkugel über dem Moor | `emissive` `IC` + `PL` Halo (alphaTest) | 0.3 | laub | P | S | **Fr** |
| `schilf` | Schilfbüschel | 2× gekreuzte `PL` mit alphaTest (`TEX.grassTuft`), starker `wind` | 0.5 | laub | P | S | U/**W** |
| `seerose` | Blätterteller mit Blüte | 3 flache `PL` Scheiben + `IC` Blüte | 0.7 | laub | P | S | **W** |
| `wurzelstelze` | Mangrovenbaum auf Stelzwurzeln | 6× `tubeGeo` Stelzwurzeln + `geoBaumArt(BAUM_SUMPF)` | 2.8 | rinde | P | M | U/**W** |
| `pfahlgoetze` | geschnitzter Pfahl mit Gesicht | `CY` + 6 `BX` Kerben + 3 `PL` Stoffbänder | 0.5 | holz | P | S | – |
| `moorkahn` | flacher Stakkahn | flacher `BX` Rumpf + `CY` Stakstange + `BX` Sitzbrett | 1.6 | holz | P | S | **W** |

## 13. Natur — Felsformationen, Geysire, Korallen

| Pool | Beschreibung | Bauweise | r | Familie | Typ | F | Regel |
|---|---|---|---|---|---|---|---|
| `felsnadel` | hoher Felszahn | 3× gestapelte, verzerrte `IC` (Quantisierung wie `geoFels`) | 1.2 | stein | P | M | St |
| `felsbogen` | natürlicher Steinbogen | `Torus`-Segment + 2 `IC` Pfeiler, alles verzerrt | 3.2 | stein | P | E | St |
| `findling` | großer Findlingsblock mit Moos | großes `IC` + `PL` Moosfleck | 1.8 | stein | P | S | – |
| `geroell` | Schuttfleck | 9× kleine `IC` in Streuung (`hashi`) | 1.2 | stein | P | S | St |
| `basaltsaeulen` | Säulenbasalt-Gruppe | 7× `CY(…,6)` unterschiedlicher Höhe, dicht gepackt | 1.8 | stein | P | M | – |
| `geysir` | Sinterkegel mit Dampfsäule | `CO` + `CY` Becken + `PL` Dampf (alphaTest, `wind`) | 1.6 | stein | P | M | – |
| `schlammtopf` | blubberndes Schlammbecken | `CY` Becken + 5 `IC` Blasen + dunkles `PL` | 1.2 | erde | P | S | – |
| `kaskadenstufe` | Sinterterrasse mit Überlauf | 3 gestufte `CY` + `PL` Wasserfläche je Stufe | 2.6 | stein | P | M | U |
| `korallenstock` | verzweigter Korallenstock | 5× verzweigte `CY` (Röhrenbaum) + 4 `IC` Knospen | 1.0 | laub | P | S | **W** |
| `seetang` | Tangbüschel im Flachwasser | gekreuzte `PL` mit alphaTest, starker `wind` | 0.6 | laub | P | S | **W** |
| `muschelbank` | Muschelhaufen am Ufersaum | 12× kleine, flache `IC` | 1.0 | stein | P | S | U |
| `treibholz` | angeschwemmter, gebleichter Wurzelstock | `geoStammLiegend`-Muster + 4 `CY` Wurzelarme, heller Tint | 1.4 | rinde | P | S | U |
| `riesenpilz` | Ghibli-Riesenpilz | `CY` Stiel + `SphereGeometry`-Kappe (Phi-Halbschnitt) + 12 `BX` Lamellen | 1.4 | laub | P | M | – |
| `leuchtpilz` | glühende Kleinpilzgruppe | 5× `CY` + `emissive` `SphereGeometry` klein | 0.4 | laub | P | S | – |
| `dornbusch` | kahler Dornbusch | 7× dünne, gekreuzte `CY` + Dornen `CO` | 0.8 | rinde | P | S | – |
| `bambus` | Halmgruppe mit Blattfächern | 6× `CY` segmentiert + 8 `PL` Blätter (alphaTest, `wind`) | 0.9 | laub | P | S | – |
| `blumenteppich` | dichte Blütenfläche als Bodenkarte | horizontales `PL` mit `TEX.bluete`-alphaTest (wie `moos`) | 1.2 | laub | P | S | – |

## 14. Kleinzeug / Requisiten

| Pool | Beschreibung | Bauweise | r | Familie | Typ | F | Regel |
|---|---|---|---|---|---|---|---|
| `wagenrad` | an die Wand gelehntes Rad | `CY` dünn + 8 `BX` Speichen + `CY` Nabe | 0.5 | holz | P | S | – |
| `holzstapel` | Scheitstapel | 12× `CY` quer in zwei Lagen | 0.8 | holz | P | S | – |
| `wasserbottich` | Bottich mit Wasserspiegel | `CY` + 2 `CY` Reifen + dunkles `PL` | 0.5 | holz | P | S | – |
| `waescheleine` | Leine mit Tüchern | 2× `CY` + `BX` Leine + 4 `PL` Tücher (`wind`) | 1.4 | stoff | P | S | – |
| `bank` | Holzbank | 3× `BX` | 0.6 | holz | P | S | – |
| `tisch` | Tisch mit zwei Bänken | `BX` Platte + 4 `CY` Beine + 2 Bänke | 0.9 | holz | P | S | – |
| `feuerstelle` | Lagerfeuer mit Steinring | 8× `IC` Ring + 4 `CY` Scheite + `emissive` `CO` Flamme | 0.8 | stein | P | S | – |
| `kochkessel` | Dreibein mit Kessel | 3× `CY` + `SphereGeometry` Kessel + `Torus` Henkel | 0.6 | metall | P | S | – |
| `lattenzaun` | Zaunfeld (Erweiterung von `pfosten`) | 2× `CY` + 3 `BX` Latten + 5 `BX` Staketen | 1.0 | holz | P | S | Ko |
| `gartenbeet` | Hochbeet mit Pflanzen | `BX` Rahmen + `BX` Erde + 6 `IC` Pflänzchen | 0.8 | holz | P | S | – |
| `tontoepfe` | Topfstapel | 4× konische `CY` versetzt | 0.4 | erde | P | S | – |
| `sackstapel` | Getreidesäcke | 5× gestauchte `IC` | 0.6 | stoff | P | S | – |
| `schubkarre` | Schubkarre | `BX` Wanne + `CY` Rad + 2 `BX` Griffe | 0.7 | holz | P | S | – |
| `leiter` | angelehnte Leiter | 2× `BX` Holme + 7 `BX` Sprossen | 0.6 | holz | P | S | – |
| `blumenkasten` | Fensterkasten mit Blumen | `BX` + 5 bunte `IC` | 0.3 | holz | K | S | Fr |
| `brunnentrog` | langer Steintrog mit Auslauf | `BX` + `CY` Rohr + `PL` Wasser | 0.8 | stein | P | S | – |
| `marktkorb` | Korbstapel mit Waren | 3× `CY` offen + `IC` Früchte | 0.4 | stoff | P | S | – |

## 15. Fahrzeuge & Tiersilhouetten

| Pool | Beschreibung | Bauweise | r | Familie | Typ | F | Regel |
|---|---|---|---|---|---|---|---|
| `ochsengespann` | Karren mit zwei Zugochsen | `karren`-Muster + 2× (`BX` Rumpf + 4 `CY` Beine + `BX` Kopf + `CO` Hörner) | 2.2 | holz | K | M | Ko |
| `kutsche` | Kabinenwagen mit vier Rädern | `BX` Kabine + `fenster()` klein + 4 `CY` Räder + `BX` Deichsel + `prismGeo` Dach | 1.6 | holz | P | M | Ko |
| `pferd` | Pferdesilhouette | `BX` Rumpf + 4 `CY` Beine + `BX` Hals + `CO` Kopf + `PL` Mähne | 1.0 | stoff | P | S | – |
| `rind` | Kuh mit Hörnern | `BX` Rumpf + 4 `CY` + `BX` Kopf + 2 `CO` Hörner | 0.8 | stoff | P | S | – |
| `schaf` | Schaf mit Wollkörper | `IC` Wollkörper + 4 dünne `CY` + `BX` Kopf | 0.5 | stoff | P | S | – |
| `ziege` | Ziege auf dem Fels | kleiner `IC` Rumpf + 4 `CY` + geschwungene `CY` Hörner | 0.4 | stoff | P | S | St |
| `moeve` | fliegende Möwensilhouette | 2× `PL` Flügel in V-Stellung + `BX` Körper | 0.2 | stoff | P | S | **Fr** |
| `rankengleiter` | kleines Luftschiff mit Blattflügeln | Rumpf-Generator + 2× `leafGeo` Tragflächen + gestauchte `SphereGeometry` Ballon + `PL` Segel | 3.0 | stoff | K | E | **Fr** |

---

## Platzierungsregeln — Zusammenfassung der Sonderfälle

`tryPlace` verwirft heute alles mit `h < WATER + 0.35`. Für die Wasserobjekte braucht es eine **invertierte Variante** — `tryPlaceWasser(occ, x, z, r)`: verlangt `h < WATER - 0.3` (echtes Wasser, keine Uferbank), ignoriert `slopeAt`, ignoriert `inCorridor`, gibt `WATER` als Setzhöhe zurück. Betroffen (`W`):

`bake`, `boje`, `fischerboot`, `kutter`, `kogge`, `dreimaster`, `ruderschiff`, `floss`, `wrack`, `eisfischerhuette`, `eisscholle`, `aalreuse`, `seerose`, `schilf`, `moorkahn`, `korallenstock`, `seetang`, `moorsteg`, `steinbruecke`/`holzbruecke` (Widerlager an Land, Feld über Wasser), `pfahlhaus`, `wurzelstelze`.

Zweite Sonderregel **`tryPlaceUfer`** (`|h − WATER| < 0.8`, Ausrichtung per Höhengradient wie in `dorfUfer`): `kaimauer`, `kaitreppe`, `kaikran`, `anleger`, `bootshaus`, `leuchtturm`, `leuchtfeuer`, `slipbahn`, `werfthalle`, `helling`, `salzgarten`, `hafenlaterne`, `netzgestell`, `fischtrockner`, `reusenstapel`, `kettenturm`, `wassermuehle`, `saegewerk`, `wasserrad`, `kanalschleuse`, `uferdamm`, `muschelbank`, `treibholz`, `kaskadenstufe`.

Dritte: **keine Bodenregeln** (`Fr`, Muster `genInseln`) für alles, was an Ranken hängt oder schwebt: `schwebescholle`, `sporenlaterne`, `irrlicht`, `moeve`, `rankengleiter`, `seilbahngondel`, `rankenhaus`, `blattplateau`, `blattsteg`, `rankenkai`, `rankentreppe`, `rankenleiter`, `saftzapfer`, `lichtbluete`, `sturzwurzel`, plus alle Aufsätze (`gaube`, `kamin`, `pechnase`, `rosette`, `blumenkasten`, `wehrbanner`, `wappenstein`, `windfaenger`), die vom Elterngebäude aus per lokalem Anker gesetzt werden — analog `FENSTER_ANKER`/`emitFensterlicht`.

Vierte: **Steilhang erlaubt** (`COS40`-Prüfung aus) für alles, was gerade den Hang braucht: `mauerbogen`, `terrassenfeld`, `kalkofen`, `stollenhaus`, `felsentreppe`, `tunnelportal`, `seilbahnmast`, `bruchkante`, `treppenruine`, `wurzelanker`, `gletschertor`, `felsnadel`, `felsbogen`, `geroell`, `ziege`, `haengebruecke`.

---

## Kompositstrukturen und Struktur-Generatoren

Als **`G`** markiert sind vier Fälle, die kein `definePool` sein dürfen, sondern einen Generator im Stil von `genViertel` brauchen — Begründung jeweils: die Geometrie ist nicht instanzierbar, weil sie sich am Gelände/Polygon orientiert und aus Dutzenden verschiedener Teile besteht.

| Generator | Baut aus | Warum kein Pool |
|---|---|---|
| `genBurg` | `bergfried`, `torhaus`, `barbakane`, `bastion`, `wehrturm`, `mauerstueck`/`mauerecke`, `burgpalas`, `burgkapelle`, `burgkueche`, `zugbruecke`, `mauertreppe`, `zwingermauer` | Der Mauerring folgt einem geschlossenen Polygonzug wie `districtStreets`; Türme sitzen an den Ecken, das Tor an der talseitigen Kante, der Palas im Hof. Das ist Layout-Logik, kein Mesh. Innenhof wird als `occ`-Fläche gesperrt und mit `KULTUR.burg` bestreut. |
| `genWerft` | `werfthalle`, `helling`, `slipbahn`, `kaimauer`, `kaikran`, `anleger`, `lagerhaus`, `seilerbahn`, `holzstapel`, `tauhaufen`, `bootshaus` | Alles muss auf **eine** gemeinsame Wasserlinie ausgerichtet werden (Yaw aus dem Höhengradienten wie in `dorfUfer`), Slipbahnen senkrecht dazu. Einzeln gestreut sähe es zufällig statt geplant aus. |
| `genKreuzgang` / `genKarawanserei` | 4 Arkadenflügel + Eckbauten + Innenhof | Rechteckhof mit exakt geschlossenen Ecken — parametrisch aus Kantenlängen, nicht aus einer festen Geometrie. |
| `genBlattstadt` | `blattplateau` + `KULTUR.arbor`-Streuung + `blattsteg` + `rankentreppe` | Das Plateau definiert erst die Höhe, auf der alles andere steht; die Bebauung braucht ein eigenes `heightAt`-Surrogat (Blattoberfläche statt Terrain). Muss deshalb den `tryPlace`-Kontrakt ersetzen, nicht nur nutzen. |

Weitere reine **Komposite (`K`)**: `dreimaster`, `kogge`, `ruderschiff` (Rumpf + Aufbauten + Takelage — als ein Pool zu teuer, aber selten genug, dass ein Einzel-Mesh vertretbar ist; Alternative: Rumpf als Pool, Masten separat gestreut), `steinbruecke`, `haengebruecke`, `kathedralenschiff`, `tempelruine`, `ochsengespann`, `rankengleiter`, `schlossfluegel`/`schlossturmhaube`/`schlossportal` (das „Schloss" ist die Kombination dieser drei plus `wohnblock`-Seitenflügel entlang eines U-förmigen Grundrisses).

---

## Umsetzungsreihenfolge — 6 Bündel

**Bündel 1 — Wehrbau-Kit (Fundament für Burg und Schloss).**
`mauerstueck`, `mauerecke`, `mauerdurchlass`, `mauerbogen`, `zwingermauer`, `mauertreppe`, `schildmauer`, `wehrturm`, `geschuetzturm`, `bergfried`, `torhaus`, `barbakane`, `bastion`, `zugbruecke`, `palisade`, `palisadentor`, `wachturm`, `wehrbanner`, `wappenstein`, `pechnase`. Zusammen, weil sie alle vom selben neuen Helfer `zinnen()` und derselben Steinpalette leben — und weil erst der komplette Satz `genBurg` ermöglicht.

**Bündel 2 — Burg-, Schloss- und Kloster-Strukturen.**
`burgpalas`, `burgkapelle`, `burgkueche`, `schlossfluegel`, `schlossturmhaube`, `schlossportal`, `kathedralenschiff`, `rosette`, `glockenturm`, `kapelle`, `kreuzgang`, plus die Generatoren `genBurg` und `genKreuzgang` und die Kulturtabellen `KULTUR.burg` / `KULTUR.kloster`. Braucht Bündel 1 und den Arkaden-Helfer.

**Bündel 3 — Maritim komplett.**
Erst die invertierte Platzierungsregel `tryPlaceWasser` + `tryPlaceUfer`, dann Rumpf-Generator, dann alle 24 Maritim-Pools plus `genWerft` und die Brücken (`steinbruecke`, `holzbruecke`, `haengebruecke`, `kanalschleuse`, `uferdamm`). In einem Zug, weil die Wasserregel sonst tote Infrastruktur ohne Nutzer wäre.

**Bündel 4 — Arbor-Welt.**
`rankenstamm`, `rankenknoten`, `blattplateau`, `blattsteg`, `rankentreppe`, `rankenleiter`, `wurzelbogen`, `wurzelanker`, `samenkapsel`, `rankenkai`, `saftzapfer`, `lichtbluete`, `sporenlaterne`, `huetersaeule`, `arborschrein`, `rankenaltar`, `lichtsammler`, `samenreliquiar`, `blattkanzel`, `rankentor`, `rankenhaus`, `rankengleiter`, `genBlattstadt`. Zusammen, weil sie eine gemeinsame weiß-leuchtende Materialvariante und dieselbe `Fr`-Platzierung teilen — das setzt das Setting als Erstes sichtbar.

**Bündel 5 — Biome und Wirtschaft.**
Eis (10), Wüste (12), Moor (11), Landwirtschaft (15), Handwerk (14), plus `KULTUR.eis` / `.wueste` / `.moor` / `.bauern`. Alles einfache Einzel-Meshes ohne neue Helfer — reine Fleißarbeit, gut parallelisierbar, füllt die Karte in der Breite.

**Bündel 6 — Ruinen, Natur, Requisiten, Tiere.**
Ruinen (13), Natur (17), Requisiten (17), Fahrzeuge/Tiere (8), Wohnbau-Rest (15), Verkehr-Rest. Streuware zum Schluss: sie hängt an keiner Struktur, ist billig zu bauen und macht am Ende den Unterschied zwischen „Modell" und „bewohnter Ort".

---

## Neue Bauhelfer, die sich lohnen

| Helfer | Signatur (Vorschlag) | Begründung |
|---|---|---|
| `zinnen(parts, w, d, y, hex, n)` | Zinnenkranz auf Rechteck- oder Kreisgrundriss | 14 Wehrbau-Pools brauchen ihn; ohne ihn steht die Merlon-Schleife vierzehnmal kopiert im Code. |
| `bogenreihe(parts, n, spann, hoehe, y, hex)` | Arkade aus `Torus`-Halbbögen zwischen Pfeilern | `arkade`, `kreuzgang`, `aquaedukt`, `steinbruecke`, `laubenhaus`, `karawanserei`, `tunnelportal` sind alle dieselbe Konstruktion mit anderen Proportionen. |
| `rumpf(l, b, h, sprung, hex)` | Schiffsrumpf: gekrümmter Kiel, sich verjüngende Spanten, Deck | Sieben Schiffstypen unterscheiden sich fast nur in Länge/Breite/Deckssprung — ein guter Rumpf ist die halbe Maritim-Kategorie. |
| `takelage(parts, masten, segel, seed)` | Masten, Rahen, `PL`-Segel, `tubeGeo`-Wanten | Trennt die teure Takelung vom Rumpf, sodass `wrack` und `floss` sie einfach weglassen. |
| `dachlandschaft(parts, w, d, y, hex, seed)` | Walm/Krüppelwalm/Mansarde + Gauben + Kamine deterministisch verteilt | `dach()` kann heute nur Giebel; Stadthäuser, Schloss und Wohnblock brauchen Varianz im Dach, und genau dort schaut die Ghibli-Ästhetik hin. |
| `fachwerk(parts, w, h, z, seite, muster, seed)` | Raster aus Ständern, Riegeln und Streben auf einer Wandfläche | In `geoHausB` sind vier Balken handverdrahtet; ein Raster-Helfer erzeugt aus einer Seed ganze Fassadenfamilien statt vier identischer Häuser. |
| `treppe(parts, n, breite, steigung, x, y, z, hex)` | Stufenlauf, gerade oder auf Helix | `mauertreppe`, `felsentreppe`, `schlossportal`, `zisterne`, `rankentreppe`, `treppenruine`, `kaitreppe` — sieben Nutzer. |
| `bruchkante(geo, ebene, seed)` | schneidet/verzerrt eine Geometrie zu einer gebrochenen Kante | Macht aus jedem Bestandsobjekt seine Ruine — `mauerruine`, `saeulenstumpf`, `giebelruine`, `ruinenturm`, `treppenruine` entstehen dann fast gratis aus vorhandenen Bauteilen. |
| `zeltbahn(parts, pts, durchhang, hex)` | gespannte Stoffbahn mit Durchhang zwischen Ankerpunkten | Wüstenzelte, Elfenlaube, Marktplanen, Waschleine, Segel — Stoff mit Schwerkraft ist der eine Look, den flache `PL` nie hinbekommen. |
| `tryPlaceWasser` / `tryPlaceUfer` | Gegenstücke zu `tryPlace` in `objects.js` | Ohne sie ist die gesamte Maritim-Kategorie unplatzierbar; die Uferfassung formalisiert außerdem die heute in `dorfUfer` hartkodierte Logik. |
| `ankerAufsatz(el, kind, wirt, anker, …)` | setzt Aufsätze (Gaube, Kamin, Erker, Banner) relativ zum Wirtsgebäude | Verallgemeinert `emitFensterlicht`/`FENSTER_ANKER` auf beliebige Aufbauten und ist der Grund, warum `gaube`, `kamin`, `pechnase`, `rosette`, `blumenkasten` billig bleiben. |
| `emissiveAdern(geo, freq, hex)` | schreibt leuchtende Streifen ins `color`-Attribut (Muster `colorAt` in `tubeGeo`) | Die Arbor-Ranken leben davon; als eigener Helfer läuft er auch auf `huetersaeule`, `lichtsammler` und `rissspalt`. |
