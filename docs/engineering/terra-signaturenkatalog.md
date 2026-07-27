# Terra — Signaturenkatalog (Runde I1, dritter Teilschritt)

Entworfen am 27.07.2026. Ergänzt `terra-runde-i-plan.md`, Abschnitt „Der
eigentliche Knackpunkt: Assets folgen dem Maßstab", und `terra-objektkatalog.md`
(230 Körperpools). Dieses Dokument beschreibt die **andere Hälfte** des
Bestands: was Terra zeichnet, wenn ein Körper zu klein zum Zeichnen ist.

Es ist der Teilschritt, der über den Erfolg der Ebenen-Hierarchie entscheidet.
Format und Kartenbaum sind Fleißarbeit; die Höhenableitung ist Rechnerei. Aber
eine Kontinentkarte, auf der 4000 Häuschen als graue Krümel liegen, ist keine
Kontinentkarte — sie ist eine Ortskarte, aus der man herausgezoomt hat. Der
Unterschied ist der ganze Punkt.

---

## Die Leitentscheidung: zwei Bildsprachen, nicht eine skalierte

Atlas benutzt auf allen Ebenen dieselben 80 Assets. Das ist der bequeme Weg und
das falsche Ergebnis. Terra macht es andersherum:

- Auf einer **Ortskarte** sieht Terra aus wie eine **Landschaft** — Häuser mit
  Fensterglut, Einzelbäume, Licht, Wind, Tiefenschärfe.
- Auf einer **Kontinentkarte** sieht Terra aus wie eine **Karte** — Signaturen,
  Beschriftungen, Flächentöne, Reliefschattierung.

Derselbe Editor, dieselben Daten, zwei Bildsprachen. Das leistet
Papier-Kartografie seit Jahrhunderten, und es ist ein besseres Ziel als
„dieselben Modelle, nur kleiner".

Daraus folgt die Regel, an der sich jede Einzelentscheidung in diesem Dokument
messen lässt:

> **Eine Signatur ist keine kleine Version des Körpers. Sie ist ein Zeichen für
> die Sache, das auch dann noch liest, wenn die Sache drei Bildpunkte breit
> wäre.**

Eine Ortssignatur zeigt deshalb keinen winzigen Grundriss, sondern einen Ring
mit einem Punkt darin. Eine Waldsignatur zeigt keine kleinen Bäume, sondern
einen Flächenton mit ein paar Randmarken. Das ist kartografische Konvention,
und sie ist Konvention geworden, weil sie funktioniert.

---

## Die Maßstabsleiter

Maßstab ist in Terra **Weltmeter je Gitterzelle** — eine Zahl, kein Levelname.
Das ist bewusst so: ein Nutzer, der eine Karte mit 8 m/Zelle anlegt, soll nicht
in eine Schublade gezwungen werden. Die vier Namen sind Ankerpunkte für die
Bedienung, nicht Fälle im Code.

| Name | m/Zelle | Kantenlänge bei 1024² | Was man sieht |
|---|---|---|---|
| **Ort** | 0,5 – 4 | 0,5 – 4 km | Häuser, Bäume, Zäune, Laternen |
| **Landschaft** | 4 – 60 | 4 – 60 km | Baukörper, Kronencluster, Wegbänder |
| **Region** | 60 – 600 | 60 – 600 km | Signaturen, Flächentöne, Grate |
| **Kontinent** | 600 – 4000 | 600 – 4000 km | Punkte, Flächen, Reliefschattierung |

Die Bänder **überlappen absichtlich**. An jeder Grenze blenden beide
Darstellungen über einen Bereich von etwa einer halben Größenordnung ineinander.
Ein Zoom über die Grenze darf nicht springen.

---

## Wie Pools ihr Band deklarieren

`definePool` bekommt zwei Felder, beide in Metern je Zelle:

```js
definePool("haus", geoHaus(), { radius: 2.9, familie: 'putz',
  sichtbarAb: 0.3, sichtbarBis: 40 });

definePool("ortssignatur", geoOrtssignatur(), { radius: 0, familie: 'karte',
  sichtbarAb: 55, sichtbarBis: 4000, karte: true });
```

Fehlen die Felder, gilt `sichtbarAb: 0, sichtbarBis: 60` — der Bestand ist
damit ohne eine einzige Änderung im Band „Ort bis Landschaft", also genau dort,
wo er heute schon ist. **Keine Migration, keine Formatänderung.**

Das Feld `karte: true` markiert Kartenzeichen. Sie hängen an einem eigenen
Material (Familie `karte`), das flach beleuchtet ist, keinen Kontaktschatten
wirft und keine Malschicht bekommt — eine Signatur ist Tinte auf Papier, kein
Gegenstand im Licht. Ohne diese Trennung sähe ein Ortsring aus wie ein
liegender Reifen.

### Ausblendung mit weichem Rand

Die Sichtbarkeit ist keine Schaltung, sondern ein Faktor:

```
f(m) = sstep(ab, ab * 1.6, m) * sstep(bis * 1.6, bis, m)
```

Ein Pool erscheint also über eine halbe Größenordnung und verschwindet über eine
halbe Größenordnung. Der Faktor geht als Alpha in den Instanz-Tint. Zwei
Darstellungen derselben Sache überlappen sich dadurch in ihrem Übergangsbereich
zu einem sauberen Kreuzblenden, ohne dass irgendwo eine Sonderregel dafür nötig
wäre.

**Wichtige Nebenwirkung, die eingeplant sein muss:** Im Überlappungsbereich
werden beide Darstellungen erzeugt, also auch beide Instanzbudgets belegt. Das
ist der Preis für den weichen Übergang. Der Instanzdeckel (`MAX_INST_PER_EL`)
muss das aushalten — er wird für Kartenzeichen getrennt geführt, weil eine
Signatur pro Element eine Instanz kostet und ein Wald 4000.

---

## Wie Generatoren maßstabsbewusst werden

**Nicht drei Kopien.** Projektregel ist erweitern, nicht duplizieren. Ein
Generator bekommt am Kopf eine Verzweigung, nicht einen Zwilling:

```js
function genWald(el) {
  var m = massstab();                    // Weltmeter je Zelle
  if (m > 55) return signaturWald(el);   // Region und darüber
  var stufe = m > 6 ? 'cluster' : 'einzeln';
  // … der bestehende Code, mit `stufe` an den drei Stellen, wo es zählt
}
```

Der Schwellenwert steht **einmal** in einer Tabelle, nicht als Zahl im
Generator. Sonst laufen die Stufen bei der nächsten Änderung auseinander, und
niemand merkt es, weil jeder Generator für sich plausibel aussieht.

Die drei Stellen, an denen es in `genWald` wirklich zählt, sind übrigens nicht
die Baumart, sondern: Kandidatendichte, ob Unterwuchs erzeugt wird, und ob je
Kandidat ein Baum oder ein Cluster gesetzt wird. Der Rest bleibt.

---

## Größe: der Fallstrick, an dem naive Umsetzungen scheitern

Ein Körper ist in Weltmetern groß. Ein Kartenzeichen ist es **nicht**. Eine
Ortssignatur, die 30 m misst, ist auf einer Kontinentkarte mit 2000 m/Zelle
unsichtbar — sie wäre ein Sechzigstel einer Zelle.

Kartenzeichen bekommen ihre Größe deshalb **relativ zur Karte**:

```
weltgroesse = grundgroesse * kartenKante * anteil
```

mit `anteil` je Signaturklasse zwischen 0,004 (kleiner Ort) und 0,05 (großes
Gebirgsmassiv). Eine Ortssignatur ist damit auf jeder Karte etwa gleich groß
**im Bild**, egal ob die Karte 2 km oder 2000 km misst. Genau das will man: die
Lesbarkeit hängt am Bild, nicht an der Welt.

