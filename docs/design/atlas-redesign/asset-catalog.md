# Atlas — Gouache-Asset-Katalog (Backlog)

Wunsch- und Ideenliste für die Gouache-Asset-Bibliothek (Phase 2 des
[Gouache-Plans](../../engineering/atlas-gouache-plan.md)). **Spezifikation, kein
Code** — dies ist der Vorrat, aus dem die Asset-Rezepte (`packages/atlas/src/assets.ts`)
nach und nach entstehen.

**Umsetzungs-Tags** (wie das Asset in die Engine passt):

| Tag | Bedeutung |
|---|---|
| `Stamp` | Einzelobjekt zum Platzieren (`AtlasObject`) |
| `Plot` | Flächenfüllung über „Objektbereich füllen" (`scatterGlyphsInPolygon`) |
| `Path` | pfad-/routenbasiert (wie `river`/`road`, ggf. neues `AtlasFeatureKind`) |
| `Landmark` | große Pseudo-3D-Landmarke — Schattenwurf/Höhen-Aura wie die Ranke (`vine.ts`) |
| `Gen` | Baustein des Stadt-/Schloss-Generators (`settlement.ts`) |
| `Terrain` | Biom-/Untergrund-Textur (`tileLayer` + `paintTerrainBlobs`) |

> **Fett** = von dir ausdrücklich gewünscht. Flug-/Schwebe-Objekte erben das
> Höhen-Stilmittel der Ranke (langer Schattenwurf + optionale Wolken-Aura),
> damit „schwebt hoch" ohne echtes 3D lesbar wird.

---

## 1 · Flächen & Biome (`Plot` / `Terrain`)

- **Weideland** `Plot`/`Terrain` — Grasfläche mit vereinzelten Büschen, Zäunen, grasenden Tieren.
- **Getreidefelder** `Plot` — parzellierte Äcker mit Ährenstruktur, Feldwegen, evtl. Vogelscheuche.
- **Sumpf** `Plot`/`Terrain` — Tümpel, Schilf, Totholz, Nebelschwaden, Weidenstümpfe.
- Weinberg — terrassierte Rebzeilen an Hängen.
- Obstplantage / Obstgarten — Reihen aus Obstbäumen.
- Reisterrassen — gestufte, wassergefüllte Felder.
- Lavendel-/Blumenfeld — farbige Streifen (nutzt Untergrund-Intensität).
- Heide / Moor — niedriges Buschwerk, dunkle Tümpel.
- Dünen / Sandwüste — Windrippel, vereinzelte Kakteen.
- Nadelwald / Laubwald / Urwald — dichte Baumbestände (bereits als Baum-Presets).
- Verbrannter / toter Wald — kahle, schwarze Stämme.
- Pilzwald — überdimensionale Pilze (Fantasy-Biom).
- Schilfgürtel / Auenland — Uferbewuchs entlang Gewässern.
- Steppe / Tundra — karges Grasland, Findlinge.

## 2 · Landformen & Relief (`Landmark` / `Terrain`)

- **Schluchten** `Terrain`/`Landmark` — Canyon/Mesa mit Schichtkanten und Schattenwurf in die Tiefe.
- Klippen / Steilküste — abfallende Felskante mit Brandung.
- Wasserfall — vertikaler Fluss-Sturz (Path-Endpunkt + Gischt).
- Vulkan (aktiv) — Kegel mit Rauch/Lava-Glut.
- Krater / Meteoreinschlag — Ringwall, evtl. glühender Kern.
- Höhlen-/Minen-Eingang — dunkles Portal im Fels.
- Gletscher / Eisfeld — bläuliches Eis mit Spalten.
- Felsbogen (Natural Arch) — freistehender Steinbogen.
- Felsnadeln / Hoodoos — hohe, schmale Gesteinssäulen.
- Heiße Quellen / Geysir — dampfende Becken.

## 3 · Fantasy-Landmarken (`Landmark`, Pseudo-3D)

- **Fliegende Inseln** `Landmark` — schwebende Felsbrocken mit Bewuchs, langem Schatten am Boden, evtl. Wasserfall ins Nichts; als Cluster gruppierbar.
- **Riesenschildkröte mit Schloss auf dem Rücken** `Landmark` — wandelnde Festung; Panzer + Türmchen + Schattenwurf.
- Weltenbaum / Riesenranke — bereits umgesetzt (`vine`), hier als Referenz.
- Schwebender Kristall / Magie-Monolith — leuchtender Kristall mit Aura.
- Schwebende Ruine / Himmelsburg — Trümmer, die in der Luft hängen.
- Portalbogen / Sternentor — magischer Torbogen, schimmernd.
- Runen-Obelisk / Menhir-Steinkreis — antike Steinsetzung.
- Drachenhorst / Nest — Klippennest mit Ei/Drache.
- Riesenpilz-Dorf — bewohnte Übergroß-Pilze.
- Versteinerter Titan / Kolossruine — halb verschütteter Riese.
- Magier-Leuchtturm / Sternwarte — Turm mit Lichtstrahl.
- Feenring / Elfenlichtung — Pilzkreis mit Lichtfunken.
- Zwergen-Bergtor — monumentales Tor im Berg.
- Schwimmende Stadt / Seerose-Siedlung — Bauten auf dem Wasser.

