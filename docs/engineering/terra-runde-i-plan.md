# Terra — Runde I: Ebenen, Biomflächen, Erosion, Beschriftung, Tests

Planungsstand 27.07.2026. **Nur Planung, nichts umgesetzt.**

**Grundregel dieser Runde: keine Übernahme aus Atlas-3D.** Atlas hat vergleichbare
Themen gelöst, aber für ein anderes Werkzeug (SDF-Globus, Tuschelook, sechs
Biome, 80 Assets). Terra hat andere Voraussetzungen — 272 Instanz-Pools, 25 tiefe
Biome, Shader-Patch-Kette, ortsstabile Hashes, Höhen-Delta-Format. Jeder Entwurf
hier ist **für Terra neu gedacht**; wo Atlas eine naheliegende Lösung hat, steht
dabei, warum Terra es anders macht.

---

# I1 — Ebenen-Hierarchie mit Drill-Down

## Die Grundidee: Maßstab statt Levelnamen

Atlas hat vier feste Stufen (`globe/continent/landscape/city`). Terra bekommt
stattdessen einen **Maßstab** als Zahl: `einheitMeter` — wie viele Meter eine
Welteinheit bedeutet.

| Kartenart | `einheitMeter` | 512er Karte entspricht |
|---|---|---|
| Kontinent | 2000 | ~1000 km |
| Region | 250 | ~128 km |
| Landschaft | 25 | ~13 km |
| Umgebung | 4 | ~2 km |
| Ort | 1 | ~500 m |

Warum eine Zahl statt einer Aufzählung: Der Maßstab ist die Größe, aus der sich
**alles andere ableiten lässt** — welche Objekte sinnvoll sind, wie breit eine
Straße ist, wie dicht Vegetation steht, ob ein Haus ein Körper oder ein Symbol
ist. Eine Aufzählung müsste jede dieser Regeln einzeln mitschleppen. Außerdem
sind Zwischenstufen erlaubt: Eine Karte mit `einheitMeter: 80` ist zwischen
Region und Landschaft, und alle Regeln interpolieren.

## Das Datenmodell

Eine Datei enthält künftig **mehrere Karten in einem Baum** (Format v5):

```
{ format:"terra", version:5,
  wurzel: "k0",
  karten: [
    { id:"k0", elternId:null, titel:"Nordmark", einheitMeter:250,
      seed, kartenGroesse, biom, hoehenDelta, elemente, marker, ... },
    { id:"k1", elternId:"k0", titel:"Talgrund", einheitMeter:25,
      ausschnitt:[{x,z},…],        // Polygon auf der Elternkarte
      hoehenQuelle:"abgeleitet",   // oder "eigen"
      hoehenDelta:[…],             // Handarbeit ÜBER der Ableitung
      … }
  ] }
```

Die heutigen Felder wandern unverändert in den Karteneintrag. **v1–v4 laden als
einzelne Wurzelkarte** — der Loader ist seit Runde C tolerant genug, das ist ein
Zweig, kein Umbau.

## Der Kern: abgeleitete Höhen statt neu gewürfelter

Hier weicht Terra **bewusst** von Atlas ab. Atlas sperrt beim Drill-Down nur eine
Silhouette und würfelt das Kind ansonsten neu — Elternrelief und Kindrelief haben
nichts miteinander zu tun.

Terra leitet stattdessen ab:

```
kindBasis(x,z) = bilinear(elternHöhe, ausschnitt→x,z)      // Grobform, exakt
               + detailRauschen(x, z, kindSeed, einheitMeter)  // neue Feinstruktur
```

Das gibt drei Eigenschaften, die Atlas nicht hat:

1. **Anschluss stimmt garantiert.** Der Talgrund liegt auf der Höhe, die die
   Regionalkarte an dieser Stelle zeigt — kein Widerspruch zwischen den Ebenen.
2. **Änderungen fließen durch.** Hebt man auf der Elternkarte den Berg an, wird
   das Kind beim nächsten Öffnen mitgehoben. Das Kind speichert seine Handarbeit
   als `hoehenDelta` **über** der Ableitung — dieselbe Mechanik wie heute gegen
   das Seed-Terrain, nur ist die Bezugsgröße jetzt die Elternkarte.