Zusätzlich eine **Mindest- und Höchstgröße im Bildraum**, weil sonst ein starker
Zoom die Signaturen zu Fladen aufbläst. Das ist derselbe Mechanismus, den die
Beschriftung aus I4 für ihre Schriftgrade braucht — beide sollten sich eine
Funktion teilen, statt sie zweimal zu haben.

---

## Bauweise: gezeichnet, nicht modelliert

Signaturen liegen flach in der XZ-Ebene, leicht über dem Gelände (0,4 % der
Kartenkante, damit sie auf einem Hang nicht im Boden verschwinden), und tragen
die Kartenfarbe statt einer Materialfarbe.

Zwei Wege standen zur Wahl:

1. **Ein Canvas-Atlas**, aus dem jede Signatur ihr Feld holt. Sieht gezeichnet
   aus, ist billig, und Terra baut in `render/textures.js` bereits Canvas-Texturen.
2. **Flache Geometrie** aus dem bestehenden `part`/`mergeGeos`-Vokabular.

**Gewählt ist 1 mit gebackenen UV**, und zwar aus einem Grund, der leicht zu
übersehen ist: Der Instanzpfad schreibt 12 Festwerte je Instanz (Matrix +
Tint) und hat keinen Platz für einen UV-Versatz. Ein Atlas mit **pro Pool
gebackenen** UV umgeht das vollständig — jede Signatur ist ein eigener Pool mit
einem eigenen Quad, dessen UV auf sein Atlasfeld zeigt. Der Atlas ist damit
**eine** Textur für alle Kartenzeichen, ohne eine einzige Änderung an der
Instanzmechanik.

Der Atlas wird beim Start gezeichnet, deterministisch, mit denselben Mitteln wie
die vorhandenen Texturen: 8 × 8 Felder à 128 px, also 1024² — eine Textur,
ein Materialwechsel, ein Zeichenaufruf je Pool.

**Tinte statt Farbe.** Die Felder werden in Graustufen mit Alpha gezeichnet; die
Farbe kommt aus dem Instanz-Tint und damit aus der Biompalette der Karte. So
liegt eine Waldsignatur in einem Nadelwaldbiom in dessen Grün und in einem
Herbstbiom in dessen Ocker, ohne dass es zwei Atlasfelder braucht.

---

## Die Stufen im Überblick

Was aus jeder Sache wird, wenn man herauszoomt. Das ist die Tabelle, gegen die
später die Sichtprüfung läuft.

| Sache | Ort (1 m) | Landschaft (25 m) | Region (250 m) | Kontinent (2000 m) |
|---|---|---|---|---|
| Wohnhaus | Körper mit Dach, Fenstern, Fensterglut | vereinfachter Baukörper | Teil der Ortssignatur | — |
| Dorf | 30 Häuser + Gassen + Zäune | 12 Baukörper, angedeutete Gassen | `ortssignatur` klein | Punkt im Ortsnetz |
| Stadt | Viertel, Gassen, Mauerring | Baukörperfeld + Mauerlinie | `ortssignatur` groß + Mauerkranz | `ortssignatur` klein |
| Wald | Einzelbäume + Unterwuchs | Kronencluster | `waldsignatur` (Flächenton + Randmarken) | Flächenton |
| Acker | Furchen, Feldsteine, Zäune | Streifenmuster | `ackersignatur` (Karomuster) | Flächenton |
| Straße | Wegband mit Rändern, Brücken | schmales Band | `strassensignatur` (Linie mit Signaturbreite) | Linie, nur Hauptzüge |
| Fluss | Wasserfläche, Ufer, Furten | schmales Band | Linie, Breite nach Abfluss | Linie, nur Hauptzüge |
| Gebirge | einzelne Felsen | Felsgruppen, Grate | `gratsignatur` (Schraffur) | Reliefschattierung |
| Sumpf | Schilf, Tümpel, Bulten | Wasserflecken | `sumpfsignatur` | Flächenton |
| Wüste | Dünen, Steine, Zelte | Dünenzüge | `wuestensignatur` | Flächenton |
| Ruine | begehbare Mauerreste | Mauerriss | `ruinensignatur` | — |
| Hafen | Kai, Kräne, Schiffe | Molenlinie + Schiffe | `hafensignatur` | Teil der Ortssignatur |
| Pass | Weg zwischen Felswänden | Wegknick im Grat | `passsignatur` | — |
| Grenze | Grenzsteine | Steinreihe | `grenzsignatur` (Perlband) | Perlband, kräftiger |
| Ranke (Arbor) | voller Strang mit Blattplateaus | Strang vereinfacht | `arborsignatur` (Lichtsäule + Fußsymbol) | Leuchtpunkt |