## 4 · Siedlung, Gebäude & Antike (`Stamp` / `Gen`)

- **Ruinen** `Stamp`/`Gen` — eingestürzte Mauern, Säulenstümpfe, überwuchert.
- **Pyramide** `Stamp`/`Landmark` — Stufen- oder Glattpyramide, evtl. mit Tempel-Eingang.
- Kirche / Kathedrale `Gen` — Langhaus + Glockenturm (bereits im Generator).
- Kloster / Abtei `Gen` — Klosterhof mit Kreuzgang.
- Burg / Festung `Gen` — Bergfried, Ringmauer, Zwinger.
- Wach-/Signalturm `Stamp` — einzelner Turm mit Feuerkorb.
- Windmühle / Wassermühle `Stamp` — Flügelrad / Mühlrad am Bach.
- Schmiede, Taverne, Bäckerei `Gen` — Sondergebäude im Stadtnetz.
- Gehöft / Bauernhof + Scheune `Stamp`/`Gen` — Hofensemble mit Feldern.
- Stadttor / Torhaus `Gen` — Durchlass in der Mauer mit Fallgitter.
- Brücke (Stein/Holz/Zugbrücke) `Stamp`/`Path` — Fluss-/Schluchtquerung.
- Aquädukt `Path` — Bogen-Wasserleitung über Land.
- Amphitheater / Kolosseum `Stamp` — antikes Rund.
- Tempel / Ziggurat `Stamp`/`Landmark` — Stufentempel.
- Krypta / Mausoleum / Grabhügel `Stamp` — Bestattungsbau.
- Bergwerk / Steinbruch `Stamp`/`Gen` — Förderturm, Abraumhalden.
- Galgen / Richtplatz `Stamp` — Ortsmarker (Grim).
- Palisadendorf / Nomadenlager (Jurten, Zelte) `Gen` — leichte Bauweise.

## 5 · Marktstände — Varianten (`Stamp` / `Gen`)

- **Verschiedene Marktstände** — Kategorien mit eigener Farbmarkierung:
  Obst/Gemüse · Fisch · Fleisch/Metzger · Brot/Bäcker · Gewürze ·
  Stoffe/Textil · Töpferwaren · Schmuck · Waffen/Schmied ·
  Kräuter/Alchemist · Blumen · Vieh · Wein/Met · Bücher/Schriftrollen.
- Brunnen, Marktkreuz, Pranger, Verkaufskarren (fahrbarer Stand).

## 6 · Fahrzeuge & Bewegtes (`Stamp`)

- **Flugschiffe** `Stamp`/`Landmark` — Luftschiff mit Ballon/Segeln + Bodenschatten (schwebt).
- **Schiffe** `Stamp` (Wasser) — Fischerboot, Handelskogge, Kriegsgaleere, Floß, Fähre, Gondel.
- **Pferdekarren** `Stamp` — Handkarren, Ochsenkarren, Postkutsche.
- Karawane (Kamele/Lastenzug) `Stamp` — Handelszug in der Wüste.
- Reiter / berittene Patrouille `Stamp` — bewegter Punkt-Marker.
- Magie-/Heißluftballon, Gleiter `Stamp`/`Landmark` — weitere Flug-Objekte (schweben).

## 7 · Wege & Routen (`Path`)

- **Fliegende Zugstrecke** `Path`/`Landmark` — Trasse in der Luft: schwebende Pylone + Schienenband + langer Bodenschatten; nutzt das Ranken-Höhenstilmittel.
- Handelsstraße / Pilgerweg / Karawanenpfad — verschiedene Straßen-Stile (Belag/Strich).
- Seeroute — gestrichelte Route übers Wasser (Schiffsweg).
- Eisenbahn (bodengebunden) / Seilbahn — Schienen bzw. Seil mit Masten.
- Grenzwall / Mauer mit Türmen — Auto-Objektsäumung entlang eines Pfads (existiert bereits: `path-attachments`).

---

## Engine-Einordnung (Zusammenfassung)

- **Neue `Plot`-Presets** (Biome/Felder) hängen an „Objektbereich füllen" (Phase 2) — kein neues Schema, nur Rezepte + Scatter-Parameter.
- **`Landmark`/Flug-Objekte** teilen sich die Pseudo-3D-Mechanik der Ranke (`vine.ts`: Schattenwurf, optionale Höhen-Aura) — kein echtes 3D.
- **`Gen`-Bausteine** erweitern den Stadt-/Schloss-Generator (`settlement.ts`, Phase 3).
- **`Path`-Routen** folgen dem `river`/`road`/`vine`-Muster; Flug-Routen bekommen zusätzlich den Höhen-Schatten.
- **Marktstand-Kategorien** sind Varianten **eines** Rezepts (Farbe/Ware als Parameter) — nutzt die vorhandene deterministische Objekt-Variation.
