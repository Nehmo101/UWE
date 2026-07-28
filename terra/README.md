# terra — Fantasy-Karteneditor

Prozeduraler Karteneditor auf Three.js (ES-Module, Import Map, gepinnt auf
`three@0.185.1` von jsDelivr). Kein Build-Schritt, keine weiteren
Abhaengigkeiten; alle Texturen entstehen beim Start im Canvas.

## Starten

Einen statischen Server im Ordner `terra/` starten, z. B.:

```bash
cd terra
python3 -m http.server 8000
```

Dann <http://localhost:8000> im Browser oeffnen (Chrome oder Firefox).
Die Three-Module kommen beim ersten Start vom CDN und liegen danach im
Browser-Cache.

## Bedienung

Werkzeuge 1-6 (Pfad, Flaeche, Objekt, Ranke, Terrain, Auswahl), WASD/Pfeile
bewegen, Q/E drehen, Mausrad zoomt, rechte Maustaste schwenkt. Doppelklick
oder Enter schliesst eine Zeichnung ab, Esc bricht ab, Entf loescht die
Auswahl (bzw. den golden markierten Punktgriff), Strg+Z / Strg+Y fuer
Undo/Redo. Im Auswahl-Werkzeug fuegt ein Doppelklick auf ein Segment einen
Punkt ein.

Untere Leiste: Seed, Biom (Wiese/Wueste/Kueste/Sumpf/Schnee), Tageszeit
(Morgen/Mittag/Abendrot/Nebel/Nacht), Raster, Effekte (Nachbearbeitung
an/aus), Wolken an/aus, Vollbild, Speichern/Laden (JSON, Formatversion 3
mit Hoehen-Delta) und PNG-Export. Eingebettet im Studio speichert
„Speichern" in die Datenbank; die JSON-Datei kommt nur mit gesetztem
JSON-Haekchen (im Einzelbetrieb ist sie der einzige Speicherweg und das
Haekchen fest gesetzt). Karten aus der frueheren Einzeldatei-Fassung
(`terra.html`, v1) und der v2-Fassung laden weiterhin; ihre Bestueckung
wuerfelt unter v3 einmalig um (ortsstabile Zufallsschluessel).

Ranken: Parameter fuer Dicke (bis 8 — der Plateau-Deckel waechst mit, bis
12 Blattplateaus), Hoehe bis 1000, Stil (geflochten/glatt), Luftwurzeln,
Stadt-Baustil und -Dichte auf den Blattplateaus, Wendeltreppe und
Haengebruecken. Objekt-Werkzeug: Variante "Schwebeinseln" und "Nur Typ"
(nach Objektart gegliedert); ein Klick auf ein Blattplateau setzt die
Streuung OBEN auf der Blattflaeche ab (params.aufPlateau). Das Karten-Panel
(Auswahl ohne Auswahl) traegt Kartenname und Massstab (Ort/Landschaft/
Region/Kontinent); die Hinweisbox unten links laesst sich ausblenden.

## Offener Stand

- Detailrunde (Nachtrag zur Bedienungsrunde): definePool veredelt jetzt ALLE
  272 Pools mit zwei deterministischen Farbschichten (Facetten-Tonung je
  Flaechenrichtung + niederfrequente Farbdrift ueber die Lage) — null
  zusaetzliche Dreiecke. Strukturell: dichtere Baumkronen (+2 Karten je Art),
  Fels mit 80 statt 20 Facetten, mehrlappiger Busch, Schornsteine und
  Rueckwand-Fachwerk an haus/haus2. Dabei behoben: die Seitenfenster von
  haus/haus2 sassen IN der Wand (samt Fensterlicht-Anker unsichtbar) und
  stehen jetzt vor der Flaeche; das Glas der x-Seiten-Fenster sank auf der
  falschen Achse ein.