---

## Der Katalog

**Spaltenlegende**

- **Anteil** — Größe als Bruchteil der Kartenkante (siehe oben)
- **Band** — `sichtbarAb` – `sichtbarBis` in Metern je Zelle
- **Q** — Quelle: `E` = aus einem Element abgeleitet, `A` = aus einer Ableitung
  (Erosion, Biomfeld, Ortsnetz), `H` = von Hand gesetzt
- Alle Felder werden ins Atlasblatt gezeichnet; die Spalte **Zeichnung**
  beschreibt, was dort steht

### 1. Orte und Bauwerk

| Pool | Zeichnung | Anteil | Band | Q |
|---|---|---|---|---|
| `sig_weiler` | offener Ring, 3 px Strich | 0,004 | 55 – 4000 | E |
| `sig_dorf` | Ring mit Mittelpunkt | 0,006 | 55 – 4000 | E |
| `sig_stadt` | Doppelring mit Mittelpunkt | 0,009 | 55 – 4000 | E |
| `sig_stadtmauer` | Zackenkranz um den Doppelring | 0,013 | 55 – 1200 | E |
| `sig_hauptstadt` | Doppelring mit Stern | 0,012 | 55 – 4000 | H |
| `sig_burg` | Zinnenrechteck | 0,007 | 40 – 2500 | E |
| `sig_kloster` | Kreuz im Quadrat | 0,006 | 40 – 2500 | E |
| `sig_turm` | Punkt mit Fähnchen | 0,005 | 40 – 1600 | E |
| `sig_ruine` | halber Zinnenriss, gebrochene Linie | 0,006 | 40 – 2500 | E |
| `sig_hafen` | Anker, vereinfacht auf Bogen + Schaft | 0,006 | 40 – 2500 | E |
| `sig_bruecke` | zwei Querstriche über der Flusslinie | 0,004 | 40 – 900 | E |
| `sig_furt` | drei kurze Querstriche | 0,004 | 40 – 900 | A |
| `sig_mine` | gekreuzte Schlägel | 0,005 | 40 – 1600 | E |
| `sig_muehle` | vierflügeliges Kreuz | 0,005 | 40 – 900 | E |

### 2. Flächen und Bewuchs

Flächenzeichen werden **gekachelt** über die Fläche gestreut, nicht einmal in
die Mitte gesetzt: eine einzelne Waldmarke auf einem 200-km-Wald sähe aus wie
ein Fehler. Die Streuung nutzt dasselbe ortsstabile Raster wie `genWald`
(`innenRaster` + `ortsRng` über den Gitterindex), damit sie beim Verschieben der
Fläche nicht neu würfelt.

