# Terra — Ideenwelle 2

Vorschläge nach Abschluss von Runde H (27.07.2026). Bewusst **keine** Wiederholung der offenen Roadmap-Punkte (restliche Objektbündel, genBurg/genWerft, LOD, Wetter/Jahreszeiten, Kantenhierarchie …) — das hier sind neue Gedanken, sortiert nach Wirkung pro Aufwand.

---

## A — Die drei Ideen, die ich zuerst bauen würde

### A1. Weltgenerator: eine ganze Karte auf Knopfdruck
Heute beginnt jede Karte als leeres Wiesenland; alles Erzählerische ist Handarbeit. Ein Generator, der aus Seed + Biom eine **vollständig bestückte Karte** baut, würde den Editor von einem Zeichenwerkzeug zu einem Ideengeber machen — und ist mit dem Vorhandenen fast geschenkt, weil alle Bausteine existieren:

1. Höhenfeld steht schon (`genBaseIn` mit Biomprofil).
2. **Flüsse aus dem Gefälle ableiten**: Steilster Abstieg von zufälligen Hochpunkten bis zum Wasser, Pfade zusammenführen, als `pfad/fluss`-Elemente einsetzen. Senken werden zu Seen.
3. **Siedlungen an plausible Orte**: Flussmündung, Furt, Küstenbucht, Passhöhe — bewertet über Höhe, Hangneigung, Wassernähe. Daraus `flaeche/viertel` mit passendem Baustil.
4. **Straßen zwischen Siedlungen** über die Wegfindung (siehe A2).
5. **Arbor zuletzt**: 2–5 Ranken an markanten Punkten, mit `kernzug` zur Mitte — der Kanon wird sichtbar, ohne dass jemand ihn kennen muss.

Ergebnis: „Neue Welt würfeln" liefert eine Karte, die man danach von Hand verfeinert. Für ein Werkzeug, dessen Ergebnis geteilt wird, ist das der größte Sprung.

### A2. Wege, die sich ihren Verlauf suchen
Straßen sind heute freihändige Linien. Eine A*-Suche auf dem Höhenfeld mit Kosten aus **Steigung** (teuer), **Wasserquerung** (sehr teuer, erzeugt automatisch eine Brücke), **vorhandenen Wegen** (billig — Wege bündeln sich) und **Korridoren** würde aus zwei geklickten Punkten einen Weg machen, der *gewachsen* aussieht. Das ist genau der Ghibli-Unterschied zwischen gezeichnet und bewohnt, und es ist billig: das Höhenfeld ist da, die Bandgeometrie ist da, Brücken baut `bandAusLinie` schon selbst.

### A3. Stempel — eigene Kompositionen wiederverwenden
Ein „Dorf mit Mauer und Feldern" ist heute jedes Mal Handarbeit. Mit einer Mehrfachauswahl und einem **Stempel** (Gruppe von Elementen relativ zu einem Ankerpunkt, gespeichert im Kartenformat oder in einer eigenen Bibliothek) baut man einmal und setzt beliebig oft — jeweils mit neuer Seed, also nie identisch. Kosten: Mehrfachauswahl, ein Transform beim Einsetzen (Position/Drehung/Spiegelung), Bibliothek als JSON. Das ist der stärkste Produktivitätshebel, den der Editor noch nicht hat.

---

## B — Setting: Arbor weiterdenken

### B1. Arbor-Netzwerk
Ranken, die zusammenwachsen, bilden bereits Bündel. Der nächste Schritt: Ein **Netz über die ganze Karte** — welche Ranken sind (über gemeinsame Bündel oder Blattbrücken) verbunden? Daraus folgt zweierlei: Die Lichtstärke einer Ranke könnte mit ihrer Vernetzung steigen (isolierte Triebe leuchten schwächer), und die Karte bekäme eine erzählerische Struktur — Zentrum und Peripherie.