- Runde H, Welle 4: die zuletzt offenen Punkte sind erledigt —
  Struktur-Generatoren fuer Burg, Werft und Kloster (neue Flaechen-
  Varianten), genBlattstadt mit echtem Gassennetz in Blattkoordinaten,
  Drift-Animation an Bruchkanten (Shader-Patch aus der Bruchmaske),
  Detailstufen fuer ferne Terrain-Patches (bis -72 % Dreiecke auf 1024er
  Karten, nahtfrei ueber angepasste Randindizes) und regionsweises Undo
  (Pinselstrich auf 1024er: 6,7 kB statt 4,2 MB).
  Offen bleibt nur die Sichtpruefung im Browser (Checkliste in PR #806).

- Runde H, Welle 3 (Weltausbau + Ghibli-Bildaufbau) ist fertig: VFX-System
  mit Wetter (Regen/Schnee/Blueten/Sporen/Staub, Arbor-Lichtflug), Godrays,
  Farbskript, Papierkante, gemalte Wasserstreifen; Weltgenerator ("Welt
  wuerfeln") und Wegsuche-Werkzeug; Marker mit Beschriftung, Stempel-
  Bibliothek, Autosave, Hoehenkarten-Import; 164 weitere Objekte (272 Pools);
  Arbor-Netzwerk und Ranken-Alterung; Palettenbindung, bildraumfeste
  Malschicht und Multiplane-Tiefenbaender; Aufnahme-Modus (Taste C) und
  Bewegungsdisziplin (ruhige Karte, wenige Boeen-Nester, seltener fliegende
  Voegel). Neue Karten starten mit aktivem Ghibli-Bildaufbau, geladene
  Altkarten bleiben unveraendert.

- Runde H (Weltausbau) ist in Arbeit. Fertig: Kartengroesse 256/512/1024
  (Terrain in Patches, Format v4), 25 Biome mit eigenen Hoehenprofilen und
  Schneeauflage, Arbor als echte Lichtquelle (Kanon: der weisse Baum haelt
  den zerrissenen Planeten zusammen und spendet Licht), Ranken mit
  Zugpunkten/Kernneigung/Zusammenwachsen, Bruchkanten-Werkzeug samt
  Wasseraussparung, 58 neue Objekte (Wehrbau, Maritim, Bruecken).
  Offen: die restlichen Objektbuendel des Katalogs (Arbor-Assets,
  Biom-Spezifika, Ruinen/Natur/Requisiten) und die Struktur-Generatoren
  genBurg/genWerft/genBlattstadt. Details in
  `docs/engineering/terra-objektkatalog.md`.

- Runde G (Setting-Ausbau) ist abgeschlossen: fuenfte Tageszeit Nacht
  (deterministische Sterne, Mond = Sonnenscheibe, selbstleuchtende Ranken,
  Fensterglut 3.2), Ranken-Parameter (dicke, stil geflochten/glatt,
  Luftwurzeln, Stadt-Baustil/-Dichte, Wendeltreppe, Haengebruecken),
  fuenf Biome ueber die BIOME-Registry, Schwebeinseln als Objekt-Variante.
  Damit ist der Bearbeitungsplan C-G vollstaendig abgearbeitet.

- Runde F (Look) ist abgeschlossen: kuehle Schatten im Wrap-Licht
  (schattenKuehl je Tageszeit), niederfrequente Farbdrift in Terrain und
  Malschicht, Kronen-Normalen von der Huellkugel (oval-Stauchung fuer
  Nadel/Zypresse), Kalibrier-Kommentare + sanfte satMitte-Korrekturen.

- Runde E (Editierbarkeit/Format) ist abgeschlossen: Bestueckung ortsstabil
  gehasht (Punktverschieben wuerfelt nicht mehr das ganze Element um; alte
  Karten wuerfeln beim ersten Laden einmalig um), Punkte einfuegen
  (Doppelklick aufs Segment) und loeschen (aktiver Griff + Entf),
  Speicherformat v3 mit hoehenDelta (nur Pinsel-Aenderungen), nurTyp im
  Objekt-Schema.

- Runde D (Performance/Ergonomie) ist abgeschlossen: Slider-Debouncing
  (Vorschau bei input, voller Commit bei change), bereichsbeschraenkte
  Terrain-Updates beim schweren Commit, Depth-only-Prepass fuer den
  Kanten-Pass, ein Mesh je Viertel-Gassennetz, Undo mit Copy-on-Write
  fuer Hoehen, seedZaehler im Speicherformat, Viertel-Netz wandert beim
  Griffziehen live mit.
- Runde C (Reparatur) ist abgeschlossen: UV-Durchreichung in `mergeGeos`
  (Kronen/Gras/Farn/Wind waren vorher wirkungslos), Plateau-Haengebewuchs im
  Mesh, geteiltes Flussmaterial, Terrain-Pinsel regeneriert Elemente,
  atomares Laden, opake Ranke mit Dither-Auslauf, toter Code entfernt.
- Ungeklaerte Performance-Frage aus der Einzeldatei-Zeit: 3-4 fps bei nur
  ~200k Dreiecken deuten auf fehlende GPU-Beschleunigung der Testumgebung.
  Pruefung ueber `WEBGL_debug_renderer_info` (steht dort llvmpipe oder
  SwiftShader, liegt es an der Umgebung); vor dieser Klaerung keine weitere
  GPU-Optimierung investieren.