| Pool | Zeichnung | Anteil | Band | Q |
|---|---|---|---|---|
| `sig_laubwald` | zwei gerundete Kronenbögen | 0,010 | 45 – 4000 | E |
| `sig_nadelwald` | zwei Dreiecksspitzen | 0,010 | 45 – 4000 | E |
| `sig_mischwald` | ein Bogen + eine Spitze | 0,010 | 45 – 4000 | E |
| `sig_hain` | einzelner Kronenbogen | 0,007 | 45 – 1600 | E |
| `sig_acker` | Karo aus vier Strichen | 0,008 | 45 – 1600 | E |
| `sig_weide` | drei Grasbüschel-Häkchen | 0,008 | 45 – 1600 | E |
| `sig_sumpf` | drei waagerechte Striche, versetzt | 0,009 | 45 – 4000 | A |
| `sig_moor` | Striche mit Tümpelpunkten | 0,009 | 45 – 4000 | A |
| `sig_wueste` | drei Dünenbögen | 0,011 | 45 – 4000 | A |
| `sig_salzpfanne` | Bruchmuster aus Polygonen | 0,011 | 45 – 4000 | A |
| `sig_tundra` | flache Punktstreuung | 0,010 | 45 – 4000 | A |
| `sig_eis` | Kristallhäkchen | 0,010 | 45 – 4000 | A |
| `sig_karst` | Kalkschraffur, kurze Parallelen | 0,010 | 45 – 4000 | A |
| `sig_weinberg` | Reihe schräger Striche | 0,008 | 45 – 900 | E |
| `sig_obstgarten` | Punktraster | 0,008 | 45 – 900 | E |

### 3. Relief

Reliefzeichen sind der Teil, bei dem Karten am schnellsten billig aussehen. Die
Regel dagegen: **dem Grat folgen, nicht die Fläche füllen.** Ein Gebirge wird
durch seine Kammlinie erzählt, nicht durch ein Feld aus Bergchen.

| Pool | Zeichnung | Anteil | Band | Q |
|---|---|---|---|---|
| `sig_grat` | asymmetrische Schraffur, Sonnenseite offen | 0,014 | 60 – 4000 | A |
| `sig_gipfel` | Dreieck mit Schattenflanke | 0,009 | 60 – 4000 | A |
| `sig_vulkan` | Dreieck mit gekappter Spitze | 0,011 | 60 – 4000 | A |
| `sig_klippe` | Zahnlinie entlang der Kante | 0,007 | 60 – 2500 | A |
| `sig_schlucht` | doppelte Zahnlinie, gegenläufig | 0,009 | 60 – 2500 | A |
| `sig_pass` | zwei Bögen mit Lücke | 0,006 | 60 – 1600 | A |
| `sig_huegelland` | flache Bogenreihe | 0,010 | 60 – 4000 | A |
| `sig_krater` | Ring mit Schattenrand | 0,010 | 60 – 4000 | A |

Zusätzlich, und **kein Pool**: die **Reliefschattierung** auf Kontinentmaßstab.
Sie ist kein Zeichen, sondern eine Terrainfarbe — schräg von Nordwest
beleuchtet, in die vorhandene `terrainColor` eingerechnet, sobald der Maßstab
über etwa 600 m/Zelle liegt. Das ist der eine Punkt dieses Katalogs, der in
`terrain.js` eingreift, und er ersetzt auf Kontinentmaßstab die gesamte
Objektdarstellung des Geländes.

### 4. Wege, Grenzen, Gewässer

Liniensignaturen sind keine gestreuten Quads, sondern ein **Band entlang des
Pfades** — dieselbe `pathSamples`-Mechanik, die `genStrasse` heute benutzt, nur
mit Signaturbreite statt Wegbreite und mit einem Streifen aus dem Atlas statt
einer Wegtextur. Sie kommen deshalb nicht als Pools, sondern als
Pfad-Darstellungsstufe.

| Zeichen | Band | Q |
|---|---|---|
| Handelsstraße — kräftige Volllinie | 55 – 4000 | E |
| Landweg — dünne Volllinie | 55 – 1200 | E |
| Saumpfad — Strichlinie | 55 – 900 | E |
| Fluss — Linie, Breite nach `abfluss` aus I3 | 45 – 4000 | E/A |
| Küste — Linie mit einseitigem Tonverlauf | 45 – 4000 | A |
| Grenze — Perlband (Punkt-Strich) | 55 – 4000 | H |
| Handelsweg zur See — feine Strichlinie | 55 – 4000 | H |

### 5. Arbor