3. **Detailgrad passt zum Maßstab.** Das Zusatzrauschen bekommt seine Frequenz
   aus `einheitMeter`: Auf einer Ortskarte entstehen Bodenwellen und Böschungen,
   auf einer Regionalkarte Hügelketten.

`hoehenQuelle: "eigen"` bleibt als Ausweg für Karten, die bewusst nichts mit der
Elternform zu tun haben sollen.

## Die Silhouette

Der Ausschnitt der Elternkarte wird auf der Kindkarte zur **weichen Grenze**:
Innerhalb liegt das abgeleitete Gelände, außerhalb fällt es zur Nachbarschaft ab
(Wasser, Dunst oder — bei einem Ausschnitt mitten im Land — eine angedeutete
Fortsetzung mit gedämpftem Kontrast, damit klar ist: hier hört die Karte auf,
nicht die Welt).

Technisch dieselbe Maskentechnik wie die Bruchmaske aus Runde H (DataTexture,
weicher Rand, im Shader gesampelt) — die existiert und ist erprobt.

## Der eigentliche Knackpunkt: Assets folgen dem Maßstab

Auf einer Kontinentkarte ist ein Haus 3 cm groß. Es dort als 360-Dreieck-Körper
zu zeichnen ist sinnlos — sichtbar ist ein **Symbol**. Terra bekommt deshalb ein
**Signaturen-System**, und das ist der Punkt, an dem Terra deutlich über Atlas
hinausgeht (Atlas benutzt auf allen Ebenen dieselben 80 Assets).

### Drei Darstellungsstufen je Sache

| Sache | Ort (1 m) | Landschaft (25 m) | Region (250 m) | Kontinent (2000 m) |
|---|---|---|---|---|
| Wohnhaus | Körper mit Dach, Fenstern, Fensterglut | vereinfachter Baukörper | Teil einer Ortssignatur | — |
| Dorf | 30 einzelne Häuser + Gassen | 12 Baukörper, angedeutete Gassen | **Ortssignatur** (Punkt + Name) | Punkt im Ortsnetz |
| Wald | Einzelbäume mit Unterwuchs | Kronencluster | **Waldsignatur** (Flächenton + Randbäume) | Flächenton |
| Straße | Wegband mit Rändern, Brücken | schmales Band | **Linie mit Signaturbreite** | Linie |
| Gebirge | einzelne Felsen | Felsgruppen, Grate | **Grat-Signatur** (Schraffur/Relief) | Reliefschattierung |
| Ranke (Arbor) | voller Strang mit Blattplateaus | Strang vereinfacht | **Lichtsäule + Fußsymbol** | Leuchtpunkt |

### Wie das im Code aussieht

1. **Pools deklarieren ihr Maßstabsband.** `definePool` bekommt ein Feld
   `sichtbarAb`/`sichtbarBis` in Metern. Ein `haus` ist zwischen 0,5 m und 40 m
   sinnvoll; darüber wird es nicht gezeichnet.
2. **Generatoren sind maßstabsbewusst.** `genWald` fragt den Maßstab und
   entscheidet: Einzelbäume, Cluster oder Signatur. Die Logik bleibt eine
   Funktion mit Zweigen — nicht drei Kopien (Projektregel: portieren, nicht
   zusammenfassen; hier: erweitern, nicht duplizieren).
3. **Neue Signatur-Pools.** Grob geschätzt 20–30 Stück: `ortssignatur`
   (Punkt + Ring, Größe nach Einwohnerzahl), `waldsignatur`, `gebirgssignatur`,
   `sumpfsignatur`, `wüstensignatur`, `grenzsignatur`, `passsignatur`,
   `hafensignatur`, `ruinensignatur`, `arborsignatur`. Sie sind flach, lesbar von
   oben und tragen die Kartenfarbe — also eher gezeichnet als modelliert.
4. **Übergang statt Sprung.** Zwischen zwei Stufen blenden beide Darstellungen
   über einen kleinen Maßstabsbereich ineinander (Alpha), damit ein Zoom über die
   Grenze nicht springt.

### Was daraus folgt (und was daran schön ist)