### B2. Wachstum als Zeitachse
Ein Regler `alter` (0–1) je Ranke, der Höhe, Dicke, Plateauzahl und Bewuchs gemeinsam steuert. Beim Setzen fährt er in zwei Sekunden hoch — die Ranke **wächst** sichtbar aus dem Boden. Deterministisch bleibt es, weil das Alter nur ein Parameter ist. Nebeneffekt: Man kann eine Karte in zwei Zuständen zeigen („vor 100 Jahren / heute").

### B3. Die Karte altern lassen
Derselbe Gedanke für die ganze Welt: ein `verfall`-Parameter, der Gebäude durch ihre Ruinenvarianten ersetzt (der `bruchkante`-Helfer macht aus jedem Bestandsteil eine Ruine), Wege überwuchern und Vegetation vordringen lässt. Ein Regler, zwei Erzählungen.

### B4. Schwerkraft an den Bruchkanten
Der Planet ist zerrissen — in Kantennähe könnten kleine Objekte leicht **schweben und driften** (Vertex-Offset im Shader, Stärke aus der Bruchmaske, die es seit Runde H gibt). Sehr billig, sehr sprechend: Man sieht der Kante an, dass dort etwas nicht stimmt.

### B5. Plateau-Ansicht
Die Blattplateaus tragen Städtchen, die man aus der Kartenperspektive kaum sieht. Ein Doppelklick auf ein Plateau könnte die Kamera **hinauffahren** und dort eine zweite Arbeitsebene öffnen (dieselben Werkzeuge, Bezugsfläche ist das Blatt statt das Terrain). Aufwendig, aber es macht aus einem Detail einen Ort.

---

## C — Bild und Stimmung (über die Ghibli-Punkte der Roadmap hinaus)

### C1. Godrays durch Wolkenlücken
Lichtstrahlen sind in den Vorlagen allgegenwärtig und in Screen-Space billig (radiales Blur von der Sonnenscheibe, maskiert durch die vorhandene Tiefentextur). Bei Abendrot und im Nebelwald wäre das der stärkste Einzelgewinn — und es passt zum Kanon, wenn nachts die Ranken statt der Sonne strahlen.

### C2. Farbskript pro Karte
Drei Farben als Kartenparameter (Licht / Mitten / Schatten), die alle Materialien und das Grading leicht zu sich ziehen. Damit bekommt eine Karte einen eigenen „Filmlook", ohne dass man 25 Biompaletten anfassen muss — und zwei Karten desselben Bioms sehen unterschiedlich aus.

### C3. Papierkante statt Vignette
Der Rand der Ansicht könnte wie ein **Blatt Papier** auslaufen (unregelmäßige Kante, leichte Körnung), statt technisch abzudunkeln. Ein Post-Effekt, der das Bild als Malerei rahmt — besonders im PNG-Export.

### C4. Wasser mit gemalter Spiegelung
Statt Reflexion: Der Himmel wird als **wenige helle Streifen** ins Wasser gemalt, die sich mit der Welle verschieben (Muster: die vorhandenen Wogen). Ghibli-Wasser ist Farbfläche plus Akzente — dafür braucht es keine Spiegelung, nur die richtigen Striche.

### C5. Vogelschwärme reagieren
Die Schwärme fliegen heute stur. Sie könnten Ranken umkreisen, an Küsten entlangziehen und beim Setzen eines Elements auffliegen — kleine Lebendigkeit, die den Unterschied zwischen Modell und Ort macht.

---

## D — Werkzeug und Verlässlichkeit

### D1. Kartenlegende und Marker
Benannte Punkte („Hafen von Ost", „Bruchkante der Ersten Nacht") mit kurzem Text, im Format gespeichert, im PNG-Export als Legende ausgebbar. Für die spätere UWE-Nutzung (Kampagnenkarten mit Notizen) ist das die zentrale Brücke — und im Editor selbst hilft es beim Navigieren großer Karten.

### D2. Höhenkarte importieren
Ein PNG als Höhenfeld einlesen (Graustufen → `base`), damit vorhandene Kartenentwürfe oder echte Geografie als Ausgangspunkt dienen können. Klein umzusetzen, großer Nutzen für Leute mit fertigen Skizzen.

### D3. Vorschaubilder ohne Browser
Ein Headless-Renderer (Node + `gl`/`headless-gl` oder Puppeteer) erzeugt aus einer Karten-JSON ein Vorschaubild. Voraussetzung für jede Galerie — und exakt das, was eine UWE-Einbindung braucht, um Karten in Listen zu zeigen.

### D4. Regressionsbilder im CI
Je Tageszeit und ausgewähltem Biom ein Referenzbild, Pixel-Diff bei jedem PR. Der UV-Bug aus Runde B war headless unsichtbar und hat eine ganze Runde gekostet; das hier fängt genau diese Klasse.

### D5. Leistungsbudget sichtbar machen
Die Statuszeile zeigt Zahlen, aber keine Grenzen. Eine kleine Anzeige „Instanzen 61 %, Draw Calls 38 %" mit Warnschwelle würde verhindern, dass eine Karte unbemerkt in den Instanzdeckel läuft (der heute stumm kappt).

### D6. Autosave und Wiederherstellung
Die letzten drei Stände im LocalStorage, beim Start angeboten. Ein Absturz kostet heute die ganze Sitzung.

---

## E — Wenn der Editor mehr sein soll als ein Editor

### E1. Spielersicht
Ein Umschalter, der Marker, Griffe und Hilfslinien ausblendet und optional Bereiche verdeckt (Nebel des Krieges als Maske, dieselbe Mechanik wie die Bruchmaske). Damit wird aus der Arbeitskarte eine Spieltischkarte.

### E2. Kamerafahrten aufzeichnen
Wegpunkte setzen, Dauer wählen, als WebM/GIF exportieren. Für ein Werkzeug, dessen Ergebnis geteilt wird, ist eine 10-Sekunden-Fahrt über die Karte mehr wert als zehn Screenshots.

### E3. Karte als Datei, Welt als Sammlung
Mehrere Karten mit gemeinsamer Weltseed und Nachbarschaftsbeziehung („östlich von …") — die Grundlage für einen Atlas statt einzelner Bilder. Passt zur UWE-Einbindung und braucht im Format nur ein paar Felder.

---

# F — Näher an ein echtes Ghibli-Filmbild

Antwort auf die Frage „was brauchen wir, um so nah wie möglich an den Filmlook zu kommen — sind es die Assets?". Kurz: **Die Assets sind rund ein Drittel.** Die größere Lücke liegt darin, dass ein Filmhintergrund *gemalt* ist und unser Bild *berechnet* wird. Fünf Hebel, nach Wirkung sortiert.

## F1 — Palettenbindung: gemalt statt beleuchtet
Oga malt ein Bild mit 21–24 Farben; ein Mensch entscheidet jeden Wert danach, ob die Silhouette davor liest. Unser Renderer liefert stufenlose Verläufe aus Geometrie und Licht — deshalb wirkt selbst gutes stilisiertes 3D „errechnet".

Gegenmittel: ein finaler Pass, der das Bild auf eine **kartenweite Palette zieht**. Gradient-Mapping über die Luminanz plus milde Farbquantisierung mit ordered Dithering; Stärke regelbar, Default dezent. Das Farbskript (C2) verschiebt Farbtöne — hier geht es darum, die *Anzahl* der vorkommenden Töne zu begrenzen. Zusammen ergibt das den Sprung.

## F2 — Pinselstruktur gehört in den Bildraum
Echter Konflikt mit unserer Regel „Texturen in Welteinheiten": Für Materialidentität ist sie richtig, aber **Pinselstriche skalieren mit der Leinwand, nicht mit dem Motiv** — auf einem Gemälde ist der Strich am fernen Berg so breit wie der im Vordergrund. Unsere Aquarellschicht wird mit der Entfernung feiner und verschwindet, die Ferne wirkt dadurch glatt.

Lösung: beides. Weltraum-Textur bleibt fürs Material, dazu eine **bildraumfeste Malschicht** (im Post-Pass oder als Screen-Space-Anteil im Materialpatch), deren Körnung mit der Entfernung nicht schrumpft.

## F3 — Multiplane statt kontinuierlicher Tiefe
Ghibli staffelt in drei bis vier **diskrete Ebenen** (Vordergrund, Mittelgrund, Ferne, Himmel), jede mit eigener Sättigung, eigenem Wertebereich und eigener Kantenschärfe. Wir haben stufenlosen Nebel.

Umsetzung: Tiefe in Bänder quantisieren (Tiefentextur existiert seit Runde D), je Band ein Sättigungs- und Werteoffset, Bandgrenzen im Nebel versteckt. Ergibt die gestaffelte Ruhe der Vorlagen statt gleichmäßigen Wegblendens.

## F4 — Komponierte Kamera (Aufnahme-Modus)
Ein Filmhintergrund ist für genau **eine** Kameraposition gemalt; freie Orbitkamera heißt: keine Komposition. Ein Aufnahme-Modus rastet auf eine komponierte Einstellung ein — langes Objektiv, Horizont auf ein Drittel, angeschnittenes Vordergrundelement, Blick auf ein Motiv ausgerichtet. Für Standbild, PNG-Export und Vorschaubilder ist das der größte Gewinn pro Aufwand, größer als jeder Shader.

## F5 — Bewegungsdisziplin
Bei uns schwingt alles gleichzeitig. In einem Ghibli-Hintergrund ist fast alles **still**, und eine Sache bewegt sich. Konkret: globale Windamplitude senken, dafür einzelne Nester (ein Grasbüschel, eine Krone, ein Vorhang) deutlich stärker animieren; Wolken langsamer; Vögel nur gelegentlich.

## F6 — Was die Assets beitragen müssen
Nicht Detailgrad, sondern **Formensprache**:
- Wenige große Formen statt vieler kleiner (ein Fels sind drei Flächen), mit bewusster Übertreibung — gestauchte Proportionen, schiefe Dächer, ausgebeulte Kronen.
- Silhouette vor Oberfläche: Jedes Objekt muss als schwarze Fläche lesbar sein; Kronen brauchen ein bis drei ausbrechende Blattgruppen.
- Handgemalte Kronenkarten statt Rauschen — dort lohnt echte Handarbeit am meisten.
- Gebrauchsspuren an jedem größeren Objekt (Moos am Sockel, Laub am Fuß, getretene Ränder), sonst bleibt der „platziert"-Eindruck.

## F7 — Kalibriermethode: Übermalen
Wirksamer als jede Theorie: einen Screenshot zwanzig Minuten lang übermalen, bis er gefällt. Die Differenz zwischen Übermalung und Original **ist** die Liste dessen, was der Renderer noch nicht kann. Genau der Abgleich, den die Ghibli-nahen Spieleprojekte gemacht haben.

**Erwartungshaltung:** „Ununterscheidbar vom Filmbild" ist nicht erreichbar — ein Gemälde für eine Kamera schlägt Echtzeit aus jeder Kamera. Erreichbar ist **ein Gemälde, das sich bewegt**.