Der Hauskanon des Projekts: Terra ist auseinandergerissen und wird vom weißen,
leuchtenden Riesenbaum **Arbor** zusammengehalten. Auf Kartenmaßstab ist das
kein Bewuchs, sondern **Infrastruktur** — die Ranken sind das, was die Bruchstücke
verbindet, und eine Karte, die sie nicht zeigt, erzählt die Welt falsch.

| Pool | Zeichnung | Anteil | Band | Q |
|---|---|---|---|---|
| `sig_ranke` | Lichtsäule: senkrechter Strich mit Halo | 0,010 | 45 – 4000 | E |
| `sig_rankenfuss` | Ring aus Blattmarken | 0,008 | 45 – 2500 | E |
| `sig_bruchkante` | doppelte Bruchlinie mit Schattenseite | 0,012 | 45 – 4000 | E |
| `sig_arborknoten` | Stern aus sechs Strahlen | 0,014 | 60 – 4000 | H |
| `sig_lichtbruecke` | Strichlinie mit Punkten dazwischen | 0,008 | 45 – 2500 | E |

Diese fünf tragen als einzige **Eigenleuchten** — sie ziehen ihre Farbe nicht
aus der Biompalette, sondern aus der Arbor-Farbe, und bekommen im Nachbearbeiter
einen kleinen Blüteanteil. Auf einer Kontinentkarte ist das der einzige Ort im
Bild, an dem es leuchtet, und genau deshalb liest man die Karte von den Ranken
her. Das ist Absicht.

---

## Zusammenzeichnen: aus vielen Häusern wird ein Ort

Der Katalog nennt Zeichen. Die schwierigere Hälfte ist die Frage, **welches**
Zeichen ein Element bekommt. Ein Dorfelement mit 30 Häusern soll auf
Regionsmaßstab eine `sig_dorf` werden, keine 30 `sig_weiler`.

Die Zuordnung läuft über eine Kennzahl je Element, die der Generator ohnehin
kennt — bei Siedlungen die Zahl der gesetzten Baukörper:

| Baukörper | Zeichen |
|---|---|
| 1 – 8 | `sig_weiler` |
| 9 – 40 | `sig_dorf` |
| 41 – 150 | `sig_stadt` |
| über 150 | `sig_stadt` + `sig_stadtmauer` |

Wichtig dabei: Die Kennzahl wird **auf Ortsmaßstab** ermittelt und mit dem
Element gespeichert, nicht auf Regionsmaßstab neu geschätzt. Sonst hinge die
Signatur davon ab, mit welchem Maßstab man die Karte zuletzt geöffnet hat — und
das wäre genau die Sorte versteckter Zustand, an der dieses Projekt schon einmal
einen Tag verloren hat (`rebuildAll`, siehe Runde I5).

---

## Was ehrlicherweise offen bleibt

- **Signaturen für Kompositstrukturen** (Burg, Werft, Kreuzgang, Blattstadt)
  sind im Katalog nur als Einzelzeichen vorgesehen. Eine Burg mit drei
  Mauerringen verdient auf Regionsmaßstab eigentlich einen eigenen Grundriss-
  Umriss statt eines Zinnenrechtecks. Das ist Ausbaustufe, nicht Grundausbau.
- **Handgesetzte Signaturen** (`Q = H`) brauchen ein Werkzeug, das es noch nicht
  gibt. Bis dahin sind sie über das Marker-Werkzeug erreichbar.
- **Die Beschriftung** (I4) ist die natürliche Ergänzung dieses Katalogs und
  wird bewusst dort und nicht hier behandelt. Beide teilen sich die Funktion für
  Größe im Bildraum — wenn sie es nicht tun, laufen Schriftgrad und
  Signaturgröße auseinander, und die Karte sieht auf jedem Maßstab ein bisschen
  falsch aus.
- **Reliefschattierung** ist hier als Regel benannt, aber nicht ausgearbeitet.
  Sie gehört in `terrainColor` und ist der einzige Shader-nahe Eingriff des
  Themas.