Auf einer Kontinentkarte sieht Terra dann aus wie eine **Karte** — Signaturen,
Beschriftungen, Flächentöne. Auf einer Ortskarte wie eine **Landschaft** —
Häuser, Bäume, Licht. Derselbe Editor, dieselben Daten, zwei Bildsprachen. Genau
das leistet Papier-Kartografie seit Jahrhunderten, und es ist ein besseres Ziel
als „dieselben Modelle, nur kleiner".

## Vererbung

Kind erbt von Eltern: Biom (als Basis), Tageszeit, Wetter, Farbskript,
Palettenbindung, Stil. Jedes Feld einzeln überschreibbar, mit sichtbarer
Herkunft im Panel („⤓ von *Nordmark*", ein Klick zurück auf Erben).

**Nicht** vererbt: Kartengröße und Maßstab (die definieren das Kind), Elemente
(jede Karte hat ihre eigenen), Marker.

## Bedienung

- Werkzeug **Ausschnitt**: Polygon auf der Karte zeichnen → „Als Karte öffnen"
  legt die Kindkarte an und wechselt hinein.
- **Kartenbaum** im Panel (Titel, Maßstab, Kindanzahl), Brotkrumenleiste oben.
- Auf der Elternkarte wird jeder Ausschnitt als **markierte Fläche mit Namen**
  gezeichnet — ein Doppelklick springt hinein.
- **Neu ableiten** (Seed des Kindes würfeln, Handarbeit verwerfen) und
  **Nachziehen** (Elternform neu übernehmen, Handarbeit behalten).

## Aufwand
**[G]**, größter Posten der Runde. Realistisch drei Teilschritte: Format und
Baum (ohne Ableitung), Höhenableitung, Signaturen-System.

---

# I2 — Biome als Flächen

## Was geht und was ehrlicherweise nicht geht

Terras Biome tragen fünf Dinge: Palette, **Höhenprofil**, Vegetationsgewichte,
Schneeauflage, Partikel. Davon ist das Höhenprofil global — `genBaseIn` läuft
einmal über das ganze Feld, und das Delta-Format rechnet dagegen.

Deshalb die Trennung:

- **Basisbiom der Karte** bestimmt das Höhenprofil (Amplitude, Randabbruch,
  Grate, Terrassen). Bleibt eine Karteneigenschaft.
- **Biomflächen** ändern Palette, Vegetation, Schnee und Partikel. Werden
  gemalt.

Das ist keine Notlösung, sondern kartografisch richtig: Ein Moor und eine Wiese
unterscheiden sich in Bewuchs und Farbe, nicht im Grundrelief. Wer eine andere
Grundform will, macht eine eigene Karte (siehe I1).

## Speicherung: Elemente, keine Maske

Atlas speichert einen Splat (Uint8-Gitter) im Terrain-Blob. Terra macht es
anders — als **Elemente**:

```
{ kind:"flaeche", variant:"biom", points:[…], params:{ biom:"moor", weich:8 } }
```

Gründe:
1. Das Element bleibt **editierbar** — Punktgriffe, Neu würfeln, Undo, Stempel,
   alles funktioniert ohne Zusatzarbeit.
2. Das Speicherformat bleibt klein (ein Polygon statt 66 049 Bytes).
3. Ältere Fassungen ignorieren die unbekannte Variante still — **keine
   Formatänderung nötig**.
4. Die Maske wird beim Commit abgeleitet, genau wie `corridor` und `wear` heute.

Zusätzlich ein **Biompinsel** (Pfad-Variante `biompinsel`), ebenfalls als
Element gespeichert und beim Laden nachgestempelt — dieselbe Logik wie die
Bruchkante.

## Rendering

- **Ableitungsschritt beim Commit**: `biomFeld` (Uint8, Index je Gitterzelle) +
  `biomGewicht` (Uint8, 0–255 für den weichen Rand). Zwei Arrays statt eines
  Splat-Blobs — dominantes Biom und Übergangsstärke.
- **Terrainfarbe**: `terrainColor` mischt zwischen der Palette des Basisbioms
  und der des Flächenbioms. Um nicht pro Vertex zwei komplette Paletten
  aufzulösen, werden **16 Mischstufen je Biompaar** gecacht (der Übergang ist
  hinter der Ausfransung ohnehin unsichtbar). Cache-Invalidierung beim Commit.
- **Grenzen ausfransen** über die vorhandene Störoktave aus `terrainColor` —
  dieselbe, die Sand- und Felsgrenzen bricht. Kein zusätzliches Rauschen, keine
  sichtbare Polygonkante.
- **Vegetation**: `genWald`/`genWiese` fragen das Biom **pro Kandidat**, nicht
  einmal pro Element. Harte Entscheidung ohne Mischung — ein halb verschneiter
  Blütenbaum ergibt kein Bild. Der Determinismus bleibt, weil die Abfrage eine
  reine Funktion der Position ist.
- **Schnee und Partikel pro Fläche**: heute globale Uniforms. Neu eine
  **Biom-LUT** als kleine DataTexture (Zeile = Biomindex, Spalten =
  Schneeauflage, Kühle, Bruch, Partikelstärke) plus das Biomfeld als zweite
  Textur. Der Schnee-Patch schlägt dann nach, statt einen globalen Wert zu lesen.
  Das ist der einzige echte Shader-Eingriff dieses Themas.

## Ableitung: Vorschlag statt Vorschrift

Terra bekommt eine **Biom-Ableitung**, die aus dem Gelände einen Vorschlag macht:

Eingaben: Höhe, Hangneigung, Wassernähe (Distanztransformation — die gibt es im
Weltgenerator schon), Abflussmenge aus der Erosion (siehe I3), und eine
**Klimaachse** als Kartenparameter (Richtung + Stärke: „nach Norden wird es
kälter"). Terra hat keinen Breitengrad, deshalb wird er zur einstellbaren
Eigenschaft statt zur Fiktion.

Daraus eine Zuordnung nach Feuchte × Temperatur, aber **auf Terras 25 Biome**
statt auf ein Schulbuchdiagramm: nass+kalt → Moor, nass+warm → Regenwald/Sumpf,
trocken+heiß → Wüste/Salzpfanne, hoch+kalt → Eis/Tundra, Steilhang → Karst usw.

**Der entscheidende Unterschied zu Atlas:** Das Ergebnis sind **Polygone**, keine
Pixelmaske. Die Ableitung erzeugt also ganz normale Biomflächen-Elemente, die man
danach verschieben, verkleinern, löschen oder umfärben kann. Ein Vorschlag, den
man weiterbearbeitet — nicht ein Bild, das man übermalen muss.

## Bedienung
Werkzeug **Biom** mit zwei Varianten (Fläche zeichnen / Pinsel), Biomauswahl im
Panel, Knopf „Biome vorschlagen" mit Regler für die Klimaachse und die
Vorschlagsstärke.

## Aufwand
**[M]** für Flächen und Rendering, **[M]** für die Ableitung, **[K]** für die
Schnee/Partikel-LUT.

---

# I3 — Erosion

## Was Erosion in Terra leisten soll

Nicht nur Höhen verändern, sondern **Daten erzeugen**, die der Rest des Systems
weiterverwendet. Das ist der Terra-eigene Dreh: Atlas erodiert und hört auf;
Terra erodiert und gewinnt dabei drei Felder, die anderswo fehlen.

| Feld | Entsteht bei | Wird gebraucht für |
|---|---|---|
| `abfluss` (Flow Accumulation) | hydraulischer Pass | Flussverläufe im Weltgenerator (heute: steilster Abstieg von zufälligen Gipfeln), Feuchte für die Biom-Ableitung, Talböden |
| `sediment` | Ablagerung | Schwemmland-Färbung, fruchtbare Flächen für Felder, Uferbänke |
| `haerte` | Ausgangswert je Zelle | ungleichmäßige Erosion → Härtlinge, Schichtstufen, Klippen |

## Die beiden Verfahren

**Hydraulisch (Tropfen).** N Tropfen starten an gehashten Positionen (kein
`Math.random` — Startpunkt aus `hashi(index, 0, seed)`), laufen bergab,
erodieren nach Geschwindigkeit und Kapazität, lagern ab, verdunsten. Klassisch,
gut kontrollierbar, und die Tropfenbahnen sind zugleich die Abflussmessung.

**Thermisch (Talus).** Material rutscht ab, wo der Hang steiler als der
Böschungswinkel ist. Macht aus scharfen Rauschkanten glaubwürdige Schutthalden
und Felswände. Billig, wenige Durchläufe reichen.

**Reihenfolge:** thermisch grob → hydraulisch → thermisch fein. Das entspricht
der Natur (Verwitterung, Abtrag, Nachrutschen) und liefert das beste Bild.

## Zwei Betriebsarten

1. **Globaler Pass** mit Reglern: Stärke, Anzahl Tropfen, Härtevarianz,
   Böschungswinkel, „Feature-Größe" (Wirkradius). Auf 1024er Karten ist das
   Sekundenarbeit — deshalb **zeitgeschnitten** über mehrere Bilder mit
   Fortschrittsanzeige und Abbruch. Deterministisch bleibt es, weil die
   Tropfenreihenfolge fest ist, nicht an die Bildrate gekoppelt.
2. **Pinsel**: Erosion nur im Kreis, für gezielte Nachbearbeitung („diese Flanke
   soll zerfurcht sein"). Nutzt die Regionsmechanik aus Runde H — nur die
   berührte Box wird neu berechnet, und der Undo-Schnappschuss ist entsprechend
   klein.

## Einbettung

- **Undo**: ein Schritt (die Regionslogik existiert seit H1e).
- **Flüsse**: `rebuildRivers` schneidet danach wie gehabt ein; erodiertes Gelände
  hat aber bereits Talböden, in denen die Flüsse plausibel liegen.
- **Weltgenerator**: Reihenfolge wird `genBase → Erosion → Flüsse aus dem
  Abflussfeld → Siedlungen → Straßen → Vegetation → Arbor`. Das ist der Punkt,
  an dem der Generator von „gewürfelt" zu „gewachsen" kippt.
- **Biom-Ableitung** liest `abfluss` als Feuchte.
- **Vegetation**: `sediment` erhöht die Walddichte in Talböden, `haerte`
  senkt sie auf Fels.

## Grenzen, die ich benenne

Vollwertige Erosion auf 1024² ist teuer; auf einem Software-Rasterizer (der
aktuelle Testfall) ist der globale Pass unangenehm langsam. Deshalb: Standard
sind moderate Tropfenzahlen, die Regler gehen höher, und die Anzeige nennt die
geschätzte Dauer. Ein Web Worker wäre die saubere Lösung — aber Terra hat keinen
Build-Schritt, und ein Worker als eigene ES-Modul-Datei müsste die halbe
Rechenkette doppelt importieren. Zeitschnitt ist der ehrlichere Weg.

## Aufwand
**[M]** für beide Verfahren und den Pinsel, **[K]** je Anschluss (Weltgenerator,
Biom-Ableitung, Vegetation).

---

# I4 — Beschriftung mit klickbarem Wiki-Link

## Warum das mehr ist als „Text anzeigen"

Terras Marker haben heute HTML-Labels. Die sind scharf und billig, haben aber
zwei Mängel: Sie erscheinen **nicht im PNG-Export**, und sie liegen als
Fremdkörper über dem Bild statt darin.

Der Entwurf löst beides und ergänzt das, was der Nutzer will: **Anklickbar, mit
Sprung in den Wiki-Artikel.**

## Aufbau

**Beschriftung als Element**, nicht als Marker-Anhängsel:

```
{ kind:"marker", variant:"beschriftung",
  points:[{x,z}],
  params:{ text:"Hafen von Ost",
           klasse:"ort",          // ort | region | gewaesser | gebirge | gefahr | arbor
           groesse:1.0,
           ziel:{ art:"wiki"|"extern"|"keins", ref:"hafen-von-ost" } } }
```

Das Feld `ziel` ist bewusst zweiteilig: Solange Terra eigenständig läuft, ist
`art:"extern"` eine URL. Sobald Terra in UWE sitzt, wird `art:"wiki"` zu einer
Seitenreferenz — **ohne Formatänderung**. Genau dafür ist das Feld so geschnitten.

## Darstellung: gezeichnet, nicht überlagert

- **Sprite mit Canvas-Textur** in der Szene, damit die Beschriftung im Bild und
  damit auch im PNG-Export landet.
- **Typografie nach Kartenkonvention**, je Klasse verschieden:
  Regionen groß, weit gesperrt, Versalien; Orte kleiner mit Punktsignatur davor;
  Gewässer kursiv und in der Wasserfarbe; Gebirge gesperrt und dem Grat folgend;
  Gefahr in warmem Rot. Das ist der Teil, der aus „Text auf Karte" eine
  Kartenbeschriftung macht.
- **Papier-Kontur** hinter der Schrift (heller Saum), damit sie auf jedem
  Untergrund liest — Terra hat dafür bereits die Farbwerte.
- **Maßstabsbindung** (siehe I1): Eine Ortsbeschriftung erscheint erst unterhalb
  eines Maßstabs, eine Regionsbeschriftung verschwindet darüber. Beschriftungen
  sind das erste, was maßstabsabhängig ein- und ausgeblendet wird.

## Gebogene Beschriftungen

Ausbaustufe, aber im Entwurf mitgedacht: Text entlang eines Pfades (Fluss, Küste,
Gebirgszug). Umsetzung als **Kette von Einzelglyphen-Quads** entlang der Kurve,
jede mit eigener Drehung; die Kurve kommt aus dem verknüpften Element (ein
Fluss-Pfad kann seine eigene Beschriftung tragen). Kein Fremdcode nötig — die
Glyphen kommen aus demselben Canvas-Verfahren, nur einzeln.

## Kollisionsvermeidung

Echte Karten lassen Beschriftungen weg, statt sie überlappen zu lassen. Terra
bekommt das gleiche: Beschriftungen haben eine **Priorität** (Klasse + Größe);
beim Aufbau wird im Bildraum geprüft, wer wen überdeckt, und die schwächere wird
ausgeblendet. Muss pro Kamerabewegung neu bewertet werden — gedrosselt auf ein
paar Mal pro Sekunde, nicht pro Bild.

## Der Klick

- **Treffererkennung per Raycast** auf das Sprite, nicht über ein HTML-Overlay.
  Grund: kein DOM-Abgleich, funktioniert auch im Vollbild und bei
  Kamerafahrten, und der Aufnahme-Modus bleibt sauber.
- **Zeigerwechsel bei Überfahrt** (der Raycast läuft ohnehin gedrosselt für die
  Elementauswahl).
- **Öffnen** in neuem Fenster: `window.open(url, "_blank", "noopener,noreferrer")`.
- **Sicherheit**: Nur `http:`/`https:` werden geöffnet; alles andere (besonders
  `javascript:`) wird beim Laden abgelehnt — die Validierung gehört in
  `validiereKarte`, damit eine fremde Kartendatei keinen Klick-Angriff mitbringen
  kann. Das ist wichtig, weil Karten geteilt werden sollen.
- **Im Aufnahme-Modus und beim PNG-Export** sind Beschriftungen sichtbar, aber
  nicht klickbar (kein Zeigerwechsel) — das Bild soll ein Bild sein.

## Bedienung
Werkzeug **Beschriftung**: Klick setzt, Text und Klasse im Panel, Zielfeld mit
Auswahl (kein Ziel / URL / Wiki-Seite). Doppelklick auf eine bestehende
Beschriftung öffnet die Bearbeitung, Entf löscht.

## Aufwand
**[M]** für Sprites, Klassen, Klick und Sicherheit. **[M]** zusätzlich für
gebogene Beschriftungen. **[K]** für die Kollisionsvermeidung.

---

# I5 — Tests

## Ausgangslage

Terra hat **null automatisierte Tests**. Bei 29 Modulen, einer
Determinismus-Zusage, Formatkompatibilität über vier Versionen und einer
Shader-Patch-Kette, die an einer gepinnten Three-Version hängt, ist das die
größte Risikolücke des Projekts. Die bisherigen Prüfungen liefen als
Wegwerf-Skripte im Scratchpad — sie haben mehrfach echte Fehler gefunden und
sind danach verschwunden.

## Rahmen: passend zu einem Projekt ohne Build-Schritt

- **Runner**: `node --test` (eingebaut, keine Abhängigkeit).
- **Three-Ersatz**: ein Loader-Haken stubbt `three`, damit reine Logikmodule
  (rng, store, generators, io) ohne Browser laufen. Die Wegwerf-Skripte der
  letzten Runden haben genau das schon gemacht — hier wird es fest.
- **Ort**: `terra/test/`, aufrufbar mit `node --test terra/test` aus dem
  Repo-Wurzelverzeichnis, ohne pnpm-Workspace. Terra bleibt eigenständig.
- **Kein CI-Zwang zu Beginn**: Die CI des Repos ist derzeit repo-weit rot; die
  Tests müssen zuerst lokal verlässlich laufen.

## Was geprüft wird — fünf Ebenen

### 1. Determinismus (die wichtigste)
Gleiche Seed, gleiche Karte, zweimal erzeugt → **identischer Hash** über alle
`emit`-Argumente und alle Geometrie-Attribute. Je Generator ein Fall, dazu ein
Gesamtlauf über eine Beispielkarte. Fängt genau die Fehlerklasse, die bei jedem
Umbau der Generatoren droht.

### 2. Formatkompatibilität
Feste Beispieldateien in `terra/test/fixtures/` für v1 (Einzeldatei), v2, v3, v4
— und künftig v5. Jede muss laden, eine erwartete Elementzahl ergeben und einen
Speicher-Ladezyklus unverändert überstehen. Dazu die Fehlerfälle: kaputtes JSON,
NaN in der Kamera, ungültige Zugpunkte, unbekanntes Biom — jeder muss **atomar**
scheitern, also den Zustand unangetastet lassen.

### 3. Generator-Invarianten
Keine Platzierung im Wasser, nichts über 40° Hang, nichts im Korridor;
Instanzdeckel eingehalten; `InstancedMesh.count` gleich der Belegung; keine NaN
in Position, Farbe oder Normale; jede referenzierte Poolnamen existiert.

### 4. Shader-Anker
Alle Patch-Anker (`#include <…>`) müssen in der **gepinnten** Three-Version
vorhanden sein, und jeder Patch muss greifen. Das ist der Test, der einen
Three-Upgrade laut scheitern lässt statt still das Bild zu ruinieren — genau der
Fehler, den die Ankerprüfung zur Laufzeit nur meldet, wenn jemand die Konsole
liest.

### 5. Registry-Konsistenz
Jedes Biom verweist auf existierende Pools; jeder Pool ist in mindestens einer
Gruppe erreichbar; jeder Schemaschlüssel in `tools.js` wird von einem Generator
gelesen und umgekehrt; die Palettenrampen enthalten keine undefinierten Farben.
Billig zu schreiben, verhindert die Klasse Fehler, die erst beim Klicken
auffällt.

## Sichtprüfung als zweite Stufe

Die Playwright-Prüfung aus der letzten Runde wird fest: lädt den Editor, schaltet
Tageszeiten, Wetter und Biome durch, prüft **0 Konsolenmeldungen, 0 Seitenfehler,
`terraPatchInfo` vollständig** — und legt **Regressionsbilder** ab. Beim nächsten
Lauf Pixelvergleich mit Toleranz; Abweichungen über der Schwelle werden als
Bilddiff gespeichert.

Damit wäre der UV-Bug aus Runde B (Kronen opak, Gras unsichtbar) beim ersten Lauf
aufgefallen — er war headless unsichtbar und hat eine ganze Runde gekostet.

## Reihenfolge
Determinismus und Formatkompatibilität zuerst (sie sichern die Zusagen, die im
Projekt schriftlich stehen), dann Registry und Anker (billig), dann Invarianten,
zuletzt die Bildregression.

## Aufwand
**[M]** für die Ebenen 1–5, **[M]** für die Bildregression samt Referenzbildern.

---

# Reihenfolge der Runde

1. **I5 Tests, Ebene 1–3** — zuerst, weil alles Folgende Generatoren anfasst
2. **I3 Erosion** — hebt Gelände und Weltgenerator, Voraussetzung für I2s Feuchte
3. **I2 Biomflächen** samt Ableitung
4. **I4 Beschriftung** — sichtbarster Gewinn pro Aufwand
5. **I1 Ebenen-Hierarchie** in drei Schritten (Format/Baum → Höhenableitung →
   Signaturen), der große Wurf zum Schluss
6. **I5 Bildregression** nachziehen, sobald das Bild wieder stabil ist

Anmerkung zur Kopplung: I3 liefert das Abflussfeld, das I2 als Feuchte nutzt; I1
braucht die Maßstabslogik, auf die sich I4 (Ein-/Ausblenden von Beschriftungen)
stützt. Die Reihenfolge ist deshalb nicht beliebig.
