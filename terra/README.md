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
Auswahl, Strg+Z / Strg+Y fuer Undo/Redo.

Untere Leiste: Seed, Tageszeit (Morgen/Mittag/Abendrot/Nebel), Raster,
Effekte (Nachbearbeitung an/aus), Speichern/Laden (JSON) und PNG-Export.
Karten aus der frueheren Einzeldatei-Fassung (`terra.html`) laden weiterhin.

## Offener Stand

- Runde C (Reparatur) ist abgeschlossen: UV-Durchreichung in `mergeGeos`
  (Kronen/Gras/Farn/Wind waren vorher wirkungslos), Plateau-Haengebewuchs im
  Mesh, geteiltes Flussmaterial, Terrain-Pinsel regeneriert Elemente,
  atomares Laden, opake Ranke mit Dither-Auslauf, toter Code entfernt.
- Ungeklaerte Performance-Frage aus der Einzeldatei-Zeit: 3-4 fps bei nur
  ~200k Dreiecken deuten auf fehlende GPU-Beschleunigung der Testumgebung.
  Pruefung ueber `WEBGL_debug_renderer_info` (steht dort llvmpipe oder
  SwiftShader, liegt es an der Umgebung); vor dieser Klaerung keine weitere
  GPU-Optimierung investieren.
